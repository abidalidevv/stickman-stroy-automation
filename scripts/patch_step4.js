const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/index.html';
let html = fs.readFileSync(p, 'utf8');

const s4 = html.lastIndexOf('<section id="step-4-panel"', html.indexOf('id="step-4-panel"') + 30);
const s5 = html.indexOf('<!-- ==================== STEP 5', s4);

if (s4 === -1 || s5 === -1) {
  console.error('step-4 boundaries not found!');
  process.exit(1);
}

const replacementStep4 = `<section id="step-4-panel" class="view-panel">
        <div class="player-layout-split">
          
          <!-- LEFT COLUMN: VIDEO PLAYER CANVAS, SCRUBBER, CONTROLS & TIMELINE SCENE STRIP -->
          <div class="player-column-left">
            <div class="preview-player-wrapper">
              <div class="player-canvas-viewport" id="playerCanvasViewport">
                <!-- Active Image Layer with Ken Burns Motion -->
                <img id="playerCanvasImage" class="canvas-image-stage motion-zoom-in" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><rect width='100' height='60' fill='%230a0d16'/><text y='32' x='50' text-anchor='middle' fill='%2300f0ff' font-size='6'>Stickman Studio Player Ready</text></svg>" alt="Stickman Scene Preview" />
                
                <!-- Scene Badge -->
                <div id="playerSceneBadge" class="canvas-scene-badge">SCENE 001</div>

                <!-- Kinetic Draggable Subtitle / Caption Overlay -->
                <div id="captionOverlay" class="caption-overlay draggable">
                  <div id="captionText" class="caption-text">Stickman scene preview ready. Hit Play below to watch.</div>
                </div>
              </div>

              <!-- Playback Controls Bar -->
              <div class="player-control-bar">
                <!-- Interactive Scrubber -->
                <div class="timeline-scrubber-track" id="timelineScrubberTrack" onclick="onScrubTimeline(event)">
                  <div id="timelineScrubberFill" class="timeline-scrubber-fill"></div>
                </div>

                <div class="player-buttons-row">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btnPlayPause" class="btn btn-primary" onclick="togglePlayback()">
                      <span>▶</span> Play Preview
                    </button>
                    <button class="btn btn-secondary" onclick="seekToStart()" title="Rewind to 0:00">
                      <span>⏮</span> 0:00
                    </button>
                    <button class="btn btn-secondary" onclick="toggleAspect()" id="btnToggleAspect" title="Toggle 16:9 Landscape / 9:16 Shorts">
                      16:9
                    </button>
                  </div>

                  <div class="playback-time-badge">
                    <strong id="playbackCurrentTime">00:00.0</strong> / <span id="playbackTotalTime">00:00.0</span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn btn-secondary" onclick="buildTimeline()">
                      ⚡ Auto-Sync Audio
                    </button>
                    <button class="btn btn-emerald" onclick="goToStep(5)">
                      🚀 Export 1080p MP4 &rarr;
                    </button>
                  </div>
                </div>
              </div>

              <!-- Hidden Audio Element for Timeline Sync -->
              <audio id="timelineAudioElement" style="display: none;"></audio>
            </div>

            <!-- Timeline Scenes Horizontal Carousel Strip -->
            <div class="card" style="margin-top: 16px;">
              <div class="card-header" style="padding-bottom: 8px;">
                <div class="card-title-group">
                  <div class="card-icon">🎬</div>
                  <div>
                    <div class="card-title">Scene Director & Narrative Sequence</div>
                    <div class="card-subtitle">Click any scene card to preview frame & cue audio position</div>
                  </div>
                </div>
                <button class="btn btn-secondary" onclick="buildTimeline()" style="font-size: 11.5px; padding: 5px 12px;">Re-Sync Scenes</button>
              </div>
              <div id="sceneDirectorCardsContainer" class="scene-cards-strip">
                <!-- Dynamic scene thumbnails injected by JS -->
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: CAPCUT CAPTION CUSTOMIZER & PRESETS (FROM E:\twitchyt\vg) -->
          <div class="caption-inspector">
            <div class="inspector-header">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>🎨 CapCut Caption Customizer</h3>
                <span class="brand-badge" style="background: rgba(0, 240, 255, 0.15); color: var(--cyan);">Live Preview</span>
              </div>
              <p>Kinetic animated subtitles with downloaded fonts, shadow depth & bounce effects.</p>
            </div>

            <!-- Master Caption Toggle -->
            <div class="inspector-section" style="background: rgba(30, 41, 59, 0.5); border: 1px solid var(--border-subtle); padding: 12px; margin-bottom: 2px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <label style="font-weight: 700; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 8px; cursor: pointer;" for="captionsMasterToggle">
                    ⚡ Animated Captions / Subtitles
                  </label>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Toggle on/off captions over video</div>
                </div>
                <label class="switch-toggle">
                  <input type="checkbox" id="captionsMasterToggle" checked onchange="toggleCaptionsMaster(this.checked)">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div id="caption-customizer-controls">
              <!-- 1. Quick Master Presets (6 Templates) -->
              <div class="inspector-section">
                <label class="section-title">
                  <span>✨ Master Caption Templates</span>
                  <span style="font-size: 10px; font-weight: 600; text-transform: none; color: #94a3b8;">1-Click Style</span>
                </label>
                <div class="preset-grid">
                  <button type="button" class="preset-btn active" onclick="applyCaptionPreset('capcut_yellow', this)" title="CapCut Yellow - Shorts & TikTok">
                    <span class="preset-preview-sample" style="color: #ffe010; -webkit-text-stroke: 1.5px #000; font-family: 'Montserrat', sans-serif;">YELLOW</span>
                    <span class="preset-title">CapCut Yellow</span>
                  </button>
                  <button type="button" class="preset-btn" onclick="applyCaptionPreset('cyber_cyan', this)" title="Cyber Cyan - Tech & AI">
                    <span class="preset-preview-sample" style="color: #00f0ff; -webkit-text-stroke: 1.5px #05070e; font-family: 'Montserrat', sans-serif;">CYAN</span>
                    <span class="preset-title">Cyber Cyan</span>
                  </button>
                  <button type="button" class="preset-btn" onclick="applyCaptionPreset('viral_box', this)" title="Viral Box - High Contrast">
                    <span class="preset-preview-sample" style="background: #ffe010; color: #000; padding: 1px 4px; border-radius: 3px; font-size: 10px; font-family: 'Montserrat', sans-serif;">BOX</span>
                    <span class="preset-title">Viral Box</span>
                  </button>
                  <button type="button" class="preset-btn" onclick="applyCaptionPreset('neon_purple', this)" title="Neon Purple - Epic Story">
                    <span class="preset-preview-sample" style="color: #c084fc; -webkit-text-stroke: 1.5px #000; font-family: 'Bebas Neue', sans-serif;">PURPLE</span>
                    <span class="preset-title">Neon Purple</span>
                  </button>
                  <button type="button" class="preset-btn" onclick="applyCaptionPreset('clean_cinema', this)" title="Clean Cinema - Documentary">
                    <span class="preset-preview-sample" style="color: #ffffff; font-family: 'Montserrat', sans-serif;">CINEMA</span>
                    <span class="preset-title">Clean Cinema</span>
                  </button>
                  <button type="button" class="preset-btn" onclick="applyCaptionPreset('red_impact', this)" title="Red Impact - High Action">
                    <span class="preset-preview-sample" style="color: #ef4444; -webkit-text-stroke: 1.5px #000; font-family: 'Anton', sans-serif;">IMPACT</span>
                    <span class="preset-title">Red Impact</span>
                  </button>
                </div>
              </div>

              <!-- 2. Typography & Font Family -->
              <div class="inspector-section" style="margin-top: 10px;">
                <label class="section-title">
                  <span>🔤 Font Family & Size</span>
                </label>
                <div class="form-group" style="margin-bottom: 10px;">
                  <select id="captionFontSelect" class="form-select" onchange="updateCaptionStyle({ fontFamily: this.value })">
                    <option value="Montserrat" selected>Montserrat (CapCut Bold Standard)</option>
                    <option value="Bebas Neue">Bebas Neue (Viral Tall Impact)</option>
                    <option value="Anton">Anton (Bold Heavy Headline)</option>
                    <option value="Outfit">Outfit (Clean Cyber Modern)</option>
                    <option value="Poppins">Poppins (Geometric Sans)</option>
                    <option value="Inter">Inter (Minimalist Clean)</option>
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                    <span style="color: var(--text-muted);">Font Size:</span>
                    <strong id="captionFontSizeLabel" style="color: var(--cyan);">26px</strong>
                  </div>
                  <input type="range" id="captionFontSizeSlider" min="16" max="48" value="26" class="form-input" style="padding: 4px 0;" oninput="document.getElementById('captionFontSizeLabel').textContent = this.value + 'px'; updateCaptionStyle({ fontSize: parseInt(this.value, 10) })" />
                </div>
              </div>

              <!-- 3. Colors & Highlight -->
              <div class="inspector-section" style="margin-top: 10px;">
                <label class="section-title">
                  <span>🎨 Text & Active Word Colors</span>
                </label>
                <div class="grid-2" style="gap: 10px;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px;">Spoken Word Highlight</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <input type="color" id="captionHighlightColor" value="#ffe010" style="border: none; width: 36px; height: 32px; border-radius: 4px; cursor: pointer; background: none;" onchange="updateCaptionStyle({ highlightColor: this.value })" />
                      <span id="captionHighlightHex" style="font-family: var(--font-mono); font-size: 11px; color: var(--cyan);">#FFE010</span>
                    </div>
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" style="font-size: 11px;">Primary Base Color</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <input type="color" id="captionPrimaryColor" value="#ffffff" style="border: none; width: 36px; height: 32px; border-radius: 4px; cursor: pointer; background: none;" onchange="updateCaptionStyle({ primaryColor: this.value })" />
                      <span style="font-family: var(--font-mono); font-size: 11px; color: #ffffff;">#FFFFFF</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 4. Text Stroke / Outline -->
              <div class="inspector-section" style="margin-top: 10px;">
                <label class="section-title">
                  <span>🖋 Text Stroke / Outline</span>
                </label>
                <div class="grid-2" style="gap: 10px; align-items: center;">
                  <div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                      <span style="color: var(--text-muted);">Stroke Width:</span>
                      <strong id="captionStrokeLabel" style="color: var(--cyan);">4px</strong>
                    </div>
                    <input type="range" id="captionStrokeSlider" min="0" max="8" value="4" class="form-input" style="padding: 4px 0;" oninput="document.getElementById('captionStrokeLabel').textContent = this.value + 'px'; updateCaptionStyle({ strokeWidth: parseInt(this.value, 10) })" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 11px; margin-bottom: 2px;">Stroke Color</label>
                    <input type="color" id="captionStrokeColor" value="#000000" style="border: none; width: 36px; height: 28px; border-radius: 4px; cursor: pointer; background: none;" onchange="updateCaptionStyle({ strokeColor: this.value })" />
                  </div>
                </div>
              </div>

              <!-- 5. Kinetic Animation & Position -->
              <div class="inspector-section" style="margin-top: 10px;">
                <label class="section-title">
                  <span>✨ Kinetic Animation & Placement</span>
                </label>
                <div class="form-group" style="margin-bottom: 10px;">
                  <label class="form-label" style="font-size: 11px;">Word Animation FX</label>
                  <select id="captionAnimSelect" class="form-select" onchange="updateCaptionStyle({ animation: this.value })">
                    <option value="word_bounce" selected>CapCut Pop & Bounce (Dynamic)</option>
                    <option value="word_glow">Neon Glowing Pulse</option>
                    <option value="word_box">Highlight Pill Box</option>
                    <option value="fade_in">Smooth Fade Up</option>
                    <option value="none">Static Highlight</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom: 6px;">
                  <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                    <span style="color: var(--text-muted);">Vertical Bottom Offset:</span>
                    <strong id="captionMarginLabel" style="color: var(--cyan);">32px</strong>
                  </div>
                  <input type="range" id="captionMarginSlider" min="10" max="120" value="32" class="form-input" style="padding: 4px 0;" oninput="document.getElementById('captionMarginLabel').textContent = this.value + 'px'; updateCaptionStyle({ marginV: parseInt(this.value, 10) })" />
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                  <button type="button" class="btn btn-secondary" onclick="recenterCaptions()" style="font-size: 11px; padding: 4px 10px;">
                    ↺ Re-center Position
                  </button>
                  <span style="font-size: 11px; color: var(--text-muted);">💡 Drag subtitle on player to move</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>\n\n      `;

html = html.substring(0, s4) + replacementStep4 + html.substring(s5);
fs.writeFileSync(p, html, 'utf8');
console.log('Successfully patched Step 4 with CapCut Caption Inspector');
