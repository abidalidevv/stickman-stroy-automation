const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('./logger');
const resourceMonitor = require('./resource_monitor');
const projectManager = require('./project_manager');
const orchestrator = require('./worker_orchestrator');
const profileManager = require('./profile_manager');
const ingestionManager = require('./ingestion_manager');
const timelineManager = require('./timeline_manager');
const transcriptionService = require('./transcription_service');
const renderEngine = require('./render_engine');
const aiEngine = require('./ai_story_engine');

// --- SYSTEM & HEALTH ---
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'Stickman Studio Local Service',
    version: '1.0.0',
    port: 45450,
    timestamp: new Date().toISOString()
  });
});

router.get('/system/resources', (req, res) => {
  res.json(resourceMonitor.getMetrics());
});

// --- PROJECTS ---
router.get('/projects', async (req, res) => {
  try {
    const list = await projectManager.listProjects();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id', async (req, res) => {
  try {
    const proj = await projectManager.getProject(req.params.id);
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    res.json(proj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const { name, mode, voiceover_duration, pacing_preset, custom_multiplier, script_text, character_name, character_image_base64 } = req.body;
    let imgBuffer = null;
    if (character_image_base64) {
      const cleanB64 = character_image_base64.includes(',') ? character_image_base64.split(',')[1] : character_image_base64;
      imgBuffer = Buffer.from(cleanB64, 'base64');
    }

    const created = await projectManager.createProject({
      name: name || 'Untitled Project',
      mode: mode || 'MODE_2',
      voiceover_duration: voiceover_duration || 0,
      pacing_preset: pacing_preset || '2/4s',
      custom_multiplier,
      script_text: script_text || '',
      character_name: character_name || 'Main Stickman',
      character_image_buffer: imgBuffer
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROMPTS (MODE 2 IMPORT & QUERY) ---
router.post('/projects/:id/prompts/import', async (req, res) => {
  try {
    const raw_prompts = req.body.raw_prompts || req.body.prompts_text || req.body.prompts;
    if (!raw_prompts) return res.status(400).json({ error: 'Missing raw_prompts in body' });

    const result = await projectManager.parseAndImportPrompts(req.params.id, raw_prompts);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/projects/:id/prompts', async (req, res) => {
  try {
    const prompts = await db.all(`
      SELECT * FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC
    `, [req.params.id]);
    res.json(prompts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/character-reference', async (req, res) => {
  try {
    const char = await db.get(`SELECT * FROM character_references WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`, [req.params.id]);
    if (!char || !char.image_path || !fs.existsSync(char.image_path)) {
      return res.status(404).send('Character reference image not found');
    }
    res.sendFile(path.resolve(char.image_path));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/assign-workers', async (req, res) => {
  try {
    const { worker_ids } = req.body;
    const allocations = await orchestrator.assignRangesToProject(req.params.id, worker_ids);
    res.json({ success: true, allocations });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- INGESTION & CENTRAL STORAGE (PHASE 3) ---
router.post('/projects/:id/ingest', async (req, res) => {
  try {
    const { prompt_id, file_path, worker_id, variant } = req.body;
    const result = await ingestionManager.ingestFileForPrompt(req.params.id, prompt_id, file_path, { workerId: worker_id, variant });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/projects/:id/reconcile', async (req, res) => {
  try {
    const result = await ingestionManager.scanAndReconcile(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/prompts/:prompt_id/replace-image', async (req, res) => {
  try {
    const { image_path, notes } = req.body;
    const result = await ingestionManager.replacePromptImage(req.params.id, req.params.prompt_id, image_path, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- MASTER TIMELINE & PACING (PHASE 3) ---
router.post('/projects/:id/timeline/build', async (req, res) => {
  try {
    const { voiceover_duration, pacing_preset } = req.body;
    const result = await timelineManager.buildMasterTimeline(req.params.id, { voiceoverDuration: voiceover_duration, pacingPreset: pacing_preset });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/projects/:id/timeline', async (req, res) => {
  try {
    const result = await timelineManager.getTimeline(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/projects/:id/timeline/items/:item_id', async (req, res) => {
  try {
    const { duration_sec } = req.body;
    const result = await timelineManager.updateItemDuration(req.params.id, req.params.item_id, duration_sec);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- POST-PRODUCTION & RENDERING (PHASE 4) ---
router.post('/projects/:id/transcribe', async (req, res) => {
  try {
    const { audio_path } = req.body;
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    const targetAudio = audio_path || project.voiceover_path;
    const result = await transcriptionService.transcribeAudio(req.params.id, targetAudio);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/captions', async (req, res) => {
  try {
    const captions = await db.all('SELECT * FROM captions WHERE project_id = ? ORDER BY start_time ASC', [req.params.id]);
    res.json(captions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/render', async (req, res) => {
  try {
    const { output_file_name, include_music, include_sfx, music_volume, transition_type } = req.body;
    const result = await renderEngine.renderProjectVideo(req.params.id, {
      outputFileName: output_file_name,
      includeMusic: include_music,
      includeSfx: include_sfx,
      musicVolume: music_volume !== undefined ? music_volume : 0.07, // 7% default
      transitionType: transition_type
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/renders', async (req, res) => {
  try {
    const renders = await db.all('SELECT * FROM renders WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(renders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MODE 1 AI STORY ENGINE (PHASE 5) ---
router.post('/projects/:id/ai/generate-prompts', async (req, res) => {
  try {
    const {
      script_text,
      voiceover_seconds,
      pacing_preset,
      custom_count,
      video_title,
      master_prompt,
      character_reference,
      visual_elements,
      optional_music,
      require_real_groq
    } = req.body;

    const result = await aiEngine.generateScriptPrompts(req.params.id, {
      scriptText: script_text,
      voiceoverSeconds: voiceover_seconds,
      pacingPreset: pacing_preset,
      customCount: custom_count,
      videoTitle: video_title,
      masterPrompt: master_prompt,
      characterReference: character_reference,
      visualElements: visual_elements,
      optionalMusic: optional_music,
      requireRealGroq: require_real_groq === true
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ai/master-prompt-default', (req, res) => {
  try {
    const v7Path = path.resolve(__dirname, '../../input master prompt i give this to chatgpt and scriptt to chjatgpt chatboxct and chatgpt give me list or prompts for as input SCRIPT_TO_IMAGE_PROMPT_MASTER_V7_STICKMAN_LOCKED.md');
    if (fs.existsSync(v7Path)) {
      const text = fs.readFileSync(v7Path, 'utf8');
      return res.json({ master_prompt: text });
    }
    res.json({ master_prompt: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ai/models', async (req, res) => {
  try {
    const selected = await aiEngine.getSelectedModel();
    res.json({
      primary_provider: 'Groq',
      primary_model: selected,
      fallback_provider: 'Ollama',
      supported_models: [
        'openai/gpt-oss-120b',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768'
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/model-config', async (req, res) => {
  try {
    const { primary_model } = req.body;
    if (!primary_model) return res.status(400).json({ error: 'Missing primary_model' });
    await db.run(`INSERT INTO settings (key, value, updated_at) VALUES ('groq_primary_model', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [primary_model]);
    res.json({ success: true, primary_model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- WORKER REGISTRY & BRIDGE ---
router.get('/workers', async (req, res) => {
  try {
    const workers = await db.all(`SELECT * FROM workers ORDER BY id ASC`);
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/register', async (req, res) => {
  try {
    const { worker_id, provider, profile_name } = req.body;
    if (!worker_id || !provider) {
      return res.status(400).json({ error: 'Missing worker_id or provider' });
    }
    const worker = await orchestrator.registerWorker({ id: worker_id, provider, profile_name });
    res.json({ success: true, worker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/heartbeat', async (req, res) => {
  try {
    const { worker_id, status, current_url, active_job_id } = req.body;
    if (!worker_id) return res.status(400).json({ error: 'Missing worker_id' });
    const result = await orchestrator.recordHeartbeat({ id: worker_id, status, current_url, active_job_id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/workers/:id/job', async (req, res) => {
  try {
    const jobResult = await orchestrator.getNextJob(req.params.id, req.query.project_id);
    res.json(jobResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/ack', async (req, res) => {
  try {
    const { worker_id } = req.body;
    const result = await orchestrator.acknowledgeJob(req.params.id, worker_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/events', async (req, res) => {
  try {
    const { event, data } = req.body;
    const result = await orchestrator.recordJobEvent(req.params.id, event, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/complete', async (req, res) => {
  try {
    const { filename, file_path, file_size, sha256 } = req.body;
    const result = await orchestrator.completeJob(req.params.id, {
      fileName: filename,
      filePath: file_path,
      fileSize: file_size,
      sha256
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/:id/fail', async (req, res) => {
  try {
    const { error, can_retry } = req.body;
    const result = await orchestrator.failJob(req.params.id, { error, canRetry: can_retry });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/:id/reference-state', async (req, res) => {
  try {
    const { project_id, status, version } = req.body;
    const result = await orchestrator.updateReferenceState(req.params.id, { project_id, status, version });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/:id/login-state', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await orchestrator.updateLoginState(req.params.id, { status });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- WORKER BROWSER PROCESSES ---
router.get('/workers/processes', (req, res) => {
  res.json(profileManager.getStatus());
});

router.post('/workers/processes/launch', async (req, res) => {
  try {
    const { worker_id, provider } = req.body;
    const result = await profileManager.launchWorker(worker_id, provider);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/processes/stop', async (req, res) => {
  try {
    const { worker_id } = req.body;
    const result = await profileManager.stopWorker(worker_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/processes/launch-all', async (req, res) => {
  try {
    const { flow_count, meta_count } = req.body;
    const total = (parseInt(flow_count, 10) || 0) + (parseInt(meta_count, 10) || 0);
    if (total > 10) {
      return res.status(400).json({ error: `Maximum 10 active workers allowed. Requested: ${total}. Configuration rejected.` });
    }
    const results = await profileManager.launchAll({ flow: flow_count, meta: meta_count });
    res.json({ success: true, results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/workers/processes/restart', async (req, res) => {
  try {
    const { worker_id } = req.body;
    const result = await profileManager.restartWorker(worker_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/system/telemetry', (req, res) => {
  res.json(profileManager.getHardwareTelemetry());
});

router.post('/workers/processes/stop-all', async (req, res) => {
  try {
    const results = await profileManager.stopAll();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SETTINGS ---
// --- RECONCILIATION ---
router.get('/system/reconcile', (req, res) => {
  const reconciliation = require('./reconciliation');
  res.json(reconciliation.getReconciliationReport());
});

router.post('/system/reconcile', async (req, res) => {
  try {
    const reconciliation = require('./reconciliation');
    const report = await reconciliation.reconcileStartup();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    const map = {};
    rows.forEach(r => {
      if (r.key === 'groq_api_key' && r.value) {
        map['groq_api_key_configured'] = true;
        map['groq_api_key'] = r.value.slice(0, 4) + '••••••••' + r.value.slice(-4);
      } else {
        map[r.key] = r.value;
      }
    });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const settings = req.body;
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(settings)) {
      await db.run(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [k, String(v), now]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- LOGS ---
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = await db.all('SELECT * FROM system_logs ORDER BY id DESC LIMIT ?', [limit]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
