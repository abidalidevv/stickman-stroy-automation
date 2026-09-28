const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/app_v2.js';
let js = fs.readFileSync(p, 'utf8');

// Target to replace: from closeNewProjectModal to loadAiModels
const targetStart = `function closeNewProjectModal() {`;
const targetEnd = `// =============================================\n// STEP 1: AI STORY ENGINE & PROMPTS\n// =============================================`;

const sIdx = js.indexOf(targetStart);
const eIdx = js.indexOf(targetEnd);

if (sIdx === -1 || eIdx === -1) {
  console.error('Boundaries not found in app_v2.js!');
  process.exit(1);
}

const replacementCode = `// State for modal uploads
let modalCharBase64_M1 = null;
let modalVoiceFile_M1 = null;
let modalMusicFile_M1 = null;

let modalVoiceFile_M2 = null;
let modalMusicFile_M2 = null;

function openNewProjectModal() {
  const modal = document.getElementById('newProjectModal');
  if (!modal) return;
  modal.style.display = 'flex';
  switchNewProjectModalTab('MODE_1');

  // Pre-load default master prompt if available
  const mpArea = document.getElementById('newProjMasterPrompt');
  if (mpArea && !mpArea.value) {
    fetch('/api/v1/ai/master-prompt')
      .then(r => r.json())
      .then(d => { if (d.content) mpArea.value = d.content; })
      .catch(() => {});
  }
}

function closeNewProjectModal() {
  const modal = document.getElementById('newProjectModal');
  if (modal) modal.style.display = 'none';
}

function switchNewProjectModalTab(mode) {
  document.getElementById('newProjActiveMode').value = mode;
  const tab1 = document.getElementById('tabNewProjMode1');
  const tab2 = document.getElementById('tabNewProjMode2');
  const c1 = document.getElementById('modalMode1Container');
  const c2 = document.getElementById('modalMode2Container');

  if (mode === 'MODE_1') {
    tab1.classList.add('active');
    tab2.classList.remove('active');
    c1.style.display = 'block';
    c2.style.display = 'none';
  } else {
    tab1.classList.remove('active');
    tab2.classList.add('active');
    c1.style.display = 'none';
    c2.style.display = 'block';
  }
}

// Auto-detect duration from local path or uploaded file
async function autoDetectModalDuration(tab) {
  const pathInput = document.getElementById(tab === 'm1' ? 'newProjVoiceoverPath' : 'newProjVoiceoverPathM2');
  const durInput = document.getElementById(tab === 'm1' ? 'newProjDuration' : 'newProjDurationM2');
  const badge = document.getElementById(tab === 'm1' ? 'newProjDurationBadge' : 'newProjDurationBadgeM2');

  const filePath = pathInput ? pathInput.value.trim() : '';
  if (!filePath) {
    showToast('Please specify a voiceover file or path (e.g. Demo/voiceover.wav)', 'warn');
    return;
  }

  showToast('Detecting audio duration...', 'info');
  try {
    const res = await fetch('/api/v1/audio/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });
    const data = await res.json();
    if (data.duration && data.duration > 0) {
      durInput.value = data.duration.toFixed(1);
      badge.textContent = data.duration.toFixed(1) + 's';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
      badge.style.color = 'var(--emerald)';
      updateModalPromptCalculation(tab);
      showToast(\`Audio probed: \${data.duration.toFixed(1)}s (\${data.duration_formatted})\`, 'success');
    } else {
      showToast(data.error || 'Failed detecting duration', 'error');
    }
  } catch (err) {
    showToast('Error probing audio: ' + err.message, 'error');
  }
}

function onVoiceoverPathChange(tab) {
  // auto trigger calculation if changed
  updateModalPromptCalculation(tab);
}

function updateModalPromptCalculation(tab) {
  const durEl = document.getElementById(tab === 'm1' ? 'newProjDuration' : 'newProjDurationM2');
  const pacingEl = document.getElementById(tab === 'm1' ? 'newProjPacing' : 'newProjPacingM2');
  const targetBadge = document.getElementById('modalTargetPromptsM1');

  if (!durEl || !pacingEl) return;
  const dur = parseFloat(durEl.value) || 0;
  const pacing = pacingEl.value;

  const MULTIPLIERS = { '1/4s': 0.25, '2/4s': 0.50, '3/4s': 0.75, '4/4s': 1.00, '5/4s': 1.25 };
  const mult = MULTIPLIERS[pacing] || 0.75;
  const count = Math.round(dur * mult);

  if (targetBadge && tab === 'm1') {
    targetBadge.textContent = count + ' Prompts';
  }
}

function updateModalScriptWordCount(tab) {
  const txt = document.getElementById('newProjScript').value.trim();
  const words = txt ? txt.split(/\\s+/).length : 0;
  const label = document.getElementById('newProjScriptWordCount');
  if (label) label.textContent = words + ' words';
}

function handleModalVoiceoverFile(input, tab) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const pathInput = document.getElementById(tab === 'm1' ? 'newProjVoiceoverPath' : 'newProjVoiceoverPathM2');
    if (pathInput) pathInput.value = file.name;
    if (tab === 'm1') modalVoiceFile_M1 = file;
    else modalVoiceFile_M2 = file;

    // Detect duration in browser using Audio context
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      if (audio.duration && audio.duration > 0) {
        const durInput = document.getElementById(tab === 'm1' ? 'newProjDuration' : 'newProjDurationM2');
        const badge = document.getElementById(tab === 'm1' ? 'newProjDurationBadge' : 'newProjDurationBadgeM2');
        if (durInput) durInput.value = audio.duration.toFixed(1);
        if (badge) {
          badge.textContent = audio.duration.toFixed(1) + 's';
          badge.style.color = 'var(--emerald)';
        }
        updateModalPromptCalculation(tab);
      }
    };
    showToast(\`Selected voiceover: \${file.name}\`, 'info');
  }
}

function handleModalMusicFile(input, tab) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const pathInput = document.getElementById(tab === 'm1' ? 'newProjMusicPath' : 'newProjMusicPathM2');
    if (pathInput) pathInput.value = file.name;
    if (tab === 'm1') modalMusicFile_M1 = file;
    else modalMusicFile_M2 = file;
    showToast(\`Selected music: \${file.name}\`, 'info');
  }
}

function handleModalCharImage(input, tab) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      modalCharBase64_M1 = e.target.result;
      const thumb = document.getElementById('newProjCharThumb');
      if (thumb) {
        thumb.src = e.target.result;
        thumb.style.display = 'block';
      }
      showToast('Avatar image loaded', 'success');
    };
    reader.readAsDataURL(file);
  }
}

function handleModalPromptFile(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const area = document.getElementById('newProjPromptList');
      if (area) {
        area.value = e.target.result;
        updateModalPromptListCount();
      }
      showToast(\`Loaded prompt file: \${file.name}\`, 'success');
    };
    reader.readAsText(file);
  }
}

function updateModalPromptListCount() {
  const area = document.getElementById('newProjPromptList');
  const badge = document.getElementById('newProjPromptCountBadge');
  if (!area || !badge) return;
  const lines = area.value.split(/\\r?\\n/).filter(l => l.trim().length > 0);
  badge.textContent = \`\${lines.length} prompts\`;
}

// =============================================
// MASTER PROJECT CREATION (ALL CANONICAL INPUTS)
// =============================================
async function submitNewProject() {
  const mode = document.getElementById('newProjActiveMode').value;
  let payload = {};

  if (mode === 'MODE_1') {
    const name = document.getElementById('newProjName').value.trim();
    if (!name) {
      showToast('Please enter a Video Title / Project Name', 'warn');
      return;
    }
    const voiceover_path = document.getElementById('newProjVoiceoverPath').value.trim();
    const duration = parseFloat(document.getElementById('newProjDuration').value) || 0;
    const pacing = document.getElementById('newProjPacing').value;
    const music_path = document.getElementById('newProjMusicPath').value.trim();
    const music_vol = (parseFloat(document.getElementById('newProjMusicVol').value) || 7) / 100;
    const char_name = document.getElementById('newProjCharName').value.trim() || 'Main Stickman';
    const char_desc = document.getElementById('newProjCharDesc').value.trim();
    const script = document.getElementById('newProjScript').value.trim();
    const master_prompt = document.getElementById('newProjMasterPrompt').value.trim();

    payload = {
      name,
      mode: 'MODE_1',
      voiceover_path: voiceover_path || (modalVoiceFile_M1 ? modalVoiceFile_M1.name : null),
      voiceover_duration: duration,
      pacing_preset: pacing,
      music_path: music_path || (modalMusicFile_M1 ? modalMusicFile_M1.name : null),
      music_volume: music_vol,
      character_name: char_name,
      character_description: char_desc,
      character_image_base64: modalCharBase64_M1,
      script_text: script,
      master_prompt: master_prompt || null
    };
  } else {
    const name = document.getElementById('newProjNameM2').value.trim();
    if (!name) {
      showToast('Please enter a Project Name', 'warn');
      return;
    }
    const raw_prompts = document.getElementById('newProjPromptList').value.trim();
    const script = document.getElementById('newProjScriptM2').value.trim();
    const voiceover_path = document.getElementById('newProjVoiceoverPathM2').value.trim();
    const duration = parseFloat(document.getElementById('newProjDurationM2').value) || 0;
    const pacing = document.getElementById('newProjPacingM2').value;
    const music_path = document.getElementById('newProjMusicPathM2').value.trim();
    const music_vol = (parseFloat(document.getElementById('newProjMusicVolM2').value) || 7) / 100;
    const char_name = document.getElementById('newProjCharNameM2').value.trim() || 'Main Stickman';
    const char_desc = document.getElementById('newProjCharDescM2').value.trim();

    payload = {
      name,
      mode: 'MODE_2',
      raw_prompts: raw_prompts || null,
      script_text: script,
      voiceover_path: voiceover_path || (modalVoiceFile_M2 ? modalVoiceFile_M2.name : null),
      voiceover_duration: duration,
      pacing_preset: pacing,
      music_path: music_path || (modalMusicFile_M2 ? modalMusicFile_M2.name : null),
      music_volume: music_vol,
      character_name: char_name,
      character_description: char_desc
    };
  }

  try {
    showToast('Creating production project...', 'info');
    const res = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const created = await res.json();
    if (created.id) {
      // If voiceover audio was chosen via file picker, upload it directly
      const activeVoiceFile = (mode === 'MODE_1') ? modalVoiceFile_M1 : modalVoiceFile_M2;
      if (activeVoiceFile) {
        const formData = new FormData();
        formData.append('audio', activeVoiceFile);
        formData.append('track_type', 'VOICEOVER');
        await fetch(\`/api/v1/projects/\${created.id}/audio/upload\`, { method: 'POST', body: formData }).catch(console.error);
      }

      // If background music was chosen via file picker, upload it
      const activeMusicFile = (mode === 'MODE_1') ? modalMusicFile_M1 : modalMusicFile_M2;
      if (activeMusicFile) {
        const formData = new FormData();
        formData.append('audio', activeMusicFile);
        formData.append('track_type', 'MUSIC');
        formData.append('volume', payload.music_volume || 0.07);
        await fetch(\`/api/v1/projects/\${created.id}/audio/upload\`, { method: 'POST', body: formData }).catch(console.error);
      }

      showToast(\`Project created: \${created.name}\`, 'success');
      closeNewProjectModal();
      await loadProjects();
      await onSelectProject(created.id);
      goToStep(1);
    } else {
      showToast(created.error || 'Failed to create project', 'error');
    }
  } catch (err) {
    showToast(\`Error creating project: \${err.message}\`, 'error');
  }
}

// Step 1 Audio Director Helpers
async function autoDetectM1Voiceover() {
  const pathInput = document.getElementById('m1VoiceoverPath');
  const durInput = document.getElementById('m1Duration');
  const badge = document.getElementById('m1DurationBadge');
  const filePath = pathInput ? pathInput.value.trim() : '';

  if (!filePath) {
    showToast('Please specify a voiceover file or path', 'warn');
    return;
  }

  showToast('Detecting voiceover duration...', 'info');
  try {
    const res = await fetch('/api/v1/audio/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });
    const data = await res.json();
    if (data.duration && data.duration > 0) {
      durInput.value = data.duration.toFixed(1);
      badge.textContent = data.duration.toFixed(1) + 's';
      badge.style.color = 'var(--emerald)';
      updateM1PromptEstimate();
      if (activeProjectId) {
        await fetch(\`/api/v1/projects/\${activeProjectId}/audio/attach\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: data.file_path, track_type: 'VOICEOVER', manual_duration: data.duration })
        }).catch(console.error);
      }
      showToast(\`Voiceover duration detected: \${data.duration.toFixed(1)}s\`, 'success');
    } else {
      showToast(data.error || 'Failed detecting duration', 'error');
    }
  } catch (e) {
    showToast('Error probing audio: ' + e.message, 'error');
  }
}

function onM1VoiceoverPathChange() {
  updateM1PromptEstimate();
}

function handleM1VoiceoverFile(input) {
  if (input.files && input.files[0] && activeProjectId) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('track_type', 'VOICEOVER');
    fetch(\`/api/v1/projects/\${activeProjectId}/audio/upload\`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        if (d.voiceover_duration) {
          document.getElementById('m1Duration').value = d.voiceover_duration.toFixed(1);
          document.getElementById('m1DurationBadge').textContent = d.voiceover_duration.toFixed(1) + 's';
          updateM1PromptEstimate();
          showToast(\`Uploaded voiceover: \${d.voiceover_duration.toFixed(1)}s\`, 'success');
        }
      })
      .catch(err => showToast('Error uploading voiceover: ' + err.message, 'error'));
  }
}

function handleM1MusicFile(input) {
  if (input.files && input.files[0] && activeProjectId) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('track_type', 'MUSIC');
    formData.append('volume', 0.07);
    fetch(\`/api/v1/projects/\${activeProjectId}/audio/upload\`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => showToast('Background music uploaded', 'success'))
      .catch(err => showToast('Error uploading music: ' + err.message, 'error'));
  }
}

function updateM1MusicVolume(val) {
  const pct = parseInt(val, 10) || 7;
  const lbl = document.getElementById('m1MusicVolLabel');
  if (lbl) lbl.textContent = pct + '% (Auto-Ducked)';
  if (activeProjectId) {
    fetch(\`/api/v1/projects/\${activeProjectId}/audio/attach\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: 'Demo/bgm.mp3', track_type: 'MUSIC', music_volume: pct / 100 })
    }).catch(() => {});
  }
}

function handleM1CharFile(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.getElementById('m1CharThumb');
      if (thumb) {
        thumb.src = e.target.result;
        thumb.style.display = 'block';
      }
      showToast('Avatar image loaded', 'success');
    };
    reader.readAsDataURL(file);
  }
}

async function autoDetectM2Voiceover() {
  const pathInput = document.getElementById('m2VoiceoverPath');
  const durInput = document.getElementById('m2Duration');
  const badge = document.getElementById('m2DurationBadge');
  const filePath = pathInput ? pathInput.value.trim() : '';

  if (!filePath) {
    showToast('Please specify a voiceover file or path', 'warn');
    return;
  }
  try {
    const res = await fetch('/api/v1/audio/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });
    const data = await res.json();
    if (data.duration && data.duration > 0) {
      durInput.value = data.duration.toFixed(1);
      badge.textContent = data.duration.toFixed(1) + 's';
      badge.style.color = 'var(--emerald)';
      showToast(\`Detected duration: \${data.duration.toFixed(1)}s\`, 'success');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function handleM2FileUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const area = document.getElementById('rawPromptsInput');
      if (area) {
        area.value = e.target.result;
        updateM2PromptCount();
      }
      showToast(\`Loaded prompt file: \${file.name}\`, 'success');
    };
    reader.readAsText(file);
  }
}

function updateM2PromptCount() {
  const area = document.getElementById('rawPromptsInput');
  const badge = document.getElementById('m2PromptCountBadge');
  if (!area || !badge) return;
  const lines = area.value.split(/\\r?\\n/).filter(l => l.trim().length > 0);
  badge.textContent = \`\${lines.length} prompts\`;
}

function recenterCaptions() {
  if (!captionEngine) return;
  captionEngine.style.offsetX = 0;
  captionEngine.style.marginV = 32;
  captionEngine.applyContainerStyles();
  const slider = document.getElementById('captionMarginSlider');
  if (slider) slider.value = 32;
  const lbl = document.getElementById('captionMarginLabel');
  if (lbl) lbl.textContent = '32px';
  showToast('Subtitles re-centered', 'info');
}

\n`;

js = js.substring(0, sIdx) + replacementCode + js.substring(eIdx);
fs.writeFileSync(p, js, 'utf8');
console.log('Successfully updated app_v2.js with complete canonical project handlers');
