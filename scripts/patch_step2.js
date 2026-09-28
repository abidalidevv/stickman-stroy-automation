const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/index.html';
let html = fs.readFileSync(p, 'utf8');

const targetGridMarker = '<!-- Worker Cards Grid -->';
if (!html.includes(targetGridMarker)) {
  console.error('Target grid marker not found!');
  process.exit(1);
}

const fleetCard = `<!-- Dynamic Worker Fleet Calculator & Batch Scheduling Card -->
          <div style="background: rgba(10, 14, 24, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 18px 22px; margin-bottom: 22px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="font-family: var(--font-display); font-size: 15px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                  <span>🧮</span> Dynamic Fleet Calculator & 10-Worker Batch Scheduler
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  Automatic 50 images/worker quota calculation, 50/50 Meta/Flow partition, and safe concurrency capping (Max 10 workers).
                </div>
              </div>
              <button class="btn btn-secondary" onclick="loadFleetCalculation()" style="font-size: 12px; padding: 6px 14px;">
                🔄 Recalculate
              </button>
            </div>

            <!-- Stats & Breakdown Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Total Prompts</div>
                <strong id="fleetTotalPrompts" style="font-size: 16px; color: #fff;">--</strong>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Needed Workers</div>
                <strong id="fleetTotalWorkers" style="font-size: 16px; color: var(--cyan);">--</strong>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Meta Workers</div>
                <strong id="fleetMetaWorkers" style="font-size: 16px; color: var(--violet);">--</strong>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Flow Workers</div>
                <strong id="fleetFlowWorkers" style="font-size: 16px; color: var(--emerald);">--</strong>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Active / Queued</div>
                <strong id="fleetActiveQueued" style="font-size: 16px; color: var(--amber);">-- / --</strong>
              </div>
            </div>

            <!-- Formula explanation badge & Dispatch button -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div id="fleetFormulaExplanation" style="font-size: 12px; color: var(--text-dim); font-family: var(--font-mono);">
                Example: 330 prompts &rarr; 7 workers (4 Meta + 3 Flow). Max 10 active at once.
              </div>
              <button class="btn btn-primary" onclick="calculateAndDispatchFleet()" style="padding: 10px 20px; font-size: 13.5px; font-weight: 800;">
                ⚡ Auto-Partition & Dispatch Fleet
              </button>
            </div>
          </div>\n\n          ` + targetGridMarker;

html = html.replace(targetGridMarker, fleetCard);
fs.writeFileSync(p, html, 'utf8');
console.log('Successfully added Fleet Calculator to Step 2');
