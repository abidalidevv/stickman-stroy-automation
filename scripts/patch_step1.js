const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/index.html';
let html = fs.readFileSync(p, 'utf8');

const s1Start = html.lastIndexOf('<!-- SUB VIEW A: MODE 1', html.indexOf('id="subViewMode1"'));
const s1End = html.indexOf('<!-- SUB VIEW C: PROJECT PROMPTS QUEUE', s1Start);

if (s1Start === -1 || s1End === -1) {
  console.error('s1Start or s1End not found!');
  process.exit(1);
}

const replacementStep1 = `<!-- SUB VIEW A: MODE 1 GROQ AI STORY ENGINE -->
        <div id="subViewMode1" class="sub-view-content">
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon">✨</div>
                <div>
                  <div class="card-title">Mode 1: Groq AI Story Engine</div>
                  <div class="card-subtitle">Generate complete sequential stickman prompts from story script with character consistency</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span id="m1PromptEstimateBadge" class="brand-badge">~54 prompts</span>
                <button class="btn btn-secondary" onclick="loadDefaultMasterPrompt()" style="font-size: 11.5px; padding: 6px 12px;">Reset Master Prompt V7</button>
              </div>
            </div>

            <!-- Video Title & Model -->
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Video Title</label>
                <input type="text" id="m1VideoTitle" class="form-input" placeholder="e.g. The Untold Story of the Stickman Kingdom" />
              </div>

              <div class="form-group">
                <label class="form-label">Groq AI Model</label>
                <div style="display: flex; gap: 8px;">
                  <select id="m1ModelSelect" class="form-select" style="flex: 1;"></select>
                  <button class="btn btn-secondary" onclick="saveModelConfig()" style="font-size: 12px; padding: 6px 12px;">Save Model</button>
                </div>
              </div>
            </div>

            <!-- Audio Director: Voiceover & Background Music (7%) -->
            <div style="background: rgba(10, 14, 24, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 800; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px;">
                  🎙️ Voiceover Audio & Background Music Director
                </div>
                <span id="m1AudioStatusBadge" class="brand-badge" style="background: rgba(0, 240, 255, 0.1); color: var(--cyan);">Duration Synced</span>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Voiceover Audio File / Path</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="file" id="m1VoiceoverFile" accept="audio/*" class="form-input" style="flex: 1;" onchange="handleM1VoiceoverFile(this)" />
                    <input type="text" id="m1VoiceoverPath" class="form-input" placeholder="or path: Demo/voiceover.wav" style="flex: 1;" oninput="onM1VoiceoverPathChange()" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Duration (Seconds) & Auto-Detection</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" class="btn btn-secondary" onclick="autoDetectM1Voiceover()" style="white-space: nowrap; font-size: 12px; padding: 8px 12px;">
                      ⚡ Auto-Detect
                    </button>
                    <input type="number" id="m1Duration" class="form-input" value="72" step="0.5" oninput="updateM1PromptEstimate()" style="width: 110px;" />
                    <span id="m1DurationBadge" class="brand-badge" style="white-space: nowrap;">72.0s</span>
                  </div>
                </div>
              </div>

              <div class="grid-3" style="margin-top: 10px;">
                <div class="form-group">
                  <label class="form-label">Pacing Preset (3/4s Recommended)</label>
                  <select id="m1Pacing" class="form-select" onchange="updateM1PromptEstimate()">
                    <option value="3/4s" selected>3 images / 4 sec (0.75x - Dynamic Story)</option>
                    <option value="2/4s">2 images / 4 sec (0.50x - YouTube Standard)</option>
                    <option value="1/4s">1 image / 4 sec (0.25x - Relaxed / Cinematic)</option>
                    <option value="4/4s">4 images / 4 sec (1.00x - Fast-Paced Action)</option>
                    <option value="5/4s">5 images / 4 sec (1.25x - Hyper Energetic)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Background Music (Optional)</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="file" id="m1MusicFile" accept="audio/*" class="form-input" style="flex: 1;" onchange="handleM1MusicFile(this)" />
                    <input type="text" id="m1MusicPath" class="form-input" placeholder="path: Demo/bgm.mp3" style="flex: 1;" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    BGM Volume: <span id="m1MusicVolLabel" style="color: var(--cyan); font-weight: 700;">7% (Default ducking)</span>
                  </label>
                  <input type="range" id="m1MusicVol" min="0" max="100" value="7" class="form-input" style="padding: 4px 0;" oninput="updateM1MusicVolume(this.value)" />
                </div>
              </div>
            </div>

            <!-- Character Reference Consistency Box -->
            <div style="background: rgba(10, 14, 24, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
              <div style="font-size: 12px; font-weight: 800; color: var(--violet); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                👤 Character Reference & Visual Consistency
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Character Name & Avatar</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" id="m1CharacterName" class="form-input" value="Main Stickman" style="flex: 1;" />
                    <input type="file" id="m1CharFile" accept="image/*" style="display: none;" onchange="handleM1CharFile(this)" />
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('m1CharFile').click()" style="font-size: 11.5px; padding: 7px 12px; white-space: nowrap;">
                      📷 Upload Avatar
                    </button>
                    <img id="m1CharThumb" src="" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; display: none; border: 1px solid var(--cyan);" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Character Consistency Reference</label>
                  <input type="text" id="m1CharacterRef" class="form-input" placeholder="e.g. Minimalist stickman hero wearing a red headband and blue sneakers, black ink outlines..." />
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Recurring Visual Elements & Atmosphere</label>
                <input type="text" id="m1VisualElements" class="form-input" placeholder="e.g. Neon glowing sword, floating dark cyberpunk city, minimalist blackboard aesthetic..." />
              </div>
            </div>

            <!-- Voiceover Script Input -->
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between;">
                <span>Story / Voiceover Script</span>
                <span id="m1WordCountLabel" style="color: var(--cyan); font-weight: 700;">0 words</span>
              </label>
              <textarea id="m1ScriptInput" class="form-textarea" placeholder="Paste your story or voiceover script here..." oninput="updateM1ScriptWordCount()" style="min-height: 160px;"></textarea>
            </div>

            <details style="margin-bottom: 20px; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); padding: 12px 16px;">
              <summary style="font-size: 12px; font-weight: 700; color: var(--cyan); cursor: pointer;">Show Master Prompt V7 Prompt Directive</summary>
              <div style="margin-top: 10px;">
                <textarea id="m1MasterPrompt" class="form-textarea" style="font-family: var(--font-mono); font-size: 12px; min-height: 120px;"></textarea>
              </div>
            </details>

            <button id="btnM1Generate" class="btn btn-primary" onclick="triggerMode1Generate()" style="width: 100%; justify-content: center; padding: 14px; font-size: 15px; font-weight: 800;">
              <span>✨</span> Generate Sequential Story Prompts
            </button>

            <!-- Animated Progress Indicator -->
            <div id="m1ProgressBox" style="display: none; margin-top: 18px;">
              <div style="height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                <div id="m1ProgressBar" style="width: 0%; height: 100%; background: var(--grad-brand); transition: width 0.4s ease;"></div>
              </div>
              <div id="m1ProgressStatus" style="font-size: 12px; color: var(--cyan); margin-top: 8px; font-family: var(--font-mono);">Generating...</div>
            </div>

            <!-- Story Bible Card (Shown after generation) -->
            <div id="m1BibleBox" style="display: none; margin-top: 20px; background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: var(--radius-sm); padding: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 800; color: #c4b5fd; font-size: 14px;">📖 Story Bible Generated:</div>
                <button class="btn btn-emerald" onclick="approveAndStartWorkers()" style="font-size: 11.5px; padding: 5px 12px;">🚀 Approve & Start Worker Farm</button>
              </div>
              <div style="font-size: 13px; color: var(--text-muted);"><strong style="color: #fff;">Protagonist:</strong> <span id="m1BibleProtagonist"></span></div>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;"><strong style="color: #fff;">Setting:</strong> <span id="m1BibleSetting"></span></div>
            </div>
          </div>
        </div>

        <!-- SUB VIEW B: MODE 2 CLEAN PROMPT LIST IMPORTER -->
        <div id="subViewMode2" class="sub-view-content" style="display: none;">
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon">📥</div>
                <div>
                  <div class="card-title">Mode 2: Clean Prompt List Importer</div>
                  <div class="card-subtitle">Import sequential 001_... formatted prompt lists directly into the production database</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <input type="file" id="m2FileInput" accept=".txt,.md,.json" style="display: none;" onchange="handleM2FileUpload(this)" />
                <button class="btn btn-secondary" onclick="document.getElementById('m2FileInput').click()" style="font-size: 12px; padding: 6px 12px;">
                  📁 Upload .txt / .md File
                </button>
              </div>
            </div>

            <!-- Mode 2 Audio & Matching Voiceover Sync -->
            <div style="background: rgba(10, 14, 24, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 18px;">
              <div style="font-size: 12px; font-weight: 800; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                🎙️ Matching Voiceover Audio & BGM
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Voiceover Audio File / Path</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="file" id="m2VoiceoverFile" accept="audio/*" class="form-input" style="flex: 1;" onchange="handleM2VoiceoverFile(this)" />
                    <input type="text" id="m2VoiceoverPath" class="form-input" placeholder="path: Demo/voiceover.wav" style="flex: 1;" oninput="onM2VoiceoverPathChange()" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Duration & Auto-Detection</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" class="btn btn-secondary" onclick="autoDetectM2Voiceover()" style="white-space: nowrap; font-size: 12px; padding: 8px 12px;">
                      ⚡ Auto-Detect
                    </button>
                    <input type="number" id="m2Duration" class="form-input" value="72" step="0.5" style="width: 100px;" />
                    <span id="m2DurationBadge" class="brand-badge" style="white-space: nowrap;">72.0s</span>
                  </div>
                </div>
              </div>

              <div class="grid-2" style="margin-top: 10px;">
                <div class="form-group">
                  <label class="form-label">Pacing Preset</label>
                  <select id="m2Pacing" class="form-select">
                    <option value="3/4s" selected>3 images / 4 sec (0.75x - Dynamic Story Recommended)</option>
                    <option value="2/4s">2 images / 4 sec (0.50x - YouTube Standard)</option>
                    <option value="1/4s">1 image / 4 sec (0.25x - Cinematic)</option>
                    <option value="4/4s">4 images / 4 sec (1.00x - Fast-Paced)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    BGM Volume: <span id="m2MusicVolLabel" style="color: var(--cyan); font-weight: 700;">7%</span>
                  </label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" id="m2MusicPath" class="form-input" placeholder="path: Demo/bgm.mp3" style="flex: 1;" />
                    <input type="range" id="m2MusicVol" min="0" max="100" value="7" style="width: 90px;" oninput="document.getElementById('m2MusicVolLabel').textContent = this.value + '%'" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Prompts Input Textarea -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" style="margin-bottom: 0;">Paste Raw Prompts (1 per line with 001_ prefix)</label>
                <span id="m2PromptCountBadge" class="brand-badge">0 prompts</span>
              </div>
              <textarea id="rawPromptsInput" class="form-textarea" placeholder="001_A simple stickman standing in a dark room&#10;002_The stickman looks up at a glowing neon star&#10;003_The stickman begins to run towards the light..." style="min-height: 220px;" oninput="updateM2PromptCount()"></textarea>
            </div>

            <div style="display: flex; gap: 12px;">
              <button class="btn btn-primary" onclick="importRawPrompts()" style="padding: 12px 24px; font-size: 14px; font-weight: 800;">
                📥 Validate & Import Prompts
              </button>
            </div>
          </div>
        </div>\n\n        `;

html = html.substring(0, s1Start) + replacementStep1 + html.substring(s1End);
fs.writeFileSync(p, html, 'utf8');
console.log('Successfully patched Step 1 subviews');
