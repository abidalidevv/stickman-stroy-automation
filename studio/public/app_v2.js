
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

    // Refresh active panel content
    goToStep(currentStep);
  } catch (err) {
    console.error('Error selecting project:', err);
  }
}

function openNewProjectModal() {
  document.getElementById('newProjectModal').style.display = 'flex';
}

function closeNewProjectModal() {
  document.getElementById('newProjectModal').style.display = 'none';
}

async function submitNewProject() {
  const name = document.getElementById('newProjName').value.trim();
  const mode = document.getElementById('newProjMode').value;
  const duration = parseFloat(document.getElementById('newProjDuration').value) || 60;
  const pacing = document.getElementById('newProjPacing').value;

  if (!name) {
    showToast('Please enter a project name', 'warn');
    return;
  }

  try {
    const res = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mode, voiceover_duration: duration, pacing_preset: pacing })
    });
    const created = await res.json();
    if (created.id) {
      showToast(`Project created: ${created.name}`, 'success');
      closeNewProjectModal();
      await loadProjects();
      onSelectProject(created.id);
    } else {
      showToast(created.error || 'Failed to create project', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
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
  const custom = parseInt(document.getElementById('m1CustomCount').value);
  if (custom && custom > 0) {
    document.getElementById('m1PromptEstimateBadge').textContent = `${custom} prompts (custom override)`;
    return;
  }
  const duration = parseFloat(document.getElementById('m1Duration').value) || 60;
  const pacing = document.getElementById('m1Pacing').value;
  const rates = { '1/4s': 0.25, '2/4s': 0.5, '3/4s': 0.75, '4/4s': 1.0, '5/4s': 1.25 };
  const rate = rates[pacing] || 0.5;
  const est = Math.max(1, Math.round(duration * rate));
  document.getElementById('m1PromptEstimateBadge').textContent = `~${est} stickman prompts`;
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

    const audioEl = document.getElementById('timelineAudioElement');
    if (currentProjectData?.voiceover_path) {
      // Point audio player to local voiceover file if available
      audioEl.src = resolveMediaUrl(currentProjectData.voiceover_path || 'voiceover.wav');
      audioEl.load();
    }

    renderSceneDirectorCards();
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

    // Find active scene
    const activeIdx = timelineItems.findIndex(item => curTime >= (item.start_time || 0) && curTime < (item.end_time || 99999));
    if (activeIdx !== -1 && activeIdx !== currentSceneIndex) {
      updatePlaybackScene(activeIdx);
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
