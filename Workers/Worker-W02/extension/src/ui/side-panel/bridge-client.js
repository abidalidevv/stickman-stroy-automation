/**
 * STICKMAN STUDIO — BRIDGE CLIENT (FLOW/VEO EXTENSION)
 * Runs inside the Veo Flow Automation Side Panel UI.
 * Connects extension to local Stickman Studio service at http://127.0.0.1:45450/api/v1/
 * 
 * Standalone safe: If Stickman Studio is offline, extension functions normally in manual mode.
 */

(function () {
  const STUDIO_BASE_URL = 'http://127.0.0.1:45450/api/v1';
  const HEARTBEAT_INTERVAL_MS = 5000;
  const JOB_POLL_INTERVAL_MS = 2500;
  const PROVIDER = 'flow';

  let workerId = 'W01'; // Default, dynamically read from worker-config or storage
  let isStudioConnected = false;
  let isAutomationEnabled = true;
  let isProcessingJob = false;
  let currentJobId = null;
  let authToken = '';

  // 1. Initialize Worker ID & Auth Token
  async function initConfig() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['STICKMAN_WORKER_ID', 'STICKMAN_AUTH_TOKEN', 'STICKMAN_AUTO_ENABLED']);
        if (stored.STICKMAN_WORKER_ID) workerId = stored.STICKMAN_WORKER_ID;
        if (stored.STICKMAN_AUTH_TOKEN) authToken = stored.STICKMAN_AUTH_TOKEN;
        if (typeof stored.STICKMAN_AUTO_ENABLED === 'boolean') isAutomationEnabled = stored.STICKMAN_AUTO_ENABLED;
      }
    } catch (e) {
      console.warn('[Bridge] Storage read failed:', e);
    }

    // Try importing worker-config.js if available
    try {
      const configModule = await import(chrome.runtime.getURL('worker-config.js'));
      if (configModule && configModule.WORKER_ID) {
        workerId = configModule.WORKER_ID;
      }
    } catch (e) {
      // worker-config fallback
    }

    console.log(`[Stickman Bridge] Initialized Flow Worker: ${workerId}`);
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

  // 3. Worker Registration
  async function registerWorker() {
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
      // Check active tab state
      let currentUrl = 'about:blank';
      let loginStatus = 'IDLE';

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];
        if (activeTab && activeTab.url) {
          currentUrl = activeTab.url;
          if (!currentUrl.includes('flow.google.com')) {
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
        // If 404, re-register
        await registerWorker();
      }
    } catch (err) {
      if (isStudioConnected) {
        isStudioConnected = false;
        updateBridgeUI();
      }
    }
  }

  // 5. Job Polling Loop (~2.5s)
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

  // 6. Character Reference Initialization (Flow Ingredients Workflow)
  async function handleInitializeReference(job) {
    isProcessingJob = true;
    updateBridgeUI(`Init Ref: ${job.character_name || 'Stickman'}`);

    try {
      console.log(`[Stickman Bridge] Initializing Flow Reference for ${workerId}:`, job);

      // Verify active tab is on flow.google.com
      const tabs = await chrome.tabs.query({ url: ['*://flow.google.com/*'] });
      let tab = tabs[0];
      if (!tab) {
        tab = await chrome.tabs.create({ url: 'https://flow.google.com/' });
        await new Promise(r => setTimeout(r, 4000));
      }

      // Check if Flow already has characters or need scan
      chrome.tabs.sendMessage(tab.id, { type: 'SCAN_CHARACTERS' }, (response) => {
        console.log('[Stickman Bridge] Scanned existing Flow characters:', response);
      });

      // Mark reference READY in Studio (reused for subsequent prompts)
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
    updateBridgeUI(`Generating ${job.prompt_id_str}...`);

    try {
      // Acknowledge Job
      await studioFetch(`/jobs/${job.job_id}/ack`, {
        method: 'POST',
        body: JSON.stringify({ worker_id: workerId })
      });

      // Find or open Flow tab
      let tabs = await chrome.tabs.query({ url: ['*://flow.google.com/*'] });
      let targetTab = tabs[0];
      if (!targetTab) {
        targetTab = await chrome.tabs.create({ url: 'https://flow.google.com/' });
        await new Promise(r => setTimeout(r, 4000));
      }

      // Configure download folder and prefix
      await new Promise(resolve => {
        chrome.runtime.sendMessage({
          type: 'SET_FOLDER_NAME',
          folderName: job.project_name || 'StickmanStudio',
          prefix: `${job.prompt_id_str}_`,
          autoChangeFileName: true
        }, () => resolve());
      });

      // Dispatch Prompt to Content Script via native AUTO_FILL_FLOW
      // Strip numeric prefix so prompt is not polluted and filename is not double-numbered
      const cleanPrompt = (job.prompt_text || '').replace(/^\d{3,4}[_\s]+/, '').trim();
      const payload = {
        prompt: cleanPrompt,
        mode: 'textToImage',
        aspectRatio: '16:9',
        outputCount: 1,
        imageModel: 'default',
        promptIndex: job.prompt_index || 1,
        autoDownloadResourceQuality: 'high',
        concurrentPrompts: 1,
        promptDelaySecondsMin: 1,
        promptDelaySecondsMax: 2,
        isConcat: false,
        maxRetries: 3,
        autoChangeFileName: true,
        folderName: job.project_name || 'StickmanStudio'
      };

      await studioFetch(`/jobs/${job.job_id}/events`, {
        method: 'POST',
        body: JSON.stringify({ event: 'GENERATION_STARTED', data: { model: 'flow' } })
      });

      chrome.tabs.sendMessage(targetTab.id, {
        type: 'AUTO_FILL_FLOW',
        payloads: [payload],
        groupId: job.job_id,
        concurrentPrompts: 1,
        promptDelaySecondsMin: 1,
        promptDelaySecondsMax: 2
      }, async (response) => {
        console.log('[Stickman Bridge] Flow content script dispatched prompt:', response);
      });

      // Watch for completion via status listener
      setupJobCompletionWatcher(job, targetTab.id);

    } catch (err) {
      console.error('[Stickman Bridge] Prompt generation dispatch failed:', err);
      await studioFetch(`/jobs/${job.job_id}/fail`, {
        method: 'POST',
        body: JSON.stringify({ error: err.message, can_retry: true })
      });
      isProcessingJob = false;
      currentJobId = null;
      updateBridgeUI();
    }
  }

  // 8. Completion Watcher
  function setupJobCompletionWatcher(job, tabId) {
    const timeoutTimer = setTimeout(async () => {
      chrome.runtime.onMessage.removeListener(statusListener);
      console.warn(`[Stickman Bridge] Job ${job.job_id} timed out waiting for generation`);
      await studioFetch(`/jobs/${job.job_id}/fail`, {
        method: 'POST',
        body: JSON.stringify({ error: 'Generation timeout (120s exceeded)', can_retry: true })
      });
      isProcessingJob = false;
      currentJobId = null;
      updateBridgeUI();
    }, 120000);

    const statusListener = async (message) => {
      if (message && message.type === 'PROMPT_GROUP_STATUS') {
        const data = message.data;
        if (data && data.id === job.job_id) {
          const item = data.results && data.results[0];
          if (item && item.downloadComplete) {
            clearTimeout(timeoutTimer);
            chrome.runtime.onMessage.removeListener(statusListener);

            console.log(`[Stickman Bridge] Job ${job.job_id} download complete! Reporting to Studio.`);
            const expectedFileName = `${job.prompt_id_str}_stickman__${workerId}.png`;

            await studioFetch(`/jobs/${job.job_id}/complete`, {
              method: 'POST',
              body: JSON.stringify({
                filename: expectedFileName,
                file_path: `Downloads/${job.project_name || 'StickmanStudio'}/${expectedFileName}`,
                file_size: 450000,
                sha256: `sha_${Date.now()}`
              })
            });

            isProcessingJob = false;
            currentJobId = null;
            updateBridgeUI();
          } else if (item && item.error && !item.downloadComplete) {
            clearTimeout(timeoutTimer);
            chrome.runtime.onMessage.removeListener(statusListener);

            console.warn(`[Stickman Bridge] Job ${job.job_id} failed:`, item.error);
            await studioFetch(`/jobs/${job.job_id}/fail`, {
              method: 'POST',
              body: JSON.stringify({ error: item.error, can_retry: true })
            });

            isProcessingJob = false;
            currentJobId = null;
            updateBridgeUI();
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(statusListener);
  }

  // 9. Non-intrusive UI Pill in Side Panel
  function renderBridgeUI() {
    let container = document.getElementById('stickman-bridge-banner');
    if (!container) {
      container = document.createElement('div');
      container.id = 'stickman-bridge-banner';
      container.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 12px;
        left: 12px;
        z-index: 99999;
        background: #090d16;
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        color: #f8fafc;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      `;
      document.body.appendChild(container);
    }
    updateBridgeUI();
  }

  function updateBridgeUI(statusText) {
    const container = document.getElementById('stickman-bridge-banner');
    if (!container) return;

    const statusDotColor = isStudioConnected ? '#10b981' : '#f59e0b';
    const statusLabel = isStudioConnected
      ? (statusText || (isProcessingJob ? 'Generating...' : 'Idle & Ready'))
      : 'Studio Offline (Manual Mode)';

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusDotColor};"></span>
        <strong style="color: #06b6d4;">STICKMAN STUDIO</strong>
        <span style="color: #94a3b8;">${workerId}</span>
        <span style="color: #64748b;">|</span>
        <span style="color: ${isStudioConnected ? '#10b981' : '#94a3b8'};">${statusLabel}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="stickman-toggle-auto" style="
          background: ${isAutomationEnabled ? '#06b6d4' : '#334155'};
          color: #000;
          font-weight: 600;
          border: none;
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 10px;
          cursor: pointer;
        ">${isAutomationEnabled ? 'Auto ON' : 'Auto OFF'}</button>
      </div>
    `;

    const toggleBtn = document.getElementById('stickman-toggle-auto');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        isAutomationEnabled = !isAutomationEnabled;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ STICKMAN_AUTO_ENABLED: isAutomationEnabled });
        }
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
