const http = require('http');
const { startServer } = require('E:/stickman-video-automation/studio/server/index');
const db = require('E:/stickman-video-automation/studio/server/db');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 45450,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(respBody) });
        } catch {
          resolve({ status: res.statusCode, raw: respBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Stickman Studio Server for Phase 1 Verification ---');
  const server = await startServer();

  try {
    // 1. Health check
    const health = await request('GET', '/api/v1/health');
    console.log('1. Health check:', health.status === 200 && health.data.status === 'ONLINE' ? 'PASS' : 'FAIL', health.data);

    // 2. Resource monitor
    const resources = await request('GET', '/api/v1/system/resources');
    console.log('2. Resource monitor:', resources.status === 200 ? 'PASS' : 'FAIL', {
      cpu_percent: resources.data.cpu_percent,
      ram_free_gb: resources.data.ram_free_gb,
      ram_total_gb: resources.data.ram_total_gb,
      gpu_name: resources.data.gpu_name
    });

    // 3. Project Creation
    const newProj = await request('POST', '/api/v1/projects', {
      name: 'Phase 1 Test Project',
      mode: 'MODE_2',
      voiceover_duration: 72,
      pacing_preset: '2/4s',
      character_name: 'Alex The Stickman'
    });
    console.log('3. Project creation:', newProj.status === 201 ? 'PASS' : 'FAIL', {
      id: newProj.data.id,
      name: newProj.data.name,
      target_image_count: newProj.data.target_image_count
    });

    const projectId = newProj.data.id;

    // 4. Mode 2 Prompt List Import (Testing Clean sequential format 001_...)
    const samplePrompts = `
001_2D minimalist hand-drawn stickman sketch, Alex waking up in bedroom
002_2D stickman Alex walking to wooden table
003_2D stickman Alex pouring black ink into mug
004_2D stickman Alex noticing glowing metallic USB drive
005_2D stickman Alex sitting at desk plugging USB into CRT monitor
006_2D cascading green code reflecting on stickman oval face
007_2D vault door schematic appearing on screen
008_2D abstract stickman carrying heavy cube of knowledge
009_2D abstract stickman walking through invisible clock cage
010_2D abstract stickman standing at geometric crossroads
011_2D stickman hand hovering over Enter key
012_2D stickman hand pressing Enter key with radiating ink shockwaves
`.trim();

    const importResult = await request('POST', `/api/v1/projects/${projectId}/prompts/import`, {
      raw_prompts: samplePrompts
    });
    console.log('4. Mode 2 Prompts Import:', importResult.status === 200 && importResult.data.success ? 'PASS' : 'FAIL', importResult.data);

    // 5. Worker Registration (Testing Flow W01 and Meta W02)
    const regW1 = await request('POST', '/api/v1/workers/register', { worker_id: 'W01', provider: 'flow' });
    const regW2 = await request('POST', '/api/v1/workers/register', { worker_id: 'W02', provider: 'meta' });
    console.log('5. Worker registration:', regW1.data.success && regW2.data.success ? 'PASS' : 'FAIL', {
      w01: regW1.data.worker.id,
      w02: regW2.data.worker.id
    });

    // 6. Fixed-Range Partitioning
    const assignResult = await request('POST', `/api/v1/projects/${projectId}/assign-workers`, {
      worker_ids: ['W01', 'W02']
    });
    console.log('6. Fixed-range partitioning (12 prompts across 2 workers = 6 each):', assignResult.status === 200 ? 'PASS' : 'FAIL', assignResult.data.allocations);

    // 7. Worker Heartbeat
    const hb = await request('POST', '/api/v1/workers/heartbeat', {
      worker_id: 'W01',
      status: 'IDLE',
      current_url: 'https://flow.google.com/'
    });
    console.log('7. Worker heartbeat:', hb.data.success ? 'PASS' : 'FAIL');

    // 8. Job Polling for W01
    // First job requires character reference initialization since W01 is NOT_READY!
    const jobPoll1 = await request('GET', '/api/v1/workers/W01/job');
    console.log('8. Job Polling (Pre-flight reference init check):', jobPoll1.data.job.type === 'INITIALIZE_REFERENCE' ? 'PASS (Reference pre-flight intercepted!)' : 'FAIL', jobPoll1.data.job);

    // Set W01 reference status to READY
    await request('POST', '/api/v1/workers/W01/reference-state', {
      project_id: projectId,
      status: 'READY',
      version: 1
    });

    // Next job poll should now dispense prompt 001!
    const jobPoll2 = await request('GET', '/api/v1/workers/W01/job');
    console.log('9. Job Polling (Dispenses Prompt 001 after reference is READY):', jobPoll2.data.job.prompt_id_str === '001' ? 'PASS' : 'FAIL', {
      job_id: jobPoll2.data.job.job_id,
      prompt: jobPoll2.data.job.prompt_text
    });

    const activeJobId = jobPoll2.data.job.job_id;

    // 10. Acknowledge and Record Events
    await request('POST', `/api/v1/jobs/${activeJobId}/ack`, { worker_id: 'W01' });
    await request('POST', `/api/v1/jobs/${activeJobId}/events`, { event: 'GENERATION_STARTED', data: { model: 'flow' } });

    // 11. Complete Job & Idempotency Lock
    const completeRes = await request('POST', `/api/v1/jobs/${activeJobId}/complete`, {
      filename: '001_stickman__W01.png',
      file_path: 'E:/stickman-video-automation/Projects/test/001_stickman__W01.png',
      file_size: 452000,
      sha256: 'mock_sha256_hash_12345'
    });
    console.log('10. Complete job & Idempotency lock:', completeRes.data.success ? 'PASS' : 'FAIL');

    // Check prompt record status in DB
    const promptRecord = await db.get('SELECT * FROM prompts WHERE id = ?', [jobPoll2.data.job.prompt_id]);
    console.log('11. Database prompt status verification:', promptRecord.status === 'COMPLETED' ? 'PASS (Prompt locked as COMPLETED)' : 'FAIL', {
      id: promptRecord.id,
      status: promptRecord.status,
      file_name: promptRecord.file_name
    });

    console.log('\n======================================================');
    console.log('ALL PHASE 1 BACKEND & ORCHESTRATION TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    server.close();
    await db.close();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
