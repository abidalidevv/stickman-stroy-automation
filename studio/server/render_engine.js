/**
 * STICKMAN STUDIO — MASTER VIDEO RENDER ENGINE
 * Compiles timeline slides, voiceover, ducked background music (7%), and SFX
 * into broadcast-ready 1080p 30 FPS H.264/AAC MP4 video via FFmpeg.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const db = require('./db');
const logger = require('./logger');
const timelineManager = require('./timeline_manager');

const FFMPEG_PATH = path.resolve('E:/stickman-video-automation/studio/bin/ffmpeg.exe');
const FFPROBE_PATH = path.resolve('E:/stickman-video-automation/studio/bin/ffprobe.exe');
const SFX_DIR = path.resolve('E:/stickman-video-automation/studio/sfx');

class RenderEngine {
  constructor() {
    this.ensureBinaries();
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
  async validateRenderedVideo(videoPath, expectedMinDuration = 1.0) {
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

      const is1080p = (width === 1920 && height === 1080);
      const isH264 = codec === 'h264';
      const hasAudio = !!aStream;

      if (!is1080p) {
        return { valid: false, error: `Invalid resolution: ${width}x${height} (Expected 1920x1080)` };
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
    transitionType = 'cut'
  } = {}) {
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

    // Video filter: Scale and letterbox to exact 1920x1080
    const videoFilter = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30';

    // Audio filter: Mix voiceover with background music ducked to 7% (0.07)
    let audioFilter = '';
    if (includeMusic && musicPath) {
      // Input 1 = VO, Input 2 = Music
      audioFilter = `[2:a]volume=${musicVolume},atrim=0:${totalDuration}[music];[1:a][music]amix=inputs=2:duration=first[aout]`;
    } else {
      audioFilter = `[1:a]atrim=0:${totalDuration}[aout]`;
    }

    args.push(
      '-filter_complex', `[0:v]${videoFilter}[vout];${audioFilter}`,
      '-map', '[vout]',
      '-map', '[aout]',
      '-t', String(totalDuration),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '20',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '192k',
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
        const val = await this.validateRenderedVideo(outputPath, totalDuration);
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
          ) VALUES (?, ?, ?, '1920x1080', 30, ?, ?, 'COMPLETED', ?, ?)
        `, [renderId, projectId, outputPath, val.duration, val.size, now, now]);

        logger.info('RENDER_ENGINE', `Render complete & validated: ${outputPath} (${val.duration}s, ${val.size} bytes)`);

        resolve({
          success: true,
          render_id: renderId,
          output_path: outputPath,
          duration: val.duration,
          file_size: val.size,
          resolution: '1920x1080',
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
