const os = require('os');
const { exec } = require('child_process');
const logger = require('./logger');

let cachedMetrics = {
  cpu_percent: 0,
  ram_total_gb: 0,
  ram_free_gb: 0,
  ram_used_gb: 0,
  ram_percent: 0,
  gpu_name: 'Scanning...',
  gpu_vram_gb: 0,
  active_workers: 0,
  flow_workers_active: 0,
  meta_workers_active: 0,
  hardware_warning: null,
  timestamp: new Date().toISOString()
};

let previousCpuTimes = null;

function getCpuUsage() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }

  const total = user + nice + sys + idle + irq;

  if (!previousCpuTimes) {
    previousCpuTimes = { total, idle };
    return 0;
  }

  const diffTotal = total - previousCpuTimes.total;
  const diffIdle = idle - previousCpuTimes.idle;
  previousCpuTimes = { total, idle };

  if (diffTotal === 0) return 0;
  const usage = 100 - (diffIdle / diffTotal) * 100;
  return Math.min(100, Math.max(0, Math.round(usage)));
}

let gpuQueried = false;
function queryGpuInfo() {
  if (gpuQueried) return;
  exec('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM | ConvertTo-Json"', (err, stdout) => {
    if (!err && stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout);
        cachedMetrics.gpu_name = parsed.Name || 'Standard GPU';
        cachedMetrics.gpu_vram_gb = parsed.AdapterRAM ? Math.round((parsed.AdapterRAM / (1024 * 1024 * 1024)) * 10) / 10 : 4.0;
        gpuQueried = true;
      } catch {}
    }
  });
}

function updateMetrics(activeWorkers = { flow: 0, meta: 0 }) {
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const usedRam = totalRam - freeRam;

  const totalGb = Math.round((totalRam / (1024 * 1024 * 1024)) * 10) / 10;
  const freeGb = Math.round((freeRam / (1024 * 1024 * 1024)) * 10) / 10;
  const usedGb = Math.round((usedRam / (1024 * 1024 * 1024)) * 10) / 10;
  const ramPercent = Math.round((usedRam / totalRam) * 100);

  const cpuPercent = getCpuUsage();

  // Low memory threshold warning (< 1.5 GB free)
  let warning = null;
  if (freeGb < 1.5) {
    warning = {
      level: 'warning',
      code: 'LOW_RAM',
      message: `Available RAM (${freeGb} GB) is low. For optimal stability on 8 GB RAM, consider using 2–3 active browser workers.`
    };
  }

  cachedMetrics = {
    ...cachedMetrics,
    cpu_percent: cpuPercent,
    ram_total_gb: totalGb,
    ram_free_gb: freeGb,
    ram_used_gb: usedGb,
    ram_percent: ramPercent,
    active_workers: activeWorkers.flow + activeWorkers.meta,
    flow_workers_active: activeWorkers.flow,
    meta_workers_active: activeWorkers.meta,
    hardware_warning: warning,
    timestamp: new Date().toISOString()
  };

  queryGpuInfo();
  return cachedMetrics;
}

// Start background refresh every 2.5 seconds
setInterval(() => {
  updateMetrics();
}, 2500);

module.exports = {
  getMetrics: () => cachedMetrics,
  updateMetrics
};
