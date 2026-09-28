const db = require('./db');
const logger = require('./logger');

const LEASE_DURATION_SEC = 120;
const HEARTBEAT_TIMEOUT_SEC = 30;

async function registerWorker({ id, provider, profile_name = null }) {
  const workerId = id.toUpperCase();
  const profile = profile_name || `Worker-${workerId.replace(/\D/g, '').padStart(2, '0')}`;
  const now = new Date().toISOString();

  await db.run(`
    INSERT INTO workers (
      id, provider, status, profile_name, profile_path,
      reference_status, active_character_version, last_heartbeat,
      registered_at, updated_at
    ) VALUES (?, ?, 'IDLE', ?, ?, 'NOT_READY', 0, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      last_heartbeat = excluded.last_heartbeat,
      updated_at = excluded.updated_at
  `, [workerId, provider, profile, `Workers/${profile}`, now, now, now]);

  logger.info('WORKER_ORCHESTRATOR', `Worker ${workerId} (${provider}) registered.`);
  return db.get(`SELECT * FROM workers WHERE id = ?`, [workerId]);
}

async function recordHeartbeat({ id, status = 'IDLE', current_url = null, active_job_id = null }) {
  const workerId = id.toUpperCase();
  const now = new Date().toISOString();

  await db.run(`
    UPDATE workers SET
      status = ?,
      last_seen_url = COALESCE(?, last_seen_url),
      active_job_id = COALESCE(?, active_job_id),
      last_heartbeat = ?,
      updated_at = ?
    WHERE id = ?
  `, [status, current_url, active_job_id, now, now, workerId]);

  if (active_job_id) {
    const newExpires = new Date(Date.now() + LEASE_DURATION_SEC * 1000).toISOString();
    await db.run(`
      UPDATE jobs SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND lease_owner = ?
    `, [newExpires, now, active_job_id, workerId]);
  }

  return { success: true };
}

async function updateReferenceState(workerId, { project_id, status, version = 1 }) {
  const now = new Date().toISOString();
  await db.run(`
    UPDATE workers SET
      reference_status = ?,
      active_character_version = ?,
      active_project_id = ?,
      updated_at = ?
    WHERE id = ?
  `, [status, version, project_id, now, workerId.toUpperCase()]);

  logger.info('WORKER_ORCHESTRATOR', `Worker ${workerId} reference state updated to ${status} (v${version})`);
  return { success: true };
}

async function updateLoginState(workerId, { status }) {
  const now = new Date().toISOString();
  const workerStatus = status === 'LOGIN_REQUIRED' ? 'LOGIN_REQUIRED' : 'READY';

  await db.run(`
    UPDATE workers SET status = ?, last_heartbeat = ?, updated_at = ? WHERE id = ?
  `, [workerStatus, now, now, workerId.toUpperCase()]);

  logger.warn('WORKER_ORCHESTRATOR', `Worker ${workerId} reported login status: ${workerStatus}`);
  return { success: true };
}

async function assignRangesToProject(projectId, workerIds = []) {
  if (!workerIds || workerIds.length === 0) {
    throw new Error('No workers specified for range assignment');
  }

  const prompts = await db.all(`
    SELECT * FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC
  `, [projectId]);

  if (prompts.length === 0) {
    throw new Error('No prompts found in project to allocate');
  }

  const N = prompts.length;
  const W = workerIds.length;
  const base = Math.floor(N / W);
  const remainder = N % W;

  let promptCursor = 0;
  const allocations = [];

  for (let i = 0; i < W; i++) {
    const workerId = workerIds[i].toUpperCase();
    const count = i < remainder ? base + 1 : base;
    const slice = prompts.slice(promptCursor, promptCursor + count);
    promptCursor += count;

    if (slice.length > 0) {
      const startIndex = slice[0].prompt_index;
      const endIndex = slice[slice.length - 1].prompt_index;
      const sliceIds = slice.map(p => p.id);

      await db.run(`
        UPDATE prompts SET assigned_worker_id = ? 
        WHERE id IN (${sliceIds.map(() => '?').join(',')}) AND status = 'QUEUED'
      `, [workerId, ...sliceIds]);

      allocations.push({
        worker_id: workerId,
        count: slice.length,
        range_start: startIndex,
        range_end: endIndex
      });
    }
  }

  logger.info('WORKER_ORCHESTRATOR', `Assigned ${N} prompts across ${W} workers for project ${projectId}`, allocations);
  return allocations;
}

async function getNextJob(workerId, requestedProjectId = null) {
  const id = workerId.toUpperCase();
  const worker = await db.get(`SELECT * FROM workers WHERE id = ?`, [id]);
  if (!worker) return { job: null, message: 'Worker not registered' };

  if (worker.status === 'LOGIN_REQUIRED') {
    return { job: null, message: 'Login required', status: 'LOGIN_REQUIRED' };
  }

  const now = new Date().toISOString();

  // 1. Check for active in-flight leased job
  const activeJob = await db.get(`
    SELECT j.*, p.prompt_text, p.prompt_index, p.prompt_id_str, pr.name as project_name, pr.directory_path
    FROM jobs j
    JOIN prompts p ON j.prompt_id = p.id
    JOIN projects pr ON j.project_id = pr.id
    WHERE j.worker_id = ? AND j.status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
      AND j.lease_expires_at > ?
    ORDER BY j.created_at DESC LIMIT 1
  `, [id, now]);

  if (activeJob) {
    return {
      job: {
        job_id: activeJob.id,
        project_id: activeJob.project_id,
        project_name: activeJob.project_name,
        prompt_id: activeJob.prompt_id,
        prompt_index: activeJob.prompt_index,
        prompt_id_str: activeJob.prompt_id_str,
        prompt_text: activeJob.prompt_text,
        type: 'PROMPT_GENERATION'
      }
    };
  }

  // 2. High-Priority Repair Queue check
  let repairQuery = `
    SELECT p.*, pr.name as project_name, pr.directory_path, pr.character_id
    FROM prompts p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.status = 'REPAIR_PENDING' AND pr.status = 'ACTIVE'
  `;
  const repairParams = [];
  if (requestedProjectId) {
    repairQuery += ` AND p.project_id = ? `;
    repairParams.push(requestedProjectId);
  }
  repairQuery += ` ORDER BY pr.created_at DESC, p.prompt_index ASC LIMIT 1 `;
  const repairPrompt = await db.get(repairQuery, repairParams);

  if (repairPrompt) {
    // PRE-FLIGHT CHECK: Ensure character reference is READY for this project
    if (repairPrompt.character_id && (worker.reference_status !== 'READY' || worker.active_project_id !== repairPrompt.project_id)) {
      const charRef = await db.get(`SELECT * FROM character_references WHERE id = ?`, [repairPrompt.character_id]);
      return {
        job: {
          job_id: `ref_init_${Date.now()}`,
          project_id: repairPrompt.project_id,
          character_id: repairPrompt.character_id,
          character_name: charRef ? charRef.character_name : 'Stickman',
          image_url: `/api/v1/projects/${repairPrompt.project_id}/character-reference`,
          type: 'INITIALIZE_REFERENCE'
        }
      };
    }

    const jobId = `job_rep_${Date.now()}_${id}`;
    const leaseExpires = new Date(Date.now() + LEASE_DURATION_SEC * 1000).toISOString();

    await db.run(`
      INSERT INTO jobs (
        id, project_id, prompt_id, worker_id, provider,
        status, lease_owner, lease_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?, ?)
    `, [jobId, repairPrompt.project_id, repairPrompt.id, id, worker.provider, id, leaseExpires, now, now]);

    await db.run(`
      UPDATE prompts SET status = 'ASSIGNED', assigned_worker_id = ?, updated_at = ? WHERE id = ?
    `, [id, now, repairPrompt.id]);

    await db.run(`UPDATE workers SET active_job_id = ? WHERE id = ?`, [jobId, id]);

    return {
      job: {
        job_id: jobId,
        project_id: repairPrompt.project_id,
        project_name: repairPrompt.project_name,
        prompt_id: repairPrompt.id,
        prompt_index: repairPrompt.prompt_index,
        prompt_id_str: repairPrompt.prompt_id_str,
        prompt_text: repairPrompt.prompt_text,
        type: 'PROMPT_GENERATION'
      }
    };
  }

  // 3. Sequential Fixed-Range Prompt Allocation
  let nextQuery = `
    SELECT p.*, pr.name as project_name, pr.directory_path, pr.character_id
    FROM prompts p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.assigned_worker_id = ? AND p.status = 'QUEUED' AND pr.status = 'ACTIVE'
  `;
  const nextParams = [id];
  if (requestedProjectId) {
    nextQuery += ` AND p.project_id = ? `;
    nextParams.push(requestedProjectId);
  }
  nextQuery += ` ORDER BY pr.created_at DESC, p.prompt_index ASC LIMIT 1 `;
  const nextPrompt = await db.get(nextQuery, nextParams);

  if (nextPrompt) {
    if (nextPrompt.character_id && (worker.reference_status !== 'READY' || worker.active_project_id !== nextPrompt.project_id)) {
      const charRef = await db.get(`SELECT * FROM character_references WHERE id = ?`, [nextPrompt.character_id]);
      return {
        job: {
          job_id: `ref_init_${Date.now()}`,
          project_id: nextPrompt.project_id,
          character_id: nextPrompt.character_id,
          character_name: charRef ? charRef.character_name : 'Stickman',
          image_url: `/api/v1/projects/${nextPrompt.project_id}/character-reference`,
          type: 'INITIALIZE_REFERENCE'
        }
      };
    }

    const jobId = `job_${Date.now()}_${id}_${nextPrompt.prompt_id_str}`;
    const leaseExpires = new Date(Date.now() + LEASE_DURATION_SEC * 1000).toISOString();

    await db.run(`
      INSERT INTO jobs (
        id, project_id, prompt_id, worker_id, provider,
        status, lease_owner, lease_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?, ?)
    `, [jobId, nextPrompt.project_id, nextPrompt.id, id, worker.provider, id, leaseExpires, now, now]);

    await db.run(`
      UPDATE prompts SET status = 'ASSIGNED', updated_at = ? WHERE id = ?
    `, [now, nextPrompt.id]);

    await db.run(`UPDATE workers SET active_job_id = ? WHERE id = ?`, [jobId, id]);

    return {
      job: {
        job_id: jobId,
        project_id: nextPrompt.project_id,
        project_name: nextPrompt.project_name,
        prompt_id: nextPrompt.id,
        prompt_index: nextPrompt.prompt_index,
        prompt_id_str: nextPrompt.prompt_id_str,
        prompt_text: nextPrompt.prompt_text,
        type: 'PROMPT_GENERATION'
      }
    };
  }

  return { job: null, status: 'IDLE' };
}

async function acknowledgeJob(jobId, workerId) {
  const now = new Date().toISOString();
  await db.run(`
    UPDATE jobs SET status = 'ACKNOWLEDGED', updated_at = ? WHERE id = ? AND worker_id = ?
  `, [now, jobId, workerId.toUpperCase()]);
  return { success: true };
}

async function recordJobEvent(jobId, eventType, data = {}) {
  const now = new Date().toISOString();
  await db.run(`
    UPDATE jobs SET last_event = ?, updated_at = ? WHERE id = ?
  `, [`${eventType}: ${JSON.stringify(data).slice(0, 200)}`, now, jobId]);

  if (eventType === 'GENERATION_STARTED') {
    await db.run(`
      UPDATE prompts SET status = 'GENERATING', updated_at = ? 
      WHERE id = (SELECT prompt_id FROM jobs WHERE id = ?)
    `, [now, jobId]);
  } else if (eventType === 'DOWNLOAD_STARTED') {
    await db.run(`
      UPDATE prompts SET status = 'DOWNLOADING', updated_at = ? 
      WHERE id = (SELECT prompt_id FROM jobs WHERE id = ?)
    `, [now, jobId]);
  }

  logger.telemetry('JOB_EVENT', `Job ${jobId} -> ${eventType}`, data);
  return { success: true };
}

async function completeJob(jobId, { fileName, filename, filePath, file_path, fileSize = 0, file_size = 0, sha256 = null }) {
  const fs = require('fs');
  const path = require('path');
  const ingestionManager = require('./ingestion_manager');

  const now = new Date().toISOString();
  const job = await db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (job.status === 'COMPLETED') {
    logger.info('WORKER_ORCHESTRATOR', `Job ${jobId} was already completed (idempotent duplicate request)`);
    return { success: true, idempotent: true };
  }

  const prompt = await db.get('SELECT * FROM prompts WHERE id = ?', [job.prompt_id]);
  if (!prompt) throw new Error(`Prompt ${job.prompt_id} not found for job ${jobId}`);

  let actualFilePath = filePath || file_path || '';
  let actualFileName = fileName || filename || (actualFilePath ? path.basename(actualFilePath) : '');

  // 1. Physical existence verification
  if (!actualFilePath || !fs.existsSync(actualFilePath)) {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [job.project_id]);
    const candidates = [
      actualFilePath,
      project ? path.join(project.directory_path, 'central_images', actualFileName) : null,
      path.join(ingestionManager.downloadsDir, actualFileName)
    ].filter(Boolean);

    const found = candidates.find(c => fs.existsSync(c));
    if (!found) {
      throw new Error(`Cannot complete job ${jobId}: physical image file does not exist on disk at "${actualFilePath}"`);
    }
    actualFilePath = found;
  }

  // 2. Filename must map to the correct prompt ID
  const baseName = path.basename(actualFilePath);
  if (!baseName.startsWith(prompt.prompt_id_str)) {
    throw new Error(`Cannot complete job ${jobId}: filename "${baseName}" does not map to prompt ID "${prompt.prompt_id_str}"`);
  }

  // 3. Physical binary signature, dimensions, and server-side SHA-256 validation & central ingestion
  const ingestResult = await ingestionManager.ingestFileForPrompt(
    job.project_id,
    job.prompt_id,
    actualFilePath,
    { workerId: job.worker_id }
  );

  // 4. ONLY AFTER real file validation and central storage copy, mark COMPLETED
  await db.run(`
    UPDATE jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?
  `, [now, jobId]);

  await db.run(`UPDATE workers SET active_job_id = NULL, status = 'IDLE', updated_at = ? WHERE id = ?`, [now, job.worker_id]);

  logger.info('WORKER_ORCHESTRATOR', `Job ${jobId} physically validated & COMPLETED for prompt ${job.prompt_id} (${ingestResult.file_name})`);
  return { success: true, idempotent: false, ...ingestResult };
}

async function failJob(jobId, { error = 'Unknown error', canRetry = true }) {
  const now = new Date().toISOString();
  const job = await db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const nextAttempt = (job.attempt_count || 1) + 1;
  const isExhausted = nextAttempt > 3;

  await db.run(`
    UPDATE jobs SET 
      status = ?,
      last_error = ?,
      attempt_count = ?,
      updated_at = ?
    WHERE id = ?
  `, [isExhausted ? 'FAILED' : 'RETRYING', String(error), nextAttempt, now, jobId]);

  await db.run(`
    UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? WHERE id = ?
  `, [now, job.prompt_id]);

  await db.run(`
    UPDATE workers SET active_job_id = NULL, status = 'IDLE', error_count = error_count + 1, updated_at = ? WHERE id = ?
  `, [now, job.worker_id]);

  logger.warn('WORKER_ORCHESTRATOR', `Job ${jobId} failed (Attempt ${nextAttempt}/3): ${error}`);
  return { success: true, moved_to_repair: true };
}

// Background Lease Reaper Loop
async function reapExpiredLeases() {
  if (!db.raw()) return;
  const now = new Date().toISOString();
  const expiredJobs = await db.all(`
    SELECT j.*, w.last_heartbeat 
    FROM jobs j
    LEFT JOIN workers w ON j.worker_id = w.id
    WHERE j.status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
      AND j.lease_expires_at < ?
  `, [now]);

  for (const ej of expiredJobs) {
    logger.warn('LEASE_REAPER', `Reclaiming expired lease for job ${ej.id} (Worker ${ej.worker_id})`);
    await db.run(`UPDATE jobs SET status = 'CANCELLED', last_error = 'Lease expired', updated_at = ? WHERE id = ?`, [now, ej.id]);
    await db.run(`UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? WHERE id = ?`, [now, ej.prompt_id]);
    await db.run(`UPDATE workers SET active_job_id = NULL WHERE id = ?`, [ej.worker_id]);
  }

  const threshold = new Date(Date.now() - HEARTBEAT_TIMEOUT_SEC * 1000).toISOString();
  await db.run(`
    UPDATE workers SET status = 'OFFLINE', updated_at = ? 
    WHERE last_heartbeat < ? AND status NOT IN ('OFFLINE', 'PAUSED', 'LOGIN_REQUIRED')
  `, [now, threshold]);
}

const reaperInterval = setInterval(async () => {
  try {
    await reapExpiredLeases();
  } catch (err) {
    if (err && err.code === 'SQLITE_MISUSE') return;
    logger.error('LEASE_REAPER', 'Error in lease reaper loop', err);
  }
}, 10000);

function stopReaper() {
  clearInterval(reaperInterval);
}

module.exports = {
  registerWorker,
  recordHeartbeat,
  updateReferenceState,
  updateLoginState,
  assignRangesToProject,
  getNextJob,
  acknowledgeJob,
  recordJobEvent,
  completeJob,
  failJob,
  reapExpiredLeases,
  stopReaper
};
