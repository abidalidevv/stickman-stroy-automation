const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 45450;
const URL = `http://127.0.0.1:${PORT}`;
const HEALTH_URL = `${URL}/api/v1/health`;
const STUDIO_ROOT = path.resolve(__dirname);
const SERVER_INDEX = path.join(STUDIO_ROOT, 'server', 'index.js');

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function findChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  try {
    const whereResult = execSync('where chrome.exe', { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (whereResult && fs.existsSync(whereResult)) return whereResult;
  } catch (e) {
    // ignore
  }

  return null;
}

async function main(options = {}) {
  console.log('==================================================');
  console.log('  STICKMAN STUDIO — WINDOWS DESKTOP LAUNCHER');
  console.log('  Node.js/Express Desktop Shell via Chrome App Mode');
  console.log('==================================================');

  const isAlreadyRunning = await checkHealth();
  if (isAlreadyRunning) {
    console.log(`[OK] Studio backend service already running at ${URL}`);
  } else {
    console.log(`[INFO] Starting Studio backend service (${SERVER_INDEX})...`);
    const serverProc = spawn(process.execPath, [SERVER_INDEX], {
      cwd: STUDIO_ROOT,
      detached: true,
      stdio: 'ignore'
    });
    serverProc.unref();

    console.log('[INFO] Waiting for Studio service to become responsive...');
    const startTime = Date.now();
    let ready = false;
    while (Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 400));
      ready = await checkHealth();
      if (ready) break;
    }

    if (!ready) {
      console.error('[ERROR] Studio backend service failed to respond within 15 seconds.');
      if (!options.noExit) process.exit(1);
      return false;
    }
    console.log(`[OK] Studio backend service is active and healthy on ${URL}`);
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    console.warn('[WARN] Chrome executable not found in standard paths.');
    console.log(`[INFO] Please open your browser and navigate to: ${URL}`);
    return true;
  }

  console.log(`[INFO] Launching Desktop Studio Window via Chrome Application Mode...`);
  console.log(`[PATH] ${chromePath}`);

  if (options.dryRun) {
    console.log('[DRY-RUN] Chrome launch validated (dryRun=true, skipping actual GUI spawn).');
    return true;
  }

  const chromeArgs = [
    `--app=${URL}`,
    '--window-size=1440,920',
    '--window-position=50,50'
  ];

  const chromeProc = spawn(chromePath, chromeArgs, {
    detached: true,
    stdio: 'ignore'
  });
  chromeProc.unref();

  console.log('[OK] Stickman Studio desktop window launched successfully.');
  return true;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}

module.exports = {
  checkHealth,
  findChromePath,
  main
};
