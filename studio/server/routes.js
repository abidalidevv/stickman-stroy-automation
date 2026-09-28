const multer = require("multer");
const express = require('express');
const router = express.Router();

// --- AUDIO UPLOAD CONFIGURATION ---
const audioStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const proj = await db.get('SELECT directory_path FROM projects WHERE id = ?', [req.params.id]);
      const dir = proj ? path.join(proj.directory_path, 'audio') : path.resolve('E:/stickman-video-automation/uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch(e) {
      cb(e, null);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const field = (req.body.track_type || file.fieldname || '').toLowerCase() === 'music' ? 'bg_music' : 'voiceover';
    cb(null, `${field}_${Date.now()}${ext}`);
  }
});
const audioUpload = multer({ storage: audioStorage });

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
    const {
      name,
      mode,
      voiceover_path,
      voiceover_duration,
      pacing_preset,
      custom_multiplier,
      script_text,
      character_name,
      character_description,
      character_image_base64,
      music_path,
      music_volume,
      master_prompt,
      raw_prompts
    } = req.body;

    let imgBuffer = null;
    if (character_image_base64) {
      const cleanB64 = character_image_base64.includes(',') ? character_image_base64.split(',')[1] : character_image_base64;
      imgBuffer = Buffer.from(cleanB64, 'base64');
    }

    let finalDuration = parseFloat(voiceover_duration) || 0;
    let resolvedVoicePath = voiceover_path || null;

    if (resolvedVoicePath && (!finalDuration || finalDuration <= 0)) {
      try {
        let testPath = resolvedVoicePath;
        if (!path.isAbsolute(testPath)) {
          const demoCandidate = path.resolve('E:/stickman-video-automation/Demo', path.basename(testPath));
          if (fs.existsSync(demoCandidate)) testPath = demoCandidate;
          else {
            const rootCandidate = path.resolve('E:/stickman-video-automation', testPath);
            if (fs.existsSync(rootCandidate)) testPath = rootCandidate;
          }
        }
        if (fs.existsSync(testPath)) {
          resolvedVoicePath = testPath;
          const probe = await renderEngine.probeMedia(testPath);
          finalDuration = parseFloat(probe.format?.duration || 0);
        }
      } catch (pErr) {
        logger.warn('ROUTES', `Auto-probing voiceover duration failed: ${pErr.message}`);
      }
    }

    const created = await projectManager.createProject({
      name: name || 'Untitled Project',
      mode: mode || 'MODE_2',
      voiceover_path: resolvedVoicePath,
      voiceover_duration: finalDuration,
      pacing_preset: pacing_preset || '3/4s',
      custom_multiplier,
      script_text: script_text || '',
      character_name: character_name || 'Main Stickman',
      character_description: character_description || '',
      character_image_buffer: imgBuffer,
      music_path: music_path || null,
      music_volume: music_volume !== undefined ? parseFloat(music_volume) : 0.07,
      master_prompt: master_prompt || null,
      raw_prompts: raw_prompts || null
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

router.put('/projects/:id/timeline/sync', async (req, res) => {
  try {
    const { items } = req.body;
    const result = await timelineManager.syncTimelineItems(req.params.id, items);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// --- STANDALONE AUDIO PROBE ENDPOINT ---
router.post('/audio/probe', async (req, res) => {
  try {
    const { file_path } = req.body;
    if (!file_path) return res.status(400).json({ error: 'file_path is required' });
    let resolvedPath = file_path;
    if (!path.isAbsolute(resolvedPath)) {
      const demoCandidate = path.resolve('E:/stickman-video-automation/Demo', path.basename(file_path));
      if (fs.existsSync(demoCandidate)) resolvedPath = demoCandidate;
      else {
        const rootCandidate = path.resolve('E:/stickman-video-automation', file_path);
        if (fs.existsSync(rootCandidate)) resolvedPath = rootCandidate;
      }
    }
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: `Audio file not found at: ${file_path}` });
    }
    const probe = await renderEngine.probeMedia(resolvedPath);
    const duration = parseFloat(probe.format?.duration || 0);
    const recommended_prompts = {
      '1/4s': Math.round(duration * 0.25),
      '2/4s': Math.round(duration * 0.50),
      '3/4s': Math.round(duration * 0.75),
      '4/4s': Math.round(duration * 1.00),
      '5/4s': Math.round(duration * 1.25)
    };
    res.json({
      success: true,
      file_path: resolvedPath,
      duration,
      duration_formatted: `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`,
      recommended_prompts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- VOICE & BACKGROUND AUDIO MANAGEMENT ---
router.post('/projects/:id/audio/upload', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
    const trackType = (req.body.track_type || 'VOICEOVER').toUpperCase();
    const filePath = req.file.path;
    const probe = await renderEngine.probeMedia(filePath);
    const duration = parseFloat(probe.format.duration || 0);

    const recommended = {
      '1/4s': Math.round(duration * 0.25),
      '2/4s': Math.round(duration * 0.50),
      '3/4s': Math.round(duration * 0.75),
      '4/4s': Math.round(duration * 1.00),
      '5/4s': Math.round(duration * 1.25)
    };

    if (trackType === 'VOICEOVER') {
      await db.run('UPDATE projects SET voiceover_path = ?, voiceover_duration = ?, updated_at = datetime("now") WHERE id = ?', [filePath, duration, req.params.id]);
    } else {
      const vol = req.body.volume !== undefined ? parseFloat(req.body.volume) : 0.07;
      await db.run('UPDATE projects SET music_path = ?, music_volume = ?, updated_at = datetime("now") WHERE id = ?', [filePath, vol, req.params.id]);
    }

    res.json({
      success: true,
      file_path: filePath,
      file_name: req.file.filename,
      track_type: trackType,
      duration,
      duration_display: `${Math.floor(duration / 60)}m ${(duration % 60).toFixed(1)}s`,
      sample_rate: probe.streams[0] ? probe.streams[0].sample_rate : '44100',
      recommended_prompts: recommended
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/audio/attach', async (req, res) => {
  try {
    const { file_path, track_type = 'VOICEOVER', music_volume = 0.07, manual_duration } = req.body;
    if (!file_path) return res.status(400).json({ error: 'file_path is required' });

    let resolvedPath = file_path;
    if (!fs.existsSync(resolvedPath)) {
      const demoCandidate = path.resolve('E:/stickman-video-automation/Demo', path.basename(file_path));
      if (fs.existsSync(demoCandidate)) resolvedPath = demoCandidate;
      else return res.status(404).json({ error: `Audio file not found at: ${file_path}` });
    }

    let duration = 0;
    if (manual_duration && parseFloat(manual_duration) > 0) {
      duration = parseFloat(manual_duration);
    } else {
      const probe = await renderEngine.probeMedia(resolvedPath);
      duration = parseFloat(probe.format.duration || 0);
    }

    const recommended = {
      '1/4s': Math.round(duration * 0.25),
      '2/4s': Math.round(duration * 0.50),
      '3/4s': Math.round(duration * 0.75),
      '4/4s': Math.round(duration * 1.00),
      '5/4s': Math.round(duration * 1.25)
    };

    if (track_type.toUpperCase() === 'VOICEOVER') {
      await db.run('UPDATE projects SET voiceover_path = ?, voiceover_duration = ?, updated_at = datetime("now") WHERE id = ?', [resolvedPath, duration, req.params.id]);
    } else {
      await db.run('UPDATE projects SET music_path = ?, music_volume = ?, updated_at = datetime("now") WHERE id = ?', [resolvedPath, parseFloat(music_volume) || 0.07, req.params.id]);
    }

    res.json({
      success: true,
      file_path: resolvedPath,
      track_type: track_type.toUpperCase(),
      duration,
      duration_display: `${Math.floor(duration / 60)}m ${(duration % 60).toFixed(1)}s`,
      recommended_prompts: recommended
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/audio', async (req, res) => {
  try {
    const project = await db.get('SELECT voiceover_path, voiceover_duration, music_path, music_volume, pacing_preset FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const dur = project.voiceover_duration || 0;
    const recommended = {
      '1/4s': Math.round(dur * 0.25),
      '2/4s': Math.round(dur * 0.50),
      '3/4s': Math.round(dur * 0.75),
      '4/4s': Math.round(dur * 1.00),
      '5/4s': Math.round(dur * 1.25)
    };

    res.json({
      voiceover_path: project.voiceover_path,
      voiceover_duration: dur,
      voiceover_display: dur > 0 ? `${Math.floor(dur / 60)}m ${(dur % 60).toFixed(1)}s` : '0s',
      music_path: project.music_path,
      music_volume: project.music_volume || 0.07,
      pacing_preset: project.pacing_preset || '2/4s',
      recommended_prompts: recommended
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const { output_file_name, include_music, include_sfx, music_volume, transition_type, aspect_ratio } = req.body;
    const result = await renderEngine.renderProjectVideo(req.params.id, {
      outputFileName: output_file_name,
      includeMusic: include_music,
      includeSfx: include_sfx,
      musicVolume: music_volume !== undefined ? music_volume : 0.07, // 7% default
      transitionType: transition_type,
      aspectRatio: aspect_ratio || '16:9'
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


// --- GROQ MULTI-API KEY POOL MANAGEMENT ---
router.get('/ai/key-pool', async (req, res) => {
  try {
    const pool = await aiEngine.getApiKeyPool();
    const masked = pool.map(k => {
      if (k.length <= 10) return '***';
      return `${k.slice(0, 6)}...${k.slice(-4)}`;
    });
    res.json({
      success: true,
      key_count: pool.length,
      keys: pool,
      keys_masked: masked,
      active_cursor: aiEngine._keyCursor || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/key-pool', async (req, res) => {
  try {
    const { keys } = req.body;
    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({ error: 'keys array is required' });
    }

    const cleanKeys = keys
      .map(k => (typeof k === 'string' ? k.trim() : ''))
      .filter(k => k && k.startsWith('gsk_'));

    if (cleanKeys.length === 0) {
      return res.status(400).json({ error: 'At least one valid Groq API key (starts with gsk_) is required' });
    }

    await db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ("groq_api_keys_pool", ?, datetime("now"))', [JSON.stringify(cleanKeys)]);
    // Also save first key as default
    await db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ("groq_api_key", ?, datetime("now"))', [cleanKeys[0]]);

    res.json({
      success: true,
      message: `Saved ${cleanKeys.length} Groq API keys to pool`,
      key_count: cleanKeys.length
    });
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

// --- DYNAMIC WORKER FLEET CALCULATOR & BATCH SCHEDULER ---
router.post('/projects/:id/workers/calculate-fleet', async (req, res) => {
  try {
    const { quota_per_worker = 50, max_concurrent = 10 } = req.body;
    const prompts = await db.all('SELECT id, prompt_index FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC', [req.params.id]);
    const N = prompts.length;
    const quota = Math.max(10, parseInt(quota_per_worker, 10) || 50);
    const maxConc = Math.max(1, Math.min(10, parseInt(max_concurrent, 10) || 10));

    const W = Math.max(1, Math.ceil(N / quota));
    const metaCount = Math.ceil(W / 2);
    const flowCount = Math.floor(W / 2);
    const activeCount = Math.min(W, maxConc);
    const queuedWorkers = Math.max(0, W - maxConc);
    const totalBatches = Math.ceil(W / maxConc);

    const plan = [];
    for (let i = 1; i <= W; i++) {
      const padded = String(((i - 1) % 10) + 1).padStart(2, '0');
      const physicalWorkerId = `W${padded}`;
      const provider = (i % 2 === 1) ? 'meta' : 'flow';
      const batchNum = Math.ceil(i / maxConc);
      const startIdx = (i - 1) * quota + 1;
      const endIdx = Math.min(N, i * quota);

      plan.push({
        slot_number: i,
        virtual_worker_id: `Worker-V${String(i).padStart(2, '0')}`,
        physical_worker_id: physicalWorkerId,
        provider,
        batch: batchNum,
        status: batchNum === 1 ? 'READY_TO_LAUNCH' : 'QUEUED_FOR_RECYCLE',
        prompt_range: { start: startIdx, end: endIdx, count: Math.max(0, endIdx - startIdx + 1) }
      });
    }

    res.json({
      success: true,
      project_id: req.params.id,
      total_prompts: N,
      quota_per_worker: quota,
      total_workers_needed: W,
      meta_workers: metaCount,
      flow_workers: flowCount,
      max_concurrent_workers: maxConc,
      active_now_batch_1: activeCount,
      queued_for_recycle: queuedWorkers,
      total_batches: totalBatches,
      plan
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/workers/dispatch-fleet', async (req, res) => {
  try {
    const { quota_per_worker = 50, max_concurrent = 10, auto_launch = false } = req.body;
    const prompts = await db.all('SELECT id, prompt_index FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC', [req.params.id]);
    const N = prompts.length;
    if (N === 0) return res.status(400).json({ error: 'No prompts found in project to dispatch' });

    const quota = Math.max(10, parseInt(quota_per_worker, 10) || 50);
    const maxConc = Math.max(1, Math.min(10, parseInt(max_concurrent, 10) || 10));
    const W = Math.max(1, Math.ceil(N / quota));

    // Clear prior jobs for clean range allocation
    await db.run('DELETE FROM jobs WHERE project_id = ?', [req.params.id]);

    const activeAllocations = [];
    const queuedAllocations = [];
    const now = new Date().toISOString();

    for (let i = 1; i <= W; i++) {
      const padded = String(((i - 1) % 10) + 1).padStart(2, '0');
      const physicalWorkerId = `W${padded}`;
      const provider = (i % 2 === 1) ? 'meta' : 'flow';
      const batchNum = Math.ceil(i / maxConc);
      const startIdx = (i - 1) * quota + 1;
      const endIdx = Math.min(N, i * quota);
      const isBatch1 = (batchNum === 1);

      // Register worker in workers table
      await orchestrator.registerWorker({ id: physicalWorkerId, provider });

      // Assign prompt range to jobs
      const slice = prompts.slice(startIdx - 1, endIdx);
      for (const p of slice) {
        const jobId = `job_${req.params.id}_${physicalWorkerId}_${p.prompt_index}`;
        await db.run(`
          INSERT OR REPLACE INTO jobs (
            id, project_id, prompt_id, worker_id, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [jobId, req.params.id, p.id, physicalWorkerId, isBatch1 ? 'PENDING' : 'QUEUED', now, now]);
      }

      const itemInfo = {
        worker_id: physicalWorkerId,
        provider,
        batch: batchNum,
        start_index: startIdx,
        end_index: endIdx,
        count: slice.length,
        status: isBatch1 ? 'DISPATCHED' : 'QUEUED'
      };

      if (isBatch1) activeAllocations.push(itemInfo);
      else queuedAllocations.push(itemInfo);

      if (auto_launch && isBatch1) {
        try {
          await profileManager.launchWorker(physicalWorkerId, provider);
        } catch (lErr) {
          logger.warn('FLEET_DISPATCH', `Worker ${physicalWorkerId} launch note: ${lErr.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully dispatched fleet: ${activeAllocations.length} active in Batch 1, ${queuedAllocations.length} queued for recycle`,
      active_batch_1: activeAllocations,
      queued_batches: queuedAllocations,
      total_batches: Math.ceil(W / maxConc)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/workers/fleet-status', async (req, res) => {
  try {
    const list = [];
    const workersDir = path.resolve('E:/stickman-video-automation/Workers');

    for (let i = 1; i <= 10; i++) {
      const id = `W${String(i).padStart(2, '0')}`;
      const provider = (i % 2 === 1) ? 'meta' : 'flow';
      const profDir = path.join(workersDir, `Worker-${id}`);
      const exists = fs.existsSync(profDir);
      let hasCookies = false;

      if (exists) {
        const cookieFile = path.join(profDir, 'Default', 'Network', 'Cookies');
        hasCookies = fs.existsSync(cookieFile);
      }

      const isRunning = profileManager.activeProcesses.has(id);

      list.push({
        id,
        provider,
        profile_path: profDir,
        directory_exists: exists,
        authenticated: hasCookies,
        is_running: isRunning,
        status: isRunning ? 'RUNNING' : (hasCookies ? 'SESSION_SAVED' : 'READY_FOR_SETUP')
      });
    }

    res.json({ success: true, workers: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/login-assistant', async (req, res) => {
  try {
    const { worker_id = 'W01', provider } = req.body;
    const workerId = (worker_id || 'W01').toUpperCase();

    if (workerId === 'ALL') {
      logger.info('WORKER_LOGIN', 'Launching all 10 worker profiles (W01–W10) for one-time login...');
      const launched = [];
      for (let i = 1; i <= 10; i++) {
        const wId = `W${String(i).padStart(2, '0')}`;
        const prov = (i % 2 === 1) ? 'meta' : 'flow';
        try {
          const result = await profileManager.launchWorker(wId, prov);
          launched.push({ workerId: wId, provider: prov, success: true, details: result });
          // stagger launches slightly to prevent process spikes
          await new Promise(r => setTimeout(r, 400));
        } catch (lErr) {
          logger.warn('WORKER_LOGIN', `Failed launching ${wId}: ${lErr.message}`);
          launched.push({ workerId: wId, provider: prov, success: false, error: lErr.message });
        }
      }
      return res.json({
        success: true,
        message: 'Launched workers W01 through W10 for 1-time login. Please complete login in the opened browser windows.',
        workers: launched
      });
    }

    const prov = provider || ((parseInt(workerId.replace('W', ''), 10) % 2 === 1) ? 'meta' : 'flow');
    logger.info('WORKER_LOGIN', `Opening interactive login window for ${workerId} (${prov})...`);
    const launchResult = await profileManager.launchWorker(workerId, prov);
    res.json({
      success: true,
      message: `Interactive login browser opened for worker ${workerId} (${prov}). Complete 1-time login in the opened browser window.`,
      details: launchResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
