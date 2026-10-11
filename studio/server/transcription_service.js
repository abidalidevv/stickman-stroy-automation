/**
 * STICKMAN STUDIO — TRANSCRIPTION & WORD-LEVEL CAPTION ENGINE
 * Primary: Groq Whisper API (whisper-large-v3) with word-level granularity.
 * Fallback: REAL local STT implementation (faster-whisper) with word-level timestamps.
 * Zero mock heuristics.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Groq } = require('groq-sdk');
const db = require('./db');
const logger = require('./logger');

const STUDIO_DIR = path.resolve(__dirname, '..');
const FFMPEG_PATH = process.env.FFMPEG_PATH || path.join(STUDIO_DIR, 'bin', 'ffmpeg.exe');
const FFPROBE_PATH = process.env.FFPROBE_PATH || path.join(STUDIO_DIR, 'bin', 'ffprobe.exe');

class TranscriptionService {
  constructor() {
    this._probeCache = new Map();
  }

  async getApiKey() {
    if (process.env.GROQ_API_KEY) {
      return process.env.GROQ_API_KEY;
    }
    const row = await db.get("SELECT value FROM settings WHERE key = 'groq_api_key'");
    return row ? row.value : null;
  }

  /**
   * Get all active Groq API keys from pool, single setting, and environment
   */
  async getApiKeyPool() {
    const keys = [];

    // Check pool setting
    const poolRow = await db.get("SELECT value FROM settings WHERE key = 'groq_api_keys_pool'");
    if (poolRow && poolRow.value) {
      try {
        const parsed = JSON.parse(poolRow.value);
        if (Array.isArray(parsed)) {
          parsed.forEach(k => {
            if (k && typeof k === 'string' && k.trim()) keys.push(k.trim());
          });
        }
      } catch (e) {
        poolRow.value.split(/[,\r\n]+/).forEach(k => {
          const clean = k.trim();
          if (clean && clean.startsWith('gsk_')) keys.push(clean);
        });
      }
    }

    // Check single key setting
    const singleRow = await db.get("SELECT value FROM settings WHERE key = 'groq_api_key'");
    if (singleRow && singleRow.value && singleRow.value.trim()) {
      const single = singleRow.value.trim();
      if (!keys.includes(single)) keys.push(single);
    }

    // Check environment
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      const envKey = process.env.GROQ_API_KEY.trim();
      if (!keys.includes(envKey)) keys.push(envKey);
    }

    return keys;
  }

  /**
   * Probe audio duration in seconds via FFprobe
   */
  async getAudioDuration(filePath) {
    if (this._probeCache && this._probeCache.has(filePath)) {
      return this._probeCache.get(filePath);
    }
    return new Promise((resolve) => {
      execFile(FFPROBE_PATH, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ], (err, stdout) => {
        if (err || !stdout) {
          resolve(0);
        } else {
          const dur = parseFloat(stdout.trim());
          const finalDur = isNaN(dur) ? 0 : dur;
          if (this._probeCache) this._probeCache.set(filePath, finalDur);
          resolve(finalDur);
        }
      });
    });
  }

  /**
   * Compact audio to 48kbps 16kHz mono MP3 before Whisper API upload (150MB -> 3.5MB)
   */
  async compressAudioForWhisper(srcPath) {
    const ext = path.extname(srcPath).toLowerCase();
    const stats = fs.statSync(srcPath);
    if (ext === '.mp3' && stats.size < 15 * 1024 * 1024) {
      return { path: srcPath, isTemp: false };
    }
    const tempMp3 = path.join(path.dirname(srcPath), `whisper_compact_${Date.now()}.mp3`);
    return new Promise((resolve) => {
      execFile(FFMPEG_PATH, [
        '-y',
        '-i', srcPath,
        '-ac', '1',
        '-ar', '16000',
        '-c:a', 'libmp3lame',
        '-b:a', '48k',
        tempMp3
      ], (err) => {
        if (err || !fs.existsSync(tempMp3)) {
          logger.warn('TRANSCRIPTION', `Audio compacting skipped, using original: ${err ? err.message : 'Unknown'}`);
          resolve({ path: srcPath, isTemp: false });
        } else {
          const cStats = fs.statSync(tempMp3);
          logger.info('TRANSCRIPTION', `Pre-upload compacted audio: ${(stats.size / (1024*1024)).toFixed(1)}MB -> ${(cStats.size / (1024*1024)).toFixed(1)}MB`);
          resolve({ path: tempMp3, isTemp: true });
        }
      });
    });
  }

  /**
   * Silence-based pause detection for non-destructive chunking
   */
  async detectSilencePoints(audioPath, totalDuration) {
    return new Promise((resolve) => {
      execFile(FFMPEG_PATH, [
        '-i', audioPath,
        '-af', 'silencedetect=noise=-30dB:d=0.3',
        '-f', 'null',
        '-'
      ], (err, stdout, stderr) => {
        const points = [];
        const regex = /silence_end:\s*([\d.]+)/g;
        let m;
        const text = (stderr || '') + (stdout || '');
        while ((m = regex.exec(text)) !== null) {
          const s = parseFloat(m[1]);
          if (!isNaN(s) && s > 0 && s < totalDuration) points.push(s);
        }
        resolve(points);
      });
    });
  }

  computeSmartChunkBoundaries(totalDuration, targetChunkSec = 600, silencePoints = []) {
    if (totalDuration <= targetChunkSec * 1.25) {
      return [{ start: 0, duration: totalDuration }];
    }
    const chunks = [];
    let currentStart = 0;
    while (currentStart < totalDuration) {
      const idealEnd = currentStart + targetChunkSec;
      if (idealEnd >= totalDuration) {
        chunks.push({ start: currentStart, duration: totalDuration - currentStart });
        break;
      }
      const candidates = silencePoints.filter(p => p >= (idealEnd - 45) && p <= (idealEnd + 45));
      let cutPoint = idealEnd;
      if (candidates.length > 0) {
        cutPoint = candidates.reduce((prev, curr) => Math.abs(curr - idealEnd) < Math.abs(prev - idealEnd) ? curr : prev);
      }
      chunks.push({ start: currentStart, duration: cutPoint - currentStart });
      currentStart = cutPoint;
    }
    return chunks;
  }

  /**
   * Chunk transcription with per-chunk retry and exponential backoff on 429
   */
  async transcribeChunkWithBackoff(chunkPath, activeKeys, chunkIndex, totalChunks) {
    let lastErr = null;
    const maxAttempts = Math.max(3, activeKeys.length);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = activeKeys[(chunkIndex + attempt) % activeKeys.length];
      try {
        const client = new Groq({ apiKey: key });
        const stream = fs.createReadStream(chunkPath);
        const res = await client.audio.transcriptions.create({
          file: stream,
          model: 'whisper-large-v3',
          response_format: 'verbose_json',
          timestamp_granularities: ['word', 'segment']
        });
        return res;
      } catch (err) {
        lastErr = err;
        const is429 = err.status === 429 || (err.message && err.message.includes('429'));
        const delayMs = is429 ? Math.min(8000, 1000 * Math.pow(2, attempt)) : 1000;
        logger.warn('TRANSCRIPTION', `Chunk ${chunkIndex + 1}/${totalChunks} attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    throw lastErr;
  }

  /**
   * Slice audio into chunk via FFmpeg
   */
  async sliceAudio(src, dest, startSec, durationSec) {
    return new Promise((resolve, reject) => {
      execFile(FFMPEG_PATH, [
        '-y',
        '-ss', String(startSec),
        '-t', String(durationSec),
        '-i', src,
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        dest
      ], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Transcribe audio file with word-level timestamps
   * Automatically detects files > 20MB, chunks them, and transcribes in parallel across Groq API key pool!
   */
  async transcribeAudio(projectId, audioFilePath) {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const apiKey = await this.getApiKey();
    if (!apiKey) {
      logger.info('TRANSCRIPTION', 'No Groq API key configured. Using genuine local STT fallback (faster-whisper).');
      return this.transcribeLocal(projectId, audioFilePath);
    }

    const keyPool = await this.getApiKeyPool();
    const activeKeys = keyPool.length > 0 ? keyPool : [apiKey];

    // Pre-upload audio compacting (48kbps mono)
    const compactResult = await this.compressAudioForWhisper(audioFilePath);
    const audioToProcess = compactResult.path;
    const stats = fs.statSync(audioToProcess);
    const sizeBytes = stats.size;
    const isLargeAudio = sizeBytes > 20 * 1024 * 1024; // > 20MB Groq limit

    let tempDir = null;
    try {
      let words = [];
      let segments = [];

      if (isLargeAudio) {
        // Smart Silence-based chunking for long audio
        const totalDuration = await this.getAudioDuration(audioToProcess);
        const silencePoints = await this.detectSilencePoints(audioToProcess, totalDuration);
        const boundaries = this.computeSmartChunkBoundaries(totalDuration, 600, silencePoints);

        logger.info('TRANSCRIPTION', `Large audio (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB, ${totalDuration.toFixed(1)}s). Slicing into ${boundaries.length} silence-locked chunks.`);

        tempDir = path.join(path.dirname(audioFilePath), `chunks_${Date.now()}`);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const chunks = [];
        for (let i = 0; i < boundaries.length; i++) {
          const b = boundaries[i];
          const chunkPath = path.join(tempDir, `chunk_${i}.mp3`);
          await this.sliceAudio(audioToProcess, chunkPath, b.start, b.duration);
          chunks.push({ index: i, path: chunkPath, startSec: b.start });
        }

        logger.info('TRANSCRIPTION', `Dispatching ${chunks.length} chunks in parallel across ${activeKeys.length} Groq API key(s) with exponential backoff`);

        const chunkResults = await Promise.all(chunks.map(async (chk, idx) => {
          const res = await this.transcribeChunkWithBackoff(chk.path, activeKeys, idx, chunks.length);
          return {
            index: chk.index,
            offset: chk.startSec,
            words: res.words || [],
            segments: res.segments || []
          };
        }));

        chunkResults.sort((a, b) => a.index - b.index);

        for (const cRes of chunkResults) {
          for (const w of cRes.words) {
            words.push({
              word: w.word,
              start: +(w.start + cRes.offset).toFixed(3),
              end: +(w.end + cRes.offset).toFixed(3)
            });
          }
          for (const s of cRes.segments) {
            segments.push({
              text: s.text,
              start: +(s.start + cRes.offset).toFixed(3),
              end: +(s.end + cRes.offset).toFixed(3)
            });
          }
        }

      } else {
        // Standard compact single audio transcription with backoff
        logger.info('TRANSCRIPTION', `Sending compacted audio to Groq Whisper: ${path.basename(audioToProcess)} (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB)`);
        const transcription = await this.transcribeChunkWithBackoff(audioToProcess, activeKeys, 0, 1);
        words = transcription.words || [];
        segments = transcription.segments || [];
      }

      // Clear old captions for project
      await db.run('DELETE FROM captions WHERE project_id = ?', [projectId]);

      const savedCaptions = [];
      const now = new Date().toISOString();

      for (const seg of segments) {
        const segWords = words.filter(w => w.start >= seg.start && w.end <= seg.end + 0.05);

        await db.run(`
          INSERT INTO captions (project_id, start_time, end_time, text, words_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          projectId,
          seg.start,
          seg.end,
          seg.text.trim(),
          JSON.stringify(segWords),
          now
        ]);

        savedCaptions.push({
          start_time: seg.start,
          end_time: seg.end,
          text: seg.text.trim(),
          words: segWords
        });
      }

      logger.info('TRANSCRIPTION', `Saved ${savedCaptions.length} caption segments with ${words.length} words via Groq Whisper`);
      return {
        success: true,
        engine: 'groq-whisper-large-v3',
        word_count: words.length,
        segment_count: savedCaptions.length,
        captions: savedCaptions
      };

    } catch (err) {
      logger.warn('TRANSCRIPTION', 'Groq Whisper error, falling back to genuine local STT (faster-whisper)', err);
      return this.transcribeLocal(projectId, audioFilePath);
    }
  }

  /**
   * Real local STT fallback using faster-whisper (tiny.en)
   */
  async transcribeLocal(projectId, audioFilePath) {
    const localWhisperScript = path.resolve('E:/stickman-video-automation/studio/server/local_whisper.py');

    logger.info('TRANSCRIPTION', `Running genuine local STT (faster-whisper) on ${path.basename(audioFilePath)}`);

    return new Promise((resolve, reject) => {
      execFile('uv', ['run', '--with', 'faster-whisper', 'python', localWhisperScript, audioFilePath], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 180000
      }, async (error, stdout, stderr) => {
        if (error) {
          logger.error('TRANSCRIPTION', `Local STT process error: ${error.message}`, stderr);
          return reject(new Error(`Local STT failed: ${error.message}`));
        }

        try {
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.filter(l => l.trim().startsWith('{')).pop();
          if (!jsonLine) {
            throw new Error(`No JSON output received from local STT: ${stdout}`);
          }

          const result = JSON.parse(jsonLine);
          if (!result.success) {
            throw new Error(result.error || 'Local STT failed');
          }

          const words = result.words || [];
          const segments = result.segments || [];

          await db.run('DELETE FROM captions WHERE project_id = ?', [projectId]);
          const now = new Date().toISOString();
          const savedCaptions = [];

          for (const seg of segments) {
            await db.run(`
              INSERT INTO captions (project_id, start_time, end_time, text, words_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              projectId,
              seg.start,
              seg.end,
              seg.text.trim(),
              JSON.stringify(seg.words || []),
              now
            ]);

            savedCaptions.push({
              start_time: seg.start,
              end_time: seg.end,
              text: seg.text.trim(),
              words: seg.words || []
            });
          }

          logger.info('TRANSCRIPTION', `Saved ${savedCaptions.length} genuine local caption segments with ${words.length} words via ${result.engine}`);
          resolve({
            success: true,
            engine: result.engine,
            word_count: words.length,
            segment_count: savedCaptions.length,
            captions: savedCaptions
          });

        } catch (parseErr) {
          logger.error('TRANSCRIPTION', 'Failed to parse local STT output', parseErr);
          reject(parseErr);
        }
      });
    });
  }

  /**
   * Generate ASS subtitles file formatted for bottom-center rendering
   */
  async generateAssSubtitles(projectId, outputPath) { return this.exportAssSubtitles(projectId, outputPath); }

  async exportAssSubtitles(projectId, outputPath) {
    const captions = await db.all(`
      SELECT * FROM captions WHERE project_id = ? ORDER BY start_time ASC
    `, [projectId]);

    const header = `[Script Info]
Title: Stickman Studio Captions
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const formatAssTime = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const cs = Math.floor((sec % 1) * 100);
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
    };

    let events = '';
    for (const c of captions) {
      const start = formatAssTime(c.start_time);
      const end = formatAssTime(c.end_time);
      events += `Dialogue: 0,${start},${end},Default,,0,0,0,,${c.text}\n`;
    }

    const fullContent = header + events;
    fs.writeFileSync(outputPath, fullContent, 'utf8');
    logger.info('TRANSCRIPTION', `Exported ASS subtitle file: ${outputPath}`);
    return { success: true, path: outputPath, count: captions.length };
  }

  /**
   * Export SRT subtitle format
   */
  async exportSrtSubtitles(projectId, outputPath) {
    const captions = await db.all(`
      SELECT * FROM captions WHERE project_id = ? ORDER BY start_time ASC
    `, [projectId]);

    const formatSrtTime = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    let srtContent = '';
    for (let i = 0; i < captions.length; i++) {
      const c = captions[i];
      srtContent += `${i + 1}\n`;
      srtContent += `${formatSrtTime(c.start_time)} --> ${formatSrtTime(c.end_time)}\n`;
      srtContent += `${c.text}\n\n`;
    }

    fs.writeFileSync(outputPath, srtContent, 'utf8');
    logger.info('TRANSCRIPTION', `Exported SRT subtitle file: ${outputPath}`);
    return { success: true, path: outputPath, count: captions.length };
  }
}

module.exports = new TranscriptionService();
