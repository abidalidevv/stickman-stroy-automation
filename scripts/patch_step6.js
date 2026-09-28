const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/index.html';
let html = fs.readFileSync(p, 'utf8');

const s6 = html.lastIndexOf('<section id="step-6-panel"', html.indexOf('id="step-6-panel"') + 30);
const s6End = html.indexOf('</section>', s6) + 10;

const replacementStep6 = `<section id="step-6-panel" class="view-panel">
        <div class="grid-2" style="margin-bottom: 20px;">
          
          <!-- System Settings & Groq Multi-Key Pool Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon">⚡</div>
                <div>
                  <div class="card-title">Groq AI Engine & Multi-API Key Pool</div>
                  <div class="card-subtitle">Round-robin load balancing & automatic 429 rate limit failover</div>
                </div>
              </div>
              <span id="activeKeysBadge" class="brand-badge">Pool Active</span>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Primary AI Model</label>
                <input type="text" id="settingsGroqModel" class="form-input" value="openai/gpt-oss-120b" />
              </div>

              <div class="form-group">
                <label class="form-label">Fallback AI Model</label>
                <input type="text" id="settingsGroqFallback" class="form-input" value="llama-3.3-70b-versatile" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                <span>Groq API Keys Pool (3–5 Keys, 1 per line)</span>
                <span id="keyPoolCountLabel" style="color: var(--cyan); font-weight: 700;">1 Key Loaded</span>
              </label>
              <textarea id="settingsGroqKeyPool" class="form-textarea" placeholder="gsk_key1...&#10;gsk_key2...&#10;gsk_key3...&#10;gsk_key4..." style="font-family: var(--font-mono); font-size: 12px; min-height: 100px;"></textarea>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 14px;">
              <button class="btn btn-primary" onclick="saveGroqKeyPool()" style="flex: 1; justify-content: center;">
                💾 Save Groq Key Pool
              </button>
              <button class="btn btn-secondary" onclick="triggerReconciliation()">
                Reconcile Storage
              </button>
            </div>
          </div>

          <!-- 1-Click 10-Worker One-Time Login Assistant Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon">🔑</div>
                <div>
                  <div class="card-title">10-Worker One-Time Login Assistant</div>
                  <div class="card-subtitle">Log in once to Meta.ai & Flow on workers W01–W10 to save permanent sessions</div>
                </div>
              </div>
            </div>

            <div style="background: rgba(0, 240, 255, 0.04); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px; font-size: 12px; color: var(--text-muted); line-height: 1.45;">
              <strong style="color: #fff;">How it works:</strong> Click below to launch browser profiles with 
              <span style="color: var(--cyan); font-weight: 700;">Meta.ai</span> and 
              <span style="color: var(--violet); font-weight: 700;">Flow</span> tabs open. 
              Log in once by hand on each worker. Chrome persists cookies in <code style="color: #fff;">profiles/worker_XX</code>, so the automated farm runs continuously without re-prompting.
            </div>

            <button class="btn btn-primary" onclick="openWorkerLogin('ALL')" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px; font-weight: 800; margin-bottom: 14px;">
              🚀 Launch 10 Worker Profiles for One-Time Login
            </button>

            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
              Or Launch Individual Worker Profile:
            </div>

            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
              <button class="btn btn-secondary" onclick="openWorkerLogin('W01')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W01</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W02')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W02</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W03')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W03</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W04')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W04</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W05')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W05</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W06')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W06</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W07')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W07</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W08')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W08</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W09')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W09</button>
              <button class="btn btn-secondary" onclick="openWorkerLogin('W10')" style="font-size: 11px; padding: 5px 0; justify-content: center;">W10</button>
            </div>
          </div>

        </div>

        <!-- Real-Time Telemetry Logs Card (Full Width) -->
        <div class="card">
          <div class="card-header">
            <div class="card-title-group">
              <div class="card-icon">📡</div>
              <div>
                <div class="card-title">Live Telemetry & System Event Stream</div>
                <div class="card-subtitle">Real-time worker lifecycle events, CAPTCHA alerts & service logs</div>
              </div>
            </div>
            <button class="btn btn-secondary" onclick="fetchLogs()" style="font-size: 12px; padding: 6px 12px;">Refresh</button>
          </div>

          <div id="telemetryLogBox" style="background: rgba(5, 5, 10, 0.85); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px; height: 320px; overflow-y: auto; font-family: var(--font-mono); font-size: 12px;">
            <!-- Dynamic logs -->
          </div>
        </div>
      </section>`;

html = html.substring(0, s6) + replacementStep6 + html.substring(s6End);
fs.writeFileSync(p, html, 'utf8');
console.log('Successfully patched Step 6 in index.html');
