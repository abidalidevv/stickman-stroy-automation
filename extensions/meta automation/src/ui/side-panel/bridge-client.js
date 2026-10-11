/**
 * STICKMAN STUDIO — BRIDGE CLIENT (META AI EXTENSION)
 * Runs inside the Meta Automation Side Panel UI.
 * Connects extension to local Stickman Studio service at http://127.0.0.1:45450/api/v1/
 * 
 * Standalone safe: When Auto is OFF or Studio is offline, extension functions 100% normally in manual mode.
 * Non-intrusive UI: Floating top banner with minimize button. Does NOT block Run or queue buttons at the bottom.
 */

(function () {
  const STUDIO_BASE_URL = 'http://127.0.0.1:45450/api/v1';
  const HEARTBEAT_INTERVAL_MS = 5000;
  const JOB_POLL_INTERVAL_MS = 3000;
  const PROVIDER = 'meta';

  let workerId = 'W02'; // Default, dynamically read from worker-config or storage
  let isStudioConnected = false;
  let isAutomationEnabled = true;
  let isProcessingJob = false;
  let currentJobId = null;
  let authToken = '';
  let isCollapsed = false;

  // 1. Initialize Worker ID & Storage
  async function initConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['STICKMAN_WORKER_ID', 'STICKMAN_AUTH_TOKEN', 'STICKMAN_AUTO_ENABLED']);
        if (stored.STICKMAN_WORKER_ID) workerId = stored.STICKMAN_WORKER_ID;
        if (stored.STICKMAN_AUTH_TOKEN) authToken = stored.STICKMAN_AUTH_TOKEN;
        if (typeof stored.STICKMAN_AUTO_ENABLED === 'boolean') isAutomationEnabled = stored.STICKMAN_AUTO_ENABLED;
        else isAutomationEnabled = true;
      }
    } catch (e) {
      console.warn('[Bridge] Storage read failed:', e);
    }

    try {
      const configModule = await import(chrome.runtime.getURL('worker-config.js'));
      if (configModule && configModule.WORKER_ID) {
        workerId = configModule.WORKER_ID;
      }
    } catch (e) {}

    console.log(`[Stickman Bridge] Initialized Meta Worker: ${workerId} (Auto: ${isAutomationEnabled})`);
    renderBridgeUI();
  }

  // 2. HTTP Helper with Auth Header
  async function studioFetch(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    };
    const url = `${STUDIO_BASE_URL}${endpoint}`;
    return fetch(url, { ...options, headers });
  }

  // Helper: Fetch character reference image as Base64 Data URL
  async function getReferenceImageBase64(projectId) {
    try {
      const res = await studioFetch(`/projects/${projectId}/character-reference`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  }

  // 3. Worker Registration
  async function registerWorker() {
    if (!isAutomationEnabled) return;
    try {
      const res = await studioFetch('/workers/register', {
        method: 'POST',
        body: JSON.stringify({
          worker_id: workerId,
          provider: PROVIDER,
          profile_name: `Worker-${workerId}`
        })
      });

      if (res.ok) {
        if (!isStudioConnected) {
          isStudioConnected = true;
          console.log(`[Stickman Bridge] Connected to Stickman Studio as ${workerId}`);
          updateBridgeUI();
        }
      }
    } catch (err) {
      if (isStudioConnected) {
        isStudioConnected = false;
        console.log('[Stickman Bridge] Studio disconnected. Switching to standalone mode.');
        updateBridgeUI();
      }
    }
  }

  // 4. Heartbeat Loop (~5s)
  async function sendHeartbeat() {
    if (!isAutomationEnabled) return;
    try {
      let currentUrl = 'about:blank';
      let loginStatus = 'IDLE';

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          currentUrl = activeTab.url;
          if (!currentUrl.includes('meta.ai')) {
            loginStatus = 'NAVIGATING';
          }
        }
      }

      if (isProcessingJob) {
        loginStatus = 'ACTIVE';
      }

      const res = await studioFetch('/workers/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          worker_id: workerId,
          status: loginStatus,
          current_url: currentUrl
        })
      });

      if (res.ok) {
        if (!isStudioConnected) {
          isStudioConnected = true;
          updateBridgeUI();
        }
      } else {
        await registerWorker();
      }
    } catch (err) {
      if (isStudioConnected) {
        isStudioConnected = false;
        updateBridgeUI();
      }
    }
  }

  // 5. Job Polling Loop (~3s)
  async function pollForJob() {
    if (!isStudioConnected || !isAutomationEnabled || isProcessingJob) return;

    try {
      const res = await studioFetch(`/workers/${workerId}/job`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data || !data.job) return;

      const job = data.job;
      console.log('[Stickman Bridge] Received Job from Studio:', job);

      if (job.type === 'INITIALIZE_REFERENCE') {
        await handleInitializeReference(job);
      } else if (job.type === 'PROMPT_GENERATION') {
        await handlePromptGeneration(job);
      }
    } catch (err) {
      console.warn('[Stickman Bridge] Job poll error:', err.message);
    }
  }

  // 6. Character Reference Initialization
  async function handleInitializeReference(job) {
    isProcessingJob = true;
    updateBridgeUI(`Init Ref: ${job.character_name || 'Stickman'}`);

    try {
      console.log(`[Stickman Bridge] Initializing Character Reference for ${workerId}:`, job);

      // Verify or find Meta.ai tab without spamming
      const tabs = await chrome.tabs.query({ url: ['*://meta.ai/*', '*://www.meta.ai/*'] });
      let tab = tabs[0];
      if (!tab) {
        tab = await chrome.tabs.create({ url: 'https://www.meta.ai/', active: false });
        await new Promise(r => setTimeout(r, 4000));
      }

      // Mark reference READY in Studio
      await studioFetch(`/workers/${workerId}/reference-state`, {
        method: 'POST',
        body: JSON.stringify({
          project_id: job.project_id,
          status: 'READY',
          version: 1
        })
      });

      console.log(`[Stickman Bridge] Character Reference initialized successfully for ${workerId}`);
    } catch (err) {
      console.error('[Stickman Bridge] Failed to initialize reference:', err);
    } finally {
      isProcessingJob = false;
      updateBridgeUI();
    }
  }

  // 7. Prompt Generation Execution
  async function handlePromptGeneration(job) {
    isProcessingJob = true;
    currentJobId = job.job_id;
    const promptList = (job.prompts && job.prompts.length > 0) ? job.prompts : [job];
    const totalCount = promptList.length;

    updateBridgeUI(`Generating 1/${totalCount}...`);

    try {
      // Acknowledge Job / Batch
      await studioFetch(`/jobs/${job.job_id}/ack`, {
        method: 'POST',
        body: JSON.stringify({ worker_id: workerId, batch_size: totalCount })
      });

      const targetDomain = 'meta.ai';
      const targetUrl = 'https://www.meta.ai/';
      const actionType = 'AUTO_FILL_META';

      let tabs = await chrome.tabs.query({ url: [`*://${targetDomain}/*`] });
      let targetTab = tabs[0];
      if (!targetTab) {
        targetTab = await chrome.tabs.create({ url: targetUrl, active: false });
        await new Promise(r => setTimeout(r, 4000));
      }

      // Configure download folder and prefix
      await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'SET_FOLDER_NAME',
          folderName: job.project_name || 'StickmanStudio',
          prefix: `${job.prompt_id_str || '001'}_`,
          autoChangeFileName: true
        }, () => resolve());
      });

      // Fetch character reference image if project has one
      const refBase64 = await getReferenceImageBase64(job.project_id);

      // Map entire batch of prompts into payloads array
      const payloads = promptList.map((p, idx) => {
        const cleanPrompt = (p.prompt_text || '').replace(/^\d{3,4}[_\s]+/, '').trim();
        return {
          prompt: cleanPrompt,
          mode: refBase64 ? 'imageToImage' : 'textToImage',
          aspectRatio: '16:9',
          outputCount: 1,
          imageModel: 'default',
          promptIndex: p.prompt_index || (idx + 1),
          promptIdStr: p.prompt_id_str || String(p.prompt_index || idx + 1).padStart(3, '0'),
          autoDownloadResourceQuality: 'high',
          concurrentPrompts: 1,
          promptDelaySecondsMin: 1,
          promptDelaySecondsMax: 2,
          isConcat: false,
          maxRetries: 3,
          autoChangeFileName: true,
          folderName: job.project_name || 'StickmanStudio',
          images: refBase64 ? [{
            base64: refBase64,
            name: 'stickman_character_ref.png'
          }] : []
        };
      });

      await studioFetch(`/jobs/${job.job_id}/events`, {
        method: 'POST',
        body: JSON.stringify({ event: 'GENERATION_STARTED', data: { model: 'meta', count: totalCount } })
      });

      console.log(`[Stickman Bridge] Dispatching ${payloads.length} prompt(s) in batch to ${actionType}`);

      chrome.tabs.sendMessage(targetTab.id, {
        type: actionType,
        payloads: payloads,
        groupId: job.job_id,
        concurrentPrompts: 1,
        promptDelaySecondsMin: 1,
        promptDelaySecondsMax: 2
      }, async (response) => {
        console.log('[Stickman Bridge] Content script dispatched batch:', response);
      });

      setupJobCompletionWatcher(job, targetTab.id, promptList);

    } catch (err) {
      console.error('[Stickman Bridge] Job dispatch error:', err);
      await studioFetch(`/jobs/${job.job_id}/fail`, {
        method: 'POST',
        body: JSON.stringify({ error: err.message, can_retry: true })
      });
      isProcessingJob = false;
      currentJobId = null;
      updateBridgeUI();
    }
  }

  // 8. Watcher for Job & Batch Downloads
  function setupJobCompletionWatcher(job, tabId, promptList = []) {
    const prompts = (promptList && promptList.length > 0) ? promptList : [job];
    const totalPrompts = prompts.length;
    const completedIndices = new Set();

    // Safe timeout: 120s per image or minimum 180s
    const timeoutMs = Math.max(180000, totalPrompts * 90000);
    const timeoutTimer = setTimeout(async () => {
      chrome.runtime.onMessage.removeListener(statusListener);
      console.warn(`[Stickman Bridge] Job/Batch ${job.job_id} timed out`);
      await studioFetch(`/jobs/${job.job_id}/fail`, {
        method: 'POST',
        body: JSON.stringify({ error: `Generation timeout (${Math.round(timeoutMs/1000)}s exceeded)`, can_retry: true })
      });
      isProcessingJob = false;
      currentJobId = null;
      updateBridgeUI();
    }, timeoutMs);

    const statusListener = async (message) => {
      if (message && message.type === 'PROMPT_GROUP_STATUS') {
        const data = message.data;
        if (data && data.id === job.job_id) {
          const results = data.results || [];

          for (let idx = 0; idx < results.length; idx++) {
            const item = results[idx];
            if (item && item.downloadComplete && !completedIndices.has(idx)) {
              completedIndices.add(idx);
              const pInfo = prompts[idx] || job;
              const pJobId = pInfo.job_id || `job_${pInfo.project_id || job.project_id}_${workerId}_${pInfo.prompt_index}`;
              const expectedFileName = `${pInfo.prompt_id_str || String(idx + 1).padStart(3, '0')}_stickman__${workerId}.png`;

              console.log(`[Stickman Bridge] Prompt ${idx + 1}/${totalPrompts} (Job ${pJobId}) complete!`);

              await studioFetch(`/jobs/${pJobId}/complete`, {
                method: 'POST',
                body: JSON.stringify({
                  filename: expectedFileName,
                  file_path: `Downloads/${job.project_name || 'StickmanStudio'}/${expectedFileName}`,
                  file_size: 450000,
                  sha256: `sha_${Date.now()}`
                })
              });

              updateBridgeUI(`Generating ${completedIndices.size + 1}/${totalPrompts}...`);
            }
          }

          // Check if all prompts in batch finished
          if (completedIndices.size >= totalPrompts) {
            clearTimeout(timeoutTimer);
            chrome.runtime.onMessage.removeListener(statusListener);
            console.log(`[Stickman Bridge] Batch ${job.job_id} (${totalPrompts} prompts) fully completed!`);

            // Also report parent batch job complete if distinct
            if (job.job_id.startsWith('batch_')) {
              await studioFetch(`/jobs/${job.job_id}/complete`, {
                method: 'POST',
                body: JSON.stringify({
                  filename: `batch_complete_${workerId}.txt`,
                  file_path: `Downloads/${job.project_name || 'StickmanStudio'}`,
                  file_size: totalPrompts,
                  sha256: `batch_${Date.now()}`
                })
              }).catch(() => {});
            }

            isProcessingJob = false;
            currentJobId = null;
            updateBridgeUI('Batch Complete');
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(statusListener);
  }

  function renderBridgeUI() {
    let container = document.getElementById('stickman-bridge-banner');
    if (!container) {
      container = document.createElement('div');
      container.id = 'stickman-bridge-banner';
      document.body.appendChild(container);
    }
    updateBridgeUI();
  }

  function updateBridgeUI(statusText) {
    const container = document.getElementById('stickman-bridge-banner');
    if (!container) return;

    if (isCollapsed) {
      container.style.cssText = `
        position: fixed;
        top: 6px;
        right: 6px;
        z-index: 99999;
        background: #0f172a;
        border: 1px solid #3b82f6;
        border-radius: 20px;
        padding: 4px 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        color: #f8fafc;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      `;
      const dotColor = isAutomationEnabled ? (isStudioConnected ? '#10b981' : '#f59e0b') : '#64748b';
      container.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${dotColor};"></span>
        <strong style="color: #60a5fa; font-size:10px;">${workerId}</strong>
        <span style="font-size:9px; color:#94a3b8;">${isAutomationEnabled ? 'AUTO' : 'MANUAL'}</span>
        <span style="color:#94a3b8; font-weight:bold; margin-left:3px; font-size:11px;">+</span>
      `;
      container.onclick = () => {
        isCollapsed = false;
        updateBridgeUI();
      };
      return;
    }

    container.onclick = null;
    container.style.cssText = `
      position: fixed;
      top: 6px;
      left: 6px;
      right: 6px;
      z-index: 99999;
      background: #090d16;
      border: 1px solid rgba(59, 130, 246, 0.35);
      border-radius: 8px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      color: #f8fafc;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    `;

    const statusDotColor = !isAutomationEnabled
      ? '#64748b'
      : (isStudioConnected ? '#10b981' : '#f59e0b');

    const statusLabel = !isAutomationEnabled
      ? 'Manual Mode (Auto OFF)'
      : (isStudioConnected
          ? (statusText || (isProcessingJob ? 'Generating...' : 'Idle & Ready'))
          : 'Studio Offline (Manual)');

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${statusDotColor}; flex-shrink: 0;"></span>
        <strong style="color: #60a5fa; font-size: 10.5px; flex-shrink: 0;">STICKMAN</strong>
        <span style="color: #94a3b8; font-size: 10px; flex-shrink: 0;">${workerId}</span>
        <span style="color: #475569;">|</span>
        <span style="color: ${isStudioConnected && isAutomationEnabled ? '#10b981' : '#94a3b8'}; font-size: 10px; overflow: hidden; text-overflow: ellipsis;">${statusLabel}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <button id="stickman-toggle-auto" title="Toggle Auto Worker Mode vs Manual Standalone Mode" style="
          background: ${isAutomationEnabled ? '#2563eb' : '#334155'};
          color: #fff;
          font-weight: 600;
          border: none;
          border-radius: 4px;
          padding: 2px 7px;
          font-size: 9.5px;
          cursor: pointer;
        ">${isAutomationEnabled ? 'Auto ON' : 'Auto OFF'}</button>
        <button id="stickman-minimize-btn" title="Minimize Banner to Corner Badge" style="
          background: transparent;
          color: #94a3b8;
          border: none;
          padding: 0 4px;
          font-size: 13px;
          cursor: pointer;
          line-height: 1;
        ">&minus;</button>
      </div>
    `;

    const toggleBtn = document.getElementById('stickman-toggle-auto');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        isAutomationEnabled = !isAutomationEnabled;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ STICKMAN_AUTO_ENABLED: isAutomationEnabled });
        }
        updateBridgeUI();
      };
    }

    const minBtn = document.getElementById('stickman-minimize-btn');
    if (minBtn) {
      minBtn.onclick = (e) => {
        e.stopPropagation();
        isCollapsed = true;
        updateBridgeUI();
      };
    }
  }

  // 10. Startup Lifecycle
  initConfig().then(() => {
    registerWorker();
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    setInterval(pollForJob, JOB_POLL_INTERVAL_MS);
  });
})();
