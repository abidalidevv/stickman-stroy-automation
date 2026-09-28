/**
 * STICKMAN STUDIO — IMAGE INGESTION & FILE VALIDATION ENGINE
 * Validates, moves, and reconciles generated images from browser download folders
 * into central project storage.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const logger = require('./logger');

class IngestionManager {
  constructor() {
    this.downloadsDir = this.detectDownloadsFolder();
  }

  detectDownloadsFolder() {
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Ali';
    const standardDownloads = path.join(userProfile, 'Downloads');
    if (fs.existsSync(standardDownloads)) {
      return standardDownloads;
    }
    return path.resolve('E:/stickman-video-automation/Downloads');
  }

  /**
   * Validate image integrity & header magic bytes
   */
  validateImageFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return { valid: false, error: 'File size is 0 bytes (corrupt or empty)' };
    }

    // Minimum size check (at least 5KB for valid generated image)
    if (stat.size < 5120) {
      return { valid: false, error: `File size too small (${stat.size} bytes)` };
    }

    try {
      const fd = fs.openSync(filePath, 'r');
      const headerBuf = Buffer.alloc(Math.min(stat.size, 65536));
      fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
      fs.closeSync(fd);

      // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      const isPng = headerBuf[0] === 0x89 && headerBuf[1] === 0x50 && headerBuf[2] === 0x4E && headerBuf[3] === 0x47;
      // Check JPEG magic bytes: FF D8 FF
      const isJpeg = headerBuf[0] === 0xFF && headerBuf[1] === 0xD8 && headerBuf[2] === 0xFF;
      // Check WebP magic bytes: 'RIFF' ... 'WEBP'
      const isWebp = headerBuf.toString('ascii', 0, 4) === 'RIFF' && headerBuf.toString('ascii', 8, 12) === 'WEBP';

      if (!isPng && !isJpeg && !isWebp) {
        return { valid: false, error: 'Invalid file signature (not PNG, JPEG, or WebP)' };
      }

      let width = 0;
      let height = 0;
      let format = '';

      if (isPng) {
        format = 'png';
        // IHDR chunk is located at byte offset 12..15
        if (headerBuf.length >= 24 && headerBuf.toString('ascii', 12, 16) === 'IHDR') {
          width = headerBuf.readUInt32BE(16);
          height = headerBuf.readUInt32BE(20);
        }
      } else if (isJpeg) {
        format = 'jpeg';
        let offset = 2;
        while (offset < headerBuf.length - 8) {
          if (headerBuf[offset] === 0xFF) {
            const marker = headerBuf[offset + 1];
            // SOF markers: 0xC0 (baseline), 0xC1 (extended), 0xC2 (progressive)
            if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC9 && marker <= 0xCB)) {
              height = headerBuf.readUInt16BE(offset + 5);
              width = headerBuf.readUInt16BE(offset + 7);
              break;
            } else if (marker === 0xD9 || marker === 0xDA) {
              break; // Start of scan or end of image
            } else {
              const len = headerBuf.readUInt16BE(offset + 2);
              offset += 2 + len;
              continue;
            }
          }
          offset++;
        }
      } else if (isWebp) {
        format = 'webp';
        const chunkType = headerBuf.toString('ascii', 12, 16);
        if (chunkType === 'VP8 ' && headerBuf.length >= 30) {
          width = headerBuf.readUInt16LE(26) & 0x3FFF;
          height = headerBuf.readUInt16LE(28) & 0x3FFF;
        } else if (chunkType === 'VP8L' && headerBuf.length >= 25) {
          const b1 = headerBuf[21], b2 = headerBuf[22], b3 = headerBuf[23], b4 = headerBuf[24];
          width = 1 + (b1 | ((b2 & 0x3F) << 8));
          height = 1 + (((b2 >> 6) | (b3 << 2) | ((b4 & 0xF) << 10)));
        } else if (chunkType === 'VP8X' && headerBuf.length >= 30) {
          width = 1 + headerBuf.readUIntLE(24, 3);
          height = 1 + headerBuf.readUIntLE(27, 3);
        }
      }

      if (width <= 0 || height <= 0) {
        return { valid: false, error: `Invalid image dimensions decoded: ${width}x${height} (format: ${format})` };
      }

      // Studio calculates SHA-256 directly from the actual physical file bytes
      const fileBytes = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');

      return {
        valid: true,
        size: stat.size,
        format,
        width,
        height,
        sha256: hash
      };
    } catch (err) {
      return { valid: false, error: `Validation exception: ${err.message}` };
    }
  }

  /**
   * Ingest a completed image into central project images directory
   */
  async ingestFileForPrompt(projectId, promptId, sourceFilePath, { workerId = 'W01', variant = null } = {}) {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const prompt = await db.get('SELECT * FROM prompts WHERE id = ? AND project_id = ?', [promptId, projectId]);
    if (!prompt) throw new Error(`Prompt ${promptId} not found in project ${projectId}`);

    const validation = this.validateImageFile(sourceFilePath);
    if (!validation.valid) {
      logger.error('INGESTION', `File validation failed for ${sourceFilePath}: ${validation.error}`);
      throw new Error(`File validation failed: ${validation.error}`);
    }

    // Target filename formatting: 001_stickman__W01.png or 001a_stickman__W01.png
    const variantSuffix = variant ? `${variant}` : '';
    const ext = path.extname(sourceFilePath) || `.${validation.format}`;
    const targetFileName = `${prompt.prompt_id_str}${variantSuffix}_stickman__${workerId}${ext}`;
    const targetDir = path.join(project.directory_path, 'central_images');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, targetFileName);

    // Copy file to central images
    fs.copyFileSync(sourceFilePath, targetFilePath);
    logger.info('INGESTION', `Copied image to central storage: ${targetFilePath}`);

    const now = new Date().toISOString();

    // Update Prompt in SQLite
    await db.run(`
      UPDATE prompts SET
        file_name = ?,
        file_path = ?,
        file_size = ?,
        sha256 = ?,
        variant = ?,
        status = 'COMPLETED',
        updated_at = ?
      WHERE id = ?
    `, [targetFileName, targetFilePath, validation.size, validation.sha256, variant, now, prompt.id]);

    // Update corresponding Timeline Item if it exists
    await db.run(`
      UPDATE timeline_items SET
        image_path = ?,
        updated_at = ?
      WHERE prompt_id = ?
    `, [targetFilePath, now, prompt.id]);

    return {
      success: true,
      prompt_id: prompt.id,
      prompt_id_str: prompt.prompt_id_str,
      file_name: targetFileName,
      file_path: targetFilePath,
      file_size: validation.size,
      sha256: validation.sha256
    };
  }

  /**
   * Manual Image Replacement for a Timeline Prompt
   */
  async replacePromptImage(projectId, promptId, newSourcePath, userNotes = 'Manual replacement') {
    const res = await this.ingestFileForPrompt(projectId, promptId, newSourcePath, {
      workerId: 'MANUAL',
      variant: 'custom'
    });

    // Save prompt version history
    const prompt = await db.get('SELECT * FROM prompts WHERE id = ?', [promptId]);
    const maxVersion = await db.get('SELECT MAX(version_number) as max_v FROM prompt_versions WHERE prompt_id = ?', [promptId]);
    const nextVer = (maxVersion && maxVersion.max_v ? maxVersion.max_v : 0) + 1;

    await db.run(`
      INSERT INTO prompt_versions (prompt_id, version_number, prompt_text, file_path, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [promptId, nextVer, prompt.prompt_text, res.file_path]);

    logger.info('INGESTION', `Replaced image for prompt ${promptId} (Version ${nextVer}): ${res.file_path}`);
    return { success: true, version: nextVer, ...res };
  }

  /**
   * Scan project download directories and reconcile completed images
   */
  async scanAndReconcile(projectId) {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const centralDir = path.join(project.directory_path, 'central_images');
    if (!fs.existsSync(centralDir)) {
      fs.mkdirSync(centralDir, { recursive: true });
    }

    const candidateDirs = [
      centralDir,
      path.join(this.downloadsDir, project.name),
      this.downloadsDir
    ];

    const prompts = await db.all(`
      SELECT * FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC
    `, [projectId]);

    const results = { reconciled: 0, missing: 0, details: [] };

    for (const p of prompts) {
      let foundFile = null;

      // 1. Check if already has a valid central file
      if (p.file_path && fs.existsSync(p.file_path)) {
        const val = this.validateImageFile(p.file_path);
        if (val.valid) {
          results.details.push({ prompt_id: p.prompt_id_str, status: 'EXISTS', path: p.file_path });
          continue;
        }
      }

      // 2. Search candidate directories for pattern: 001_* or 001.*
      for (const cDir of candidateDirs) {
        if (!fs.existsSync(cDir)) continue;
        const files = fs.readdirSync(cDir);
        const match = files.find(f => {
          const base = path.basename(f);
          return base.startsWith(`${p.prompt_id_str}_`) || base.startsWith(`${p.prompt_id_str}.`);
        });

        if (match) {
          foundFile = path.join(cDir, match);
          break;
        }
      }

      if (foundFile) {
        try {
          const ingestRes = await this.ingestFileForPrompt(projectId, p.id, foundFile);
          results.reconciled++;
          results.details.push({ prompt_id: p.prompt_id_str, status: 'RECONCILED', path: ingestRes.file_path });
        } catch (e) {
          results.missing++;
          results.details.push({ prompt_id: p.prompt_id_str, status: 'INVALID', error: e.message });
        }
      } else {
        results.missing++;
        results.details.push({ prompt_id: p.prompt_id_str, status: 'MISSING' });
      }
    }

    logger.info('INGESTION', `Scan and reconcile complete for project ${projectId}: ${results.reconciled} reconciled, ${results.missing} missing`);
    return results;
  }
}

module.exports = new IngestionManager();
