
// ====================================================================
// SCRIPT FILE PICKER & AUTO PROMPT/IMAGE ESTIMATION
// ====================================================================
function handleScriptFile(input, targetContext) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (targetContext === 'm1') {
        const el = document.getElementById('m1ScriptInput');
        if (el) el.value = text;
        updateM1ScriptWordCount();
      } else if (targetContext === 'modal_m1') {
        const el = document.getElementById('newProjScript');
        if (el) el.value = text;
        updateModalScriptWordCount('m1');
      } else if (targetContext === 'modal_m2') {
        const el = document.getElementById('newProjScriptM2');
        if (el) el.value = text;
      }
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      showToast(`Loaded script: ${file.name} (${wordCount} words)`, 'success');
    };
    reader.readAsText(file);
  }
}

let m1CharBase64 = null;

function handleM1CharFile(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      m1CharBase64 = e.target.result;
      const thumb = document.getElementById('m1CharThumb');
      const placeholder = document.getElementById('m1CharPlaceholder');
      const removeBtn = document.getElementById('m1CharRemoveBtn');
      const statusText = document.getElementById('m1CharStatusText');

      if (thumb) {
        thumb.src = e.target.result;
        thumb.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (statusText) {
        statusText.innerHTML = `<strong style="color: var(--emerald);">✅ Character Reference Active:</strong> ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
      }

      showToast(`Character reference loaded: ${file.name}`, 'success');
    };
    reader.readAsDataURL(file);
  }
}

function removeM1CharImage() {
  m1CharBase64 = null;
  const thumb = document.getElementById('m1CharThumb');
  const placeholder = document.getElementById('m1CharPlaceholder');
  const removeBtn = document.getElementById('m1CharRemoveBtn');
  const statusText = document.getElementById('m1CharStatusText');
  const fileInput = document.getElementById('m1CharFile');

  if (thumb) { thumb.src = ''; thumb.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';
  if (statusText) statusText.textContent = 'Pick reference image to lock character appearance across all scenes';
  if (fileInput) fileInput.value = '';

  showToast('Removed character reference image', 'info');
}

function removeModalCharImage(tab) {
  if (tab === 'm1') modalCharBase64_M1 = null;
  else modalCharBase64_M2 = null;

  const thumb = document.getElementById(tab === 'm1' ? 'newProjCharThumb' : 'newProjCharThumbM2');
  const placeholder = document.getElementById(tab === 'm1' ? 'newProjCharPlaceholder' : 'newProjCharPlaceholderM2');
  const removeBtn = document.getElementById(tab === 'm1' ? 'newProjCharRemoveBtn' : 'newProjCharRemoveBtnM2');
  const statusText = document.getElementById(tab === 'm1' ? 'newProjCharStatusText' : 'newProjCharStatusTextM2');
  const fileInput = document.getElementById(tab === 'm1' ? 'newProjCharFile' : 'newProjCharFileM2');

  if (thumb) { thumb.src = ''; thumb.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';
  if (statusText) statusText.textContent = 'Pick reference image to lock character appearance across all scenes';
  if (fileInput) fileInput.value = '';

  showToast('Removed character reference image', 'info');
}

function handleM2VoiceoverFile(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  const audioObj = new Audio();
  const objectUrl = URL.createObjectURL(file);
  audioObj.src = objectUrl;
  audioObj.onloadedmetadata = () => {
    const dur = audioObj.duration;
    URL.revokeObjectURL(objectUrl);
    if (dur && dur > 0) {
      const formattedDur = dur.toFixed(1);
      const durInput = document.getElementById('m2Duration');
      if (durInput) durInput.value = formattedDur;
      const badge = document.getElementById('m2DurationBadge');
      if (badge) {
        badge.textContent = `${formattedDur}s (Auto-Detected)`;
        badge.style.color = 'var(--emerald)';
        badge.style.borderColor = 'var(--emerald)';
      }
      updateM2PromptForecast();
      showToast(`⚡ Audio auto-scanned: ${formattedDur}s`, 'success');
    }
  };

  const statusChip = document.getElementById('m2VoiceoverStatus');
  if (statusChip) {
    statusChip.textContent = `🎵 ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    statusChip.style.display = 'inline-flex';
  }
  const pathInput = document.getElementById('m2VoiceoverPath');
  if (pathInput) pathInput.value = file.name;
}

function updateM2PromptForecast() {
  const durEl = document.getElementById('m2Duration');
  const pacingEl = document.getElementById('m2Pacing');
  if (!durEl || !pacingEl) return;
  const duration = parseFloat(durEl.value) || 60;
  const pacing = pacingEl.value || '3/4s';
  const MULTIPLIERS = { '1/4s': 0.25, '2/4s': 0.50, '3/4s': 0.75, '4/4s': 1.00 };
  const mult = MULTIPLIERS[pacing] || 0.75;
  const targetCount = Math.max(1, Math.round(duration * mult));

  const fDur = document.getElementById('m2ForecastDur');
  const fPacing = document.getElementById('m2ForecastPacing');
  const fCount = document.getElementById('m2ForecastCount');
  if (fDur) fDur.textContent = `${duration.toFixed(1)}s`;
  if (fPacing) fPacing.textContent = `${pacing} (${(1/mult).toFixed(2)}s/img)`;
  if (fCount) fCount.textContent = `${targetCount} Prompts Expected`;
}


// =============================================
// CAPTCHA & LOGIN AUDIO VOICE ALERT SYSTEM
// =============================================
let alertedWorkers = new Set();

function triggerWorkerVoiceAlert(workerId, reason = 'Captcha needed') {
  if (alertedWorkers.has(workerId)) return; // Don't repeat constantly
  alertedWorkers.add(workerId);

  // Play browser speech synthesis alert: "Worker W01 Captcha needed"
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `Worker ${workerId} ${reason}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.warn('SpeechSynthesis error:', e);
  }

  showToast(`⚠️ ALERT: Worker ${workerId} requires attention: ${reason}!`, 'error');
  // Reset alert after 45 seconds so it can alert again if still stuck
  setTimeout(() => { alertedWorkers.delete(workerId); }, 45000);
}


// =============================================
// FLEET CALCULATOR & BATCH SCHEDULER
// =============================================
async function loadFleetCalculation() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/workers/calculate-fleet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quota_per_worker: 50, max_concurrent: 10 })
    });
    const data = await res.json();
    if (!data.success) return;

    document.getElementById('calcTotalPrompts').textContent = data.total_prompts;
    document.getElementById('calcWorkersNeeded').textContent = data.total_workers_needed;
    document.getElementById('calcProviderSplit').textContent = `${data.meta_workers} Meta + ${data.flow_workers} Flow`;
    document.getElementById('calcConcurrencyPlan').textContent = data.total_batches > 1 
      ? `${data.active_now_batch_1} Active / ${data.queued_for_recycle} Queued (${data.total_batches} Batches)`
      : `All ${data.total_workers_needed} Active in Batch 1`;

    const container = document.getElementById('fleetBatchesContainer');
    if (container && data.total_batches > 1) {
      container.style.display = 'block';
      container.innerHTML = `
        <div style="font-weight: 700; color: var(--cyan); margin-bottom: 6px;">Batch Execution Queue:</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <div class="badge badge-emerald">Batch 1: 10 Workers (Prompts 1 - 500) Active Immediate</div>
          <div class="badge badge-amber">Batch 2: ${data.total_workers_needed - 10} Workers (Recycled W01..W${String(data.total_workers_needed - 10).padStart(2,'0')})</div>
        </div>
      `;
    }
  } catch (err) {
    console.warn('loadFleetCalculation error:', err);
  }
}

async function calculateAndDispatchFleet() {
  if (!activeProjectId) {
    showToast('Select a project first', 'warn');
    return;
  }
  showToast('Optimizing prompt allocation across worker fleet...', 'info');
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/workers/dispatch-fleet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quota_per_worker: 50, max_concurrent: 10, auto_launch: false })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadWorkersStatus();
      await loadWorkersProcesses();
      await loadFleetCalculation();
    } else {
      showToast(data.error || 'Failed to dispatch fleet', 'error');
    }
  } catch (err) {
    showToast(`Dispatch error: ${err.message}`, 'error');
  }
}

// =============================================
// 10-WORKER LOGIN ASSISTANT & GROQ POOL
// =============================================
async function refreshFleetStatus() {
  try {
    const res = await fetch('/api/v1/workers/fleet-status');
    const data = await res.json();
    const grid = document.getElementById('workersFleetStatusGrid');
    if (!grid || !data.workers) return;

    grid.innerHTML = data.workers.map(w => {
      const isAuth = w.authenticated;
      const statusBadge = isAuth 
        ? '<span class="badge badge-emerald" style="font-size: 10px;">✓ Session Saved</span>'
        : '<span class="badge badge-amber" style="font-size: 10px;">⏳ Setup Required</span>';

      return `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${w.id}</span>
            <span class="badge badge-cyan" style="font-size: 10px;">${w.provider.toUpperCase()}</span>
          </div>
          <div style="margin-bottom: 8px;">${statusBadge}</div>
          <button class="btn btn-secondary" onclick="openWorkerLogin('${w.id}', '${w.provider}')" style="width: 100%; padding: 4px 8px; font-size: 11px;">
            🔑 Open Login
          </button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('refreshFleetStatus error:', err);
  }
}

async function openWorkerLogin(workerId, provider) {
  showToast(`Opening 1-time login browser for ${workerId} (${provider})...`, 'info');
  try {
    const res = await fetch('/api/v1/workers/login-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId, provider })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      setTimeout(refreshFleetStatus, 4000);
    } else {
      showToast(data.error || 'Failed to open login window', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function loadGroqKeyPool() {
  try {
    const res = await fetch('/api/v1/ai/key-pool');
    const data = await res.json();
    const badge = document.getElementById('activeKeysBadge') || document.getElementById('groqKeyCountBadge');
    if (badge) badge.textContent = `${data.key_count || 0} Keys in Pool`;
    const label = document.getElementById('keyPoolCountLabel');
    if (label) label.textContent = `${data.key_count || 0} Key(s) Loaded`;

    const area = document.getElementById('settingsGroqKeyPool') || document.getElementById('groqKeysPoolInput');
    if (area && data.keys && Array.isArray(data.keys) && data.keys.length > 0) {
      area.value = data.keys.join('\n');
    }
  } catch (err) {
    console.error('Error loading Groq key pool:', err);
  }
}

async function saveGroqKeyPool() {
  const input = document.getElementById('settingsGroqKeyPool') || document.getElementById('groqKeysPoolInput');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) {
    showToast('Enter at least one Groq API key', 'warn');
    return;
  }
  const keys = raw.split(/[\r\n,]+/).map(k => k.trim()).filter(k => k.startsWith('gsk_'));
  if (keys.length === 0) {
    showToast('Invalid format. Keys must start with gsk_', 'error');
    return;
  }

  try {
    showToast('Saving Groq API keys...', 'info');
    const res = await fetch('/api/v1/ai/key-pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadGroqKeyPool();
    } else {
      showToast(data.error || 'Failed saving keys', 'error');
    }
  } catch (err) {
    showToast(`Error saving keys: ${err.message}`, 'error');
  }
}

async function refreshFleetStatus() {
  try {
    const res = await fetch('/api/v1/workers/fleet-status');
    const data = await res.json();
    const grid = document.getElementById('workersFleetStatusGrid');
    if (!grid || !data.workers) return;

    grid.innerHTML = data.workers.map(w => {
      const isAuth = w.authenticated;
      const statusBadge = isAuth 
        ? '<span class="badge badge-emerald" style="font-size: 10px;">✓ Session Saved</span>'
        : '<span class="badge badge-amber" style="font-size: 10px;">⏳ Setup Required</span>';

      return `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${w.id}</span>
            <span class="badge badge-cyan" style="font-size: 10px;">${w.provider.toUpperCase()}</span>
          </div>
          <div style="margin-bottom: 8px;">${statusBadge}</div>
          <button class="btn btn-secondary" onclick="openWorkerLogin('${w.id}', '${w.provider}')" style="width: 100%; padding: 4px 8px; font-size: 11px;">
            🔑 Open Login
          </button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('refreshFleetStatus error:', err);
  }
}

async function openWorkerLogin(workerId, provider) {
  showToast(`Opening 1-time login browser for ${workerId} (${provider})...`, 'info');
  try {
    const res = await fetch('/api/v1/workers/login-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId, provider })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      setTimeout(refreshFleetStatus, 4000);
    } else {
      showToast(data.error || 'Failed to open login window', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function loadGroqKeyPool() {
  try {
    const res = await fetch('/api/v1/ai/key-pool');
    const data = await res.json();
    const badge = document.getElementById('groqKeyCountBadge');
    if (badge) badge.textContent = `${data.key_count} Keys in Pool`;
    const status = document.getElementById('groqPoolStatusText');
    if (status) status.textContent = `Active cursor: Key #${(data.active_cursor || 0) + 1}`;
  } catch (err) {}
}

async function saveGroqKeyPool() {
  const input = document.getElementById('groqKeysPoolInput');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) {
    showToast('Enter at least one Groq API key', 'warn');
    return;
  }
  const keys = raw.split(/[\r\n,]+/).map(k => k.trim()).filter(k => k.startsWith('gsk_'));
  if (keys.length === 0) {
    showToast('Invalid format. Keys must start with gsk_', 'error');
    return;
  }

  try {
    const res = await fetch('/api/v1/ai/key-pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      input.value = '';
      loadGroqKeyPool();
    } else {
      showToast(data.error || 'Failed to save keys', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}


// =============================================
// MASTER AUDIO & VOICEOVER MANAGEMENT
// =============================================
async function loadProjectAudio() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/audio`);
    if (!res.ok) return;
    const data = await res.json();

    const voInput = document.getElementById('voFilePathInput');
    if (voInput && data.voiceover_path) voInput.value = data.voiceover_path;

    const bgmInput = document.getElementById('bgmFilePathInput');
    if (bgmInput && data.music_path) bgmInput.value = data.music_path;

    const bgmSlider = document.getElementById('bgmVolumeSlider');
    const bgmLabel = document.getElementById('bgmVolumeDisplay');
    if (bgmSlider && data.music_volume !== undefined) {
      const pct = Math.round(data.music_volume * 100);
      bgmSlider.value = pct;
      if (bgmLabel) bgmLabel.textContent = pct + '%';
    }

    const dur = data.voiceover_duration || 0;
    const textEl = document.getElementById('audioDurationText');
    const badgeEl = document.getElementById('audioDurationBadge');
    const tagEl = document.getElementById('voDetectedTag');

    if (dur > 0) {
      if (textEl) textEl.textContent = `VO: ${data.voiceover_display} (${dur.toFixed(1)}s)`;
      if (badgeEl) badgeEl.style.borderColor = 'var(--emerald)';
      if (tagEl) tagEl.style.display = 'inline';

      // Update Audio Player Elements
      const audioEl = document.getElementById('timelineAudioElement');
      if (audioEl && data.voiceover_path) {
        audioEl.src = resolveMediaUrl(data.voiceover_path);
        audioEl.load();
      }

      // Populate Pacing Calculation Grid
      const rec = data.recommended_prompts || {};
      const grid = document.getElementById('pacingGridBadges');
      if (grid) {
        grid.innerHTML = `
          <div class="badge badge-cyan" style="font-size: 11px; padding: 4px 8px;">1/4s: ${rec['1/4s'] || 0} images (4.0s/img)</div>
          <div class="badge badge-emerald" style="font-size: 11px; padding: 4px 8px;">2/4s: ${rec['2/4s'] || 0} images (2.0s/img)</div>
          <div class="badge badge-violet" style="font-size: 11px; padding: 4px 8px;">3/4s: ${rec['3/4s'] || 0} images (1.33s/img)</div>
          <div class="badge badge-amber" style="font-size: 11px; padding: 4px 8px;">4/4s: ${rec['4/4s'] || 0} images (1.0s/img)</div>
        `;
      }

      const summary = document.getElementById('pacingCalcSummary');
      if (summary) {
        summary.innerHTML = `Voiceover detected: <strong>${data.voiceover_display}</strong>. At standard <strong>2/4s</strong> pacing, you need <strong>${rec['2/4s']} images</strong>. At fast <strong>3/4s</strong> pacing, you need <strong>${rec['3/4s']} images</strong>.`;
      }
    } else {
      if (textEl) textEl.textContent = 'No Audio Attached';
      if (badgeEl) badgeEl.style.borderColor = 'var(--border-accent)';
      if (tagEl) tagEl.style.display = 'none';
    }
  } catch (err) {
    console.warn('loadProjectAudio failed:', err);
  }
}

async function attachLocalAudio(trackType) {
  if (!activeProjectId) {
    showToast('Select an active project first', 'warn');
    return;
  }
  const isVO = (trackType === 'VOICEOVER');
  const inputEl = document.getElementById(isVO ? 'voFilePathInput' : 'bgmFilePathInput');
  const filePath = inputEl ? inputEl.value.trim() : '';

  if (!filePath) {
    showToast(`Please enter a file path for ${trackType}`, 'warn');
    return;
  }

  showToast(`Probing ${trackType} audio file...`, 'info');
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/audio/attach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, track_type: trackType })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${trackType} attached! Duration: ${data.duration_display}`, 'success');
      await loadProjectAudio();
      if (isVO) await loadTimeline();
    } else {
      showToast(data.error || 'Failed to attach audio', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function uploadAudioFile(fileInput, trackType) {
  if (!activeProjectId) {
    showToast('Select an active project first', 'warn');
    return;
  }
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('audio', file);
  formData.append('track_type', trackType);

  showToast(`Uploading ${file.name} and detecting duration...`, 'info');
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/audio/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${trackType} uploaded! Duration: ${data.duration_display}`, 'success');
      await loadProjectAudio();
      if (trackType === 'VOICEOVER') await loadTimeline();
    } else {
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (err) {
    showToast(`Upload error: ${err.message}`, 'error');
  }
}

function updateBgmVolume(val) {
  const pct = parseInt(val, 10);
  const lbl = document.getElementById('bgmVolumeDisplay');
  if (lbl) lbl.textContent = pct + '%';
  const bgmEl = document.getElementById('bgmAudioElement');
  if (bgmEl) bgmEl.volume = pct / 100;
}


// =============================================
// STUDIO CAPTION ENGINE INITIALIZATION
// =============================================
let captionEngine = null;

// =============================================
// TWITCHYOUTUBE 18 CAPTION PRESETS & LIVE PREVIEW ENGINE
// =============================================
const CAPTION_STATE = {
  enabled: true,
  preset: 'capcut_yellow',
  position: 'bottom',
  size: 'medium',
  customSize: 115,
  fontFamily: 'default',
  bgBoxEnabled: false,
  bgColor: '#000000',
  bgOpacity: 0.75
};

const CAPTION_PRESET_CONFIGS = {
  'capcut_yellow': { className: 'aa-capcut', font: 'Montserrat', color: '#ffff00', shadow: '0 0 8px #ffcc00, 2px 2px 0 #000' },
  'hormozi_green': { className: 'aa-hormozi', font: 'Impact', color: '#00ff66', shadow: '0 0 8px #00dd44, 2px 2px 0 #000' },
  'mrbeast_punch': { className: 'aa-mrbeast', font: 'Bangers', color: '#fbbf24', shadow: '2px 2px 0 #000' },
  'ali_abdaal': { className: 'aa-ali', font: 'Poppins', color: '#38bdf8', shadow: '1px 1px 0 #000' },
  'iman_gadzhi': { className: 'aa-luxury', font: 'Cinzel', color: '#ffd700', shadow: '0 0 10px rgba(255,215,0,0.4)' },
  'tiktok_violet': { className: 'aa-tiktok', font: 'Archivo Black', color: '#d946ef', shadow: '0 0 8px #a855f7' },
  'podcast_pill': { className: 'aa-podcast-pill', font: 'Montserrat', color: '#000000', shadow: 'none', bg: '#00e5ff' },
  'streamer_lime': { className: 'aa-streamer', font: 'Luckiest Guy', color: '#a3e635', shadow: '2px 2px 0 #000' },
  'neon_cyber': { className: 'aa-neon', font: 'Montserrat', color: '#00ffff', shadow: '0 0 8px #ff00ff' },
  'red_fire': { className: 'aa-fire', font: 'Impact', color: '#ff3344', shadow: '0 0 8px #ef4444' },
  'dark_stoic': { className: 'aa-stoic', font: 'Oswald', color: '#cbd5e1', shadow: '1px 1px 0 #000' },
  'clean_minimal': { className: 'aa-minimal', font: 'Inter', color: '#ffffff', shadow: '0 2px 6px rgba(0,0,0,0.8)' },
  'retro_vintage': { className: 'aa-retro', font: 'Arial Black', color: '#ffa03c', shadow: '2px 2px 0 #000' },
  'midnight_blue': { className: 'aa-midnight', font: 'Montserrat', color: '#38bdf8', shadow: '0 0 8px #2563eb' },
  'true_crime': { className: 'aa-crime', font: 'Courier New', color: '#ef4444', shadow: '0 0 6px #7f1d1d' },
  'wealth_cash': { className: 'aa-wealth', font: 'Impact', color: '#10df70', shadow: '0 0 8px #059669' },
  'cosmic_violet': { className: 'aa-cosmic', font: 'Montserrat', color: '#c084fc', shadow: '0 0 8px #9333ea' },
  'cinematic_bronze': { className: 'aa-bronze', font: 'Cinzel', color: '#f59e0b', shadow: '0 0 8px rgba(245,158,11,0.5)' }
};

function selectCaptionPreset(card) {
  document.querySelectorAll('.preset-card-visual').forEach(c => c.classList.remove('active'));
  if (card) card.classList.add('active');
  const presetKey = card ? card.dataset.preset : 'capcut_yellow';
  CAPTION_STATE.preset = presetKey;
  syncCaptionPreview();
  const nameEl = card ? card.querySelector('.preset-name') : null;
  const name = nameEl ? nameEl.textContent : presetKey;
  showToast(`Applied preset: ${name}`, 'info');
}

function setCaptionPosition(pos) {
  CAPTION_STATE.position = pos;
  ['cap-pos-left', 'cap-pos-right', 'cap-pos-bottom', 'cap-pos-center'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const activeBtn = document.getElementById(`cap-pos-${pos}`);
  if (activeBtn) activeBtn.classList.add('active');

  const box = document.getElementById('stage-caption-box');
  if (box) {
    box.classList.remove('pos-bottom', 'pos-center', 'pos-left', 'pos-right');
    box.classList.add(`pos-${pos}`);
  }
}

function setCaptionSize(size) {
  CAPTION_STATE.size = size;
  const btnMed = document.getElementById('cap-size-medium');
  const btnLrg = document.getElementById('cap-size-large');
  const btnHug = document.getElementById('cap-size-huge');
  const customRow = document.getElementById('custom-font-size-row');
  const badge = document.getElementById('caption-font-size-badge');

  [btnMed, btnLrg, btnHug].forEach(el => el && el.classList.remove('active'));

  const sizeMap = {
    small: { px: 20, label: 'Small (80px)' },
    medium: { px: 28, label: 'Medium (95px)' },
    large: { px: 38, label: 'Large (115px)' },
    huge: { px: 48, label: 'Huge (135px)' },
    extrahuge: { px: 58, label: '🚀 Extra Huge (160px)' },
    custom: { px: CAPTION_STATE.customSize, label: `Custom (${CAPTION_STATE.customSize}px)` }
  };

  if (size === 'medium' && btnMed) btnMed.classList.add('active');
  else if (size === 'large' && btnLrg) btnLrg.classList.add('active');
  else if (size === 'huge' && btnHug) btnHug.classList.add('active');

  if (size === 'custom') {
    if (customRow) customRow.style.display = 'block';
  } else {
    if (customRow) customRow.style.display = 'none';
  }

  if (badge) badge.textContent = sizeMap[size]?.label || `${size}`;
  syncCaptionPreview();
}

function onCaptionMoreSelect(val) {
  if (val) setCaptionSize(val);
}

function onCustomFontSizeInput(val) {
  CAPTION_STATE.customSize = parseInt(val, 10) || 115;
  const badge = document.getElementById('caption-font-size-badge');
  if (badge) badge.textContent = `Custom (${CAPTION_STATE.customSize}px)`;
  syncCaptionPreview();
}

function onCaptionFontFamilyChange(font) {
  CAPTION_STATE.fontFamily = font;
  const badge = document.getElementById('caption-font-family-badge');
  if (badge) badge.textContent = font === 'default' ? 'Default (Template)' : font;
  syncCaptionPreview();
}

function toggleCaptionVisibility(visible) {
  CAPTION_STATE.enabled = visible;
  const box = document.getElementById('stage-caption-box');
  if (box) {
    box.style.display = visible ? 'flex' : 'none';
  }
  showToast(visible ? 'Subtitles enabled' : 'Subtitles hidden', 'info');
}

function toggleCaptionBg(enabled) {
  CAPTION_STATE.bgBoxEnabled = enabled;
  const opt = document.getElementById('caption-bg-options');
  if (opt) opt.style.display = enabled ? 'block' : 'none';
  syncCaptionPreview();
}

function updateCaptionBgPreview() {
  const col = document.getElementById('caption-bg-color')?.value || '#000000';
  const op = (parseInt(document.getElementById('caption-bg-opacity')?.value || '75', 10)) / 100;
  CAPTION_STATE.bgColor = col;
  CAPTION_STATE.bgOpacity = op;
  syncCaptionPreview();
}

function syncCaptionPreview() {
  const box = document.getElementById('stage-caption-box');
  const content = document.getElementById('stage-caption-content');
  if (!box || !content) return;

  if (!CAPTION_STATE.enabled) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';

  const cfg = CAPTION_PRESET_CONFIGS[CAPTION_STATE.preset] || CAPTION_PRESET_CONFIGS['capcut_yellow'];

  // Clear previous classes
  content.className = 'stage-caption-content ' + (cfg.className || '');

  // Font family
  const finalFont = CAPTION_STATE.fontFamily !== 'default' ? CAPTION_STATE.fontFamily : cfg.font;
  content.style.fontFamily = `'${finalFont}', sans-serif`;

  // Font size
  const sizeMap = { small: 20, medium: 28, large: 38, huge: 48, extrahuge: 58 };
  const fsPx = (CAPTION_STATE.size === 'custom') ? (CAPTION_STATE.customSize / 4) : (sizeMap[CAPTION_STATE.size] || 28);
  content.style.fontSize = `${fsPx}px`;

  // Background Box
  if (CAPTION_STATE.bgBoxEnabled) {
    const r = parseInt(CAPTION_STATE.bgColor.slice(1, 3), 16) || 0;
    const g = parseInt(CAPTION_STATE.bgColor.slice(3, 5), 16) || 0;
    const b = parseInt(CAPTION_STATE.bgColor.slice(5, 7), 16) || 0;
    box.style.background = `rgba(${r}, ${g}, ${b}, ${CAPTION_STATE.bgOpacity})`;
    box.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    box.style.borderRadius = '8px';
  } else {
    box.style.background = cfg.bg ? cfg.bg : 'transparent';
    box.style.border = 'none';
  }

  // Force re-render live demo words
  const curScene = (timelineItems && timelineItems[currentSceneIndex]) ? timelineItems[currentSceneIndex] : null;
  renderLiveCaptionWords(curScene?.prompt_text, 0);
}

// Live caption text rendering with word pop bounce
function renderLiveCaptionWords(customText, activeWordIndex = 0) {
  const content = document.getElementById('stage-caption-content');
  if (!content) return;
  const text = (customText || '').trim();
  const rawWords = text ? text.split(/\s+/) : ['WAIT...', 'DID', 'HE', 'REALLY', 'DISCOVER', 'THE', 'NEON', 'PORTAL?!'];

  const cfg = CAPTION_PRESET_CONFIGS[CAPTION_STATE.preset] || CAPTION_PRESET_CONFIGS['capcut_yellow'];

  content.innerHTML = rawWords.map((w, idx) => {
    const isActive = idx === activeWordIndex;
    const colorStyle = isActive ? `color: ${cfg.color}; text-shadow: ${cfg.shadow};` : 'color: #ffffff;';
    return `<span class="demo-word ${isActive ? 'active' : ''}" style="${colorStyle}">${w}</span>`;
  }).join(' ');
}

// =============================================
// CAPCUT MULTI-TRACK TIMELINE & DRAGGABLE SEQUENCE EDITOR
// =============================================
let draggedTimelineIndex = null;

function renderCapCutTimeline() {
  const lane = document.getElementById('capcutVideoTrackLane');
  const countBadge = document.getElementById('capcutSceneCount');
  const voiceName = document.getElementById('timelineVoiceFileName');
  const voiceDur = document.getElementById('timelineVoiceDuration');

  if (!lane) return;

  if (currentProjectData) {
    if (voiceName) voiceName.textContent = currentProjectData.voiceover_path ? currentProjectData.voiceover_path.replace(/\\/g, '/').split('/').pop() : 'voiceover.mp3';
    if (voiceDur) voiceDur.textContent = formatTime(currentProjectData.voiceover_duration || 0);
  }

  if (!timelineItems || timelineItems.length === 0) {
    lane.innerHTML = `<div style="color: var(--text-dim); padding: 14px; font-size: 12px;">No timeline scenes loaded. Click "⚡ Auto-Sync Audio" above to generate initial sequence.</div>`;
    if (countBadge) countBadge.textContent = '0';
    return;
  }

  if (countBadge) countBadge.textContent = timelineItems.length;

  lane.innerHTML = timelineItems.map((item, idx) => {
    const isActive = idx === currentSceneIndex;
    const dur = (parseFloat(item.duration) || 1.33).toFixed(2);
    const rawImg = item.image_path || item.file_path || item.image_url;
    const imgSrc = rawImg ? resolveMediaUrl(rawImg) : 'data:image/svg+xml,<svg xmlns=http://www.w3.org/2000/svg viewBox=0 0 100 60><rect width=100 height=60 fill=%231a1a2e/><text y=32 x=50 text-anchor=middle fill=%23f59e0b font-size=8>Missing Image</text></svg>';
    const isMissing = !rawImg || item.is_missing;

    return `
      <div class="timeline-scene-card ${isActive ? 'active-scene' : ''} ${isMissing ? 'missing-image' : ''}"
           id="timeline-card-${idx}"
           draggable="true"
           ondragstart="onTimelineCardDragStart(event, ${idx})"
           ondragover="onTimelineCardDragOver(event, ${idx})"
           ondrop="onTimelineCardDrop(event, ${idx})"
           onclick="seekToTimelineScene(${idx})">
        <img src="${imgSrc}" class="timeline-card-thumb" alt="Scene ${idx + 1}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 60\\'><rect width=\\'100\\' height=\\'60\\' fill=\\'%231a1a2e\\'/><text y=\\'32\\' x=\\'50\\' text-anchor=\\'middle\\' fill=\\'%23f59e0b\\' font-size=\\'8\\'>Missing Image</text></svg>'; this.parentElement.classList.add('missing-image');" />
        <div class="timeline-card-meta">
          <strong style="color: ${isActive ? 'var(--cyan)' : '#fff'};">#${String(idx + 1).padStart(2, '0')}</strong>
          <span style="color: var(--text-muted); font-size: 10px;">${dur}s</span>
        </div>
        <div class="timeline-duration-ctrl" onclick="event.stopPropagation()">
          <button type="button" class="timeline-dur-btn" onclick="adjustSceneDuration(${idx}, -0.25)" title="Shorten scene by 0.25s">-</button>
          <span class="timeline-dur-val">${dur}s</span>
          <button type="button" class="timeline-dur-btn" onclick="adjustSceneDuration(${idx}, 0.25)" title="Extend scene by 0.25s">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function onTimelineCardDragStart(e, idx) {
  draggedTimelineIndex = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', idx);
  const card = document.getElementById(`timeline-card-${idx}`);
  if (card) card.classList.add('dragging');
}

function onTimelineCardDragOver(e, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onTimelineCardDrop(e, targetIdx) {
  e.preventDefault();
  if (draggedTimelineIndex === null || draggedTimelineIndex === targetIdx) return;

  const moved = timelineItems.splice(draggedTimelineIndex, 1)[0];
  timelineItems.splice(targetIdx, 0, moved);
  draggedTimelineIndex = null;

  renderCapCutTimeline();
  showToast(`Moved scene to position #${targetIdx + 1}. Click Save Timeline to apply.`, 'info');
}

function adjustSceneDuration(idx, delta) {
  if (!timelineItems[idx]) return;
  const cur = parseFloat(timelineItems[idx].duration) || 1.33;
  const updated = Math.max(0.4, Math.round((cur + delta) * 100) / 100);
  timelineItems[idx].duration = updated;

  let cursor = 0;
  for (const it of timelineItems) {
    it.start_time = cursor;
    cursor += (parseFloat(it.duration) || 1.33);
    it.end_time = cursor;
  }

  renderCapCutTimeline();
  const durVal = document.querySelector(`#timeline-card-${idx} .timeline-dur-val`);
  if (durVal) durVal.textContent = updated.toFixed(2) + 's';
}

function seekToTimelineScene(idx) {
  if (idx < 0 || idx >= timelineItems.length) return;
  updatePlaybackScene(idx);
  const audio = document.getElementById('timelineAudioElement');
  if (audio && timelineItems[idx].start_time !== undefined) {
    audio.currentTime = timelineItems[idx].start_time;
  }
  const promptTxt = timelineItems[idx].prompt_text || `Scene #${idx + 1}`;
  renderLiveCaptionWords(promptTxt, 0);
}

async function checkForMissingImages() {
  if (!timelineItems || timelineItems.length === 0) {
    showToast('No timeline loaded to verify', 'warn');
    return;
  }

  showToast('Scanning all scene image assets on disk...', 'info');
  let missingCount = 0;
  const missingIndices = [];

  for (let i = 0; i < timelineItems.length; i++) {
    const item = timelineItems[i];
    const rawImg = item.image_path || item.file_path || item.image_url;
    if (!rawImg) {
      item.is_missing = true;
      missingCount++;
      missingIndices.push(i + 1);
      continue;
    }

    try {
      const testUrl = resolveMediaUrl(rawImg);
      const res = await fetch(testUrl, { method: 'HEAD' });
      if (!res.ok) {
        item.is_missing = true;
        missingCount++;
        missingIndices.push(i + 1);
      } else {
        item.is_missing = false;
      }
    } catch {
      item.is_missing = true;
      missingCount++;
      missingIndices.push(i + 1);
    }
  }

  renderCapCutTimeline();

  const banner = document.getElementById('timelineMissingBanner');
  const txt = document.getElementById('timelineMissingText');

  if (missingCount > 0) {
    if (banner) banner.style.display = 'flex';
    if (txt) txt.textContent = `⚠️ ${missingCount} missing image(s) detected: Scenes [${missingIndices.slice(0, 8).join(', ')}${missingIndices.length > 8 ? '...' : ''}]`;
    showToast(`Found ${missingCount} scenes missing generated images!`, 'warn');
  } else {
    if (banner) banner.style.display = 'none';
    showToast(`✅ All ${timelineItems.length} scene images are present and verified!`, 'success');
  }
}

function requeueMissingPrompts() {
  goToStep(2);
  showToast('Switched to Step 2 (Workers) to generate missing images', 'info');
}

function equalizeTimelineDurations() {
  if (!timelineItems || timelineItems.length === 0) return;
  const totalDur = (currentProjectData?.voiceover_duration && currentProjectData.voiceover_duration > 0)
    ? currentProjectData.voiceover_duration
    : (timelineItems.length * 1.33);

  const equalSlice = Math.round((totalDur / timelineItems.length) * 100) / 100;
  let cursor = 0;
  for (const it of timelineItems) {
    it.duration = equalSlice;
    it.start_time = cursor;
    cursor += equalSlice;
    it.end_time = cursor;
  }

  renderCapCutTimeline();
  showToast(`Auto-equalized all ${timelineItems.length} scenes to ${equalSlice}s per image`, 'success');
}

async function saveTimelineChanges() {
  if (!activeProjectId) {
    showToast('No active project to save timeline', 'warn');
    return;
  }

  try {
    showToast('Saving timeline sequence and durations...', 'info');
    const res = await fetch(`/api/v1/projects/${activeProjectId}/timeline/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: timelineItems })
    });
    const result = await res.json();
    if (result.items) {
      timelineItems = result.items;
      renderCapCutTimeline();
      showToast('Timeline changes saved successfully!', 'success');
    } else {
      showToast('Timeline saved', 'success');
    }
  } catch (err) {
    showToast(`Error saving timeline: ${err.message}`, 'error');
  }
}


function resolveMediaUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  const projIdx = normalized.indexOf('/Projects/');
  if (projIdx !== -1) {
    return '/projects-media/' + normalized.substring(projIdx + 10);
  }
  const folderName = currentProjectData?.directory_path ? currentProjectData.directory_path.replace(/\\/g, '/').split('/').pop() : currentProjectData?.name;
  return `/projects-media/${folderName}/${filePath.replace(/^\/+/, '')}`;
}


// Step 1 Sub-Tab Switcher
function switchStep1SubTab(tab) {
  document.getElementById('subTabMode1').classList.remove('active');
  document.getElementById('subTabMode2').classList.remove('active');
  document.getElementById('subTabPromptsQueue').classList.remove('active');

  document.getElementById('subViewMode1').style.display = 'none';
  document.getElementById('subViewMode2').style.display = 'none';
  document.getElementById('subViewQueue').style.display = 'none';

  if (tab === 'mode1') {
    document.getElementById('subTabMode1').classList.add('active');
    document.getElementById('subViewMode1').style.display = 'block';
  } else if (tab === 'mode2') {
    document.getElementById('subTabMode2').classList.add('active');
    document.getElementById('subViewMode2').style.display = 'block';
  } else if (tab === 'queue') {
    document.getElementById('subTabPromptsQueue').classList.add('active');
    document.getElementById('subViewQueue').style.display = 'block';
    loadProjectPrompts();
  }
}

function approveAndStartWorkers() {
  goToStep(2);
  showToast('Prompts approved! Ready to launch browser workers.', 'success');
}

/**
 * 🎬 STICKMAN STUDIO V2 — FRONTEND CONTROLLER
 * Ultra-fast, reactive, modern glassmorphic dashboard controller
 * with Interactive Video Canvas Player & Visual Scene Director.
 */

let activeProjectId = '';
let currentStep = 1;
let currentProjectData = null;
let telemetryTimer = null;
let workersTimer = null;
let renderPollInterval = null;

// Timeline & Video Canvas Player State
let timelineItems = [];
let isPlaying = false;
let currentSceneIndex = -1;
let isVerticalAspect = false;

// =============================================
// INITIALIZATION & LIFECYCLE
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupKeyboardShortcuts();
});

async function initApp() {
  setupNavigation();
  await loadProjects();
  startHardwarePolling();
  loadAiModels();
  loadDefaultMasterPrompt();
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Spacebar to Play/Pause when on Step 4 (Timeline) and not typing in an input
    if (e.code === 'Space' && currentStep === 4) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      togglePlayback();
    }
  });
}

// =============================================
// NAVIGATION & WIZARD STEPPER
// =============================================
function setupNavigation() {
  const tabs = document.querySelectorAll('.stepper-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const step = parseInt(tab.dataset.step);
      if (step) goToStep(step);
    });
  });
}

function goToStep(stepNum) {
  // If leaving timeline while playing, pause audio
  if (currentStep === 4 && isPlaying) {
    pausePlayback();
  }

  currentStep = stepNum;
  
  // Update stepper tabs UI
  document.querySelectorAll('.stepper-tab').forEach(tab => {
    const s = parseInt(tab.dataset.step);
    if (s === stepNum) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Switch panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`step-${stepNum}-panel`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Refresh step-specific data
  if (stepNum === 1) loadProjectPrompts();
  if (stepNum === 2) refreshWorkers();
  if (stepNum === 3) loadProjectGallery();
  if (stepNum === 4) loadTimeline();
  if (stepNum === 5) loadRenderHistory();
  if (stepNum === 6) { fetchLogs(); loadSettings(); }
}

// =============================================
// TOAST NOTIFICATION SYSTEM
// =============================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: '⚡',
    warn: '⚠️'
  };

  toast.innerHTML = `
    <span style="font-size: 16px;">${icons[type] || '⚡'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// =============================================
// PROJECT MANAGEMENT
// =============================================
async function loadProjects() {
  try {
    const res = await fetch('/api/v1/projects');
    const projects = await res.json();
    
    const select = document.getElementById('projectSelector');
    if (!select) return;

    select.innerHTML = '<option value="">Select Project...</option>';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.target_image_count} prompts)`;
      select.appendChild(opt);
    });

    if (projects.length > 0 && !activeProjectId) {
      onSelectProject(projects[0].id);
    }
  } catch (err) {
    console.error('Error loading projects:', err);
  }
}

async function onSelectProject(projectId) {
  if (!projectId) return;
  activeProjectId = projectId;
  
  const select = document.getElementById('projectSelector');
  if (select) select.value = projectId;

  try {
    const res = await fetch(`/api/v1/projects/${projectId}`);
    currentProjectData = await res.json();

    // Update Header and Metrics
    document.getElementById('headerProjectBadge').textContent = currentProjectData.name;
    document.getElementById('statTotalPrompts').textContent = currentProjectData.stats?.total_prompts || 0;
    document.getElementById('statCompletedPrompts').textContent = currentProjectData.stats?.completed_prompts || 0;
    document.getElementById('statGeneratingPrompts').textContent = currentProjectData.stats?.generating_prompts || 0;
    document.getElementById('statFailedPrompts').textContent = currentProjectData.stats?.failed_prompts || 0;

    const total = currentProjectData.stats?.total_prompts || 0;
    const comp = currentProjectData.stats?.completed_prompts || 0;
    const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
    document.getElementById('statProgressPercent').textContent = `${pct}%`;

    // Pre-populate Step 1 & Audio Director inputs from project data
    if (currentProjectData.voiceover_path) {
      const v1 = document.getElementById('m1VoiceoverPath');
      if (v1) v1.value = currentProjectData.voiceover_path;
      const v2 = document.getElementById('m2VoiceoverPath');
      if (v2) v2.value = currentProjectData.voiceover_path;
    }
    if (currentProjectData.voiceover_duration) {
      const d1 = document.getElementById('m1Duration');
      if (d1) d1.value = currentProjectData.voiceover_duration;
      const b1 = document.getElementById('m1DurationBadge');
      if (b1) b1.textContent = currentProjectData.voiceover_duration + 's';
      const d2 = document.getElementById('m2Duration');
      if (d2) d2.value = currentProjectData.voiceover_duration;
      const b2 = document.getElementById('m2DurationBadge');
      if (b2) b2.textContent = currentProjectData.voiceover_duration + 's';
    }
    if (currentProjectData.pacing_preset) {
      const p1 = document.getElementById('m1Pacing');
      if (p1) p1.value = currentProjectData.pacing_preset;
      const p2 = document.getElementById('m2Pacing');
      if (p2) p2.value = currentProjectData.pacing_preset;
    }
    if (currentProjectData.music_path) {
      const mu1 = document.getElementById('m1MusicPath');
      if (mu1) mu1.value = currentProjectData.music_path;
      const mu2 = document.getElementById('m2MusicPath');
      if (mu2) mu2.value = currentProjectData.music_path;
    }
    const volPct = Math.round((currentProjectData.music_volume !== undefined ? currentProjectData.music_volume : 0.07) * 100);
    const mVol = document.getElementById('m1MusicVol');
    if (mVol) mVol.value = volPct;
    const mVolLbl = document.getElementById('m1MusicVolLabel');
    if (mVolLbl) mVolLbl.textContent = volPct + '% (Auto-Ducked)';

    if (currentProjectData.script_text) {
      const sc = document.getElementById('m1ScriptInput');
      if (sc) sc.value = currentProjectData.script_text;
      if (typeof updateM1ScriptWordCount === 'function') updateM1ScriptWordCount();
    }
    if (currentProjectData.name) {
      const vt = document.getElementById('m1VideoTitle');
      if (vt) vt.value = currentProjectData.name;
    }
    if (currentProjectData.character) {
      const cRef = document.getElementById('m1CharacterRef');
      if (cRef) cRef.value = currentProjectData.character.description || '';
      const cName = document.getElementById('m1CharacterName');
      if (cName) cName.value = currentProjectData.character.character_name || 'Main Stickman';
      if (currentProjectData.character.image_path) {
        const thumb = document.getElementById('m1CharThumb');
        const placeholder = document.getElementById('m1CharPlaceholder');
        const removeBtn = document.getElementById('m1CharRemoveBtn');
        const statusText = document.getElementById('m1CharStatusText');
        if (thumb) {
          thumb.src = resolveMediaUrl(currentProjectData.character.image_path);
          thumb.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
        if (statusText) {
          statusText.innerHTML = `<strong style="color: var(--emerald);">✅ Character Ref Loaded:</strong> ${currentProjectData.character.character_name || 'Stickman'}`;
        }
      }
    }
    if (currentProjectData.voiceover_duration) {
      const dur = parseFloat(currentProjectData.voiceover_duration);
      const durInput = document.getElementById('m1Duration');
      if (durInput) durInput.value = dur.toFixed(1);
      const badge = document.getElementById('m1DurationBadge');
      if (badge) {
        badge.textContent = `${dur.toFixed(1)}s (Auto-Detected)`;
        badge.style.color = 'var(--emerald)';
      }
    }
    if (currentProjectData.voiceover_path) {
      const statusChip = document.getElementById('m1VoiceoverStatus');
      if (statusChip) {
        statusChip.textContent = `🎵 ${currentProjectData.voiceover_path.split(/[\\/]/).pop()}`;
        statusChip.style.display = 'inline-flex';
      }
    }
    if (currentProjectData.master_prompt) {
      const mp = document.getElementById('m1MasterPrompt');
      if (mp) mp.value = currentProjectData.master_prompt;
    }

    if (typeof updateM1PromptEstimate === 'function') updateM1PromptEstimate();
    if (typeof loadFleetCalculation === 'function') loadFleetCalculation();

    // Refresh active panel content
    goToStep(currentStep);
  } catch (err) {
    console.error('Error selecting project:', err);
  }
}

function openNewProjectModal() {
  document.getElementById('newProjectModal').style.display = 'flex';
}

// State for modal uploads
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
      showToast(`Audio probed: ${data.duration.toFixed(1)}s (${data.duration_formatted})`, 'success');
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
  if (!durEl || !pacingEl) return;

  const duration = parseFloat(durEl.value) || 60;
  const pacing = pacingEl.value || '3/4s';
  const MULTIPLIERS = { '1/4s': 0.25, '2/4s': 0.50, '3/4s': 0.75, '4/4s': 1.00, '5/4s': 1.25 };
  const mult = MULTIPLIERS[pacing] || 0.75;
  const targetCount = Math.max(1, Math.round(duration * mult));
  const secPerImg = (1 / mult).toFixed(2);

  if (tab === 'm1') {
    const fDur = document.getElementById('modalForecastDurM1');
    const fPacing = document.getElementById('modalForecastPacingM1');
    const fCount = document.getElementById('modalTargetPromptsM1');
    if (fDur) fDur.textContent = `${duration.toFixed(1)}s`;
    if (fPacing) fPacing.textContent = `${pacing} (${secPerImg}s/image)`;
    if (fCount) fCount.textContent = `${targetCount} Prompts & ${targetCount} Images`;
  } else {
    const fDur = document.getElementById('modalForecastDurM2');
    const fPacing = document.getElementById('modalForecastPacingM2');
    const fCount = document.getElementById('modalForecastCountM2');
    if (fDur) fDur.textContent = `${duration.toFixed(1)}s`;
    if (fPacing) fPacing.textContent = `${pacing} (${secPerImg}s/img)`;
    if (fCount) fCount.textContent = `${targetCount} Prompts Expected`;
  }
}

function updateModalScriptWordCount(tab) {
  const txt = document.getElementById('newProjScript').value.trim();
  const words = txt ? txt.split(/\s+/).length : 0;
  const label = document.getElementById('newProjScriptWordCount');
  if (label) label.textContent = words + ' words';
}

function handleModalVoiceoverFile(input, tab) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (tab === 'm1') modalVoiceFile_M1 = file;
  else modalVoiceFile_M2 = file;

  const statusId = tab === 'm1' ? 'newProjVoiceoverStatus' : 'newProjVoiceoverStatusM2';
  const statusChip = document.getElementById(statusId);
  if (statusChip) {
    statusChip.textContent = `🎵 ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    statusChip.style.display = 'inline-flex';
  }

  const pathInput = document.getElementById(tab === 'm1' ? 'newProjVoiceoverPath' : 'newProjVoiceoverPathM2');
  if (pathInput) pathInput.value = file.name;

  // Instant HTML5 duration probe
  const audio = new Audio();
  const objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.onloadedmetadata = () => {
    const dur = audio.duration;
    URL.revokeObjectURL(objectUrl);
    if (dur && dur > 0) {
      const formattedDur = dur.toFixed(1);
      const durInput = document.getElementById(tab === 'm1' ? 'newProjDuration' : 'newProjDurationM2');
      const badge = document.getElementById(tab === 'm1' ? 'newProjDurationBadge' : 'newProjDurationBadgeM2');
      if (durInput) durInput.value = formattedDur;
      if (badge) {
        badge.textContent = `${formattedDur}s (Auto-Detected)`;
        badge.style.color = 'var(--emerald)';
        badge.style.borderColor = 'var(--emerald)';
      }
      updateModalPromptCalculation(tab);
      showToast(`⚡ Audio auto-scanned: ${formattedDur}s. Pacing forecast ready!`, 'success');
    }
  };
}

function handleModalMusicFile(input, tab) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const pathInput = document.getElementById(tab === 'm1' ? 'newProjMusicPath' : 'newProjMusicPathM2');
    if (pathInput) pathInput.value = file.name;
    if (tab === 'm1') modalMusicFile_M1 = file;
    else modalMusicFile_M2 = file;
    showToast(`Selected music: ${file.name}`, 'info');
  }
}

function handleModalCharImage(input, tab) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (tab === 'm1') modalCharBase64_M1 = e.target.result;
      else modalCharBase64_M2 = e.target.result;

      const thumb = document.getElementById(tab === 'm1' ? 'newProjCharThumb' : 'newProjCharThumbM2');
      const placeholder = document.getElementById(tab === 'm1' ? 'newProjCharPlaceholder' : 'newProjCharPlaceholderM2');
      const removeBtn = document.getElementById(tab === 'm1' ? 'newProjCharRemoveBtn' : 'newProjCharRemoveBtnM2');
      const statusText = document.getElementById(tab === 'm1' ? 'newProjCharStatusText' : 'newProjCharStatusTextM2');

      if (thumb) {
        thumb.src = e.target.result;
        thumb.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (statusText) {
        statusText.innerHTML = `<strong style="color: var(--emerald);">✅ Reference Loaded:</strong> ${file.name}`;
      }

      showToast(`Character reference loaded: ${file.name}`, 'success');
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
      showToast(`Loaded prompt file: ${file.name}`, 'success');
    };
    reader.readAsText(file);
  }
}

function updateModalPromptListCount() {
  const area = document.getElementById('newProjPromptList');
  const badge = document.getElementById('newProjPromptCountBadge');
  if (!area || !badge) return;
  const lines = area.value.split(/\r?\n/).filter(l => l.trim().length > 0);
  badge.textContent = `${lines.length} prompts`;
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
        await fetch(`/api/v1/projects/${created.id}/audio/upload`, { method: 'POST', body: formData }).catch(console.error);
      }

      // If background music was chosen via file picker, upload it
      const activeMusicFile = (mode === 'MODE_1') ? modalMusicFile_M1 : modalMusicFile_M2;
      if (activeMusicFile) {
        const formData = new FormData();
        formData.append('audio', activeMusicFile);
        formData.append('track_type', 'MUSIC');
        formData.append('volume', payload.music_volume || 0.07);
        await fetch(`/api/v1/projects/${created.id}/audio/upload`, { method: 'POST', body: formData }).catch(console.error);
      }

      showToast(`Project created: ${created.name}`, 'success');
      closeNewProjectModal();
      await loadProjects();
      await onSelectProject(created.id);
      goToStep(1);
    } else {
      showToast(created.error || 'Failed to create project', 'error');
    }
  } catch (err) {
    showToast(`Error creating project: ${err.message}`, 'error');
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
        await fetch(`/api/v1/projects/${activeProjectId}/audio/attach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: data.file_path, track_type: 'VOICEOVER', manual_duration: data.duration })
        }).catch(console.error);
      }
      showToast(`Voiceover duration detected: ${data.duration.toFixed(1)}s`, 'success');
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
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  // Instant HTML5 browser audio duration probe
  const audioObj = new Audio();
  const objectUrl = URL.createObjectURL(file);
  audioObj.src = objectUrl;

  audioObj.onloadedmetadata = () => {
    const dur = audioObj.duration;
    URL.revokeObjectURL(objectUrl);
    if (dur && dur > 0) {
      const formattedDur = dur.toFixed(1);
      const durInput = document.getElementById('m1Duration');
      if (durInput) durInput.value = formattedDur;
      const badge = document.getElementById('m1DurationBadge');
      if (badge) {
        badge.textContent = `${formattedDur}s (Auto-Detected)`;
        badge.style.color = 'var(--emerald)';
        badge.style.borderColor = 'var(--emerald)';
      }
      updateM1PromptEstimate();
      showToast(`⚡ Audio auto-scanned: ${formattedDur}s. Pacing forecast updated!`, 'success');
    }
  };

  // Update status chip
  const statusChip = document.getElementById('m1VoiceoverStatus');
  if (statusChip) {
    statusChip.textContent = `🎵 ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    statusChip.style.display = 'inline-flex';
  }
  const pathInput = document.getElementById('m1VoiceoverPath');
  if (pathInput) pathInput.value = file.name;

  if (activeProjectId) {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('track_type', 'VOICEOVER');
    fetch(`/api/v1/projects/${activeProjectId}/audio/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        if (d.voiceover_duration) {
          document.getElementById('m1Duration').value = d.voiceover_duration.toFixed(1);
          document.getElementById('m1DurationBadge').textContent = d.voiceover_duration.toFixed(1) + 's';
          updateM1PromptEstimate();
        }
      })
      .catch(err => console.warn('Background upload note:', err.message));
  }
}

function handleM1MusicFile(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const statusChip = document.getElementById('m1MusicStatus');
  if (statusChip) {
    statusChip.textContent = `🎵 ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    statusChip.style.display = 'inline-flex';
  }
  const pathInput = document.getElementById('m1MusicPath');
  if (pathInput) pathInput.value = file.name;

  if (activeProjectId) {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('track_type', 'MUSIC');
    formData.append('volume', (parseFloat(document.getElementById('m1MusicVol')?.value) || 7) / 100);
    fetch(`/api/v1/projects/${activeProjectId}/audio/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => showToast('Background music uploaded', 'success'))
      .catch(err => console.warn('BGM note:', err.message));
  }
}

function updateM1MusicVolume(val) {
  const pct = parseInt(val, 10) || 7;
  const lbl = document.getElementById('m1MusicVolLabel');
  if (lbl) lbl.textContent = pct + '% (Auto-Ducked)';
  if (activeProjectId) {
    fetch(`/api/v1/projects/${activeProjectId}/audio/attach`, {
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
      showToast(`Detected duration: ${data.duration.toFixed(1)}s`, 'success');
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
      showToast(`Loaded prompt file: ${file.name}`, 'success');
    };
    reader.readAsText(file);
  }
}

function updateM2PromptCount() {
  const area = document.getElementById('rawPromptsInput');
  const badge = document.getElementById('m2PromptCountBadge');
  if (!area || !badge) return;
  const lines = area.value.split(/\r?\n/).filter(l => l.trim().length > 0);
  badge.textContent = `${lines.length} prompts`;
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


// =============================================
// STEP 1: AI STORY ENGINE & PROMPTS
// =============================================
async function loadAiModels() {
  try {
    const res = await fetch('/api/v1/ai/models');
    const data = await res.json();
    const select = document.getElementById('m1ModelSelect');
    if (!select) return;

    select.innerHTML = '';
    (data.models || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === data.primary_model) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) {}
}

async function loadDefaultMasterPrompt() {
  try {
    const res = await fetch('/api/v1/ai/master-prompt-default');
    const data = await res.json();
    if (data.master_prompt) {
      const el = document.getElementById('m1MasterPrompt');
      if (el && !el.value) el.value = data.master_prompt;
    }
  } catch (e) {}
}

function updateM1ScriptWordCount() {
  const text = document.getElementById('m1ScriptInput').value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('m1WordCountLabel').textContent = `${words} words`;
  updateM1PromptEstimate();
}

function updateM1PromptEstimate() {
  const durEl = document.getElementById('m1Duration');
  const pacingEl = document.getElementById('m1Pacing');
  const customEl = document.getElementById('m1CustomCount');
  const badge = document.getElementById('m1PromptEstimateBadge');
  if (!durEl || !pacingEl) return;

  const duration = parseFloat(durEl.value) || 60;
  const pacing = pacingEl.value || '3/4s';
  const custom = customEl ? parseInt(customEl.value) : null;
  const rates = { '1/4s': 0.25, '2/4s': 0.50, '3/4s': 0.75, '4/4s': 1.00, '5/4s': 1.25 };
  const rate = rates[pacing] || 0.75;
  const targetPrompts = (custom && custom > 0) ? custom : Math.max(1, Math.round(duration * rate));
  const secPerImg = (1 / rate).toFixed(2);

  if (badge) {
    badge.textContent = (custom && custom > 0) ? `${custom} prompts (override)` : `~${targetPrompts} stickman prompts`;
  }

  // Update Live Audio Forecast Card
  const fDur = document.getElementById('m1ForecastDur');
  const fPacing = document.getElementById('m1ForecastPacing');
  const fCount = document.getElementById('m1ForecastCount');
  if (fDur) fDur.textContent = `${duration.toFixed(1)}s`;
  if (fPacing) fPacing.textContent = `${pacing} (${secPerImg}s/image)`;
  if (fCount) fCount.textContent = `${targetPrompts} Scenes (${targetPrompts} Prompts & ${targetPrompts} Images)`;
}

async function triggerMode1Generate() {
  if (!activeProjectId) {
    showToast('Select or create a project first', 'warn');
    return;
  }
  const scriptText = document.getElementById('m1ScriptInput').value.trim();
  if (!scriptText) {
    showToast('Please enter your story or voiceover script', 'warn');
    return;
  }

  const duration = parseFloat(document.getElementById('m1Duration').value) || 60;
  const pacing = document.getElementById('m1Pacing').value;
  const customCountRaw = document.getElementById('m1CustomCount').value;
  const customCount = customCountRaw ? parseInt(customCountRaw) : null;
  const masterPrompt = document.getElementById('m1MasterPrompt').value;
  const charRef = document.getElementById('m1CharacterRef').value;
  const visualElems = document.getElementById('m1VisualElements').value;

  const btn = document.getElementById('btnM1Generate');
  const progressBox = document.getElementById('m1ProgressBox');
  const progressBar = document.getElementById('m1ProgressBar');
  const progressStatus = document.getElementById('m1ProgressStatus');

  btn.disabled = true;
  btn.innerHTML = '<span>⚡</span> Generating Prompts with Groq...';
  progressBox.style.display = 'block';
  progressBar.style.width = '20%';
  progressStatus.textContent = 'Contacting Groq LLM API...';

  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/ai/generate-prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script_text: scriptText,
        voiceover_seconds: duration,
        pacing_preset: pacing,
        custom_count: customCount,
        master_prompt: masterPrompt,
        character_reference: charRef,
        visual_elements: visualElems
      })
    });
    
    progressBar.style.width = '80%';
    progressStatus.textContent = 'Formatting and validating prompts...';

    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Generation failed');

    progressBar.style.width = '100%';
    progressStatus.textContent = `Generated ${result.generated_count} prompts successfully!`;
    showToast(`Generated ${result.generated_count} stickman prompts!`, 'success');

    if (result.story_bible) {
      document.getElementById('m1BibleBox').style.display = 'block';
      document.getElementById('m1BibleProtagonist').textContent = result.story_bible.protagonist || 'Stickman Hero';
      document.getElementById('m1BibleSetting').textContent = result.story_bible.setting || 'Obsidian void / minimalist background';
    }

    await loadProjectPrompts();
    onSelectProject(activeProjectId);
  } catch (err) {
    showToast(`Generation failed: ${err.message}`, 'error');
    progressStatus.textContent = `Error: ${err.message}`;
    progressBar.style.background = 'var(--rose)';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>⚡</span> Generate Story Prompts';
    setTimeout(() => { progressBox.style.display = 'none'; }, 4000);
  }
}

async function importRawPrompts() {
  if (!activeProjectId) {
    showToast('Select an active project first', 'warn');
    return;
  }
  const rawText = document.getElementById('rawPromptsInput').value;
  if (!rawText.trim()) {
    showToast('Paste prompt list first', 'warn');
    return;
  }

  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/prompts/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_prompts: rawText })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Imported ${data.count} prompts successfully!`, 'success');
      document.getElementById('rawPromptsInput').value = '';
      loadProjectPrompts();
      onSelectProject(activeProjectId);
    } else {
      showToast(`Validation error: ${(data.errors || []).join(', ')}`, 'error');
    }
  } catch (err) {
    showToast(`Import error: ${err.message}`, 'error');
  }
}

async function loadProjectPrompts() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/prompts`);
    const prompts = await res.json();
    const container = document.getElementById('promptListContainer');
    if (!container) return;

    document.getElementById('promptsCountBadge').textContent = `${prompts.length} Prompts`;
    if (document.getElementById('promptsSubTabCount')) {
      document.getElementById('promptsSubTabCount').textContent = prompts.length;
    }

    if (prompts.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); padding: 18px; text-align: center;">No prompts in this project yet. Use AI Story Generator or Import Prompts above.</div>';
      return;
    }

    container.innerHTML = prompts.map(p => `
      <div class="prompt-row">
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan);">${p.prompt_id_str}</span>
          <span style="color: var(--text-main); font-size: 13px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p.prompt_text}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span class="worker-badge-status ${p.status === 'COMPLETED' ? 'status-generating' : 'status-idle'}">${p.status}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading prompts:', err);
  }
}

// =============================================
// STEP 2: WORKER FARM & CLUSTER
// =============================================
async function refreshWorkers() {
  try {
    const [wRes, pRes] = await Promise.all([
      fetch('/api/v1/workers'),
      fetch('/api/v1/workers/processes')
    ]);
    const workers = await wRes.json();
    const procData = await pRes.json();

    const grid = document.getElementById('workerFarmGrid');
    if (!grid) return;

    document.getElementById('farmActiveCountBadge').textContent = `${procData.active_count || 0} / 10 Active`;

    if (workers.length === 0) {
      grid.innerHTML = '<div style="color: var(--text-dim); grid-column: span 3; padding: 20px; text-align: center;">No workers online. Click "Launch Farm" above to launch browser workers.</div>';
      return;
    }

    grid.innerHTML = workers.map(w => {
    if (w.status === 'LOGIN_REQUIRED' || (w.last_error && w.last_error.toLowerCase().includes('captcha'))) {
      triggerWorkerVoiceAlert(w.id, 'Captcha needed');
    }
      const isFlow = w.provider === 'flow';
      const proc = procData.processes?.find(p => p.workerId === w.id);
      const pidText = proc ? `PID: ${proc.pid}` : 'Not Running';
      
      let statusClass = 'status-idle';
      if (w.status === 'GENERATING') statusClass = 'status-generating';
      else if (w.status === 'LOGIN_REQUIRED') statusClass = 'status-login';
      else if (w.status === 'OFFLINE') statusClass = 'status-offline';

      return `
        <div class="worker-card ${isFlow ? 'flow' : 'meta'}">
          <div class="worker-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="worker-tag ${isFlow ? 'flow' : 'meta'}">${w.provider.toUpperCase()}</span>
              <strong style="color: var(--text-pure); font-size: 13px;">${w.id}</strong>
            </div>
            <span class="worker-badge-status ${statusClass}">${w.status}</span>
          </div>

          <div style="font-size: 11px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
            <div><strong>Profile:</strong> ${w.profile_name || 'default'}</div>
            <div><strong>Process:</strong> <span style="font-family: var(--font-mono); color: var(--cyan);">${pidText}</span></div>
            <div><strong>Range:</strong> ${w.range_start ? `${('00' + w.range_start).slice(-3)} - ${('00' + w.range_end).slice(-3)}` : 'Unassigned'}</div>
            <div><strong>Active Job:</strong> ${w.active_job_id || 'None (Idle)'}</div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button class="btn btn-secondary" onclick="restartWorker('${w.id}')" style="flex: 1; padding: 4px 8px; font-size: 11px;">Restart</button>
            <button class="btn btn-rose" onclick="stopWorker('${w.id}')" style="flex: 1; padding: 4px 8px; font-size: 11px;">Stop</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error refreshing workers:', err);
  }
}

async function launchFarm() {
  const flowCount = parseInt(document.getElementById('farmFlowCount').value) || 0;
  const metaCount = parseInt(document.getElementById('farmMetaCount').value) || 0;
  const total = flowCount + metaCount;

  if (total > 10) {
    showToast('Maximum 10 workers allowed simultaneously', 'error');
    return;
  }

  showToast(`Launching ${total} browser workers...`, 'info');
  try {
    const res = await fetch('/api/v1/workers/processes/launch-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow_count: flowCount, meta_count: metaCount })
    });
    const data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
    } else {
      showToast('Worker farm launch initiated!', 'success');
      setTimeout(refreshWorkers, 2000);
    }
  } catch (err) {
    showToast(`Launch failed: ${err.message}`, 'error');
  }
}

async function stopAllWorkers() {
  if (!confirm('Stop all running browser worker instances?')) return;
  try {
    await fetch('/api/v1/workers/processes/stop-all', { method: 'POST' });
    showToast('All workers stopped', 'info');
    setTimeout(refreshWorkers, 1000);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function restartWorker(workerId) {
  try {
    await fetch('/api/v1/workers/processes/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId })
    });
    showToast(`Restarting ${workerId}...`, 'info');
    setTimeout(refreshWorkers, 2000);
  } catch (err) {
    showToast(`Restart failed: ${err.message}`, 'error');
  }
}

async function stopWorker(workerId) {
  try {
    await fetch('/api/v1/workers/processes/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: workerId })
    });
    showToast(`Stopped ${workerId}`, 'info');
    setTimeout(refreshWorkers, 1000);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Ranges Modal
async function openRangesModal() {
  if (!activeProjectId) {
    showToast('Select a project first', 'warn');
    return;
  }
  const modal = document.getElementById('rangesModal');
  const container = document.getElementById('rangesList');
  modal.style.display = 'flex';
  container.innerHTML = '<div style="color: var(--text-dim);">Loading workers...</div>';

  try {
    const [wRes, pRes] = await Promise.all([
      fetch('/api/v1/workers'),
      fetch(`/api/v1/projects/${activeProjectId}/prompts`)
    ]);
    const workers = await wRes.json();
    const prompts = await pRes.json();

    if (workers.length === 0) {
      container.innerHTML = '<div style="color: var(--rose);">No workers registered. Launch workers first.</div>';
      return;
    }

    const total = prompts.length;
    const perWorker = Math.ceil(total / workers.length);

    container.innerHTML = workers.map((w, idx) => {
      const s = (idx * perWorker) + 1;
      const e = Math.min((idx + 1) * perWorker, total);
      return `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 10px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between;">
          <div style="font-weight: 600; color: var(--cyan);">${w.id} (${w.provider.toUpperCase()})</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="number" id="v2_range_start_${w.id}" value="${w.range_start || s}" class="form-input" style="width: 70px; padding: 4px 8px;" />
            <span style="color: var(--text-dim);">to</span>
            <input type="number" id="v2_range_end_${w.id}" value="${w.range_end || e}" class="form-input" style="width: 70px; padding: 4px 8px;" />
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="color: var(--rose);">${err.message}</div>`;
  }
}

function closeRangesModal() {
  document.getElementById('rangesModal').style.display = 'none';
}

async function submitRanges() {
  if (!activeProjectId) return;
  try {
    const wRes = await fetch('/api/v1/workers');
    const workers = await wRes.json();
    const assignments = workers.map(w => ({
      worker_id: w.id,
      range_start: parseInt(document.getElementById(`v2_range_start_${w.id}`)?.value) || 0,
      range_end: parseInt(document.getElementById(`v2_range_end_${w.id}`)?.value) || 0
    }));

    const res = await fetch(`/api/v1/projects/${activeProjectId}/assign-workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Worker partition assigned successfully!', 'success');
      closeRangesModal();
      refreshWorkers();
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

// =============================================
// STEP 3: IMAGE ASSETS & VISUAL QA STUDIO
// =============================================
async function loadProjectGallery() {
  if (!activeProjectId) return;
  try {
    await fetch(`/api/v1/projects/${activeProjectId}/ingest`, { method: 'POST' });

    const res = await fetch(`/api/v1/projects/${activeProjectId}/prompts`);
    const prompts = await res.json();

    const gallery = document.getElementById('galleryGrid');
    if (!gallery) return;

    const completed = prompts.filter(p => p.status === 'COMPLETED' && (p.file_path || p.image_path || p.file_name));
    document.getElementById('galleryCountBadge').textContent = `${completed.length} / ${prompts.length} Rendered`;

    if (completed.length === 0) {
      gallery.innerHTML = '<div style="color: var(--text-dim); grid-column: span 4; padding: 30px; text-align: center;">No images generated yet. Workers will save images directly into the project repository.</div>';
      return;
    }

    gallery.innerHTML = completed.map(p => {
      const imgUrl = resolveMediaUrl(p.file_path || p.image_path);
      return `
        <div class="image-card">
          <div class="image-thumbnail-wrap" onclick="openLightbox('${imgUrl}', '${p.prompt_id_str}', '${encodeURIComponent(p.prompt_text)}')">
            <img src="${imgUrl}" alt="${p.prompt_id_str}" class="image-thumbnail" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><text y=\\'50\\' x=\\'50\\' text-anchor=\\'middle\\' fill=\\'%23666\\'>Image</text></svg>'" />
          </div>
          <div class="image-card-body">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="image-prompt-id">${p.prompt_id_str}</span>
              <span class="worker-badge-status status-generating">QA APPROVED</span>
            </div>
            <div class="image-prompt-text" title="${p.prompt_text}">${p.prompt_text}</div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-secondary" onclick="openReplaceModal('${p.id}', '${p.prompt_id_str}')" style="flex: 1; padding: 4px 6px; font-size: 10px;">Replace</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading gallery:', err);
  }
}

function openLightbox(url, id, text) {
  const modal = document.getElementById('lightboxModal');
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxTitle').textContent = `Prompt ${id}`;
  document.getElementById('lightboxDesc').textContent = decodeURIComponent(text);
  modal.style.display = 'flex';
}

function closeLightbox() {
  document.getElementById('lightboxModal').style.display = 'none';
}

// =============================================
// STEP 4: 🎬 INTERACTIVE VIDEO CANVAS & SCENE DIRECTOR
// =============================================
async function loadTimeline() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/timeline`);
    const rawTl = await res.json();
    timelineItems = Array.isArray(rawTl) ? rawTl : (rawTl.items || []);
    if (window.captionEngine) window.captionEngine.loadScenes(timelineItems);

    const audioEl = document.getElementById('timelineAudioElement');
    if (currentProjectData?.voiceover_path) {
      // Point audio player to local voiceover file if available
      audioEl.src = resolveMediaUrl(currentProjectData.voiceover_path || 'voiceover.wav');
      audioEl.load();
    }

    renderSceneDirectorCards();
    renderCapCutTimeline();
    initPlayerListeners();

    if (timelineItems.length > 0) {
      updatePlaybackScene(0);
      const totalDur = timelineItems[timelineItems.length - 1].end_time || 0;
      document.getElementById('playbackTotalTime').textContent = formatTime(totalDur);
    }
  } catch (err) {
    console.error('Error loading timeline:', err);
  }
}

async function buildTimeline() {
  if (!activeProjectId) return;
  try {
    showToast('Auto-synchronizing images with voiceover audio...', 'info');
    const res = await fetch(`/api/v1/projects/${activeProjectId}/timeline/build`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Master Timeline generated!', 'success');
      await loadTimeline();
    } else {
      showToast(`Timeline error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

function initPlayerListeners() {
  const audio = document.getElementById('timelineAudioElement');
  if (!audio) return;

  audio.ontimeupdate = () => {
    const curTime = audio.currentTime;
    document.getElementById('playbackCurrentTime').textContent = formatTime(curTime);

    const totalDur = timelineItems.length > 0 ? (timelineItems[timelineItems.length - 1].end_time || 1) : (audio.duration || 1);
    const pct = Math.min((curTime / totalDur) * 100, 100);
    document.getElementById('timelineScrubberFill').style.width = `${pct}%`;
    if (window.captionEngine) window.captionEngine.renderAtTime(curTime);

    // Find active scene
    const activeIdx = timelineItems.findIndex(item => curTime >= (item.start_time || 0) && curTime < (item.end_time || 99999));
    if (activeIdx !== -1) {
      if (activeIdx !== currentSceneIndex) {
        updatePlaybackScene(activeIdx);
      }
      const scene = timelineItems[activeIdx];
      if (scene) {
        const dur = (scene.end_time || 0) - (scene.start_time || 0);
        const elapsed = Math.max(0, curTime - (scene.start_time || 0));
        const words = (scene.prompt_text || '').trim().split(/\s+/);
        if (words.length > 0 && dur > 0) {
          const wIdx = Math.min(Math.floor((elapsed / dur) * words.length), words.length - 1);
          renderLiveCaptionWords(scene.prompt_text, wIdx);
        }
      }
    }
  };

  audio.onended = () => {
    pausePlayback();
    seekToStart();
  };
}

function updatePlaybackScene(idx) {
  if (idx < 0 || idx >= timelineItems.length) return;
  currentSceneIndex = idx;
  const scene = timelineItems[idx];

  const imgEl = document.getElementById('playerCanvasImage');
  const badgeEl = document.getElementById('playerSceneBadge');
  const captionEl = document.getElementById('playerCaptionOverlay');

  if (scene.image_path) {
    imgEl.src = resolveMediaUrl(scene.image_path || scene.file_path);
  } else {
    imgEl.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="%230a0d16"/><text y="32" x="50" text-anchor="middle" fill="%2300f0ff" font-size="6">Stickman Scene Ready</text></svg>';
  }

  // Trigger smooth Ken Burns animation reset
  const motionClass = (scene.motion_preset || 'SLOW_ZOOM').toLowerCase().replace('_', '-');
  imgEl.className = 'canvas-image-stage motion-zoom-in';
  void imgEl.offsetWidth; // trigger reflow
  imgEl.className = `canvas-image-stage motion-${motionClass}`;

  badgeEl.textContent = `SCENE ${scene.prompt_id_str || (idx + 1)}`;
  captionEl.textContent = scene.prompt_text || scene.label || `Stickman scene ${idx + 1}`;

  // Highlight active scene card in Director Grid
  document.querySelectorAll('.scene-director-card').forEach((c, i) => {
    if (i === idx) c.classList.add('active-playing');
    else c.classList.remove('active-playing');
  });

  document.querySelectorAll('.timeline-scene-card').forEach((c, i) => {
    if (i === idx) {
      c.classList.add('active-scene');
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      c.classList.remove('active-scene');
    }
  });

  renderLiveCaptionWords(scene.prompt_text || scene.label || ('Scene #' + (idx + 1)), 0);
}

function togglePlayback() {
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  const audio = document.getElementById('timelineAudioElement');
  isPlaying = true;
  document.getElementById('btnPlayPause').innerHTML = '<span>⏸</span> Pause';
  if (audio && audio.src) {
    audio.play().catch(() => {});
  }
}

function pausePlayback() {
  const audio = document.getElementById('timelineAudioElement');
  isPlaying = false;
  document.getElementById('btnPlayPause').innerHTML = '<span>▶</span> Play Preview';
  if (audio) audio.pause();
}

function seekToStart() {
  const audio = document.getElementById('timelineAudioElement');
  if (audio) audio.currentTime = 0;
  document.getElementById('timelineScrubberFill').style.width = '0%';
  document.getElementById('playbackCurrentTime').textContent = '00:00.0';
  if (timelineItems.length > 0) updatePlaybackScene(0);
}

function onScrubTimeline(event) {
  const track = document.getElementById('timelineScrubberTrack');
  const rect = track.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const pct = Math.max(0, Math.min(clickX / rect.width, 1));

  const totalDur = timelineItems.length > 0 ? (timelineItems[timelineItems.length - 1].end_time || 30) : 30;
  const targetTime = pct * totalDur;

  const audio = document.getElementById('timelineAudioElement');
  if (audio) audio.currentTime = targetTime;

  document.getElementById('timelineScrubberFill').style.width = `${pct * 100}%`;
  document.getElementById('playbackCurrentTime').textContent = formatTime(targetTime);

  const idx = timelineItems.findIndex(item => targetTime >= (item.start_time || 0) && targetTime < (item.end_time || 99999));
  if (idx !== -1) updatePlaybackScene(idx);
}

function toggleAspect() {
  const viewport = document.getElementById('playerCanvasViewport');
  const btn = document.getElementById('btnToggleAspect');
  isVerticalAspect = !isVerticalAspect;

  if (isVerticalAspect) {
    viewport.classList.add('vertical');
    btn.textContent = '9:16 (Shorts)';
  } else {
    viewport.classList.remove('vertical');
    btn.textContent = '16:9 (YouTube)';
  }
}

function renderSceneDirectorCards() {
  const grid = document.getElementById('sceneDirectorGrid');
  const badge = document.getElementById('sceneCountBadge');
  if (!grid) return;

  badge.textContent = `${timelineItems.length} Scenes`;

  if (timelineItems.length === 0) {
    grid.innerHTML = '<div style="color: var(--text-dim); grid-column: span 3; padding: 24px; text-align: center;">No scenes in timeline. Click "Auto-Sync Audio" above to build the sequence.</div>';
    return;
  }

  grid.innerHTML = timelineItems.map((scene, idx) => {
    const thumbUrl = resolveMediaUrl(scene.image_path || scene.file_path);
    const dur = (scene.duration || (scene.end_time - scene.start_time) || 3.0).toFixed(1);

    return `
      <div class="scene-director-card" id="sceneCard_${idx}">
        <div class="scene-card-top">
          <img src="${thumbUrl}" class="scene-card-thumb" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 80 50\\'><rect width=\\'80\\' height=\\'50\\' fill=\\'%23080b14\\'/><text y=\\'28\\' x=\\'40\\' text-anchor=\\'middle\\' fill=\\'%23555\\' font-size=\\'10\\'>${scene.prompt_id_str || idx + 1}</text></svg>'" />
          <div class="scene-card-info">
            <span class="scene-card-id">${scene.prompt_id_str || ('00' + (idx + 1)).slice(-3)}</span>
            <span class="scene-card-text" title="${scene.prompt_text || ''}">${scene.prompt_text || scene.label || 'Stickman scene'}</span>
            <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">${scene.start_time?.toFixed(1)}s &rarr; ${scene.end_time?.toFixed(1)}s</span>
          </div>
        </div>

        <div class="scene-card-controls">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 10px; color: var(--text-dim);">Duration:</label>
            <input type="number" step="0.1" value="${dur}" onchange="updateSceneDuration(${idx}, this.value)" class="form-input" style="width: 55px; padding: 2px 6px; font-size: 11px; height: 26px;" />
            <span style="font-size: 10px; color: var(--text-dim);">s</span>
          </div>

          <div style="display: flex; gap: 4px;">
            <button class="btn btn-secondary" onclick="moveScene(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 10px;" title="Move earlier">▲</button>
            <button class="btn btn-secondary" onclick="moveScene(${idx}, 1)" ${idx === timelineItems.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 10px;" title="Move later">▼</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateSceneDuration(idx, newDurationStr) {
  const newDur = parseFloat(newDurationStr);
  if (isNaN(newDur) || newDur <= 0.2) {
    showToast('Invalid duration', 'warn');
    return;
  }

  timelineItems[idx].duration = newDur;
  recalculateTimelineTimings();
  renderSceneDirectorCards();
  showToast(`Updated Scene ${idx + 1} duration to ${newDur}s`, 'success');
}

function moveScene(idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= timelineItems.length) return;

  const temp = timelineItems[idx];
  timelineItems[idx] = timelineItems[targetIdx];
  timelineItems[targetIdx] = temp;

  recalculateTimelineTimings();
  renderSceneDirectorCards();
  showToast(`Reordered scene ${idx + 1}`, 'info');
}


let timelineSyncTimeout = null;
async function syncTimelineToBackend() {
  if (!activeProjectId || !timelineItems || timelineItems.length === 0) return;
  clearTimeout(timelineSyncTimeout);
  timelineSyncTimeout = setTimeout(async () => {
    try {
      const payload = timelineItems.map((item, idx) => ({
        id: item.id,
        order_index: idx + 1,
        duration: item.duration
      }));
      await fetch(`/api/v1/projects/${activeProjectId}/timeline/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      });
      console.log('Master timeline synced to SQLite database');
    } catch (e) {
      console.warn('Failed to sync timeline to backend:', e);
    }
  }, 300);
}

function recalculateTimelineTimings() {
  let cursor = 0;
  for (let i = 0; i < timelineItems.length; i++) {
    const dur = timelineItems[i].duration || (timelineItems[i].end_time - timelineItems[i].start_time) || 3.0;
    timelineItems[i].start_time = cursor;
    timelineItems[i].end_time = cursor + dur;
    timelineItems[i].duration = dur;
    cursor += dur;
  }
  const totalDur = cursor;
  document.getElementById('playbackTotalTime').textContent = formatTime(totalDur);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${('0' + m).slice(-2)}:${('0' + s).slice(-2)}.${ms}`;
}

// =============================================
// STEP 5: RENDER STUDIO & EXPORT ENGINE
// =============================================
async function triggerRender() {
  if (!activeProjectId) {
    showToast('Select an active project first', 'warn');
    return;
  }

  const fps = parseInt(document.getElementById('renderFps').value) || 30;
  const resolution = document.getElementById('renderResolution').value || '1920x1080';
  const motion = document.getElementById('renderMotionToggle').checked;

  const btn = document.getElementById('btnStartRender');
  const box = document.getElementById('renderStatusCard');
  btn.disabled = true;
  box.style.display = 'block';

  document.getElementById('renderProgressText').textContent = 'Encoding 1080p MP4 with FFmpeg...';
  document.getElementById('renderBar').style.width = '20%';

  try {
    const isPortrait = (resolution === '1080x1920');
    const aspectRatio = isPortrait ? '9:16' : '16:9';
    document.getElementById('renderProgressText').textContent = 'Rendering 1080p Master Video via FFmpeg...';
    
    const res = await fetch(`/api/v1/projects/${activeProjectId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fps: parseInt(fps, 10) || 30,
        resolution,
        aspect_ratio: aspectRatio,
        motion_enabled: motion,
        include_music: true,
        include_sfx: true,
        music_volume: 0.07
      })
    });
    const data = await res.json();
    if (data.output_path || data.success) {
      document.getElementById('renderBar').style.width = '100%';
      document.getElementById('renderProgressText').textContent = '✓ Render Complete!';
      btn.disabled = false;
      showToast('1080p Video Render Complete!', 'success');
      
      const playerWrap = document.getElementById('renderPlayerWrap');
      const video = document.getElementById('renderedVideoPlayer');
      video.src = resolveMediaUrl(data.output_path);
      playerWrap.style.display = 'block';
      loadRenderHistory();
    } else if (data.render_id) {
      showToast('Render in progress...', 'info');
      pollRender(data.render_id);
    } else {
      showToast(data.error || 'Render failed', 'error');
      btn.disabled = false;
    }
  } catch (err) {
    showToast(`Render failed: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

function pollRender(renderId) {
  let attempts = 0;
  if (renderPollInterval) clearInterval(renderPollInterval);

  renderPollInterval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/api/v1/projects/${activeProjectId}/renders`);
      const renders = await res.json();
      const current = renders.find(r => r.id === renderId);

      if (current) {
        document.getElementById('renderBar').style.width = `${Math.min(20 + attempts * 8, 95)}%`;

        if (current.status === 'COMPLETED') {
          clearInterval(renderPollInterval);
          document.getElementById('renderBar').style.width = '100%';
          document.getElementById('renderProgressText').textContent = '✅ Render Complete!';
          document.getElementById('btnStartRender').disabled = false;
          showToast('1080p Video Render Complete!', 'success');

          // Show Player
          const playerWrap = document.getElementById('renderPlayerWrap');
          const video = document.getElementById('renderedVideoPlayer');
          video.src = resolveMediaUrl(current.output_path);
          playerWrap.style.display = 'block';
          loadRenderHistory();
        } else if (current.status === 'FAILED') {
          clearInterval(renderPollInterval);
          document.getElementById('renderProgressText').textContent = `❌ Render Error: ${current.error_message}`;
          document.getElementById('renderBar').style.background = 'var(--rose)';
          document.getElementById('btnStartRender').disabled = false;
          showToast('Render failed', 'error');
        }
      }
    } catch (e) {
      console.error(e);
    }
    if (attempts > 90) clearInterval(renderPollInterval);
  }, 2000);
}

async function loadRenderHistory() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`/api/v1/projects/${activeProjectId}/renders`);
    const renders = await res.json();
    const container = document.getElementById('renderHistoryList');
    if (!container) return;

    if (renders.length === 0) {
      container.innerHTML = '<div style="color: var(--text-dim); padding: 12px;">No videos rendered for this project yet.</div>';
      return;
    }

    container.innerHTML = renders.map(r => `
      <div style="background: rgba(14, 20, 36, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 600; color: #fff;">${r.id}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${new Date(r.created_at).toLocaleString()} • ${r.resolution} • ${r.fps}fps</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="${resolveMediaUrl(r.output_path)}" target="_blank" class="btn btn-secondary" style="text-decoration: none; padding: 4px 10px; font-size: 11px;">▶ Play</a>
          <a href="${resolveMediaUrl(r.output_path)}" download class="btn btn-primary" style="text-decoration: none; padding: 4px 10px; font-size: 11px;">⬇ Download</a>
        </div>
      </div>
    `).join('');
  } catch (err) {}
}

// =============================================
// STEP 6: TELEMETRY & SETTINGS
// =============================================
function startHardwarePolling() {
  async function poll() {
    try {
      const res = await fetch('/api/v1/system/resources');
      if (!res.ok) return;
      const data = await res.json();

      document.getElementById('headerCpuVal').textContent = `${data.cpu_percent}%`;
      document.getElementById('headerRamVal').textContent = `${data.ram_percent}%`;
      document.getElementById('headerWorkersVal').textContent = `${data.active_workers} Active (${data.flow_workers_active}F / ${data.meta_workers_active}M)`;

      if (document.getElementById('teleTotalRam')) document.getElementById('teleTotalRam').textContent = `${data.ram_total_gb} GB`;
      if (document.getElementById('teleUsedRam')) document.getElementById('teleUsedRam').textContent = `${data.ram_used_gb} GB (${data.ram_percent}%)`;
      if (document.getElementById('teleFreeRam')) {
        const free = (parseFloat(data.ram_total_gb) - parseFloat(data.ram_used_gb)).toFixed(1);
        document.getElementById('teleFreeRam').textContent = `${free} GB`;
      }
      const warnEl = document.getElementById('farmRamWarning');
      if (warnEl) {
        if (data.hardware_warning) {
          warnEl.style.display = 'block';
          warnEl.textContent = '⚠️ ' + data.hardware_warning.message;
        } else {
          warnEl.style.display = 'none';
        }
      }
    } catch (e) {}
  }
  poll();
  telemetryTimer = setInterval(poll, 3000);
}

async function fetchLogs() {
  try {
    const res = await fetch('/api/v1/logs?limit=50');
    const logs = await res.json();
    const box = document.getElementById('telemetryLogBox');
    if (!box) return;

    box.innerHTML = logs.map(l => {
      let color = 'var(--cyan)';
      if (l.level === 'error') color = 'var(--rose)';
      else if (l.level === 'warn') color = 'var(--amber)';

      return `
        <div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; gap: 10px; font-size: 12px; font-family: var(--font-mono);">
          <span style="color: var(--text-dim);">${new Date(l.timestamp).toLocaleTimeString()}</span>
          <span style="color: ${color}; font-weight: 700;">[${l.level.toUpperCase()}]</span>
          <span style="color: var(--text-muted);">${l.source}:</span>
          <span style="color: var(--text-main);">${l.message}</span>
        </div>
      `;
    }).join('');
  } catch (err) {}
}

async function triggerReconciliation() {
  try {
    showToast('Reconciling filesystem & database...', 'info');
    const res = await fetch('/api/v1/system/reconcile', { method: 'POST' });
    const data = await res.json();
    showToast('Reconciliation complete!', 'success');
    fetchLogs();
  } catch (err) {
    showToast(`Reconciliation error: ${err.message}`, 'error');
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/v1/settings');
    const data = await res.json();
    if (data.groq_primary_model) document.getElementById('settingsGroqModel').value = data.groq_primary_model;
    if (data.groq_fallback_model) document.getElementById('settingsGroqFallback').value = data.groq_fallback_model;
    if (data.groq_api_key_configured) {
      document.getElementById('settingsGroqKey').placeholder = 'Configured: ' + data.groq_api_key;
      document.getElementById('settingsGroqKey').value = '';
    }
  } catch (err) {}
}

async function saveSettings() {
  const model = document.getElementById('settingsGroqModel').value;
  const fallback = document.getElementById('settingsGroqFallback').value;
  const keyInput = document.getElementById('settingsGroqKey').value.trim();

  const payload = { groq_primary_model: model, groq_fallback_model: fallback };
  if (keyInput && !keyInput.includes('••••')) {
    payload.groq_api_key = keyInput;
  }

  try {
    const res = await fetch('/api/v1/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Settings saved successfully!', 'success');
      loadSettings();
    } else {
      showToast(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}
