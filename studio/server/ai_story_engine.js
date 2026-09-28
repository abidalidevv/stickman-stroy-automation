/**
 * STICKMAN STUDIO — MODE 1 AI STORY & PROMPT GENERATION ENGINE
 * 
 * Primary AI Provider: Groq (openai/gpt-oss-120b)
 * Local Emergency Fallback: Ollama
 * Canonical Runtime Master Prompt: master_prompt.md
 * 
 * Strict Fallback Order:
 * 1. Groq (Primary)
 * 2. Ollama (Fallback)
 * 3. Hard Error
 * 
 * Synthetic generation is NEVER a production fallback.
 * It is only accessible when explicitly enabled via SYNTHETIC_TEST_MODE=true.
 */

const fs = require('fs');
const path = require('path');
const { Groq } = require('groq-sdk');
const db = require('./db');
const logger = require('./logger');
const projectManager = require('./project_manager');
const fidelityQA = require('./fidelity_qa');

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const CANONICAL_MASTER_PROMPT_PATH = path.resolve(__dirname, '../../master_prompt.md');

const PACING_MULTIPLIERS = {
  '1/4s': 0.25, // 1 image per 4 seconds
  '2/4s': 0.50, // 2 images per 4 seconds (1 per 2s, default)
  '3/4s': 0.75, // 3 images per 4 seconds
  '4/4s': 1.00, // 4 images per 4 seconds (1 per 1s)
  '5/4s': 1.25, // 5 images per 4 seconds
  'Custom': 0.50
};

class AIStoryEngine {
  /**
   * Load canonical Master Prompt from master_prompt.md
   */
  getCanonicalMasterPrompt() {
    if (fs.existsSync(CANONICAL_MASTER_PROMPT_PATH)) {
      return fs.readFileSync(CANONICAL_MASTER_PROMPT_PATH, 'utf8');
    }
    // Fallback search in parent directory
    const altPath = path.resolve(__dirname, '../master_prompt.md');
    if (fs.existsSync(altPath)) {
      return fs.readFileSync(altPath, 'utf8');
    }
    logger.warn('AI_ENGINE', `Canonical master_prompt.md not found at ${CANONICAL_MASTER_PROMPT_PATH}`);
    return '';
  }

  async getApiKey() {
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      return process.env.GROQ_API_KEY.trim();
    }
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^GROQ_API_KEY=(.+)$/m);
      if (match && match[1].trim()) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    const row = await db.get("SELECT value FROM settings WHERE key = 'groq_api_key'");
    if (row && row.value && row.value.trim()) {
      return row.value.trim();
    }
    return null;
  }

  async getSelectedModel() {
    const row = await db.get("SELECT value FROM settings WHERE key = 'groq_primary_model'");
    return row && row.value ? row.value : DEFAULT_GROQ_MODEL;
  }

  calculateTargetPromptCount(voiceoverSeconds, pacingPreset = '2/4s', customCount = null) {
    if (customCount && customCount > 0) return customCount;
    const multiplier = PACING_MULTIPLIERS[pacingPreset] || 0.50;
    return Math.max(1, Math.round(voiceoverSeconds * multiplier));
  }

  /**
   * Primary Generation using Groq (openai/gpt-oss-120b)
   */
  async generateWithGroq({
    scriptText,
    targetCount,
    modelName,
    videoTitle = null,
    masterPrompt = null,
    characterReference = null,
    visualElements = null
  }) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Groq API Key not configured in environment or settings.');
    }

    const groq = new Groq({ apiKey });

    // Use user-supplied master prompt if present, otherwise load canonical master_prompt.md
    let systemInstruction = (masterPrompt && masterPrompt.trim()) ? masterPrompt.trim() : this.getCanonicalMasterPrompt();
    if (!systemInstruction) {
      systemInstruction = 'You are the Lead Visual Director for Stickman Studio. Output 2D stickman sketch prompts as pure JSON.';
    }

    let userPrompt = '';
    if (videoTitle && videoTitle.trim()) {
      userPrompt += `VIDEO TITLE:\n"${videoTitle.trim()}"\n\n`;
    }
    if (characterReference && characterReference.trim()) {
      userPrompt += `CHARACTER REFERENCE / PROTAGONIST:\n"${characterReference.trim()}"\n\n`;
    }
    if (visualElements && visualElements.trim()) {
      userPrompt += `RECURRING VISUAL ELEMENTS / MOTIFS:\n"${visualElements.trim()}"\n\n`;
    }

    userPrompt += `VOICEOVER SCRIPT:
"""
${scriptText}
"""

TARGET IMAGE COUNT: Exactly ${targetCount} prompts.
Pacing: Generate precisely ${targetCount} sequential prompts numbered from 001 to ${String(targetCount).padStart(3, '0')}.
Ensure each prompt begins with its 3-digit prefix (e.g., "001_...", "002_...").
Translate all script narration into visual stickman scenes adhering strictly to the visual laws in the Master Prompt.
Output pure JSON with the keys:
{
  "story_bible": {
    "protagonist": "Description",
    "setting": "Description",
    "recurring_elements": []
  },
  "prompts": [
    {
      "index": 1,
      "id_str": "001",
      "prompt_text": "001_2D minimalist hand-drawn stickman sketch, ...",
      "visual_beat": "Beat description",
      "character_action": "Action description"
    }
  ]
}`;

    logger.info('AI_ENGINE', `Calling Groq (${modelName}) for ${targetCount} prompts...`);

    const response = await groq.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      max_tokens: 16384,
      temperature: 0.2
    });

    const rawContent = response.choices[0].message.content;
    const parsed = JSON.parse(rawContent);

    if (!parsed.prompts || !Array.isArray(parsed.prompts)) {
      throw new Error('Groq response did not contain a valid prompts array');
    }

    return parsed;
  }

  /**
   * Local Emergency Fallback using Ollama
   */
  async generateWithOllama(scriptText, targetCount) {
    logger.warn('AI_ENGINE', `Attempting local Ollama fallback on ${OLLAMA_HOST}...`);

    const canonicalPrompt = this.getCanonicalMasterPrompt();
    const promptPayload = `
${canonicalPrompt}

Script:
"""
${scriptText}
"""
Generate exactly ${targetCount} sequential stickman prompts (001 to ${String(targetCount).padStart(3, '0')}) as JSON.
`;

    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3:latest',
        prompt: promptPayload,
        format: 'json',
        stream: false
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama fallback failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.response);
    return parsed;
  }

  /**
   * Master Workflow: Mode 1 Script to Prompt Generation
   */
  async generateScriptPrompts(projectId, {
    scriptText,
    voiceoverSeconds = 60,
    pacingPreset = '2/4s',
    customCount = null,
    videoTitle = null,
    masterPrompt = null,
    characterReference = null,
    visualElements = null,
    optionalMusic = null,
    requireRealGroq = false
  }) {
    if (!scriptText || !scriptText.trim()) {
      throw new Error('Voiceover script cannot be empty');
    }

    const targetCount = this.calculateTargetPromptCount(voiceoverSeconds, pacingPreset, customCount);
    const modelName = await this.getSelectedModel();

    logger.info('AI_ENGINE', `Starting Mode 1 Generation for project ${projectId}: Target Count ${targetCount}, Model: ${modelName}, requireRealGroq: ${requireRealGroq}`);

    let generationResult = null;
    let providerUsed = 'groq';

    try {
      generationResult = await this.generateWithGroq({
        scriptText,
        targetCount,
        modelName,
        videoTitle,
        masterPrompt,
        characterReference,
        visualElements
      });
    } catch (err) {
      if (requireRealGroq) {
        throw new Error(`Real Groq generation failed: ${err.message}. Synthetic fallback is prohibited.`);
      }
      logger.error('AI_ENGINE', `Primary Groq generation failed: ${err.message}. Attempting Ollama fallback.`);
      try {
        generationResult = await this.generateWithOllama(scriptText, targetCount);
        providerUsed = 'ollama_fallback';
      } catch (fallbackErr) {
        // Fallback rule 2.6: Synthetic generation is NEVER a production fallback.
        // It is only allowed when explicitly enabled via SYNTHETIC_TEST_MODE=true.
        if (process.env.SYNTHETIC_TEST_MODE === 'true') {
          logger.warn('AI_ENGINE', 'SYNTHETIC_TEST_MODE=true is active. Using synthetic deterministic fallback.');
          generationResult = this.generateSyntheticStickmanPrompts(scriptText, targetCount);
          providerUsed = 'SYNTHETIC — NOT AI';
        } else {
          throw new Error(`AI Prompt Generation Failed: Groq failed (${err.message}) and Ollama fallback failed (${fallbackErr.message}). Synthetic fallback is disabled in production.`);
        }
      }
    }

    // --- FIDELITY QA PASS ---
    const qaResult = fidelityQA.validateDeterministic(generationResult.prompts, targetCount);
    const sourceTraces = fidelityQA.buildSourceTrace(generationResult.prompts, scriptText, providerUsed, modelName);
    const qaMap = {};
    sourceTraces.forEach(t => { qaMap[t.prompt_id_str] = t; });

    // Persist Project Metadata
    const updates = [];
    const params = [];
    if (videoTitle) { updates.push('name = ?'); params.push(videoTitle); }
    if (scriptText) { updates.push('script_text = ?'); params.push(scriptText); }
    if (voiceoverSeconds) { updates.push('voiceover_duration = ?'); params.push(voiceoverSeconds); }
    if (pacingPreset) { updates.push('pacing_preset = ?'); params.push(pacingPreset); }
    if (targetCount) { updates.push('target_image_count = ?'); params.push(targetCount); }
    if (masterPrompt) { updates.push('master_prompt = ?'); params.push(masterPrompt); }
    if (optionalMusic) { updates.push('music_path = ?'); params.push(optionalMusic); }
    updates.push("updated_at = datetime('now')");
    params.push(projectId);

    await db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);

    // Story Bible Persistence
    if (generationResult.story_bible) {
      const bibleJson = JSON.stringify(generationResult.story_bible);
      const existingRef = await db.get('SELECT * FROM character_references WHERE project_id = ?', [projectId]);
      if (existingRef) {
        await db.run(`
          UPDATE character_references SET bible_json = ?, updated_at = datetime('now') WHERE id = ?
        `, [bibleJson, existingRef.id]);
      } else if (characterReference) {
        const refId = `char_${Date.now()}`;
        await db.run(`
          INSERT INTO character_references (id, project_id, character_name, image_path, version, status, description, bible_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, 'READY', ?, ?, datetime('now'), datetime('now'))
        `, [refId, projectId, characterReference.slice(0, 50), 'default.png', characterReference, bibleJson]);
      }
    }

    // Format prompts into raw text list (clean prompt text only)
    const rawPromptLines = generationResult.prompts.map(p => {
      let text = p.prompt_text || p.prompt || '';
      const numStr = String(p.index || p.id_str).padStart(3, '0');
      if (!text.startsWith(`${numStr}_`)) {
        text = `${numStr}_${text}`;
      }
      return text;
    });

    const rawPromptsText = rawPromptLines.join('\n');

    // Handoff to Mode 2 Pipeline with QA metadata attached
    const importRes = await projectManager.parseAndImportPrompts(projectId, rawPromptsText, qaMap);

    return {
      success: true,
      provider: providerUsed,
      model: modelName,
      target_count: targetCount,
      generated_count: importRes.count,
      story_bible: generationResult.story_bible,
      first_prompt: importRes.first_id,
      last_prompt: importRes.last_id,
      prompts: generationResult.prompts,
      qa_summary: {
        pass: qaResult.pass,
        flagged_count: qaResult.flagged_count,
        issues: qaResult.global_issues
      },
      is_synthetic: providerUsed === 'SYNTHETIC — NOT AI'
    };
  }

  /**
   * Deterministic stickman prompt generator for test harness only (SYNTHETIC_TEST_MODE=true)
   */
  generateSyntheticStickmanPrompts(scriptText, targetCount) {
    const sentences = scriptText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const prompts = [];

    for (let i = 1; i <= targetCount; i++) {
      const num = String(i).padStart(3, '0');
      const action = sentences[(i - 1) % Math.max(1, sentences.length)] || `Action sequence part ${i}`;
      prompts.push({
        index: i,
        id_str: num,
        prompt_text: `${num}_2D minimalist hand-drawn stickman sketch, Alex representing ${action.slice(0, 80)}, clean black ink lines, solid pure white background`,
        visual_beat: `Beat ${i}`
      });
    }

    return {
      story_bible: {
        protagonist: 'Stickman Alex with classic 2D minimalist ink line silhouette',
        setting: 'Blank pure white sketchbook canvas',
        recurring_elements: ['Chalk doorway', 'Arrow charts']
      },
      prompts
    };
  }
}

module.exports = new AIStoryEngine();
