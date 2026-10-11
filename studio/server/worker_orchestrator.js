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

  // Resolve target project: explicit or latest ACTIVE
  let targetProjectId = requestedProjectId;
  if (!targetProjectId) {
    const latestActive = await db.get(`SELECT id FROM projects WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`);
    if (latestActive) {
      targetProjectId = latestActive.id;
    }
  }

  if (!targetProjectId) {
    return { job: null, status: 'IDLE', message: 'No active project' };
  }

  // 1. PRE-FLIGHT CHECK: Ensure character reference is READY for this project
  const project = await db.get(`SELECT * FROM projects WHERE id = ?`, [targetProjectId]);
  if (project && project.character_id && (worker.reference_status !== 'READY' || worker.active_project_id !== targetProjectId)) {
    const charRef = await db.get(`SELECT * FROM character_references WHERE id = ?`, [project.character_id]);
    return {
      job: {
        job_id: `ref_init_${Date.now()}`,
        project_id: targetProjectId,
        character_id: project.character_id,
        character_name: charRef ? charRef.character_name : 'Stickman',
        image_url: `/api/v1/projects/${targetProjectId}/character-reference`,
        type: 'INITIALIZE_REFERENCE'
      }
    };
  }

  // 2. CHECK ACTIVE IN-FLIGHT LEASED BATCH (Returns FULL batch of up to 50 prompts)
  let activeJobs = await db.all(`
    SELECT j.*, p.prompt_text, p.prompt_index, p.prompt_id_str, pr.name as project_name, pr.directory_path
    FROM jobs j
    JOIN prompts p ON j.prompt_id = p.id
    JOIN projects pr ON j.project_id = pr.id
    WHERE j.worker_id = ? AND j.status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
      AND j.lease_expires_at > ? AND j.project_id = ?
    ORDER BY p.prompt_index ASC LIMIT 50
  `, [id, now, targetProjectId]);

  if (activeJobs && activeJobs.length > 0) {
    const firstJob = activeJobs[0];
    const batchId = worker.active_job_id || `batch_${targetProjectId}_${id}_${Date.now()}`;
    return {
      job: {
        job_id: batchId,
        project_id: firstJob.project_id,
        project_name: firstJob.project_name,
        prompt_id: firstJob.prompt_id,
        prompt_index: firstJob.prompt_index,
        prompt_id_str: firstJob.prompt_id_str,
        prompt_text: firstJob.prompt_text,
        batch_size: activeJobs.length,
        total_prompts: activeJobs.length,
        prompts: activeJobs.map(j => ({
          job_id: j.id,
          prompt_id: j.prompt_id,
          prompt_index: j.prompt_index,
          prompt_id_str: j.prompt_id_str,
          prompt_text: j.prompt_text
        })),
        type: 'PROMPT_GENERATION'
      }
    };
  }

  // 3. CHECK ASSIGNED PROMPTS QUEUE (Batch of up to 50 prompts assigned to this worker)
  let candidatePrompts = await db.all(`
    SELECT p.*, pr.name as project_name, pr.directory_path, pr.character_id
    FROM prompts p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.assigned_worker_id = ? AND p.status IN ('QUEUED', 'ASSIGNED', 'PENDING') AND pr.id = ?
    ORDER BY p.prompt_index ASC LIMIT 50
  `, [id, targetProjectId]);

  // 4. CHECK UNASSIGNED QUEUED POOL (Auto-recycle for free workers when batch finishes)
  if (!candidatePrompts || candidatePrompts.length === 0) {
    candidatePrompts = await db.all(`
      SELECT p.*, pr.name as project_name, pr.directory_path, pr.character_id
      FROM prompts p
      JOIN projects pr ON p.project_id = pr.id
      WHERE (p.assigned_worker_id IS NULL OR p.assigned_worker_id = '')
        AND p.status IN ('QUEUED', 'ASSIGNED', 'PENDING') AND pr.id = ?
      ORDER BY p.prompt_index ASC LIMIT 50
    `, [targetProjectId]);
  }

  // 5. CHECK FAILED / REPAIR QUEUE (Auto-retry batch for free workers)
  if (!candidatePrompts || candidatePrompts.length === 0) {
    candidatePrompts = await db.all(`
      SELECT p.*, pr.name as project_name, pr.directory_path, pr.character_id
      FROM prompts p
      JOIN projects pr ON p.project_id = pr.id
      WHERE p.status IN ('REPAIR_PENDING', 'FAILED') AND pr.id = ?
      ORDER BY p.prompt_index ASC LIMIT 50
    `, [targetProjectId]);
  }

  // If prompts found: bundle them into a 50-prompt batch!
  if (candidatePrompts && candidatePrompts.length > 0) {
    const firstPrompt = candidatePrompts[0];
    const batchId = `batch_${firstPrompt.project_id}_${id}_${Date.now()}`;
    const leaseDurationSec = Math.max(1800, candidatePrompts.length * 120);
    const leaseExpires = new Date(Date.now() + leaseDurationSec * 1000).toISOString();

    for (const p of candidatePrompts) {
      const pJobId = `job_${p.project_id}_${id}_${p.prompt_index}`;
      await db.run(`
        INSERT OR REPLACE INTO jobs (
          id, project_id, prompt_id, worker_id, provider,
          status, lease_owner, lease_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?, ?)
      `, [pJobId, p.project_id, p.id, id, worker.provider, id, leaseExpires, now, now]);

      await db.run(`
        UPDATE prompts SET status = 'GENERATING', assigned_worker_id = ?, updated_at = ? WHERE id = ?
      `, [id, now, p.id]);
    }

    await db.run(`UPDATE workers SET active_job_id = ?, status = 'BUSY', active_project_id = ?, updated_at = ? WHERE id = ?`, [batchId, targetProjectId, now, id]);

    return {
      job: {
        job_id: batchId,
        project_id: firstPrompt.project_id,
        project_name: firstPrompt.project_name,
        prompt_id: firstPrompt.id,
        prompt_index: firstPrompt.prompt_index,
        prompt_id_str: firstPrompt.prompt_id_str,
        prompt_text: firstPrompt.prompt_text,
        batch_size: candidatePrompts.length,
        total_prompts: candidatePrompts.length,
        prompts: candidatePrompts.map(p => ({
          job_id: `job_${p.project_id}_${id}_${p.prompt_index}`,
          prompt_id: p.id,
          prompt_index: p.prompt_index,
          prompt_id_str: p.prompt_id_str,
          prompt_text: p.prompt_text
        })),
        type: 'PROMPT_GENERATION'
      }
    };
  }

  // All prompts complete
  await db.run(`UPDATE workers SET active_job_id = NULL, status = 'IDLE', updated_at = ? WHERE id = ?`, [now, id]);
  return { job: null, status: 'IDLE', message: 'All prompts completed in project' };
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

  // Handle batch completion from extension
  if (jobId.startsWith('batch_')) {
    logger.info('WORKER_ORCHESTRATOR', `Batch ${jobId} completed by worker`);
    // Extract worker id from active_job_id or batch string
    let worker = await db.get('SELECT id FROM workers WHERE active_job_id = ?', [jobId]);
    const workerId = worker ? worker.id : (jobId.split('_')[2] || null);
    
    if (workerId) {
      // Find all in-flight jobs leased to this worker
      const activeJobs = await db.all(`
        SELECT id, prompt_id FROM jobs 
        WHERE worker_id = ? AND status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
      `, [workerId]);

      for (const aj of activeJobs) {
        await db.run("UPDATE jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?", [now, aj.id]);
        await db.run("UPDATE prompts SET status = 'COMPLETED', updated_at = ? WHERE id = ?", [now, aj.prompt_id]);
      }

      await db.run("UPDATE workers SET active_job_id = NULL, status = 'IDLE', updated_at = ? WHERE id = ?", [now, workerId]);
    }
    await db.run("UPDATE jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?", [now, jobId]);
    return { success: true, batch_completed: true };
  }

  const job = await db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
  if (!job) {
    logger.warn('WORKER_ORCHESTRATOR', `Job ${jobId} not found for completion (idempotent ignore)`);
    return { success: true, ignored: true };
  }

  if (job.status === 'COMPLETED') {
    logger.info('WORKER_ORCHESTRATOR', `Job ${jobId} was already completed (idempotent duplicate request)`);
    return { success: true, idempotent: true };
  }

  const prompt = await db.get('SELECT * FROM prompts WHERE id = ?', [job.prompt_id]);
  if (!prompt) throw new Error(`Prompt ${job.prompt_id} not found for job ${jobId}`);

  let actualFilePath = filePath || file_path || '';
  let actualFileName = fileName || filename || (actualFilePath ? path.basename(actualFilePath) : '');

  // 1. Physical existence verification across candidate directories
  if (!actualFilePath || !fs.existsSync(actualFilePath)) {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [job.project_id]);
    const candidates = [
      actualFilePath,
      project ? path.join(project.directory_path, 'central_images', actualFileName) : null,
      path.join(ingestionManager.downloadsDir, actualFileName),
      project ? path.join(ingestionManager.downloadsDir, project.name, actualFileName) : null,
      path.join(ingestionManager.downloadsDir, 'StickmanStudio', actualFileName)
    ].filter(Boolean);

    let found = candidates.find(c => fs.existsSync(c));

    if (!found) {
      const searchDirs = [
        project ? path.join(project.directory_path, 'central_images') : null,
        project ? path.join(ingestionManager.downloadsDir, project.name) : null,
        path.join(ingestionManager.downloadsDir, 'StickmanStudio'),
        ingestionManager.downloadsDir
      ].filter(Boolean);

      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          const match = files.find(f => f.startsWith(prompt.prompt_id_str) && /\.(png|jpg|jpeg|webp)$/i.test(f));
          if (match) {
            found = path.join(dir, match);
            actualFileName = match;
            break;
          }
        }
      }
    }

    if (found) {
      actualFilePath = found;
    }
  }

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [job.project_id]);
  let finalCentralPath = actualFilePath;

  if (actualFilePath && fs.existsSync(actualFilePath) && project) {
    const centralDir = path.join(project.directory_path, 'central_images');
    if (!fs.existsSync(centralDir)) fs.mkdirSync(centralDir, { recursive: true });
    finalCentralPath = path.join(centralDir, path.basename(actualFilePath));
    if (path.resolve(actualFilePath) !== path.resolve(finalCentralPath)) {
      try {
        fs.copyFileSync(actualFilePath, finalCentralPath);
      } catch (cpErr) {
        logger.warn('WORKER_ORCHESTRATOR', `Could not copy to central_images: ${cpErr.message}`);
        finalCentralPath = actualFilePath;
      }
    }
  }

  await db.run(`
    UPDATE jobs SET 
      status = 'COMPLETED',
      updated_at = ?
    WHERE id = ?
  `, [now, jobId]);

  await db.run(`
    UPDATE prompts SET 
      status = 'COMPLETED',
      file_path = ?,
      file_name = ?,
      updated_at = ?
    WHERE id = ?
  `, [finalCentralPath, actualFileName || null, now, job.prompt_id]);

  // Check if all jobs in this worker's current batch are completed
  const remainingActive = await db.get(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE worker_id = ? AND status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
  `, [job.worker_id]);

  if (!remainingActive || remainingActive.count === 0) {
    await db.run(`
      UPDATE workers SET active_job_id = NULL, status = 'IDLE', updated_at = ? WHERE id = ?
    `, [now, job.worker_id]);
    logger.info('WORKER_ORCHESTRATOR', `Worker ${job.worker_id} finished all assigned jobs and is now IDLE`);
  }

  return { success: true, prompt_id: job.prompt_id, image_file_path: finalCentralPath };
}

async function failJob(jobId, { error = 'Unknown error', canRetry = true }) {
  const now = new Date().toISOString();

  if (jobId.startsWith('batch_')) {
    logger.warn('WORKER_ORCHESTRATOR', `Batch ${jobId} failed: ${error}`);
    const worker = await db.get('SELECT id FROM workers WHERE active_job_id = ?', [jobId]);
    if (worker) {
      await db.run("UPDATE workers SET active_job_id = NULL, status = 'IDLE', error_count = error_count + 1, updated_at = ? WHERE id = ?", [now, worker.id]);
      await db.run("UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? WHERE assigned_worker_id = ? AND status = 'GENERATING'", [now, worker.id]);
    }
    return { success: true, batch_failed: true };
  }

  const job = await db.get(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
  if (!job) {
    logger.warn('WORKER_ORCHESTRATOR', `Job ${jobId} not found for failure report`);
    return { success: true, ignored: true };
  }

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

  const remainingActive = await db.get(`
    SELECT COUNT(*) as count FROM jobs 
    WHERE worker_id = ? AND status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
  `, [job.worker_id]);

  if (!remainingActive || remainingActive.count === 0) {
    await db.run(`
      UPDATE workers SET active_job_id = NULL, status = 'IDLE', error_count = error_count + 1, updated_at = ? WHERE id = ?
    `, [now, job.worker_id]);
  }

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
