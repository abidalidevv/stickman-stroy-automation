const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/index.html';
let html = fs.readFileSync(p, 'utf8');

const comment1 = '<!-- New Project Modal -->';
const comment2 = '<!-- Assign Ranges Modal -->';

const startIndex = html.indexOf(comment1);
const endIndex = html.indexOf(comment2);

if (startIndex === -1 || endIndex === -1) {
  console.error('Modal comments not found!');
  process.exit(1);
}

const replacementModal = `<!-- ==================== CANONICAL MULTI-MODE NEW PROJECT MODAL ==================== -->
  <div id="newProjectModal" class="modal-overlay">
    <div class="modal-content" style="max-width: 720px; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="font-family: var(--font-display); font-size: 20px; font-weight: 800; color: #fff;">
          + Create New Production Project
        </div>
        <button onclick="closeNewProjectModal()" style="background: none; border: none; color: var(--text-dim); font-size: 26px; cursor: pointer;">&times;</button>
      </div>

      <!-- Mode Selector Tabs -->
      <div class="modal-tabs">
        <button type="button" id="tabNewProjMode1" class="modal-tab-btn active" onclick="switchNewProjectModalTab('MODE_1')">
          MODE 1 — Generate Everything
        </button>
        <button type="button" id="tabNewProjMode2" class="modal-tab-btn" onclick="switchNewProjectModalTab('MODE_2')">
          MODE 2 — Existing Prompt List
        </button>
      </div>

      <input type="hidden" id="newProjActiveMode" value="MODE_1" />

      <!-- ==================== MODE 1 FIELDS ==================== -->
      <div id="modalMode1Container">
        <div style="background: rgba(0, 240, 255, 0.04); border: 1px solid rgba(0, 240, 255, 0.18); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; font-size: 12px; color: var(--text-muted);">
          <strong style="color: var(--cyan);">Mode 1 Workflow:</strong> Provide Title, Voiceover, Script, Master Prompt & Character Reference. The Groq AI Story Engine will auto-generate sequential prompt scenes matching your audio duration.
        </div>

        <div class="form-group">
          <label class="form-label">Video Title / Project Name</label>
          <input type="text" id="newProjName" class="form-input" placeholder="e.g. The Untold Story of the Shadow Stickman Episode 1" />
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Voiceover Audio File / Path</label>
            <div style="display: flex; gap: 8px;">
              <input type="file" id="newProjVoiceoverFile" accept="audio/*" class="form-input" style="flex: 1;" onchange="handleModalVoiceoverFile(this, 'm1')" />
              <input type="text" id="newProjVoiceoverPath" class="form-input" placeholder="or path: Demo/voiceover.wav" style="flex: 1;" oninput="onVoiceoverPathChange('m1')" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Duration & Auto-Detection</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-secondary" onclick="autoDetectModalDuration('m1')" style="white-space: nowrap; font-size: 12px; padding: 8px 12px;">
                ⚡ Auto-Detect
              </button>
              <input type="number" id="newProjDuration" class="form-input" value="72" step="0.5" oninput="updateModalPromptCalculation('m1')" style="width: 100px;" />
              <span id="newProjDurationBadge" class="brand-badge" style="white-space: nowrap;">72.0s</span>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Pacing Preset</label>
            <select id="newProjPacing" class="form-select" onchange="updateModalPromptCalculation('m1')">
              <option value="3/4s" selected>3 images / 4 sec (0.75x - Dynamic Story Recommended)</option>
              <option value="2/4s">2 images / 4 sec (0.50x - YouTube Standard)</option>
              <option value="1/4s">1 image / 4 sec (0.25x - Relaxed / Cinematic)</option>
              <option value="4/4s">4 images / 4 sec (1.00x - Fast-Paced Action)</option>
              <option value="5/4s">5 images / 4 sec (1.25x - Hyper Energetic)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Required Prompt Calculation</label>
            <div style="background: rgba(10, 14, 24, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; height: 38px;">
              <span style="color: var(--text-muted);">Needed Prompts:</span>
              <strong id="modalTargetPromptsM1" style="color: var(--cyan); font-size: 14px;">54 Prompts</strong>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Background Music (Optional)</label>
            <div style="display: flex; gap: 8px;">
              <input type="file" id="newProjMusicFile" accept="audio/*" class="form-input" style="flex: 1;" onchange="handleModalMusicFile(this, 'm1')" />
              <input type="text" id="newProjMusicPath" class="form-input" placeholder="or path: Demo/bgm.mp3" style="flex: 1;" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              BGM Volume: <span id="newProjMusicVolLabel" style="color: var(--cyan); font-weight: 700;">7% (Default ducking)</span>
            </label>
            <input type="range" id="newProjMusicVol" min="0" max="100" value="7" class="form-input" style="padding: 4px 0;" oninput="document.getElementById('newProjMusicVolLabel').textContent = this.value + '% (Ducking)'" />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Character Name & Reference Avatar</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="text" id="newProjCharName" class="form-input" value="Main Stickman" style="flex: 1;" />
              <input type="file" id="newProjCharFile" accept="image/*" style="display: none;" onchange="handleModalCharImage(this, 'm1')" />
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('newProjCharFile').click()" style="font-size: 11.5px; padding: 7px 10px; white-space: nowrap;">
                📷 Avatar
              </button>
              <img id="newProjCharThumb" src="" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; display: none; border: 1px solid var(--cyan);" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Character Consistency Prompt Tags</label>
            <input type="text" id="newProjCharDesc" class="form-input" placeholder="e.g. Minimalist stickman hero wearing red headband and blue sneakers, black ink outlines" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="display: flex; justify-content: space-between;">
            <span>Voiceover / Story Script</span>
            <span id="newProjScriptWordCount" style="color: var(--cyan); font-weight: 700;">0 words</span>
          </label>
          <textarea id="newProjScript" class="form-textarea" placeholder="Paste your story or voiceover script here..." style="min-height: 120px;" oninput="updateModalScriptWordCount('m1')"></textarea>
        </div>

        <details style="margin-bottom: 16px; background: rgba(0, 0, 0, 0.3); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); padding: 10px 14px;">
          <summary style="font-size: 12px; font-weight: 700; color: var(--cyan); cursor: pointer;">
            Customize Master Prompt V7 Directive
          </summary>
          <textarea id="newProjMasterPrompt" class="form-textarea" style="font-family: var(--font-mono); font-size: 11.5px; min-height: 100px; margin-top: 8px;"></textarea>
        </details>
      </div>

      <!-- ==================== MODE 2 FIELDS ==================== -->
      <div id="modalMode2Container" style="display: none;">
        <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.22); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; font-size: 12px; color: var(--text-muted);">
          <strong style="color: var(--violet);">Mode 2 Workflow:</strong> You already have a formatted prompt list (.md / .txt). Upload or paste it directly. Also provide voiceover audio, matching script, and character reference.
        </div>

        <div class="form-group">
          <label class="form-label">Video Title / Project Name</label>
          <input type="text" id="newProjNameM2" class="form-input" placeholder="e.g. Stickman Epic Quest Episode 1" />
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">Existing Prompt List (001_..., 002_...)</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="file" id="newProjPromptFile" accept=".txt,.md,.json" style="display: none;" onchange="handleModalPromptFile(this)" />
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('newProjPromptFile').click()" style="font-size: 11.5px; padding: 4px 10px;">
                📁 Upload .txt / .md
              </button>
              <span id="newProjPromptCountBadge" class="brand-badge">0 prompts</span>
            </div>
          </div>
          <textarea id="newProjPromptList" class="form-textarea" placeholder="001_A simple stickman standing in the neon rain&#10;002_The stickman turns to face the glowing portal&#10;003_He leaps forward into the light..." style="min-height: 140px;" oninput="updateModalPromptListCount()"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Accompanying Story Script / Transcript</label>
          <textarea id="newProjScriptM2" class="form-textarea" placeholder="Paste the matching voiceover script for captions & timeline alignment..." style="min-height: 80px;"></textarea>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Voiceover Audio File / Path</label>
            <div style="display: flex; gap: 8px;">
              <input type="file" id="newProjVoiceoverFileM2" accept="audio/*" class="form-input" style="flex: 1;" onchange="handleModalVoiceoverFile(this, 'm2')" />
              <input type="text" id="newProjVoiceoverPathM2" class="form-input" placeholder="or path: Demo/voiceover.wav" style="flex: 1;" oninput="onVoiceoverPathChange('m2')" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Duration & Auto-Detection</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-secondary" onclick="autoDetectModalDuration('m2')" style="white-space: nowrap; font-size: 12px; padding: 8px 12px;">
                ⚡ Auto-Detect
              </button>
              <input type="number" id="newProjDurationM2" class="form-input" value="72" step="0.5" style="width: 100px;" />
              <span id="newProjDurationBadgeM2" class="brand-badge" style="white-space: nowrap;">72.0s</span>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Pacing Ratio Verification</label>
            <select id="newProjPacingM2" class="form-select">
              <option value="3/4s" selected>3 images / 4 sec (0.75x - Dynamic Story Recommended)</option>
              <option value="2/4s">2 images / 4 sec (0.50x - YouTube Standard)</option>
              <option value="1/4s">1 image / 4 sec (0.25x - Cinematic)</option>
              <option value="4/4s">4 images / 4 sec (1.00x - Fast-Paced)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">
              BGM (Optional) & 7% Volume: <span id="newProjMusicVolLabelM2" style="color: var(--cyan); font-weight: 700;">7%</span>
            </label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="text" id="newProjMusicPathM2" class="form-input" placeholder="path: Demo/bgm.mp3" style="flex: 1;" />
              <input type="range" id="newProjMusicVolM2" min="0" max="100" value="7" style="width: 90px;" oninput="document.getElementById('newProjMusicVolLabelM2').textContent = this.value + '%'" />
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Character Reference Name</label>
            <input type="text" id="newProjCharNameM2" class="form-input" value="Main Stickman" />
          </div>

          <div class="form-group">
            <label class="form-label">Character Visual Consistency Description</label>
            <input type="text" id="newProjCharDescM2" class="form-input" placeholder="e.g. Minimalist stickman hero, red headband, sneakers" />
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
        <button type="button" class="btn btn-secondary" onclick="closeNewProjectModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="submitNewProject()" style="padding: 10px 22px; font-size: 14px; font-weight: 800;">
          🚀 Create Production Project
        </button>
      </div>
    </div>
  </div>\n\n  `;

html = html.substring(0, startIndex) + replacementModal + html.substring(endIndex);
fs.writeFileSync(p, html, 'utf8');
console.log('Successfully replaced newProjectModal in index.html');
