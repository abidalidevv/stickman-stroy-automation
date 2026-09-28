/**
 * STICKMAN STUDIO — MASTER TIMELINE & PACING ENGINE
 * Generates, updates, and optimizes video timelines based on voiceover duration,
 * pacing presets, and image sequence order.
 */

const db = require('./db');
const logger = require('./logger');

const PACING_PRESETS = {
  '1/4s': { multiplier: 0.25, defaultDuration: 4.0 },
  '2/4s': { multiplier: 0.50, defaultDuration: 2.0 },
  '3/4s': { multiplier: 0.75, defaultDuration: 1.333 },
  '4/4s': { multiplier: 1.00, defaultDuration: 1.0 },
  '5/4s': { multiplier: 1.25, defaultDuration: 0.8 },
  'Custom': { multiplier: 0.50, defaultDuration: 2.0 }
};

class TimelineManager {
  /**
   * Build or rebuild the master timeline for a project
   */
  async buildMasterTimeline(projectId, { voiceoverDuration = null, pacingPreset = null } = {}) {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const presetKey = pacingPreset || project.pacing_preset || '2/4s';
    const preset = PACING_PRESETS[presetKey] || PACING_PRESETS['2/4s'];

    const voDuration = voiceoverDuration !== null
      ? parseFloat(voiceoverDuration)
      : (project.voiceover_duration ? parseFloat(project.voiceover_duration) : 0);

    const prompts = await db.all(`
      SELECT * FROM prompts WHERE project_id = ? ORDER BY prompt_index ASC
    `, [projectId]);

    if (prompts.length === 0) {
      throw new Error(`No prompts found in project ${projectId} to build timeline`);
    }

    const N = prompts.length;
    let standardDuration = preset.defaultDuration;

    if (voDuration > 0) {
      standardDuration = parseFloat((voDuration / N).toFixed(3));
    }

    const now = new Date().toISOString();
    let currentStartTime = 0.0;
    const timelineItems = [];

    // Clear existing timeline items to rebuild cleanly
    await db.run('DELETE FROM timeline_items WHERE project_id = ?', [projectId]);

    for (let i = 0; i < N; i++) {
      const p = prompts[i];
      const duration = standardDuration;
      const startTime = parseFloat(currentStartTime.toFixed(3));
      const endTime = parseFloat((startTime + duration).toFixed(3));
      currentStartTime = endTime;

      const itemId = `tl_${projectId}_${p.prompt_id_str}`;

      await db.run(`
        INSERT INTO timeline_items (
          id, project_id, prompt_id, order_index, image_path,
          duration, start_time, end_time, transition,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'crossfade', ?, ?)
      `, [
        itemId, projectId, p.id, i + 1, p.file_path || '',
        duration, startTime, endTime, now, now
      ]);

      timelineItems.push({
        id: itemId,
        prompt_id: p.id,
        prompt_id_str: p.prompt_id_str,
        order_index: i + 1,
        sequence_order: i + 1,
        image_path: p.file_path,
        duration: duration,
        duration_sec: duration,
        start_time: startTime,
        start_time_sec: startTime,
        end_time: endTime,
        end_time_sec: endTime,
        transition: 'crossfade'
      });
    }

    // Update project with calculated VO duration and pacing
    await db.run(`
      UPDATE projects SET
        voiceover_duration = ?,
        pacing_preset = ?,
        pacing_multiplier = ?,
        updated_at = ?
      WHERE id = ?
    `, [currentStartTime, presetKey, preset.multiplier, now, projectId]);

    logger.info('TIMELINE_MANAGER', `Built master timeline for project ${projectId}: ${N} items, total duration: ${currentStartTime.toFixed(2)}s`);

    return {
      success: true,
      project_id: projectId,
      item_count: N,
      total_duration_sec: currentStartTime,
      items: timelineItems
    };
  }

  /**
   * Get full Master Timeline representation for UI preview
   */
  async getTimeline(projectId) {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const items = await db.all(`
      SELECT 
        ti.*,
        ti.duration as duration_sec,
        ti.start_time as start_time_sec,
        ti.end_time as end_time_sec,
        ti.order_index as sequence_order,
        p.prompt_id_str,
        p.prompt_text,
        p.status as prompt_status,
        p.file_name
      FROM timeline_items ti
      JOIN prompts p ON ti.prompt_id = p.id
      WHERE ti.project_id = ?
      ORDER BY ti.order_index ASC
    `, [projectId]);

    const totalDuration = items.length > 0 ? items[items.length - 1].end_time : 0;

    return {
      project_id: projectId,
      project_name: project.name,
      pacing_preset: project.pacing_preset,
      voiceover_duration: project.voiceover_duration,
      total_duration_sec: totalDuration,
      item_count: items.length,
      items
    };
  }

  /**
   * Adjust duration of a specific timeline slide and recalculate downstream timings
   */
  /**
   * Batch sync timeline items (order and durations) from Scene Director
   */
  async syncTimelineItems(projectId, items = []) {
    if (!items || items.length === 0) return this.getTimeline(projectId);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const dur = Math.max(0.2, parseFloat(it.duration || it.duration_sec || 2.0));
      const order = i + 1;
      await db.run(
        'UPDATE timeline_items SET order_index = ?, duration = ?, updated_at = datetime("now") WHERE id = ? AND project_id = ?',
        [order, dur, it.id, projectId]
      );
    }
    return this.recalculateTimestamps(projectId);
  }

  async updateItemDuration(projectId, itemId, newDurationSec) {
    const dur = Math.max(0.5, parseFloat(newDurationSec));

    await db.run(`
      UPDATE timeline_items SET duration = ?, updated_at = datetime('now') WHERE id = ? AND project_id = ?
    `, [dur, itemId, projectId]);

    return this.recalculateTimestamps(projectId);
  }

  /**
   * Recalculate start and end times for all items sequentially
   */
  async recalculateTimestamps(projectId) {
    const items = await db.all(`
      SELECT id, duration FROM timeline_items WHERE project_id = ? ORDER BY order_index ASC
    `, [projectId]);

    let cursor = 0.0;
    for (const item of items) {
      const start = parseFloat(cursor.toFixed(3));
      const end = parseFloat((start + item.duration).toFixed(3));
      cursor = end;

      await db.run(`
        UPDATE timeline_items SET start_time = ?, end_time = ?, updated_at = datetime('now') WHERE id = ?
      `, [start, end, item.id]);
    }

    await db.run(`UPDATE projects SET voiceover_duration = ?, updated_at = datetime('now') WHERE id = ?`, [cursor, projectId]);
    return this.getTimeline(projectId);
  }
}

module.exports = new TimelineManager();
