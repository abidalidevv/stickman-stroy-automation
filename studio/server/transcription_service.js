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

class TranscriptionService {
  async getApiKey() {
    if (process.env.GROQ_API_KEY) {
      return process.env.GROQ_API_KEY;
    }
    const row = await db.get("SELECT value FROM settings WHERE key = 'groq_api_key'");
    return row ? row.value : null;
  }

  /**
   * Transcribe audio file with word-level timestamps
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

    const groq = new Groq({ apiKey });

    try {
      logger.info('TRANSCRIPTION', `Sending audio to Groq Whisper: ${path.basename(audioFilePath)}`);
      const fileStream = fs.createReadStream(audioFilePath);

      const transcription = await groq.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-large-v3',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });

      const words = transcription.words || [];
      const segments = transcription.segments || [];

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
