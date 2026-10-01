const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('./logger');

const PROJECTS_ROOT = path.resolve('E:/stickman-video-automation/Projects');
if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
}

const PACING_MULTIPLIERS = {
  '1/4s': 0.25,
  '2/4s': 0.50,
  '3/4s': 0.75,
  '4/4s': 1.00,
  '5/4s': 1.25,
  'Custom': 0.50
};

function sanitizeFolderName(name) {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '-');
}

async function listProjects() {
  const rows = await db.all(`SELECT * FROM projects WHERE status != 'DELETED' ORDER BY updated_at DESC`);
  return rows;
}

async function getProject(id) {
  const proj = await db.get(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (!proj) return null;

  const character = await db.get(`SELECT * FROM character_references WHERE project_id = ? OR project_id IS NULL ORDER BY created_at DESC LIMIT 1`, [id]);
  const promptStats = await db.get(`
    SELECT 
      COUNT(*) as total_prompts,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_prompts,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_prompts,
      SUM(CASE WHEN status = 'GENERATING' THEN 1 ELSE 0 END) as generating_prompts
    FROM prompts WHERE project_id = ?
  `, [id]);

  return {
    ...proj,
    character,
    stats: promptStats
  };
}

async function createProject({
  name,
  mode = 'MODE_2',
  voiceover_path = null,
  voiceover_duration = 0,
  pacing_preset = '2/4s',
  custom_multiplier = null,
  script_text = '',
  character_name = 'Main Stickman',
  character_description = '',
  character_image_buffer = null,
  character_image_name = 'reference.png',
  music_path = null,
  music_volume = 0.07,
  master_prompt = null,
  raw_prompts = null
}) {
  const projId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const folderName = `${sanitizeFolderName(name)}_${projId.slice(-6)}`;
  const projDir = path.join(PROJECTS_ROOT, folderName);

  const subdirs = ['central_images', 'downloads_raw', 'images', 'characters', 'prompts', 'captions', 'sfx', 'music', 'renders'];
  for (const sub of subdirs) {
    fs.mkdirSync(path.join(projDir, sub), { recursive: true });
  }

  const multiplier = custom_multiplier ? parseFloat(custom_multiplier) : (PACING_MULTIPLIERS[pacing_preset] || 0.50);
  const targetImageCount = Math.round((parseFloat(voiceover_duration) || 0) * multiplier);
  const now = new Date().toISOString();

  // Character Reference setup
  let charRefId = `char_${Date.now()}`;
  let charImagePath = '';
  if (character_image_buffer) {
    const charDir = path.join(projDir, 'characters', sanitizeFolderName(character_name));
    fs.mkdirSync(charDir, { recursive: true });
    charImagePath = path.join(charDir, character_image_name);
    fs.writeFileSync(charImagePath, character_image_buffer);
  }

  // Insert project with all canonical parameters
  await db.run(`
    INSERT INTO projects (
      id, name, directory_path, status, mode, voiceover_path, voiceover_duration,
      pacing_preset, pacing_multiplier, target_image_count, script_text,
      character_id, music_path, music_volume, master_prompt, created_at, updated_at
    ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    projId, name, projDir, mode, voiceover_path || null, parseFloat(voiceover_duration) || 0,
    pacing_preset || '2/4s', multiplier, targetImageCount, script_text || '',
    charRefId, music_path || null, music_volume !== undefined ? parseFloat(music_volume) : 0.07,
    master_prompt || null, now, now
  ]);

  if (charImagePath || character_description) {
    await db.run(`
      INSERT INTO character_references (
        id, project_id, character_name, image_path, version, status, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 'READY', ?, ?, ?)
    `, [charRefId, projId, character_name, charImagePath || '', character_description || '', now, now]);
  }

  // If raw_prompts is provided (Mode 2), immediately parse and import
  if (raw_prompts && (typeof raw_prompts === 'string' || Array.isArray(raw_prompts))) {
    try {
      await parseAndImportPrompts(projId, raw_prompts);
    } catch (impErr) {
      logger.warn('PROJECT_MANAGER', `Auto-importing raw_prompts during project creation: ${impErr.message}`);
    }
  }

  // Save project.json on disk
  const projectJson = {
    id: projId,
    name,
    directory_path: projDir,
    mode,
    voiceover_duration,
    pacing_preset,
    pacing_multiplier: multiplier,
    target_image_count: targetImageCount,
    created_at: now
  };
  fs.writeFileSync(path.join(projDir, 'project.json'), JSON.stringify(projectJson, null, 2), 'utf8');

  logger.info('PROJECT_MANAGER', `Created project ${name} (${projId}) at ${projDir}`);
  return getProject(projId);
}

// Mode 2 Clean Prompt List Parser
async function parseAndImportPrompts(projectId, rawPromptText, qaMetadataMap = {}) {
  const project = await db.get(`SELECT * FROM projects WHERE id = ?`, [projectId]);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Split into lines or prompt blocks (support array or raw string)
  const lines = Array.isArray(rawPromptText) 
    ? rawPromptText.map(l => String(l).trim()).filter(Boolean)
    : String(rawPromptText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const promptEntries = [];
  const seenIndexes = new Set();
  const errors = [];

  for (const line of lines) {
    // Expected format: 001_prompt text... OR 001 prompt text...
    const match = line.match(/^(\d{3,4})[_\s]+(.+)$/);
    if (!match) {
      // Check if it's metadata to reject
      if (/^(IMAGE|TIMESTAMP|SCENE|PROMPT|NOTE|VISUAL)/i.test(line)) {
        errors.push(`Header/metadata detected in prompt input: "${line.slice(0, 40)}...". Target clean sequential prompts only.`);
      } else {
        errors.push(`Malformed prompt line (must start with numeric ID e.g. 001_...): "${line.slice(0, 40)}..."`);
      }
      continue;
    }

    const indexNum = parseInt(match[1], 10);
    const idStr = match[1].padStart(3, '0');
    const promptText = match[2].trim();

    if (seenIndexes.has(indexNum)) {
      errors.push(`Duplicate prompt ID detected: ${idStr}`);
      continue;
    }

    seenIndexes.add(indexNum);
    promptEntries.push({
      index: indexNum,
      idStr,
      text: promptText,
      fullLine: `${idStr}_${promptText}`
    });
  }

  // Sort sequentially
  promptEntries.sort((a, b) => a.index - b.index);

  // Check continuity
  const missingIds = [];
  if (promptEntries.length > 0) {
    const minIdx = promptEntries[0].index;
    const maxIdx = promptEntries[promptEntries.length - 1].index;
    for (let i = minIdx; i <= maxIdx; i++) {
      if (!seenIndexes.has(i)) {
        missingIds.push(String(i).padStart(3, '0'));
      }
    }
  }

  if (missingIds.length > 0) {
    errors.push(`Gap in prompt numbering! Missing prompt IDs: ${missingIds.slice(0, 10).join(', ')}${missingIds.length > 10 ? '...' : ''}`);
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      parsed_count: promptEntries.length
    };
  }

  // Insert into DB
  const now = new Date().toISOString();
  await db.exec('BEGIN TRANSACTION;');
  try {
    for (const p of promptEntries) {
      const promptPk = `prompt_${projectId}_${p.idStr}`;
      const qa = qaMetadataMap[p.idStr] || {};
      await db.run(`
        INSERT INTO prompts (
          id, project_id, prompt_index, prompt_id_str, prompt_text,
          status, source_span, scene_desc, characters, objects, location,
          qa_verdict, qa_details, provider, model, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, prompt_index) DO UPDATE SET
          id = excluded.id,
          prompt_text = excluded.prompt_text,
          prompt_id_str = excluded.prompt_id_str,
          status = 'QUEUED',
          file_path = NULL,
          file_name = NULL,
          file_size = 0,
          sha256 = NULL,
          assigned_worker_id = NULL,
          source_span = excluded.source_span,
          scene_desc = excluded.scene_desc,
          characters = excluded.characters,
          objects = excluded.objects,
          location = excluded.location,
          qa_verdict = excluded.qa_verdict,
          qa_details = excluded.qa_details,
          provider = excluded.provider,
          model = excluded.model,
          updated_at = excluded.updated_at
      `, [
        promptPk, projectId, p.index, p.idStr, p.fullLine,
        qa.source_span || null,
        qa.scene_desc || null,
        qa.characters || null,
        qa.objects || null,
        qa.location || null,
        qa.qa_verdict || 'PASS',
        qa.qa_details || null,
        qa.provider || null,
        qa.model || null,
        now, now
      ]);
    }

    // Prune excess prompts if previous count was higher than new imported count
    const maxIndex = Math.max(...promptEntries.map(p => p.index));
    await db.run(`DELETE FROM prompts WHERE project_id = ? AND prompt_index > ?`, [projectId, maxIndex]);

    // Update target count in project
    await db.run(`UPDATE projects SET target_image_count = ?, updated_at = ? WHERE id = ?`, [promptEntries.length, now, projectId]);
    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }

  // Save source.md in project prompts/
  const promptsDir = path.join(project.directory_path, 'prompts');
  fs.writeFileSync(path.join(promptsDir, 'source.md'), rawPromptText, 'utf8');

  logger.info('PROJECT_MANAGER', `Successfully imported ${promptEntries.length} validated prompts for project ${project.name}`);
  return {
    success: true,
    count: promptEntries.length,
    first_id: promptEntries[0]?.idStr,
    last_id: promptEntries[promptEntries.length - 1]?.idStr
  };
}

module.exports = {
  PROJECTS_ROOT,
  listProjects,
  getProject,
  createProject,
  parseAndImportPrompts
};
