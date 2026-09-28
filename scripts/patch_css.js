const fs = require('fs');
const cssPath = 'E:/stickman-video-automation/studio/public/styles_v2.css';
let css = fs.readFileSync(cssPath, 'utf8');

const newStyles = `
/* ==================== STEP 4 SPLIT PLAYER & CAPTION INSPECTOR ==================== */
.player-layout-split {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.95fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 1100px) {
  .player-layout-split {
    grid-template-columns: 1fr;
  }
}

.caption-inspector {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}

.caption-inspector::-webkit-scrollbar {
  width: 5px;
}
.caption-inspector::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.inspector-header {
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 12px;
}

.inspector-header h3 {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.inspector-header p {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.inspector-section {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--cyan);
  margin-bottom: 10px;
}

/* Preset Buttons Grid (CapCut Presets) */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 8px 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s ease;
  text-align: center;
}

.preset-btn:hover {
  border-color: var(--cyan);
  background: rgba(0, 240, 255, 0.08);
  transform: translateY(-1px);
}

.preset-btn.active {
  border-color: var(--cyan);
  background: rgba(0, 240, 255, 0.15);
  box-shadow: 0 0 12px var(--cyan-glow);
}

.preset-preview-sample {
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.5px;
}

.preset-title {
  font-size: 10.5px;
  color: var(--text-muted);
  font-weight: 600;
}

/* ==================== CAPTIONS TOGGLE SWITCH ==================== */
.switch-toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #1e293b;
  transition: 0.3s;
  border-radius: 24px;
  border: 1px solid var(--border-subtle);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: #ffffff;
  transition: 0.3s;
  border-radius: 50%;
}

.switch-toggle input:checked + .toggle-slider {
  background-color: var(--cyan);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
}

.switch-toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
  background-color: #05070e;
}

#caption-customizer-controls.disabled {
  opacity: 0.35;
  pointer-events: none;
  filter: grayscale(0.5);
  transition: opacity 0.25s ease;
}

/* Modal Tabs */
.modal-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 8px;
}

.modal-tab-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-tab-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.modal-tab-btn.active {
  color: var(--cyan);
  border-color: var(--cyan);
  background: rgba(0, 240, 255, 0.1);
  box-shadow: 0 0 10px var(--cyan-glow);
}
`;

if (!css.includes('.player-layout-split')) {
  css += '\n' + newStyles;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Appended caption inspector styles to styles_v2.css');
} else {
  console.log('Styles already present');
}
