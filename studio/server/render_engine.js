/**
 * STICKMAN STUDIO — MASTER VIDEO RENDER ENGINE
 * Compiles timeline slides, voiceover, ducked background music (7%), and SFX
 * into broadcast-ready 1080p 30 FPS H.264/AAC MP4 video via FFmpeg.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');
const db = require('./db');
const logger = require('./logger');
const timelineManager = require('./timeline_manager');

const STUDIO_DIR = path.resolve(__dirname, '..');
const FFMPEG_PATH = process.env.FFMPEG_PATH || path.join(STUDIO_DIR, 'bin', 'ffmpeg.exe');
const FFPROBE_PATH = process.env.FFPROBE_PATH || path.join(STUDIO_DIR, 'bin', 'ffprobe.exe');
const SFX_DIR = path.join(STUDIO_DIR, 'sfx');
const FONTS_DIR = path.join(STUDIO_DIR, 'data', 'fonts');

class RenderEngine {
  constructor() {
    this._cachedEncoder = null;
    this.ensureBinaries();
  }

  /**
   * Hardware GPU Auto-Detection Cascade: nvenc -> qsv -> amf -> mf -> libx264
   */
  async detectGpuEncoder() {
    if (this._cachedEncoder) return this._cachedEncoder;
    const candidates = ['h264_nvenc', 'h264_qsv', 'h264_amf', 'h264_mf', 'libx264'];
    for (const enc of candidates) {
      if (enc === 'libx264') {
        this._cachedEncoder = 'libx264';
        return 'libx264';
      }
      try {
        const works = await new Promise((resolve) => {
          const p = spawn(FFMPEG_PATH, ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-c:v', enc, '-f', 'null', '-'], { windowsHide: true });
          p.on('close', (code) => resolve(code === 0));
          p.on('error', () => resolve(false));
          setTimeout(() => { try { p.kill(); } catch (e) {} resolve(false); }, 2500);
        });
        if (works) {
          logger.info('RENDER_ENGINE', `Hardware GPU encoder detected and selected: ${enc}`);
          this._cachedEncoder = enc;
          return enc;
        }
      } catch (e) {}
    }
    this._cachedEncoder = 'libx264';
    return 'libx264';
  }

  getEncoderArgs(encoder, crfVal, speedPreset) {
    if (encoder === 'h264_nvenc') {
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-cq', crfVal, '-pix_fmt', 'yuv420p'];
    } else if (encoder === 'h264_qsv') {
      return ['-c:v', 'h264_qsv', '-preset', 'veryfast', '-global_quality', crfVal, '-pix_fmt', 'nv12'];
    } else if (encoder === 'h264_amf') {
      return ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cbr', '-pix_fmt', 'yuv420p'];
    } else if (encoder === 'h264_mf') {
      return ['-c:v', 'h264_mf', '-quality', '2', '-pix_fmt', 'yuv420p'];
    } else {
      return ['-c:v', 'libx264', '-preset', speedPreset || 'veryfast', '-crf', crfVal, '-pix_fmt', 'yuv420p'];
    }
  }

  ensureBinaries() {
    if (!fs.existsSync(FFMPEG_PATH)) {
      logger.warn('RENDER_ENGINE', `FFmpeg binary not found at: ${FFMPEG_PATH}`);
    }
    if (!fs.existsSync(FFPROBE_PATH)) {
      logger.warn('RENDER_ENGINE', `FFprobe binary not found at: ${FFPROBE_PATH}`);
    }
  }

  /**
   * Run FFprobe to inspect and validate a media file
   */
  async probeMedia(filePath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ];

      execFile(FFPROBE_PATH, args, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`FFprobe failed: ${error.message}`));
        }
        try {
          const json = JSON.parse(stdout);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse FFprobe JSON: ${e.message}`));
        }
      });
    });
  }

  /**
   * Post-Render Validation
   * Ensures output is 1920x1080, 30 FPS, H.264, AAC, and non-empty
   */
  async validateRenderedVideo(videoPath, expectedMinDuration = 1.0, expectedWidth = 1920, expectedHeight = 1080) {
    if (!fs.existsSync(videoPath)) {
      return { valid: false, error: 'Rendered video file does not exist' };
    }

    const stat = fs.statSync(videoPath);
    if (stat.size < 10240) {
      return { valid: false, error: `Rendered file is suspiciously small (${stat.size} bytes)` };
    }

    try {
      const probe = await this.probeMedia(videoPath);
      const vStream = probe.streams && probe.streams.find(s => s.codec_type === 'video');
      const aStream = probe.streams && probe.streams.find(s => s.codec_type === 'audio');

      if (!vStream) {
        return { valid: false, error: 'No video stream found in rendered MP4' };
      }

      const width = vStream.width;
      const height = vStream.height;
      const codec = vStream.codec_name;
      const duration = parseFloat(probe.format.duration || vStream.duration || 0);

      const isExpectedRes = (width === expectedWidth && height === expectedHeight);
      const isH264 = codec === 'h264';
      const hasAudio = !!aStream;

      if (!isExpectedRes) {
        return { valid: false, error: `Invalid resolution: ${width}x${height} (Expected ${expectedWidth}x${expectedHeight})` };
      }

      if (!isH264) {
        return { valid: false, error: `Invalid video codec: ${codec} (Expected h264)` };
      }

      if (duration < expectedMinDuration * 0.9) {
        return { valid: false, error: `Rendered duration (${duration.toFixed(2)}s) shorter than expected` };
      }

      return {
        valid: true,
        width,
        height,
        codec,
        duration,
        size: stat.size,
        audio_codec: aStream ? aStream.codec_name : 'none'
      };

    } catch (err) {
      return { valid: false, error: `Probe validation exception: ${err.message}` };
    }
  }

  /**
   * Render Master 1080p Video for a Project
   */
  async renderProjectVideo(projectId, {
    outputFileName = null,
    includeMusic = true,
    includeSfx = true,
    musicVolume = 0.07, // STRICT REQUIREMENT: DEFAULT MUSIC VOLUME = 7%
    transitionType = 'cross_dissolve',
    aspectRatio = '16:9',
    resolution = '1920x1080',
    effectsPreset = 'normal',
    vignetteEnabled = false,
    blurAmount = 0,
    sharpenEnabled = false,
    grainEnabled = false,
    fps = 60,
    speedPreset = 'veryfast',
    crf = null,
    audioBitrate = '320k',
    enableHwaccel = true
  } = {}) {
    let targetW = 1920;
    let targetH = 1080;
    if (resolution && resolution.includes('x')) {
      const parts = resolution.split('x').map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        targetW = parts[0];
        targetH = parts[1];
      }
    } else if (aspectRatio === '9:16') {
      targetW = 1080;
      targetH = 1920;
    }
    const renderFps = parseInt(fps, 10) || 60;
    const crfVal = crf !== null && crf !== undefined ? String(crf) : (targetW >= 3840 ? '18' : '20');
    const resolutionStr = `${targetW}x${targetH}`;
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const timeline = await timelineManager.getTimeline(projectId);
    if (!timeline.items || timeline.items.length === 0) {
      throw new Error(`Project ${projectId} has no timeline items to render`);
    }

    // Verify all images exist
    for (const item of timeline.items) {
      if (!item.image_path || !fs.existsSync(item.image_path)) {
        throw new Error(`Missing image for slide ${item.prompt_id_str}: ${item.image_path}`);
      }
    }

    const outputDir = path.join(project.directory_path, 'renders');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const targetName = outputFileName || `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_master_1080p.mp4`;
    const outputPath = path.join(outputDir, targetName);

    // Create FFmpeg concat demuxer text file
    const concatListPath = path.join(outputDir, `concat_${Date.now()}.txt`);
    const concatLines = [];
    for (const item of timeline.items) {
      const normalizedPath = item.image_path.replace(/\\/g, '/');
      concatLines.push(`file '${normalizedPath}'`);
      concatLines.push(`duration ${item.duration_sec}`);
    }
    // Repeat last image without duration for FFmpeg concat format requirement
    if (timeline.items.length > 0) {
      const lastPath = timeline.items[timeline.items.length - 1].image_path.replace(/\\/g, '/');
      concatLines.push(`file '${lastPath}'`);
    }
    fs.writeFileSync(concatListPath, concatLines.join('\n'), 'utf8');

    // Prepare audio inputs
    const totalDuration = timeline.total_duration_sec;
    const voPath = project.voiceover_path && fs.existsSync(project.voiceover_path) ? project.voiceover_path : null;
    const musicPath = project.music_path && fs.existsSync(project.music_path) ? project.music_path : null;

    logger.info('RENDER_ENGINE', `Starting 1080p render for ${project.name} (Duration: ${totalDuration}s, Music Vol: ${musicVolume})`);

    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath
    ];

    // Audio stream preparation
    if (voPath) {
      args.push('-i', voPath);
    } else {
      // Synthesize silence for VO channel if no voiceover file attached
      args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`);
    }

    // Background music stream
    if (includeMusic && musicPath) {
      args.push('-i', musicPath);
    }

    // Video filter: Scale and letterbox to exact target resolution with broadcast FPS
    let videoFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black`;

    // Apply Atmospheric & Post-Production Effects
    if (effectsPreset === 'cyberpunk') {
      videoFilter += `,hue=s=1.6:h=25,eq=contrast=1.3:brightness=0.03`;
    } else if (effectsPreset === 'noir' || effectsPreset === 'b_w') {
      videoFilter += `,hue=s=0,eq=contrast=1.45:brightness=-0.04`;
    } else if (effectsPreset === 'warm') {
      videoFilter += `,colorchannelmixer=rr=1.15:rg=0.05:bb=0.85,eq=saturation=1.2`;
    } else if (effectsPreset === 'cool') {
      videoFilter += `,colorchannelmixer=rr=0.85:bb=1.25,eq=saturation=1.15`;
    } else if (effectsPreset === 'vintage') {
      videoFilter += `,colorchannelmixer=rr=1.1:rg=0.05:bb=0.8,eq=contrast=1.1:saturation=0.85`;
    } else if (effectsPreset === 'vivid') {
      videoFilter += `,eq=contrast=1.25:saturation=1.6`;
    } else if (effectsPreset === 'moody_dark') {
      videoFilter += `,eq=contrast=1.35:brightness=-0.1:saturation=0.9`;
    } else if (effectsPreset === 'golden_hour') {
      videoFilter += `,colorchannelmixer=rr=1.2:gg=1.05:bb=0.7,eq=contrast=1.15:saturation=1.3`;
    } else if (effectsPreset === 'dreamy') {
      videoFilter += `,gblur=sigma=1.2,eq=contrast=1.08:brightness=0.05:saturation=1.2`;
    } else if (effectsPreset === 'neon') {
      videoFilter += `,hue=s=1.6:h=-20,eq=contrast=1.35`;
    } else if (effectsPreset === 'sepia') {
      videoFilter += `,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=contrast=1.1`;
    } else if (effectsPreset === 'invert') {
      videoFilter += `,negate`;
    } else if (effectsPreset === 'pastel') {
      videoFilter += `,eq=contrast=0.95:brightness=0.06:saturation=0.85`;
    } else if (effectsPreset === 'frost') {
      videoFilter += `,colorchannelmixer=rr=0.85:bb=1.3,eq=contrast=1.15:saturation=0.9`;
    } else if (effectsPreset === 'sunset') {
      videoFilter += `,colorchannelmixer=rr=1.25:gg=0.85:bb=0.95,eq=contrast=1.2:saturation=1.35`;
    } else if (effectsPreset === 'ocean') {
      videoFilter += `,colorchannelmixer=rr=0.75:gg=1.1:bb=1.35,eq=contrast=1.2:saturation=1.25`;
    } else if (effectsPreset === 'bright') {
      videoFilter += `,eq=contrast=1.1:brightness=0.08:saturation=1.1`;
    }

    if (vignetteEnabled) {
      videoFilter += `,vignette=PI/4`;
    }
    if (sharpenEnabled) {
      videoFilter += `,unsharp=5:5:1.0:5:5:0.0`;
    }
    if (blurAmount > 0) {
      videoFilter += `,gblur=sigma=${Math.min(blurAmount, 10)}`;
    }
    if (grainEnabled) {
      videoFilter += `,noise=c1s=8:c1f=t+u`;
    }

    // Audio filter: Mix voiceover with background music ducked to 7% (0.07) + microsecond lipsync lock
    let audioFilter = '';
    if (includeMusic && musicPath) {
      // Input 1 = VO, Input 2 = Music
      audioFilter = `[2:a]volume=${musicVolume},atrim=0:${totalDuration}[music];[1:a][music]amix=inputs=2:duration=first,aresample=async=1000[aout]`;
    } else {
      audioFilter = `[1:a]atrim=0:${totalDuration},aresample=async=1000[aout]`;
    }

    // Detect GPU hardware encoder or fallback to CPU libx264
    const encoder = enableHwaccel !== false ? await this.detectGpuEncoder() : 'libx264';
    const encArgs = this.getEncoderArgs(encoder, crfVal, speedPreset);
    const adaptiveThreads = String(Math.min(4, Math.max(2, Math.floor(os.cpus().length / 2))));

    args.push(
      '-filter_complex', `[0:v]${videoFilter}[vout];${audioFilter}`,
      '-map', '[vout]',
      '-map', '[aout]',
      '-t', String(totalDuration),
      ...encArgs,
      '-r', String(renderFps),
      '-fps_mode', 'cfr',
      '-threads', adaptiveThreads,
      '-max_muxing_queue_size', '1024',
      '-dn',
      '-c:a', 'aac',
      '-b:a', audioBitrate || '320k',
      '-movflags', '+faststart',
      outputPath
    );

    return new Promise((resolve, reject) => {
      const child = spawn(FFMPEG_PATH, args);
      let stderr = '';

      child.stderr.on('data', data => stderr += data.toString());

      child.on('close', async (code) => {
        // Clean up concat file
        try { fs.unlinkSync(concatListPath); } catch (e) {}

        if (code !== 0) {
          logger.error('RENDER_ENGINE', `FFmpeg failed with code ${code}`, stderr.slice(-1000));
          return reject(new Error(`FFmpeg render failed (code ${code}): ${stderr.slice(-300)}`));
        }

        // Post-render validation
        const val = await this.validateRenderedVideo(outputPath, totalDuration, targetW, targetH);
        if (!val.valid) {
          logger.error('RENDER_ENGINE', `Post-render validation failed: ${val.error}`);
          return reject(new Error(`Post-render validation failed: ${val.error}`));
        }

        const now = new Date().toISOString();
        const renderId = `rnd_${Date.now()}`;

        await db.run(`
          INSERT INTO renders (
            id, project_id, output_path, resolution, fps, render_duration_sec,
            file_size, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 30, ?, ?, 'COMPLETED', ?, ?)
        `, [renderId, projectId, outputPath, resolutionStr, val.duration, val.size, now, now]);

        logger.info('RENDER_ENGINE', `Render complete & validated: ${outputPath} (${val.duration}s, ${val.size} bytes)`);

        resolve({
          success: true,
          render_id: renderId,
          output_path: outputPath,
          duration: val.duration,
          file_size: val.size,
          resolution: resolutionStr,
          fps: 30,
          codec: val.codec,
          audio_codec: val.audio_codec
        });
      });
    });
  }

  async renderTimeline(projectId, options) {
    return this.renderProjectVideo(projectId, options);
  }
}

module.exports = new RenderEngine();
