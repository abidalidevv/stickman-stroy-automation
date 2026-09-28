/**
 * STICKMAN STUDIO — DATABASE & FILESYSTEM RECONCILIATION ENGINE
 * Runs on Studio startup and on-demand:
 * 1. Reconciles stale worker leases and in-flight jobs after unexpected shutdown
 * 2. Audits DB prompt records vs physical disk assets in central_images
 * 3. Detects orphan files, missing DB assets, 0-byte corrupt files
 * 4. Ensures project directories are intact without deleting user data
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('./logger');

const PROJECT_SUBDIRS = [
  'central_images',
  'downloads_raw',
  'characters',
  'captions',
  'sfx',
  'music',
  'audio',
  'renders'
];

let lastReport = {
  timestamp: null,
  status: 'PENDING',
  stale_jobs_recovered: 0,
  stale_workers_reset: 0,
  projects_checked: 0,
  prompts_checked: 0,
  missing_disk_assets: [],
  orphan_disk_files: [],
  corrupt_files: [],
  repaired_prompts: []
};

async function reconcileStartup() {
  const startTime = Date.now();
  const nowIso = new Date().toISOString();
  logger.info('RECONCILIATION', 'Starting startup reconciliation audit...');

  const report = {
    timestamp: nowIso,
    status: 'IN_PROGRESS',
    stale_jobs_recovered: 0,
    stale_workers_reset: 0,
    projects_checked: 0,
    prompts_checked: 0,
    missing_disk_assets: [],
    orphan_disk_files: [],
    corrupt_files: [],
    repaired_prompts: []
  };

  try {
    // 1. Reconcile stale in-flight jobs from prior crashes
    const staleJobs = await db.all(`
      SELECT * FROM jobs 
      WHERE status IN ('ASSIGNED', 'ACKNOWLEDGED', 'GENERATING', 'DOWNLOADING')
    `);

    for (const job of staleJobs) {
      logger.warn('RECONCILIATION', `Reconciling unfinalized job ${job.id} (Prompt ${job.prompt_id}) from previous process session`);
      await db.run(`
        UPDATE jobs SET status = 'CANCELLED', last_error = 'Studio process restart recovery', updated_at = ? 
        WHERE id = ?
      `, [nowIso, job.id]);

      // Move prompt back to REPAIR_PENDING so another worker can complete it cleanly
      await db.run(`
        UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? 
        WHERE id = ? AND status != 'COMPLETED'
      `, [nowIso, job.prompt_id]);

      report.stale_jobs_recovered++;
      report.repaired_prompts.push(job.prompt_id);
    }

    // 2. Reset active jobs on workers
    const activeWorkers = await db.all(`SELECT id FROM workers WHERE active_job_id IS NOT NULL`);
    for (const w of activeWorkers) {
      await db.run(`UPDATE workers SET active_job_id = NULL, status = 'IDLE', updated_at = ? WHERE id = ?`, [nowIso, w.id]);
      report.stale_workers_reset++;
    }

    // 3. Audit all projects and physical directory assets
    const projects = await db.all(`SELECT * FROM projects`);
    report.projects_checked = projects.length;

    for (const proj of projects) {
      const projDir = proj.directory_path;
      if (!fs.existsSync(projDir)) {
        logger.warn('RECONCILIATION', `Project directory missing on disk: ${projDir}`);
        continue;
      }

      // Ensure all 8 canonical subdirectories exist
      for (const sub of PROJECT_SUBDIRS) {
        const subPath = path.join(projDir, sub);
        if (!fs.existsSync(subPath)) {
          fs.mkdirSync(subPath, { recursive: true });
        }
      }

      // Audit prompts in this project
      const prompts = await db.all(`SELECT * FROM prompts WHERE project_id = ?`, [proj.id]);
      const centralDir = path.join(projDir, 'central_images');
      const diskFiles = fs.existsSync(centralDir) ? fs.readdirSync(centralDir) : [];

      for (const p of prompts) {
        report.prompts_checked++;
        if (p.status === 'COMPLETED') {
          if (!p.file_path) {
            report.missing_disk_assets.push({ prompt_id: p.id, prompt_id_str: p.prompt_id_str, reason: 'No file_path recorded in DB' });
            await db.run(`UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? WHERE id = ?`, [nowIso, p.id]);
          } else if (!fs.existsSync(p.file_path)) {
            // Check if it exists in central_images by filename
            const expectedFile = `${p.prompt_id_str}_${proj.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.webp`;
            const altPath = path.join(centralDir, expectedFile);
            if (fs.existsSync(altPath)) {
              await db.run(`UPDATE prompts SET file_path = ?, updated_at = ? WHERE id = ?`, [altPath, nowIso, p.id]);
            } else {
              report.missing_disk_assets.push({ prompt_id: p.id, prompt_id_str: p.prompt_id_str, path: p.file_path, reason: 'File missing on disk' });
              await db.run(`UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? WHERE id = ?`, [nowIso, p.id]);
            }
          } else {
            // Check file size (corrupt detection)
            const stat = fs.statSync(p.file_path);
            if (stat.size === 0) {
              report.corrupt_files.push({ prompt_id: p.id, path: p.file_path, size: 0 });
              await db.run(`UPDATE prompts SET status = 'REPAIR_PENDING', updated_at = ? WHERE id = ?`, [nowIso, p.id]);
            }
          }
        }
      }

      // Check for orphan disk files in central_images
      for (const df of diskFiles) {
        const promptMatch = prompts.find(p => p.file_path && path.basename(p.file_path) === df);
        if (!promptMatch) {
          report.orphan_disk_files.push({ project_id: proj.id, filename: df, path: path.join(centralDir, df) });
        }
      }
    }

    report.status = 'COMPLETED';
    report.duration_ms = Date.now() - startTime;
    lastReport = report;

    logger.info('RECONCILIATION', `Startup audit complete in ${report.duration_ms}ms: ${report.stale_jobs_recovered} stale jobs recovered, ${report.missing_disk_assets.length} missing assets flagged, ${report.orphan_disk_files.length} orphan files noted.`);
    return report;
  } catch (err) {
    logger.error('RECONCILIATION', 'Error during startup reconciliation', err);
    report.status = 'ERROR';
    report.error = err.message;
    lastReport = report;
    return report;
  }
}

function getReconciliationReport() {
  return lastReport;
}

module.exports = {
  reconcileStartup,
  getReconciliationReport
};
