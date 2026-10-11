const fs = require('fs');
const path = require('path');
const db = require('./db');
const logger = require('./logger');

const ROOT_DIR = process.env.STICKMAN_ROOT || path.resolve(__dirname, '../../');
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || path.join(ROOT_DIR, 'Projects');
if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
}

const PACING_MULTIPLIERS = {
  '1/4s': 0.25,
  '2/4s': 0.50,
  '3/4s': 0.75,
  '4/4s': 1.00,
  '5/4s': 1.25,
  'Random': 0.50,
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


function cleanPromptText(raw) {
  let str = String(raw || '').trim();
  // Strip leading numbering or labels: 001_, 1., Scene 1:, Prompt 1:, [Prompt 1], etc.
  str = str.replace(/^(?:(?:scene|prompt|image|panel|shot|frame)?\s*\[?#?(\d+)\]?[\s_.:\-)\]]+)/i, '').trim();
  // Strip outer quotes, markdown asterisks or bullet dashes
  str = str.replace(/^[\"\'\*\-•\s]+|[\"\'\s]+$/g, '').trim();
  return str;
}

function smartUniversalPromptExtractor(rawInput) {
  if (!rawInput) return [];
  if (Array.isArray(rawInput)) {
    return rawInput.map(x => cleanPromptText(x)).filter(Boolean);
  }

  const text = String(rawInput || '').trim();
  if (!text) return [];

  // Strategy 1: JSON Array or Object
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const results = [];
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) {
            results.push(cleanPromptText(item));
          } else if (item && typeof item === 'object') {
            const val = item.prompt || item.text || item.prompt_text || item.fullLine || item.description;
            if (val) results.push(cleanPromptText(String(val)));
          }
        }
        if (results.length > 0) return results;
      } else if (parsed && typeof parsed === 'object') {
        const arr = parsed.prompts || parsed.data || parsed.images || parsed.items;
        if (Array.isArray(arr)) {
          return smartUniversalPromptExtractor(JSON.stringify(arr));
        }
      }
    } catch (e) {}
  }

  // Strategy 2: Explicit Structured Prompt Pack (Style 2: **PROMPT 001**, ### Prompt 1, Image 001:, etc.)
  const promptMarkerPattern = /(?:^|\n)[#*_\s]*\b(?:PROMPT|IMAGE|SCENE|PANEL|FRAME)\s*#?\[?(\d+)\]?[*_\s]*[:\-—]?\s*\n+/i;
  const parts = text.split(promptMarkerPattern);
  if (parts.length >= 3) {
    const extracted = [];
    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i], 10);
      let body = (parts[i + 1] || '').trim();
      body = body.split(/\n+(?:###|\*\*Visual Group|\#\#)/i)[0].trim();
      body = cleanPromptText(body);
      if (body && body.length > 5) {
        extracted.push({ num, body });
      }
    }
    if (extracted.length > 0) {
      extracted.sort((a, b) => a.num - b.num);
      return extracted.map(e => e.body);
    }
  }

  function isDocumentMeta(str) {
    const s = str.trim();
    if (!s) return true;
    if (/^[-=_*~]{3,}$/.test(s)) return true;
    if (/^(?:#+\s*|\*\*)\s*(?:Stickman|YouTube|Production Specifications|Specification|Character & Visual Consistency|Consistency Rules|Visual Group|\d+\s*Image Prompts)/i.test(s)) return true;
    if (/^-\s*(?:Voiceover duration|Pacing|Total required|Image duration|Structure|Same core|Keep line|Ancient|No photorealistic|Every frame|Prefer clear)/i.test(s)) return true;
    return false;
  }

  // Strategy 3: Paragraph-separated blocks
  const paragraphs = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    const validParagraphs = [];
    for (const p of paragraphs) {
      if (isDocumentMeta(p)) continue;
      const clean = cleanPromptText(p);
      if (clean && clean.length > 15) {
        validParagraphs.push(clean);
      }
    }
    if (validParagraphs.length >= 2) {
      return validParagraphs;
    }
  }

  // Strategy 4: Line by line
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const validLines = [];
  for (const line of lines) {
    if (isDocumentMeta(line)) continue;
    const clean = cleanPromptText(line);
    if (clean && clean.length > 5) {
      validLines.push(clean);
    }
  }
  return validLines;
}

// Mode 2 Clean Prompt List Parser (Universal 10-Style Extractor & Auto-Prefixer)
async function parseAndImportPrompts(projectId, rawPromptText, qaMetadataMap = {}) {
  const project = await db.get(`SELECT * FROM projects WHERE id = ?`, [projectId]);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const extractedStrings = smartUniversalPromptExtractor(rawPromptText);
  const promptEntries = [];

  for (let i = 0; i < extractedStrings.length; i++) {
    const indexNum = i + 1;
    const idStr = String(indexNum).padStart(3, '0');
    const promptText = extractedStrings[i];
    const fullLine = `${idStr}_${promptText}`;

    promptEntries.push({
      index: indexNum,
      idStr,
      text: promptText,
      fullLine
    });
  }

  if (promptEntries.length === 0) {
    return {
      success: false,
      errors: ['No valid prompt lines detected in input. Please paste prompt text.'],
      count: 0
    };
  }

  // Insert into DB
  const now = new Date().toISOString();
  await db.exec('BEGIN TRANSACTION;');
  try {
    await db.run('DELETE FROM prompts WHERE project_id = ?', [projectId]);

    for (const p of promptEntries) {
      const promptPk = `prompt_${projectId}_${p.idStr}`;
      const qa = qaMetadataMap[p.idStr] || {};
      await db.run(`
        INSERT INTO prompts (
          id, project_id, prompt_index, prompt_id_str, prompt_text,
          status, source_span, scene_desc, characters, objects, location,
          qa_verdict, qa_details, provider, model, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    await db.run(`UPDATE projects SET target_image_count = ?, updated_at = ? WHERE id = ?`, [promptEntries.length, now, projectId]);
    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }

  const promptsDir = path.join(project.directory_path, 'prompts');
  if (fs.existsSync(promptsDir)) {
    fs.writeFileSync(path.join(promptsDir, 'source.md'), String(rawPromptText || ''), 'utf8');
  }
  logger.info('PROJECT_MANAGER', `Successfully imported ${promptEntries.length} smart-indexed prompts for project ${project.name}`);
  return {
    success: true,
    count: promptEntries.length,
    prompts: promptEntries
  };
}

async function deleteProject(projectId, purgeFiles = false) {
  const project = await db.get(`SELECT * FROM projects WHERE id = ?`, [projectId]);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const now = new Date().toISOString();
  await db.run(`UPDATE projects SET status = 'DELETED', updated_at = ? WHERE id = ?`, [now, projectId]);
  await db.run(`DELETE FROM prompts WHERE project_id = ?`, [projectId]);
  await db.run(`DELETE FROM jobs WHERE project_id = ?`, [projectId]);
  await db.run(`DELETE FROM captions WHERE project_id = ?`, [projectId]);

  if (purgeFiles && project.directory_path && fs.existsSync(project.directory_path)) {
    try {
      fs.rmSync(project.directory_path, { recursive: true, force: true });
      logger.info('PROJECT_MANAGER', `Purged project folder from disk: ${project.directory_path}`);
    } catch (e) {
      logger.warn('PROJECT_MANAGER', `Could not purge project folder: ${e.message}`);
    }
  }

  logger.info('PROJECT_MANAGER', `Deleted project ${project.name} (${projectId})`);
  return { success: true, id: projectId, name: project.name };
}

module.exports = {
  deleteProject,
  PROJECTS_ROOT,
  listProjects,
  getProject,
  createProject,
  parseAndImportPrompts
};
