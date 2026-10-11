/**
 * STICKMAN STUDIO — BROWSER PROFILE MANAGER (DYNAMIC WORKER FARM)
 * 
 * Supports dynamic worker provisioning from W01 to W10 (Max 10 active).
 * Each worker receives:
 * - Dedicated persistent Chrome user-data-dir (Workers/Worker-Wnn/)
 * - Isolated WORKER_ID configuration
 * - Chrome application launch with extension loaded
 * - Telemetry & hardware RAM monitoring
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');
const logger = require('./logger');
const db = require('./db');

const ROOT_DIR = process.env.STICKMAN_ROOT || path.resolve(__dirname, '../../');
const WORKERS_BASE_DIR = process.env.WORKERS_BASE_DIR || path.join(ROOT_DIR, 'Workers');
const EXTENSIONS_BASE_DIR = process.env.EXTENSIONS_BASE_DIR || path.join(ROOT_DIR, 'extensions');
const MAX_ACTIVE_WORKERS = 10;

class BrowserProfileManager {
  constructor() {
    this.activeProcesses = new Map(); // workerId -> { process, pid, provider, startTime, profileDir }
    this.chromePath = this.detectChromePath();
    this.ensureBaseDirectory();
  }

  ensureBaseDirectory() {
    if (!fs.existsSync(WORKERS_BASE_DIR)) {
      fs.mkdirSync(WORKERS_BASE_DIR, { recursive: true });
    }
  }

  detectChromePath() {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        logger.info('PROFILE_MANAGER', `Found browser executable: ${p}`);
        return p;
      }
    }

    logger.warn('PROFILE_MANAGER', 'No standard Chrome/Edge executable found in default paths.');
    return 'chrome';
  }

  getHardwareTelemetry() {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const totalGB = (totalMemBytes / (1024 ** 3)).toFixed(1);
    const freeGB = (freeMemBytes / (1024 ** 3)).toFixed(1);
    const usedGB = ((totalMemBytes - freeMemBytes) / (1024 ** 3)).toFixed(1);
    const activeCount = this.activeProcesses.size;

    let warning = null;
    if (parseFloat(freeGB) < 3.5) {
      warning = `Low available memory: ${freeGB} GB free. Concurrency pressure may cause disk paging.`;
    } else if (activeCount > 4) {
      warning = `High concurrency: ${activeCount} workers active on 16GB RAM. Monitor system responsiveness.`;
    }

    return {
      total_ram_gb: totalGB,
      free_ram_gb: freeGB,
      used_ram_gb: usedGB,
      active_workers: activeCount,
      max_allowed_workers: MAX_ACTIVE_WORKERS,
      warning
    };
  }

  getProfileDir(workerId) {
    const dir = path.join(WORKERS_BASE_DIR, `Worker-${workerId}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('PROFILE_MANAGER', `Auto-provisioned worker profile directory: ${dir}`);
    }
    return dir;
  }

  getBaseExtensionPath(provider) {
    const p = (provider || '').toLowerCase();
    if (p === 'flow') {
      return path.join(EXTENSIONS_BASE_DIR, 'veo-automation-with Mbmirza');
    } else if (p === 'meta') {
      return path.join(EXTENSIONS_BASE_DIR, 'meta automation');
    }
    return null;
  }

  copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '.venv') continue;
      const s = path.join(src, e.name);
      const d = path.join(dest, e.name);
      if (e.isDirectory()) {
        this.copyDirRecursive(s, d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  }

  prepareWorkerExtension(workerId, provider) {
    const prov = (provider || '').toLowerCase();
    const baseExtDir = this.getBaseExtensionPath(prov);
    if (!baseExtDir || !fs.existsSync(baseExtDir)) {
      throw new Error(`Base extension not found for provider '${provider}' at ${baseExtDir}`);
    }

    const profileDir = this.getProfileDir(workerId);
    const workerExtDir = path.join(profileDir, 'extension');

    // Check if worker extension already exists and matches target provider
    let needsProvisioning = !fs.existsSync(workerExtDir);
    const configPath = path.join(workerExtDir, 'worker-config.js');
    if (!needsProvisioning && fs.existsSync(configPath)) {
      try {
        const existingConfig = fs.readFileSync(configPath, 'utf8');
        if (!existingConfig.includes(`WORKER_ID = "${workerId}"`) || !existingConfig.includes(`PROVIDER = "${prov}"`)) {
          needsProvisioning = true;
          fs.rmSync(workerExtDir, { recursive: true, force: true });
        }
      } catch (e) {
        needsProvisioning = true;
      }
    }

    if (needsProvisioning) {
      logger.info('PROFILE_MANAGER', `Provisioning isolated extension for worker ${workerId} (${prov}) into ${workerExtDir}`);
      this.copyDirRecursive(baseExtDir, workerExtDir);
    }

    // Always ensure worker-config.js contains exact WORKER_ID and PROVIDER
    const configContent = `export const WORKER_ID = "${workerId}";\nexport const PROVIDER = "${prov}";\n`;
    fs.writeFileSync(configPath, configContent, 'utf8');

    return workerExtDir;
  }

  getTargetUrl(provider) {
    return provider === 'flow' ? 'https://flow.google.com/?pli=1' : 'https://www.meta.ai/';
  }

  validateWorkerId(workerId) {
    const match = workerId.match(/^W(0[1-9]|10)$/);
    if (!match) {
      throw new Error(`Invalid Worker ID '${workerId}'. Must be between W01 and W10.`);
    }
  }

  /**
   * Launch a dedicated browser instance for a worker
   */
  async launchWorker(workerId, provider) {
    this.validateWorkerId(workerId);

    if (this.activeProcesses.has(workerId)) {
      const procInfo = this.activeProcesses.get(workerId);
      logger.warn('PROFILE_MANAGER', `Worker ${workerId} is already running (PID: ${procInfo.pid})`);
      return { success: true, message: 'Already running', pid: procInfo.pid, workerId, provider };
    }

    if (this.activeProcesses.size >= MAX_ACTIVE_WORKERS) {
      throw new Error(`Maximum ${MAX_ACTIVE_WORKERS} active workers allowed. Cannot launch ${workerId}.`);
    }

    const profileDir = this.getProfileDir(workerId);
    const extensionPath = this.prepareWorkerExtension(workerId, provider);
    const targetUrl = this.getTargetUrl(provider);

    // Clean stray processes, locks, and stale session restore files
    this.cleanWorkerProcessesAndLocks(workerId);
    const sessionsDir = path.join(profileDir, 'Default', 'Sessions');
    if (fs.existsSync(sessionsDir)) {
      try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) {}
    }

    const args = [
      `--user-data-dir=${profileDir}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,820',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      targetUrl
    ];

    logger.info('PROFILE_MANAGER', `Spawning worker ${workerId} (${provider}) with profile: ${profileDir}`);

    const child = spawn(this.chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });

    const info = {
      workerId,
      provider,
      pid: child.pid,
      profileDir,
      startTime: new Date().toISOString()
    };

    this.activeProcesses.set(workerId, info);

    child.on('exit', (code, signal) => {
      logger.warn('PROFILE_MANAGER', `Worker ${workerId} browser exited (code: ${code}, signal: ${signal})`);
      this.activeProcesses.delete(workerId);
    });

    child.unref();

    return {
      success: true,
      workerId,
      provider,
      pid: child.pid,
      profileDir
    };
  }

  /**
   * Terminate a worker's browser process
   */
  async stopWorker(workerId) {
    const info = this.activeProcesses.get(workerId);
    if (!info) {
      return { success: false, message: `Worker ${workerId} is not running` };
    }

    logger.info('PROFILE_MANAGER', `Stopping worker ${workerId} (PID: ${info.pid})`);

    try {
      if (process.platform === 'win32') {
        exec(`taskkill /PID ${info.pid} /T /F`);
      } else {
        process.kill(info.pid, 'SIGTERM');
      }
    } catch (err) {
      logger.error('PROFILE_MANAGER', `Failed to kill process ${info.pid}: ${err.message}`);
    }

    this.activeProcesses.delete(workerId);
    return { success: true, workerId, stoppedPid: info.pid };
  }

  /**
   * Restart a worker process
   */
  async restartWorker(workerId, providerFallback = 'flow') {
    const existing = this.activeProcesses.get(workerId);
    const provider = existing ? existing.provider : providerFallback;
    if (existing) {
      await this.stopWorker(workerId);
      await new Promise(r => setTimeout(r, 1000));
    }
    return this.launchWorker(workerId, provider);
  }

  /**
   * Launch all configured workers up to MAX_ACTIVE_WORKERS
   */
  async launchAll(counts = { flow: 1, meta: 1 }) {
    const flowCount = parseInt(counts.flow, 10) || 0;
    const metaCount = parseInt(counts.meta, 10) || 0;
    const total = flowCount + metaCount;

    if (total > MAX_ACTIVE_WORKERS) {
      throw new Error(`Maximum ${MAX_ACTIVE_WORKERS} active workers allowed. Requested: ${total} (Flow: ${flowCount}, Meta: ${metaCount}). Rejecting configuration.`);
    }

    if (total <= 0) {
      throw new Error('At least 1 active worker must be configured.');
    }

    const results = [];
    let workerIndex = 1;

    for (let i = 0; i < flowCount; i++) {
      const workerId = `W${String(workerIndex).padStart(2, '0')}`;
      workerIndex++;
      try {
        const res = await this.launchWorker(workerId, 'flow');
        results.push(res);
      } catch (err) {
        results.push({ workerId, provider: 'flow', success: false, error: err.message });
      }
    }

    for (let i = 0; i < metaCount; i++) {
      const workerId = `W${String(workerIndex).padStart(2, '0')}`;
      workerIndex++;
      try {
        const res = await this.launchWorker(workerId, 'meta');
        results.push(res);
      } catch (err) {
        results.push({ workerId, provider: 'meta', success: false, error: err.message });
      }
    }

    return results;
  }

  async stopAll() {
    const workerIds = Array.from(this.activeProcesses.keys());
    const results = [];
    for (const wId of workerIds) {
      const res = await this.stopWorker(wId);
      results.push(res);
    }
    return results;
  }

  getStatus() {
    const list = [];
    for (const [workerId, info] of this.activeProcesses.entries()) {
      list.push(info);
    }
    const telemetry = this.getHardwareTelemetry();
    return {
      active_count: list.length,
      processes: list,
      chrome_path: this.chromePath,
      telemetry
    };
  }

  /**
   * Launch a clean interactive Chrome instance specifically for One-Time Login
   * Opens both Meta.ai and Flow tabs, cleans lockfiles, enables persistent session saving
   */
  /**
   * Thoroughly terminate any hanging Chrome processes associated with a worker and remove lockfiles
   */
  cleanWorkerProcessesAndLocks(workerId = null) {
    if (process.platform === 'win32') {
      const { execFileSync } = require('child_process');
      try {
        const filter = workerId ? `*Worker-${workerId}*` : '*Worker-W*';
        const psCmd = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '${filter}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { stdio: 'ignore' });
      } catch (e) { logger.warn('PROFILE_MANAGER', `Process cleanup error: ${e.message}`); }
    }
    const workers = workerId ? [workerId] : Array.from({ length: 10 }, (_, i) => `W${String(i + 1).padStart(2, '0')}`);
    for (const w of workers) {
      const pDir = this.getProfileDir(w);
      const staleLocks = ['SingletonLock', 'lockfile', 'SingletonSocket', 'SingletonCookie'];
      for (const lock of staleLocks) {
        try {
          const lPath = path.join(pDir, lock);
          if (fs.existsSync(lPath)) fs.unlinkSync(lPath);
        } catch (e) {}
      }
    }
  }

  /**
   * Launch a clean interactive Chrome instance for One-Time Login
   * Strictly 1 worker = 1 service = 1 extension (Meta.ai OR Google Flow)
   * Never dual tabs, never dual extensions
   */
  async launchLoginAssistant(workerId, requestedProvider = null) {
    this.validateWorkerId(workerId);

    // Stop and kill any processes holding this worker's directory & delete lockfiles
    this.cleanWorkerProcessesAndLocks(workerId);
    this.activeProcesses.delete(workerId);
    await new Promise(r => setTimeout(r, 400));

    // Resolve provider from argument, DB, or fallback
    let provider = (requestedProvider || '').toLowerCase();
    if (!provider || !['meta', 'flow'].includes(provider)) {
      try {
        const row = await db.get('SELECT provider FROM workers WHERE id = ?', [workerId]);
        if (row && row.provider) {
          provider = row.provider.toLowerCase();
        }
      } catch (e) {}
    }
    if (!provider || !['meta', 'flow'].includes(provider)) {
      const num = parseInt(workerId.replace(/\D/g, ''), 10);
      provider = (num % 2 === 1) ? 'flow' : 'meta';
    }

    const profileDir = this.getProfileDir(workerId);
    const extensionPath = this.prepareWorkerExtension(workerId, provider);
    const targetUrl = this.getTargetUrl(provider);

    // Strictly ONE isolated extension and strictly ONE target URL
    const args = [
      `--user-data-dir=${profileDir}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,820',
      targetUrl
    ];

    logger.info('WORKER_LOGIN', `Launching 1-time login assistant for worker ${workerId} (${provider.toUpperCase()}) -> ${targetUrl} [Profile: ${profileDir}]`);

    const child = spawn(this.chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });

    const info = {
      workerId,
      provider,
      pid: child.pid,
      profileDir,
      extensionPath,
      targetUrl,
      startTime: new Date().toISOString(),
      isLoginMode: true
    };

    this.activeProcesses.set(workerId, info);

    child.on('exit', (code, signal) => {
      logger.info('WORKER_LOGIN', `Worker ${workerId} (${provider}) login window closed (code: ${code}, signal: ${signal})`);
      this.activeProcesses.delete(workerId);
    });

    child.unref();

    return {
      success: true,
      workerId,
      provider,
      pid: child.pid,
      profileDir,
      targetUrl,
      extensionPath
    };
  }

  /**
   * Stop all active worker processes
   */
  async stopAllWorkers() {
    logger.info('PROFILE_MANAGER', `Stopping all ${this.activeProcesses.size} active worker processes...`);
    const results = [];
    for (const [wId, info] of Array.from(this.activeProcesses.entries())) {
      try {
        const res = await this.stopWorker(wId);
        results.push(res);
      } catch (e) {
        results.push({ success: false, workerId: wId, error: e.message });
      }
    }
    this.cleanWorkerProcessesAndLocks();
    this.activeProcesses.clear();
    return { success: true, count: results.length, results };
  }
}

module.exports = new BrowserProfileManager();
