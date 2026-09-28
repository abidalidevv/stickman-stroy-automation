const fs = require('fs');
const path = require('path');
const pPath = 'E:/stickman-video-automation/studio/server/project_manager.js';
let content = fs.readFileSync(pPath, 'utf8');

const targetFunc = `async function createProject({
  name,
  mode = 'MODE_2',
  voiceover_duration = 0,
  pacing_preset = '2/4s',
  custom_multiplier = null,
  script_text = '',
  character_name = 'Main Stickman',
  character_image_buffer = null,
  character_image_name = 'reference.png'
}) {`;

const replacementFunc = `async function createProject({
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
}) {`;

if (!content.includes(targetFunc)) {
  console.error('Target function signature not found!');
  process.exit(1);
}
content = content.replace(targetFunc, replacementFunc);

const targetInsert = `  // Insert project
  await db.run(\`
    INSERT INTO projects (
      id, name, directory_path, status, mode, voiceover_duration,
      pacing_preset, pacing_multiplier, target_image_count, script_text,
      character_id, created_at, updated_at
    ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`, [
    projId, name, projDir, mode, voiceover_duration,
    pacing_preset, multiplier, targetImageCount, script_text,
    charRefId, now, now
  ]);

  if (charImagePath) {
    await db.run(\`
      INSERT INTO character_references (
        id, project_id, character_name, image_path, version, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 'READY', ?, ?)
    \`, [charRefId, projId, character_name, charImagePath, now, now]);
  }`;

const replacementInsert = `  // Insert project with all canonical parameters
  await db.run(\`
    INSERT INTO projects (
      id, name, directory_path, status, mode, voiceover_path, voiceover_duration,
      pacing_preset, pacing_multiplier, target_image_count, script_text,
      character_id, music_path, music_volume, master_prompt, created_at, updated_at
    ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`, [
    projId, name, projDir, mode, voiceover_path || null, parseFloat(voiceover_duration) || 0,
    pacing_preset || '2/4s', multiplier, targetImageCount, script_text || '',
    charRefId, music_path || null, music_volume !== undefined ? parseFloat(music_volume) : 0.07,
    master_prompt || null, now, now
  ]);

  if (charImagePath || character_description) {
    await db.run(\`
      INSERT INTO character_references (
        id, project_id, character_name, image_path, version, status, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 'READY', ?, ?, ?)
    \`, [charRefId, projId, character_name, charImagePath || '', character_description || '', now, now]);
  }

  // If raw_prompts is provided (Mode 2), immediately parse and import
  if (raw_prompts && (typeof raw_prompts === 'string' || Array.isArray(raw_prompts))) {
    try {
      await parseAndImportPrompts(projId, raw_prompts);
    } catch (impErr) {
      logger.warn('PROJECT_MANAGER', \`Auto-importing raw_prompts during project creation: \${impErr.message}\`);
    }
  }`;

if (!content.includes(targetInsert)) {
  console.error('Target insert block not found!');
  process.exit(1);
}
content = content.replace(targetInsert, replacementInsert);

fs.writeFileSync(pPath, content, 'utf8');
console.log('Successfully updated project_manager.js');
