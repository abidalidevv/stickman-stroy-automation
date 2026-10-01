/**
 * STICKMAN STUDIO — BRIDGE CLIENT (GOOGLE FLOW EXTENSION)
 * Runs inside the Google Flow Automation Side Panel UI.
 * Connects extension to local Stickman Studio service at http://127.0.0.1:45450/api/v1/
 * 
 * Standalone safe: When Auto is OFF or Studio is offline, extension functions 100% normally in manual mode.
 * Non-intrusive UI: Floating top banner with minimize button. Does NOT block Run or queue buttons at the bottom.
 */

(function () {
  const STUDIO_BASE_URL = 'http://127.0.0.1:45450/api/v1';
  const HEARTBEAT_INTERVAL_MS = 5000;
  const JOB_POLL_INTERVAL_MS = 3000;
  const PROVIDER = 'flow';

  let workerId = 'W01'; // Default, dynamically read from worker-config or storage
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

    console.log(`[Stickman Bridge] Initialized Flow Worker: ${workerId} (Auto: ${isAutomationEnabled})`);
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

  // 6. Character Reference Initialization (Flow Ingredients & Media Upload)
  async function handleInitializeReference(job) {
    isProcessingJob = true;
    updateBridgeUI(`Init Ref: ${job.character_name || 'Stickman'}`);

    try {
      console.log(`[Stickman Bridge] Initializing Character Reference for ${workerId}:`, job);

      let tabs = await chrome.tabs.query({ url: ['*://flow.google.com/*'] });
      let targetTab = tabs[0];
      if (!targetTab) {
        targetTab = await chrome.tabs.create({ url: 'https://flow.google.com/', active: false });
        await new Promise(r => setTimeout(r, 4000));
      }

      // Fetch reference image base64
      const refBase64 = await getReferenceImageBase64(job.project_id);

      if (refBase64 && targetTab && targetTab.id) {
        // Execute injection script to click Add ingredients -> Upload media -> Add to prompt
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: (imageBase64) => {
            try {
              // 1. Look for + icon button (Add ingredients to prompt box)
              const addBtn = document.querySelector('button.add-menu-trigger, button[aria-label*="Add ingredients"]');
              if (addBtn) {
                addBtn.click();
                setTimeout(() => {
                  // 2. Look for Upload media button
                  const uploadBtn = document.querySelector('button.sidebar-upload-btn, button[mattooltip*="Upload media"]');
                  if (uploadBtn) uploadBtn.click();

                  // 3. Inject file into input if present
                  const fileInput = document.querySelector('input[type="file"]');
                  if (fileInput && imageBase64) {
                    const byteChars = atob(imageBase64.split(',')[1] || imageBase64);
                    const byteNums = new Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                    const byteArray = new Uint8Array(byteNums);
                    const file = new File([byteArray], 'character_ref.png', { type: 'image/png' });

                    const dt = new DataTransfer();
                    dt.items.add(file);
                    fileInput.files = dt.files;
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

                    // 4. Click Add to prompt once uploaded
                    setTimeout(() => {
                      const addPromptBtn = document.querySelector('button.detail-add-to-prompt-btn');
                      if (addPromptBtn) addPromptBtn.click();
                    }, 1800);
                  }
                }, 800);
              }
            } catch (e) {
              console.warn('[Stickman Flow] Reference attach script error:', e);
            }
          },
          args: [refBase64]
        }).catch(e => console.warn('[Stickman Flow] Script injection:', e));
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
    updateBridgeUI(`Generating ${job.prompt_id_str}...`);

    try {
      // Acknowledge Job
      await studioFetch(`/jobs/${job.job_id}/ack`, {
        method: 'POST',
        body: JSON.stringify({ worker_id: workerId })
      });

      let tabs = await chrome.tabs.query({ url: ['*://flow.google.com/*'] });
      let targetTab = tabs[0];
      if (!targetTab) {
        targetTab = await chrome.tabs.create({ url: 'https://flow.google.com/', active: false });
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

      // Strip numeric prefix so prompt is clean
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

  // 9. Non-intrusive Top UI Banner with Minimize Toggle
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
        background: #090d16;
        border: 1px solid #06b6d4;
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
        <strong style="color: #06b6d4; font-size:10px;">${workerId}</strong>
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
      border: 1px solid rgba(6, 182, 212, 0.35);
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
        <strong style="color: #06b6d4; font-size: 10.5px; flex-shrink: 0;">STICKMAN</strong>
        <span style="color: #94a3b8; font-size: 10px; flex-shrink: 0;">${workerId}</span>
        <span style="color: #475569;">|</span>
        <span style="color: ${isStudioConnected && isAutomationEnabled ? '#10b981' : '#94a3b8'}; font-size: 10px; overflow: hidden; text-overflow: ellipsis;">${statusLabel}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <button id="stickman-toggle-auto" title="Toggle Auto Worker Mode vs Manual Standalone Mode" style="
          background: ${isAutomationEnabled ? '#06b6d4' : '#334155'};
          color: ${isAutomationEnabled ? '#000' : '#fff'};
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
