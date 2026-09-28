const fs = require('fs');
const pPath = 'E:/stickman-video-automation/studio/server/routes.js';
let content = fs.readFileSync(pPath, 'utf8');

// 1. Standalone probe route
const audioUploadMarker = `// --- VOICE & BACKGROUND AUDIO MANAGEMENT ---`;
const probeEndpointCode = `// --- STANDALONE AUDIO PROBE ENDPOINT ---
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
      return res.status(404).json({ error: \`Audio file not found at: \${file_path}\` });
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
      duration_formatted: \`\${Math.floor(duration / 60)}:\${String(Math.floor(duration % 60)).padStart(2, '0')}\`,
      recommended_prompts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});\n\n`;

if (!content.includes('/audio/probe')) {
  content = content.replace(audioUploadMarker, probeEndpointCode + audioUploadMarker);
}

// 2. Update router.post('/projects', ...)
const targetCreateRoute = `router.post('/projects', async (req, res) => {
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
});`;

const replacementCreateRoute = `router.post('/projects', async (req, res) => {
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
        logger.warn('ROUTES', \`Auto-probing voiceover duration failed: \${pErr.message}\`);
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
});`;

if (!content.includes(targetCreateRoute)) {
  console.error('Target create route not found!');
  process.exit(1);
}
content = content.replace(targetCreateRoute, replacementCreateRoute);

fs.writeFileSync(pPath, content, 'utf8');
console.log('Successfully updated routes.js');
