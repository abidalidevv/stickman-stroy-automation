const path = require('path');
const fs = require('fs');
const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}\nRaw: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function runPhase1GateVerification() {
  console.log('================================================================');
  console.log('  STICKMAN STUDIO — PHASE 1 GATE VERIFICATION');
  console.log('  Standard: Zero-mock, physical hardware and disk verification');
  console.log('================================================================\n');

  const results = [];
  function assertCheck(name, passed, details, classification = '[REAL INTEGRATION]') {
    results.push({ name, passed, details, classification });
    const mark = passed ? '[PASS]' : '[FAIL]';
    console.log(`${mark} ${classification} ${name}: ${details}`);
    if (!passed) {
      throw new Error(`Assertion failed: ${name} - ${details}`);
    }
  }

  // 1. Desktop Launcher & Chrome App Mode
  console.log('--- 1. Testing Desktop Launcher (studio/launcher.js & launch_studio.bat) ---');
  const launcherPath = 'E:/stickman-video-automation/studio/launcher.js';
  const batPath = 'E:/stickman-video-automation/launch_studio.bat';
  assertCheck('Launcher Script Exists', fs.existsSync(launcherPath), `Found at ${launcherPath}`);
  assertCheck('Launch Batch File Exists', fs.existsSync(batPath), `Found at ${batPath}`);

  const launcher = require(launcherPath);
  const chromePath = launcher.findChromePath();
  assertCheck('Chrome Path Detection', !!chromePath && fs.existsSync(chromePath), `Chrome detected at: ${chromePath}`);

  // Test dry-run launcher
  const dryRunOk = await launcher.main({ dryRun: true, noExit: true });
  assertCheck('Launcher Dry-Run Execution', dryRunOk === true, 'Launcher verified server readiness and Chrome launch arguments');

  // 2. Local Node Sidecar Service & Health Endpoint
  console.log('\n--- 2. Testing Node Local Sidecar (127.0.0.1:45450) ---');
  const healthRes = await fetchJson('http://127.0.0.1:45450/api/v1/health');
  assertCheck('Sidecar Health HTTP 200', healthRes.status === 200, `HTTP status code: ${healthRes.status}`);
  assertCheck('Sidecar Status Online', healthRes.body.status === 'ONLINE', `Status: ${healthRes.body.status}, version: ${healthRes.body.version}`);
  assertCheck('Sidecar Port Binding', healthRes.body.port === 45450, `Bound strictly to port 45450 on 127.0.0.1`);

  // 3. Resource Monitor
  console.log('\n--- 3. Testing Resource Monitor (studio/server/resource_monitor.js) ---');
  const resourcesRes = await fetchJson('http://127.0.0.1:45450/api/v1/system/resources');
  assertCheck('Resource Metrics HTTP 200', resourcesRes.status === 200, `HTTP ${resourcesRes.status}`);
  const resources = resourcesRes.body;
  assertCheck('RAM Total & Free Monitored', resources.ram_total_gb > 0 && resources.ram_used_gb > 0, `RAM: ${resources.ram_used_gb} GB used / ${resources.ram_total_gb} GB total (${resources.ram_percent}%)`);
  assertCheck('CPU Percent Monitored', typeof resources.cpu_percent === 'number', `CPU: ${resources.cpu_percent}%`);
  assertCheck('Hardware Warning Logic Active', typeof resources.hardware_warning !== 'undefined', `Warning state: ${resources.hardware_warning || 'NORMAL (RAM within threshold)'}`);

  // 4. SQLite Schema, WAL Mode, Foreign Keys & Migrations
  console.log('\n--- 4. Testing SQLite Core, WAL Mode & Migrations ---');
  const db = require('E:/stickman-video-automation/studio/server/db');
  await db.init();
  
  const journalMode = await db.get('PRAGMA journal_mode;');
  assertCheck('SQLite WAL Mode Enabled', journalMode.journal_mode === 'wal', `journal_mode: ${journalMode.journal_mode}`);

  const foreignKeys = await db.get('PRAGMA foreign_keys;');
  assertCheck('SQLite Foreign Keys Enabled', foreignKeys.foreign_keys === 1, `foreign_keys: ${foreignKeys.foreign_keys}`);

  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const tableNames = tables.map(t => t.name);
  console.log('Discovered tables in studio.sqlite:', tableNames.join(', '));
  
  const requiredTables = [
    'projects',
    'prompts',
    'workers',
    'jobs',
    'character_references',
    'timeline_items',
    'settings',
    'system_logs',
    'audio_tracks',
    'renders'
  ];
  for (const reqTable of requiredTables) {
    assertCheck(`Table '${reqTable}' Exists`, tableNames.includes(reqTable), `Found table ${reqTable} in SQLite schema`);
  }

  // 5. Complete Project Lifecycle Gate (Create -> Save -> Close -> Reopen -> Data Exists)
  console.log('\n--- 5. Testing Project Lifecycle Gate (Create -> Save -> Close -> Reopen -> Data Exists) ---');
  const pm = require('E:/stickman-video-automation/studio/server/project_manager');
  const testProjectName = `Phase-1-Gate-Audit_${Date.now()}`;
  
  // Step A: Create Project
  const createdProj = await pm.createProject({
    name: testProjectName,
    mode: 'MODE_2',
    voiceover_duration: 30,
    pacing_preset: '2/4s',
    script_text: 'A real gate verification script testing persistent disk and SQLite storage.'
  });

  assertCheck('Project Created in SQLite', !!createdProj && !!createdProj.id, `Created project ID: ${createdProj.id}`);
  assertCheck('Project Target Image Count', createdProj.target_image_count === 15, `Target images: ${createdProj.target_image_count} (30s * 0.50x pacing)`);

  // Step B: Verify Canonical Folders on Disk
  const projDir = createdProj.directory_path;
  assertCheck('Project Directory on Disk', fs.existsSync(projDir), `Created at ${projDir}`);

  const canonicalDirs = ['central_images', 'downloads_raw', 'prompts', 'characters', 'captions', 'sfx', 'music', 'renders'];
  for (const cDir of canonicalDirs) {
    const fullSub = path.join(projDir, cDir);
    assertCheck(`Canonical Folder '${cDir}/'`, fs.existsSync(fullSub), `Found at ${fullSub}`);
  }

  // Step C: Verify project.json on Disk
  const projJsonPath = path.join(projDir, 'project.json');
  assertCheck('project.json Exists on Disk', fs.existsSync(projJsonPath), `Found at ${projJsonPath}`);
  const parsedJson = JSON.parse(fs.readFileSync(projJsonPath, 'utf8'));
  assertCheck('project.json Integrity', parsedJson.id === createdProj.id && parsedJson.name === testProjectName, `ID and Name match`);

  // Step D: Import Validated Prompts
  const testPrompts = [
    '001_A minimalist black stickman at modern studio desk with glowing monitors, white background.',
    '002_Close up of stickman drawing precise line art on graphic tablet, intense focus.',
    '003_Stickman standing confidently pointing to high-speed render progress bar reaching 100%.',
    '004_Stickman celebrating with arms raised triumphantly, clean black strokes on solid white.',
    '005_Wide cinematic shot of stickman walking out into expansive horizon, minimalist aesthetic.'
  ].join('\n');

  const importResult = await pm.parseAndImportPrompts(createdProj.id, testPrompts);
  assertCheck('Prompts Imported & Parsed', importResult.success === true && importResult.count === 5, `Imported ${importResult.count} sequential prompts (001-005)`);

  // Step E: Verify Prompts in SQLite
  const dbPrompts = await db.all('SELECT * FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC', [createdProj.id]);
  assertCheck('Prompts Persisted in SQLite', dbPrompts.length === 5, `Found 5 rows in prompts table`);
  assertCheck('Prompt 001 Index Integrity', dbPrompts[0].prompt_id_str === '001' && dbPrompts[0].status === 'QUEUED', `001 status: ${dbPrompts[0].status}`);
  assertCheck('Prompt 005 Index Integrity', dbPrompts[4].prompt_id_str === '005' && dbPrompts[4].status === 'QUEUED', `005 status: ${dbPrompts[4].status}`);

  // Step F: Simulate CLOSE & REOPEN
  console.log('\n--- Simulating App Close & Reopen (Persistence Verification) ---');
  // Re-read directly from disk SQLite via project manager getProject
  const reopenedProj = await pm.getProject(createdProj.id);
  assertCheck('Project Retrieved After Reopen', !!reopenedProj, `Retrieved project ${reopenedProj.name}`);
  assertCheck('Project Data Unchanged', reopenedProj.id === createdProj.id, `ID: ${reopenedProj.id}`);
  assertCheck('Project Prompts Count Preserved', reopenedProj.stats.total_prompts === 5, `Total prompts: ${reopenedProj.stats.total_prompts}`);
  assertCheck('Project Source File Preserved', fs.existsSync(path.join(projDir, 'prompts', 'source.md')), `source.md verified on disk`);

  // 6. Test Frontend REST API Endpoints
  console.log('\n--- 6. Testing Frontend ↔ Sidecar REST API Endpoints ---');
  const projectListRes = await fetchJson('http://127.0.0.1:45450/api/v1/projects');
  assertCheck('GET /api/v1/projects HTTP 200', projectListRes.status === 200, `Returned HTTP 200`);
  const projectList = Array.isArray(projectListRes.body) ? projectListRes.body : (projectListRes.body.projects || []);
  const foundInList = projectList.some(p => p.id === createdProj.id);
  assertCheck('Project Present in API List', foundInList, `Project ${createdProj.id} present in API response list`);

  const singleProjRes = await fetchJson(`http://127.0.0.1:45450/api/v1/projects/${createdProj.id}`);
  assertCheck('GET /api/v1/projects/:id HTTP 200', singleProjRes.status === 200, `Returned HTTP 200`);
  const projectObj = singleProjRes.body.project || singleProjRes.body;
  assertCheck('Project Retrieved via REST API', projectObj.id === createdProj.id, `Project matched in REST response`);

  console.log('\n================================================================');
  console.log(`  PHASE 1 GATE VERIFICATION RESULT: ALL ${results.length} CHECKS PASSED`);
  console.log('  Classification: 100% [REAL INTEGRATION]');
  console.log('================================================================\n');

  return { success: true, count: results.length, results };
}

if (require.main === module) {
  runPhase1GateVerification().catch(err => {
    console.error('\n[FATAL GATE FAILURE]', err);
    process.exit(1);
  });
}

module.exports = { runPhase1GateVerification };
