const fs = require('fs');
const path = require('path');
const multer = require("multer");
const express = require('express');
const router = express.Router();
const ROOT_DIR = process.env.STICKMAN_ROOT || path.resolve(__dirname, '../../');

// --- AUDIO UPLOAD CONFIGURATION ---
const audioStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const proj = await db.get('SELECT directory_path FROM projects WHERE id = ?', [req.params.id]);
      const dir = proj ? path.join(proj.directory_path, 'audio') : path.join(ROOT_DIR, 'uploads');
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

router.get('/ai/health', async (req, res) => {
  try {
    const pool = await aiEngine.getApiKeyPool();
    const gpu = await renderEngine.detectGpuEncoder();
    res.json({
      status: 'ok',
      groq: {
        configured: pool.length > 0,
        keys_count: pool.length,
        model: 'llama-3.3-70b-versatile'
      },
      render: {
        gpu_encoder: gpu.encoder,
        gpu_detected: gpu.isGpu
      },
      whisper: {
        available: pool.length > 0 || !!process.env.OPENAI_API_KEY
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

router.delete('/projects/:id', async (req, res) => {
  try {
    const purge = req.query.purge === 'true';
    const result = await projectManager.deleteProject(req.params.id, purge);
    res.json(result);
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
          const demoCandidate = path.join(ROOT_DIR, 'Demo', path.basename(testPath));
          if (fs.existsSync(demoCandidate)) testPath = demoCandidate;
          else {
            const rootCandidate = path.join(ROOT_DIR, testPath);
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

// Realtime Prompt Image Serving & Auto-Sync from Downloads
router.get('/projects/:id/prompts/:promptIndex/image', async (req, res) => {
  try {
    const { id, promptIndex } = req.params;
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).send('Project not found');

    const promptStr = String(promptIndex).padStart(3, '0');
    const ingestionManager = require('./ingestion_manager');
    const centralDir = path.join(project.directory_path, 'central_images');

    // Check Downloads directory and subfolders first for fresh real images
    const searchDirs = [
      path.join(ingestionManager.downloadsDir, project.name),
      path.join(ingestionManager.downloadsDir, 'veo-folder-1'),
      path.join(ingestionManager.downloadsDir, 'meta-folder-1'),
      path.join(ingestionManager.downloadsDir, 'StickmanStudio'),
      ingestionManager.downloadsDir
    ];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const match = files.find(f => f.startsWith(`${promptStr}_`) && /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (match) {
          const dlPath = path.join(dir, match);
          if (!fs.existsSync(centralDir)) fs.mkdirSync(centralDir, { recursive: true });
          const destPath = path.join(centralDir, match);
          try { fs.copyFileSync(dlPath, destPath); } catch (e) {}

          await db.run("UPDATE prompts SET file_name = ?, file_path = ?, status = 'COMPLETED' WHERE project_id = ? AND prompt_index = ?", [match, destPath, id, parseInt(promptIndex, 10)]);
          await db.run("UPDATE timeline_items SET image_path = ? WHERE project_id = ? AND order_index = ?", [destPath, id, parseInt(promptIndex, 10)]);

          return res.sendFile(dlPath);
        }
      }
    }

    // Direct check in project central_images
    if (fs.existsSync(centralDir)) {
      const files = fs.readdirSync(centralDir);
      const match = files.find(f => f.startsWith(`${promptStr}_`) && /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (match) {
        return res.sendFile(path.join(centralDir, match));
      }
    }

    return res.status(404).send('Image not ready');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Clear failed prompts from project
router.delete('/projects/:id/prompts/failed', async (req, res) => {
  try {
    const delPrompts = await db.run("DELETE FROM prompts WHERE project_id = ? AND status = 'FAILED'", [req.params.id]);
    await db.run("DELETE FROM jobs WHERE project_id = ? AND status = 'FAILED'", [req.params.id]);
    res.json({ success: true, message: 'Cleared all failed prompts from queue' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry failed prompts (reset to PENDING)
router.post('/projects/:id/prompts/retry-failed', async (req, res) => {
  try {
    const now = new Date().toISOString();
    await db.run("UPDATE prompts SET status = 'QUEUED', assigned_worker_id = NULL, updated_at = ? WHERE project_id = ? AND status = 'FAILED'", [now, req.params.id]);
    await db.run("UPDATE jobs SET status = 'PENDING', last_error = NULL, updated_at = ? WHERE project_id = ? AND status = 'FAILED'", [now, req.params.id]);
    res.json({ success: true, message: 'Reset all failed prompts to PENDING for retry' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all prompts from project queue
router.delete('/projects/:id/prompts/all', async (req, res) => {
  try {
    await db.run("DELETE FROM prompts WHERE project_id = ?", [req.params.id]);
    await db.run("DELETE FROM jobs WHERE project_id = ?", [req.params.id]);
    res.json({ success: true, message: 'All prompts cleared from queue' });
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

router.post('/projects/:id/character-reference', async (req, res) => {
  try {
    const { character_name, character_description, image_base64 } = req.body;
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    let imagePath = '';
    const now = new Date().toISOString();
    const charName = character_name || 'Main Stickman';
    const charRefId = `char_${Date.now()}`;

    if (image_base64) {
      const cleanB64 = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64;
      const imgBuffer = Buffer.from(cleanB64, 'base64');
      const safeName = charName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const charDir = path.join(project.directory_path, 'characters', safeName);
      fs.mkdirSync(charDir, { recursive: true });
      imagePath = path.join(charDir, 'reference.png');
      fs.writeFileSync(imagePath, imgBuffer);
    }

    await db.run(`
      INSERT INTO character_references (
        id, project_id, character_name, image_path, version, status, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 'READY', ?, ?, ?)
    `, [charRefId, req.params.id, charName, imagePath || '', character_description || '', now, now]);

    logger.info('ROUTES', `Updated character reference for project ${req.params.id}: ${charName} (image: ${imagePath ? 'yes' : 'no'})`);
    res.json({ success: true, character_id: charRefId, image_path: imagePath });
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
      const demoCandidate = path.join(ROOT_DIR, 'Demo', path.basename(file_path));
      if (fs.existsSync(demoCandidate)) resolvedPath = demoCandidate;
      else {
        const rootCandidate = path.join(ROOT_DIR, file_path);
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
      // Background pre-transcription so timeline subtitles are ready ahead of time (Issue #4)
      setTimeout(async () => {
        try {
          const capCount = await db.get('SELECT COUNT(*) as count FROM captions WHERE project_id = ?', [req.params.id]);
          if (!capCount || capCount.count === 0) {
            logger.info('TRANSCRIPTION', `Triggering background pre-transcription for project ${req.params.id}...`);
            await transcriptionService.transcribeAudio(req.params.id, filePath);
          }
        } catch (e) {
          logger.warn('TRANSCRIPTION', `Background pre-transcription non-fatal notice: ${e.message}`);
        }
      }, 300);
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
      const demoCandidate = path.join(ROOT_DIR, 'Demo', path.basename(file_path));
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
    const {
      output_file_name,
      include_music,
      include_sfx,
      music_volume,
      transition_type,
      aspect_ratio,
      resolution,
      effects_preset,
      vignette_enabled,
      blur_amount,
      sharpen_enabled,
      grain_enabled,
      fps,
      speed_preset,
      crf,
      audio_bitrate,
      enable_hwaccel
    } = req.body;
    const result = await renderEngine.renderProjectVideo(req.params.id, {
      outputFileName: output_file_name,
      includeMusic: include_music !== undefined ? include_music : true,
      includeSfx: include_sfx !== undefined ? include_sfx : true,
      musicVolume: music_volume !== undefined ? music_volume : 0.07, // 7% default
      transitionType: transition_type || 'cross_dissolve',
      aspectRatio: aspect_ratio || '16:9',
      resolution: resolution || (aspect_ratio === '9:16' ? '1080x1920' : '1920x1080'),
      effectsPreset: effects_preset || 'normal',
      vignetteEnabled: !!vignette_enabled,
      blurAmount: parseFloat(blur_amount) || 0,
      sharpenEnabled: !!sharpen_enabled,
      grainEnabled: !!grain_enabled,
      fps: parseInt(fps, 10) || 60,
      speedPreset: speed_preset || 'veryfast',
      crf: crf !== undefined ? crf : null,
      audioBitrate: audio_bitrate || '320k',
      enableHwaccel: enable_hwaccel !== false
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
    const candidates = [
      'e:/stickman-video-automation/Old Md files/story to prompts.md',
      'E:/stickman-video-automation/Old Md files/story to prompts.md',
      path.resolve(__dirname, '../../Old Md files/story to prompts.md'),
      path.resolve(__dirname, '../../master_prompt.md'),
      path.resolve(__dirname, '../master_prompt.md')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, 'utf8');
        return res.json({ master_prompt: text });
      }
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

    res.json({
      success: true,
      project_id: req.params.id,
      total_prompts: N,
      quota_per_worker: quota,
      total_workers_needed: W,
      default_meta_workers: metaCount,
      default_flow_workers: flowCount,
      meta_workers: metaCount,
      flow_workers: flowCount,
      max_concurrent_workers: maxConc,
      active_now_batch_1: activeCount,
      queued_for_recycle: queuedWorkers,
      total_batches: totalBatches
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/workers/dispatch-fleet', async (req, res) => {
  try {
    const {
      quota_per_worker = 50,
      meta_count = null,
      flow_count = null,
      auto_launch = true
    } = req.body;

    const prompts = await db.all('SELECT id, prompt_index FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC', [req.params.id]);
    const N = prompts.length;
    if (N === 0) return res.status(400).json({ error: 'No prompts found in project to dispatch' });

    const quota = Math.max(10, parseInt(quota_per_worker, 10) || 50);
    const W = Math.max(1, Math.ceil(N / quota));

    // Resolve user counts or 50/50 defaults
    let numMeta = meta_count !== null ? parseInt(meta_count, 10) : Math.ceil(W / 2);
    let numFlow = flow_count !== null ? parseInt(flow_count, 10) : Math.floor(W / 2);

    if (isNaN(numMeta)) numMeta = 0;
    if (isNaN(numFlow)) numFlow = 0;

    // Safety cap at 10 workers
    if (numMeta + numFlow > 10) {
      const scale = 10 / (numMeta + numFlow);
      numMeta = Math.floor(numMeta * scale);
      numFlow = 10 - numMeta;
    }
    const totalWorkersToUse = Math.max(1, Math.min(10, numMeta + numFlow));

    // Curated physical worker IDs pool
    const allMetaSlots = ['W02', 'W03', 'W05', 'W08', 'W10', 'W01', 'W04', 'W06', 'W07', 'W09'];
    const allFlowSlots = ['W01', 'W04', 'W06', 'W07', 'W09', 'W02', 'W03', 'W05', 'W08', 'W10'];

    const chosenWorkers = [];
    const usedIds = new Set();

    // Pick Meta workers
    for (const wId of allMetaSlots) {
      if (chosenWorkers.filter(w => w.provider === 'meta').length >= numMeta) break;
      if (!usedIds.has(wId)) {
        chosenWorkers.push({ id: wId, provider: 'meta' });
        usedIds.add(wId);
      }
    }

    // Pick Flow workers
    for (const wId of allFlowSlots) {
      if (chosenWorkers.filter(w => w.provider === 'flow').length >= numFlow) break;
      if (!usedIds.has(wId)) {
        chosenWorkers.push({ id: wId, provider: 'flow' });
        usedIds.add(wId);
      }
    }

    // Fill any gap up to totalWorkersToUse
    for (let i = 1; i <= 10; i++) {
      if (chosenWorkers.length >= totalWorkersToUse) break;
      const wId = `W${String(i).padStart(2, '0')}`;
      if (!usedIds.has(wId)) {
        chosenWorkers.push({ id: wId, provider: 'meta' });
        usedIds.add(wId);
      }
    }

    // Clear prior jobs for clean range allocation
    await db.run('DELETE FROM jobs WHERE project_id = ?', [req.params.id]);

    const now = new Date().toISOString();
    const activeAllocations = [];

    // Assign batches of 50 prompts to each active worker
    for (let i = 0; i < chosenWorkers.length; i++) {
      const workerInfo = chosenWorkers[i];
      const startIdx = i * quota + 1;
      const endIdx = Math.min(N, (i + 1) * quota);

      await orchestrator.registerWorker({ id: workerInfo.id, provider: workerInfo.provider });
      await db.run("UPDATE workers SET provider = ?, status = 'IDLE', active_job_id = NULL WHERE id = ?", [workerInfo.provider, workerInfo.id]);

      const slice = prompts.slice(startIdx - 1, endIdx);
      for (const p of slice) {
        const jobId = `job_${req.params.id}_${workerInfo.id}_${p.prompt_index}`;
        const leaseExpires = new Date(Date.now() + 3600 * 1000).toISOString();
        await db.run(`
          INSERT OR REPLACE INTO jobs (
            id, project_id, prompt_id, worker_id, provider, status,
            lease_owner, lease_expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?, ?)
        `, [jobId, req.params.id, p.id, workerInfo.id, workerInfo.provider, workerInfo.id, leaseExpires, now, now]);

        await db.run("UPDATE prompts SET assigned_worker_id = ?, status = 'ASSIGNED', updated_at = ? WHERE id = ?", [workerInfo.id, now, p.id]);
      }

      activeAllocations.push({
        worker_id: workerInfo.id,
        provider: workerInfo.provider,
        batch: 1,
        start_index: startIdx,
        end_index: endIdx,
        count: slice.length,
        status: 'DISPATCHED'
      });
    }

    // Remaining prompts beyond active workers (e.g. prompts 501..530)
    const assignedCount = chosenWorkers.length * quota;
    if (N > assignedCount) {
      const remainingPrompts = prompts.slice(assignedCount);
      for (const p of remainingPrompts) {
        await db.run("UPDATE prompts SET assigned_worker_id = NULL, status = 'QUEUED', updated_at = ? WHERE id = ?", [now, p.id]);
      }
    }

    // Auto-launch worker Chrome profiles
    if (auto_launch) {
      for (const w of chosenWorkers) {
        try {
          await profileManager.launchWorker(w.id, w.provider);
          await new Promise(r => setTimeout(r, 600));
        } catch (lErr) {
          logger.warn('FLEET_DISPATCH', `Worker ${w.id} launch note: ${lErr.message}`);
        }
      }
    }

    const remainingQueued = Math.max(0, N - assignedCount);
    res.json({
      success: true,
      message: `Fleet launched: ${chosenWorkers.length} active worker(s) (${chosenWorkers.filter(w=>w.provider==='meta').length} Meta + ${chosenWorkers.filter(w=>w.provider==='flow').length} Flow), ${remainingQueued} remaining prompt(s) in auto-queue`,
      active_workers: activeAllocations,
      remaining_queued: remainingQueued,
      total_prompts: N
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/workers/fleet-status', async (req, res) => {
  try {
    const list = [];
    const workersDir = path.join(ROOT_DIR, 'Workers');
    const dbWorkers = await db.all('SELECT id, provider, status, profile_name FROM workers ORDER BY id ASC');
    const dbMap = {};
    dbWorkers.forEach(w => { dbMap[w.id] = w; });

    for (let i = 1; i <= 10; i++) {
      const id = `W${String(i).padStart(2, '0')}`;
      const dbEntry = dbMap[id];
      const provider = (dbEntry && dbEntry.provider) ? dbEntry.provider.toLowerCase() : ((i % 2 === 1) ? 'flow' : 'meta');
      const profDir = path.join(workersDir, `Worker-${id}`);
      const exists = fs.existsSync(profDir);
      let hasCookies = false;

      if (exists) {
        const cookieFile1 = path.join(profDir, 'Default', 'Network', 'Cookies');
        const cookieFile2 = path.join(profDir, 'Default', 'Cookies');
        hasCookies = fs.existsSync(cookieFile1) || fs.existsSync(cookieFile2);
      }

      const isRunning = profileManager.activeProcesses.has(id);
      const activeInfo = isRunning ? profileManager.activeProcesses.get(id) : null;

      list.push({
        id,
        provider,
        profile_path: profDir,
        directory_exists: exists,
        authenticated: hasCookies,
        is_running: isRunning,
        pid: activeInfo ? activeInfo.pid : null,
        status: isRunning ? 'RUNNING' : (hasCookies ? 'SESSION_SAVED' : 'READY_FOR_SETUP')
      });
    }

    res.json({ success: true, workers: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a worker's provider (Flow <-> Meta)
router.post('/workers/:id/provider', async (req, res) => {
  try {
    const workerId = req.params.id.toUpperCase();
    const { provider } = req.body;
    const prov = (provider || '').toLowerCase();
    if (!['meta', 'flow'].includes(prov)) {
      return res.status(400).json({ error: "Provider must be 'meta' or 'flow'" });
    }

    const now = new Date().toISOString();
    await db.run('UPDATE workers SET provider = ?, updated_at = ? WHERE id = ?', [
      prov, now, workerId
    ]);

    // Re-provision isolated extension if needed
    try {
      profileManager.prepareWorkerExtension(workerId, prov);
    } catch (e) {
      logger.warn('WORKER_CONFIG', `Warning preparing extension for ${workerId}: ${e.message}`);
    }

    logger.info('WORKER_ORCHESTRATOR', `Updated worker ${workerId} provider to ${prov.toUpperCase()}`);
    res.json({ success: true, workerId, provider: prov });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Launch One-Time Login Assistant (1 Worker = 1 Dedicated Extension & Single URL)
router.post('/workers/login-assistant', async (req, res) => {
  try {
    const { worker_id = 'W01', provider = null } = req.body;
    const workerId = (worker_id || 'W01').toUpperCase();

    if (workerId === 'ALL') {
      logger.info('WORKER_LOGIN', 'Launching all 10 worker profiles (W01–W10) with single dedicated extension & single service...');
      const launched = [];
      const dbWorkers = await db.all('SELECT id, provider FROM workers ORDER BY id ASC');
      const provMap = {};
      dbWorkers.forEach(w => { provMap[w.id] = w.provider; });

      for (let i = 1; i <= 10; i++) {
        const wId = `W${String(i).padStart(2, '0')}`;
        const wProv = provMap[wId] || ((i % 2 === 1) ? 'flow' : 'meta');
        try {
          const result = await profileManager.launchLoginAssistant(wId, wProv);
          launched.push({ workerId: wId, provider: wProv, success: true, details: result });
          // Stagger launches by 1.2s so Windows opens each window smoothly
          await new Promise(r => setTimeout(r, 1200));
        } catch (lErr) {
          logger.warn('WORKER_LOGIN', `Failed launching login window for ${wId}: ${lErr.message}`);
          launched.push({ workerId: wId, provider: wProv, success: false, error: lErr.message });
        }
      }
      return res.json({
        success: true,
        message: 'Launched all 10 worker profiles! Each worker opened with its own dedicated single extension and page (Flow or Meta).',
        workers: launched
      });
    }

    logger.info('WORKER_LOGIN', `Opening dedicated login browser for ${workerId}...`);
    const launchResult = await profileManager.launchLoginAssistant(workerId, provider);
    res.json({
      success: true,
      message: `Opened browser profile for worker ${workerId} (${launchResult.provider.toUpperCase()}) with single dedicated extension.`,
      details: launchResult
    });
  } catch (err) {
    logger.error('WORKER_LOGIN', `Failed to launch login assistant: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/stop-all', async (req, res) => {
  try {
    const result = await profileManager.stopAllWorkers();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open folder in Windows File Explorer
router.post('/system/open-folder', async (req, res) => {
  try {
    const { folder_type = 'logs', project_id } = req.body;
    const { exec } = require('child_process');
    let targetPath = '';

    if (folder_type === 'logs') {
      targetPath = path.join(__dirname, '../logs');
    } else if (folder_type === 'renders' && project_id) {
      const proj = await db.get('SELECT directory_path FROM projects WHERE id = ?', [project_id]);
      targetPath = proj ? path.join(proj.directory_path, 'renders') : path.join(ROOT_DIR, 'renders');
    } else if (folder_type === 'workers') {
      targetPath = path.join(ROOT_DIR, 'Workers');
    } else {
      targetPath = path.resolve('E:/stickman-video-automation');
    }

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    exec(`explorer.exe "${targetPath}"`);
    res.json({ success: true, opened: targetPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Groq API Key connectivity
router.post('/settings/test-groq', async (req, res) => {
  try {
    const { api_key } = req.body;
    const keyToTest = api_key || (await db.get("SELECT value FROM settings WHERE key = 'groq_api_key'"))?.value;
    if (!keyToTest) return res.status(400).json({ success: false, error: 'No Groq API Key provided or configured' });

    const startTime = Date.now();
    const fetch = global.fetch || require('node-fetch');
    const resp = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${keyToTest}` }
    });
    const latency = Date.now() - startTime;

    if (resp.ok) {
      const data = await resp.json();
      const modelCount = data.data ? data.data.length : 0;
      res.json({ success: true, latency_ms: latency, models_available: modelCount, message: `Groq API Key is valid! (${modelCount} models available, Latency: ${latency}ms)` });
    } else {
      const errData = await resp.json().catch(() => ({}));
      res.status(400).json({ success: false, error: errData.error?.message || `Groq API returned HTTP ${resp.status}` });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download / Read raw log file
router.get('/logs/raw', (req, res) => {
  const logPath = path.resolve('E:/stickman-video-automation/studio/logs/studio.log');
  if (!fs.existsSync(logPath)) {
    return res.type('text/plain').send('No logs recorded yet.');
  }
  res.sendFile(logPath);
});

router.get('/workers', async (req, res) => {
  try {
    const existing = await db.all(`SELECT id FROM workers`);
    const existingSet = new Set(existing.map(w => w.id));
    const now = new Date().toISOString();
    for (let i = 1; i <= 10; i++) {
      const wId = `W${String(i).padStart(2, '0')}`;
      if (!existingSet.has(wId)) {
        const provider = (i % 2 === 1) ? 'flow' : 'meta';
        const profile = `Worker-${String(i).padStart(2, '0')}`;
        await db.run(`
          INSERT INTO workers (id, provider, status, profile_name, profile_path, reference_status, active_character_version, last_heartbeat, registered_at, updated_at)
          VALUES (?, ?, 'OFFLINE', ?, ?, 'NOT_READY', 0, ?, ?, ?)
        `, [wId, provider, profile, `Workers/${profile}`, now, now, now]);
      }
    }
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
