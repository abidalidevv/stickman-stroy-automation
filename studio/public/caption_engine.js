/**
 * STICKMAN STUDIO — MASTER CAPTION & KINETIC SUBTITLE ENGINE
 * Adapted from VideoGenStudio / CapCut Kinetic Architecture.
 * Synchronizes and renders animated kinetic subtitles in real-time
 * over the interactive video player canvas.
 */

class StudioCaptionEngine {
  constructor(overlayContainerId, textElementId) {
    this.overlay = document.getElementById(overlayContainerId);
    this.captionEl = document.getElementById(textElementId);
    
    this.currentScenes = [];
    this.wordChunks = [];
    this.enabled = true; // Master toggle

    // Default style (CapCut Yellow kinetic)
    this.style = {
      preset: 'capcut_yellow',
      fontFamily: 'Montserrat',
      fontSize: 26,
      primaryColor: '#ffffff',
      highlightColor: '#ffe010',
      strokeColor: '#000000',
      strokeWidth: 4,
      marginV: 32,
      offsetX: 0,
      letterSpacing: 1,
      wordSpacing: 6,
      uppercase: true,
      animation: 'word_bounce'
    };

    this.lastRenderedChunkIdx = -1;
    this.lastRenderedWordIdx = -1;
  }

  loadScenes(scenes) {
    this.currentScenes = scenes || [];
    this.wordChunks = [];

    // Pre-calculate chunks across scenes
    for (const sc of this.currentScenes) {
      const words = sc.words || [];
      if (words.length === 0) {
        // Fallback: Scene prompt text as single chunk
        const text = sc.prompt_text || sc.text || '';
        if (text) {
          // Break longer scene text into 4-6 word readable chunks
          const tokens = text.split(/\s+/).filter(Boolean);
          const dur = (sc.end_time || sc.end || 3.0) - (sc.start_time || sc.start || 0.0);
          const startBase = sc.start_time || sc.start || 0.0;
          const chunkSize = 5;
          const numChunks = Math.ceil(tokens.length / chunkSize);
          const chunkDur = dur / Math.max(1, numChunks);

          for (let i = 0; i < tokens.length; i += chunkSize) {
            const chunkTokens = tokens.slice(i, i + chunkSize);
            const cStart = startBase + (i / chunkSize) * chunkDur;
            const cEnd = cStart + chunkDur;
            const subWords = chunkTokens.map((t, idx) => ({
              word: t,
              start: cStart + (idx / chunkTokens.length) * chunkDur,
              end: cStart + ((idx + 1) / chunkTokens.length) * chunkDur
            }));

            this.wordChunks.push({
              start: cStart,
              end: cEnd,
              words: subWords,
              text: chunkTokens.join(' ')
            });
          }
        }
        continue;
      }

      let currentChunk = [];
      for (const w of words) {
        currentChunk.push(w);
        const txt = w.word || '';
        if (currentChunk.length >= 4 || /[.!?,;]/.test(txt)) {
          this.wordChunks.push({
            start: currentChunk[0].start,
            end: currentChunk[currentChunk.length - 1].end,
            words: [...currentChunk]
          });
          currentChunk = [];
        }
      }
      if (currentChunk.length > 0) {
        this.wordChunks.push({
          start: currentChunk[0].start,
          end: currentChunk[currentChunk.length - 1].end,
          words: [...currentChunk]
        });
      }
    }

    this.lastRenderedChunkIdx = -1;
    this.lastRenderedWordIdx = -1;
    this.applyContainerStyles();
  }

  updateStyle(newStyle) {
    this.style = { ...this.style, ...newStyle };
    this.applyContainerStyles();
    this.lastRenderedWordIdx = -1;
    this.lastRenderedChunkIdx = -1;
  }

  applyPreset(presetName) {
    const PRESETS = {
      'capcut_yellow': {
        preset: 'capcut_yellow',
        fontFamily: 'Montserrat',
        fontSize: 26,
        primaryColor: '#ffffff',
        highlightColor: '#ffe010',
        strokeColor: '#000000',
        strokeWidth: 4,
        uppercase: true,
        animation: 'word_bounce'
      },
      'cyber_cyan': {
        preset: 'cyber_cyan',
        fontFamily: 'Outfit',
        fontSize: 26,
        primaryColor: '#ffffff',
        highlightColor: '#00f0ff',
        strokeColor: '#05070e',
        strokeWidth: 3,
        uppercase: true,
        animation: 'word_glow'
      },
      'viral_box': {
        preset: 'viral_box',
        fontFamily: 'Montserrat',
        fontSize: 24,
        primaryColor: '#ffffff',
        highlightColor: '#ffb703',
        strokeColor: '#000000',
        strokeWidth: 0,
        uppercase: true,
        animation: 'word_box'
      },
      'neon_purple': {
        preset: 'neon_purple',
        fontFamily: 'Bebas Neue',
        fontSize: 30,
        primaryColor: '#ffffff',
        highlightColor: '#b388ff',
        strokeColor: '#1a0033',
        strokeWidth: 4,
        uppercase: true,
        animation: 'word_glow'
      },
      'clean_white': {
        preset: 'clean_white',
        fontFamily: 'Inter',
        fontSize: 24,
        primaryColor: '#ffffff',
        highlightColor: '#e2e8f0',
        strokeColor: '#000000',
        strokeWidth: 2,
        uppercase: false,
        animation: 'fade_in'
      },
      'red_impact': {
        preset: 'red_impact',
        fontFamily: 'Anton',
        fontSize: 28,
        primaryColor: '#ffffff',
        highlightColor: '#ff1744',
        strokeColor: '#000000',
        strokeWidth: 5,
        uppercase: true,
        animation: 'word_bounce'
      }
    };

    if (PRESETS[presetName]) {
      this.updateStyle(PRESETS[presetName]);
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.overlay) return;
    if (!this.enabled) {
      this.overlay.style.display = 'none';
    } else {
      this.overlay.style.display = 'flex';
      this.applyContainerStyles();
    }
  }

  applyContainerStyles() {
    if (!this.overlay || !this.captionEl) return;

    if (!this.enabled) {
      this.overlay.style.display = 'none';
      return;
    } else {
      this.overlay.style.display = 'flex';
      this.overlay.style.justifyContent = 'center';
      this.overlay.style.alignItems = 'center';
      this.overlay.style.left = '0';
      this.overlay.style.right = '0';
      this.overlay.style.width = '100%';
      this.overlay.style.textAlign = 'center';
    }

    const marginV = this.style.marginV !== undefined ? this.style.marginV : 32;
    this.overlay.style.bottom = `${marginV}px`;

    const offX = this.style.offsetX || 0;
    this.captionEl.style.transform = offX ? `translateX(${offX}px)` : 'none';

    this.captionEl.style.fontFamily = `'${this.style.fontFamily}', sans-serif`;
    const baseFontSize = this.style.fontSize || 26;
    this.captionEl.style.fontSize = `${baseFontSize}px`;
    this.captionEl.style.color = this.style.primaryColor;

    const lSpacing = this.style.letterSpacing !== undefined ? this.style.letterSpacing : 1;
    const wSpacing = this.style.wordSpacing !== undefined ? this.style.wordSpacing : 6;
    this.captionEl.style.letterSpacing = `${lSpacing}px`;
    this.captionEl.style.wordSpacing = `${wSpacing}px`;

    if (this.style.uppercase) {
      this.captionEl.style.textTransform = 'uppercase';
    } else {
      this.captionEl.style.textTransform = 'none';
    }
  }

  enableDrag(onPositionChange) {
    if (!this.overlay) return;

    let isDragging = false;
    let startY = 0;
    let startBottom = 0;

    const onStart = (e) => {
      isDragging = true;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startY = clientY;
      const parsed = parseInt(this.overlay.style.bottom || '', 10);
      startBottom = Number.isFinite(parsed) ? parsed : (this.style.marginV || 32);
      e.stopPropagation();
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = startY - clientY;
      const newBottom = Math.max(10, Math.min(200, Math.round(startBottom + deltaY)));
      this.overlay.style.bottom = `${newBottom}px`;
      this.style.marginV = newBottom;
      if (onPositionChange) onPositionChange(newBottom);
    };

    const onEnd = () => {
      isDragging = false;
    };

    this.overlay.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  }

  renderAtTime(currentTime) {
    if (!this.enabled || !this.captionEl) return;

    if (this.wordChunks.length === 0) {
      this.captionEl.innerHTML = '';
      return;
    }

    // Find active chunk
    let chunkIdx = this.wordChunks.findIndex(c => currentTime >= c.start && currentTime <= c.end);
    if (chunkIdx === -1) {
      // Small pause lingering (0.3s)
      let lastEnded = -1;
      for (let i = 0; i < this.wordChunks.length; i++) {
        if (this.wordChunks[i].end <= currentTime) lastEnded = i;
      }
      if (lastEnded !== -1 && (currentTime - this.wordChunks[lastEnded].end <= 0.35)) {
        chunkIdx = lastEnded;
      } else {
        this.captionEl.innerHTML = '';
        this.lastRenderedChunkIdx = -1;
        this.lastRenderedWordIdx = -1;
        return;
      }
    }

    const chunk = this.wordChunks[chunkIdx];
    if (!chunk) return;

    // Active word in chunk
    let activeWordIdx = -1;
    if (chunk.words && chunk.words.length > 0) {
      activeWordIdx = chunk.words.findIndex(w => currentTime >= w.start && currentTime <= w.end);
      if (activeWordIdx === -1) {
        activeWordIdx = chunk.words.reduce((closest, w, i) => (w.start <= currentTime ? i : closest), 0);
      }
    }

    if (this.lastRenderedChunkIdx === chunkIdx && this.lastRenderedWordIdx === activeWordIdx) {
      return;
    }

    this.lastRenderedChunkIdx = chunkIdx;
    this.lastRenderedWordIdx = activeWordIdx;

    const strokeStyle = this.style.strokeWidth > 0 
      ? `-webkit-text-stroke: ${this.style.strokeWidth}px ${this.style.strokeColor}; paint-order: stroke fill; text-shadow: 0 4px 12px rgba(0,0,0,0.8);`
      : `text-shadow: 0 4px 12px rgba(0,0,0,0.8);`;

    const htmlParts = (chunk.words || []).map((w, idx) => {
      const isActive = idx === activeWordIdx;
      let text = w.word || '';
      if (this.style.uppercase) text = text.toUpperCase();

      if (isActive) {
        if (this.style.animation === 'word_box') {
          return `<span class="caption-word active box-style" style="background:${this.style.highlightColor}; color:#000000 !important; -webkit-text-fill-color:#000000 !important; -webkit-text-stroke:0px !important;">${text}</span>`;
        } else if (this.style.animation === 'word_glow') {
          return `<span class="caption-word active anim-glow" style="color:${this.style.highlightColor}; -webkit-text-fill-color:${this.style.highlightColor}; ${strokeStyle} text-shadow: 0 0 18px ${this.style.highlightColor};">${text}</span>`;
        } else if (this.style.animation === 'fade_in') {
          return `<span class="caption-word active anim-fade" style="color:${this.style.highlightColor}; -webkit-text-fill-color:${this.style.highlightColor}; ${strokeStyle}">${text}</span>`;
        } else {
          // Default: CapCut kinetic bounce
          return `<span class="caption-word active anim-bounce" style="color:${this.style.highlightColor}; -webkit-text-fill-color:${this.style.highlightColor}; ${strokeStyle}">${text}</span>`;
        }
      } else {
        return `<span class="caption-word" style="color:${this.style.primaryColor}; -webkit-text-fill-color:${this.style.primaryColor}; ${strokeStyle}">${text}</span>`;
      }
    });

    this.captionEl.innerHTML = htmlParts.join(' ');
  }
}

window.StudioCaptionEngine = StudioCaptionEngine;
