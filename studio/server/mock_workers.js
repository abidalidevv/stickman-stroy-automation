/**
 * STICKMAN STUDIO — MOCK WORKER SIMULATOR
 * High-performance worker cluster simulator for stress testing,
 * fixed-range validation, and crash recovery benchmarking.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('./logger');

function createSyntheticPngBuffer() {
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);
  return Buffer.concat([pngHeader, Buffer.alloc(6000, 0x00)]);
}

class MockWorker {
  constructor(workerId, provider, port = 45450, options = {}) {
    this.workerId = workerId;
    this.provider = provider;
    this.port = port;
    this.options = {
      simulateDelayMs: options.simulateDelayMs || 50,
      crashOnPromptIndex: options.crashOnPromptIndex || null,
      ...options
    };
    this.running = false;
    this.completedCount = 0;
  }

  async request(method, pathUrl, body = null) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: this.port,
        path: pathUrl,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
          } catch (e) {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async start(projectId, tempMediaDir) {
    this.running = true;
    this.projectId = projectId;
    this.tempMediaDir = tempMediaDir;

    // 1. Register Worker
    await this.request('POST', '/api/v1/workers/register', {
      worker_id: this.workerId,
      provider: this.provider,
      profile_name: `MockProfile-${this.workerId}`
    });

    // 2. Continuous Execution Loop
    while (this.running) {
      try {
        // Heartbeat
        await this.request('POST', '/api/v1/workers/heartbeat', {
          worker_id: this.workerId,
          status: 'IDLE',
          current_url: `https://${this.provider === 'flow' ? 'flow.google.com' : 'meta.ai'}/`
        });

        // Poll for Job
        const poll = await this.request('GET', `/api/v1/workers/${this.workerId}/job?project_id=${this.projectId}`);
        const job = poll.data && poll.data.job;

        if (!job) {
          // No job currently available
          await new Promise(r => setTimeout(r, 100));
          continue;
        }

        // Handle Reference Initialization
        if (job.type === 'INITIALIZE_REFERENCE') {
          await new Promise(r => setTimeout(r, this.options.simulateDelayMs));
          await this.request('POST', `/api/v1/workers/${this.workerId}/reference-state`, {
            project_id: this.projectId,
            status: 'READY',
            version: 1
          });
          continue;
        }

        // Handle Prompt Generation
        if (job.type === 'PROMPT_GENERATION') {
          // Check for simulated crash condition
          if (this.options.crashOnPromptIndex && job.prompt_index === this.options.crashOnPromptIndex) {
            logger.warn('MOCK_WORKER', `Worker ${this.workerId} simulating crash on prompt ${job.prompt_id_str}!`);
            this.running = false;
            return; // Exit without completing or ACKing to test lease reaper!
          }

          // Acknowledge Job
          await this.request('POST', `/api/v1/jobs/${job.job_id}/ack`, { worker_id: this.workerId });

          // Record generation started event
          await this.request('POST', `/api/v1/jobs/${job.job_id}/events`, {
            event: 'GENERATION_STARTED',
            data: { model: this.provider }
          });

          // Simulate organic delay
          await new Promise(r => setTimeout(r, this.options.simulateDelayMs));

          // Generate synthetic image file
          const fileName = `${job.prompt_id_str}_stickman__${this.workerId}.png`;
          const filePath = path.join(this.tempMediaDir, fileName);
          fs.writeFileSync(filePath, createSyntheticPngBuffer());

          // Complete Job
          await this.request('POST', `/api/v1/jobs/${job.job_id}/complete`, {
            filename: fileName,
            file_path: filePath,
            file_size: 6067,
            sha256: `sha256_${Date.now()}`
          });

          this.completedCount++;
        }

      } catch (err) {
        logger.error('MOCK_WORKER', `Worker ${this.workerId} error`, err);
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  stop() {
    this.running = false;
  }
}

class MockWorkerCluster {
  constructor(port = 45450) {
    this.port = port;
    this.workers = [];
  }

  async runBatch({
    projectId,
    flowCount = 1,
    metaCount = 1,
    simulateDelayMs = 50,
    tempMediaDir = null,
    crashConfig = null // { workerId: 'W01', onPromptIndex: 5 }
  }) {
    this.workers = [];
    const workerIds = [];

    let idx = 1;
    for (let i = 0; i < flowCount; i++) {
      const wId = `W${String(idx).padStart(2, '0')}`;
      idx++;
      workerIds.push(wId);
      const isCrashTarget = crashConfig && crashConfig.workerId === wId;
      this.workers.push(new MockWorker(wId, 'flow', this.port, {
        simulateDelayMs,
        crashOnPromptIndex: isCrashTarget ? crashConfig.onPromptIndex : null
      }));
    }

    for (let i = 0; i < metaCount; i++) {
      const wId = `W${String(idx).padStart(2, '0')}`;
      idx++;
      workerIds.push(wId);
      const isCrashTarget = crashConfig && crashConfig.workerId === wId;
      this.workers.push(new MockWorker(wId, 'meta', this.port, {
        simulateDelayMs,
        crashOnPromptIndex: isCrashTarget ? crashConfig.onPromptIndex : null
      }));
    }

    // Partition project across workers
    const db = require('./db');
    const orchestrator = require('./worker_orchestrator');
    await orchestrator.assignRangesToProject(projectId, workerIds);

    // Launch workers in parallel
    const promises = this.workers.map(w => w.start(projectId, tempMediaDir));

    return {
      worker_ids: workerIds,
      stopAll: () => this.workers.forEach(w => w.stop()),
      completionPromise: Promise.all(promises)
    };
  }
}

module.exports = { MockWorker, MockWorkerCluster };
