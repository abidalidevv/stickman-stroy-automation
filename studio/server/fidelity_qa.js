/**
 * STICKMAN STUDIO — FIDELITY QA ENGINE
 * Enforces strict 3-tier QA:
 * A. Deterministic Rule Checks (count, sequencing, photorealism, in-image text, style tokens)
 * B. Source Tracing (records script span, scene, character, objects, location per prompt)
 * C. Semantic / LLM Judge (flags invented symbols, floating abstract nouns, unsupported props)
 */

const logger = require('./logger');

const FORBIDDEN_PHOTOREALISM_TERMS = [
  'photo', 'photograph', 'photorealistic', 'realistic', 'cinematic',
  'live-action', '3d', 'rendered', 'octane', 'hyperrealistic', 'dslr',
  'unreal engine', 'cgi', 'bokeh', 'shading', 'textured skin', 'depth of field'
];

const FORBIDDEN_TEXT_PATTERNS = [
  'labeled', 'labelled', 'speech bubble', 'text that says', 'sign that says',
  'words say', 'subtitles', 'watermark', 'words written', 'captioned'
];

// Well-known bad abstract inventions from earlier benchmark to catch deterministically
const SUSPICIOUS_SYMBOLIC_INVENTIONS = [
  'cube of knowledge', 'dotted cage', 'handshake symbolism', 'floating orb of wisdom',
  'glowing orb of awareness', 'physical metaphor of ignorance', 'cube of'
];

class FidelityQA {
  /**
   * Tier A: Deterministic Rule Checks
   */
  validateDeterministic(prompts, targetCount = null) {
    const issues = [];
    const promptCount = prompts.length;

    if (targetCount !== null && promptCount !== targetCount) {
      issues.push({
        type: 'COUNT_MISMATCH',
        message: `Expected ${targetCount} prompts but got ${promptCount}`
      });
    }

    const seenIds = new Set();
    const evaluatedPrompts = [];

    prompts.forEach((p, idx) => {
      const expectedIndex = idx + 1;
      const expectedIdStr = String(expectedIndex).padStart(3, '0');
      const text = p.prompt_text || p.prompt || '';
      const promptIssues = [];

      // Check ID sequence
      const numMatch = text.match(/^(\d{3})_/);
      const actualIdStr = numMatch ? numMatch[1] : (p.id_str || String(p.index || expectedIndex).padStart(3, '0'));

      if (actualIdStr !== expectedIdStr) {
        promptIssues.push(`Non-sequential ID: expected ${expectedIdStr}, got ${actualIdStr}`);
      }

      if (seenIds.has(actualIdStr)) {
        promptIssues.push(`Duplicate ID detected: ${actualIdStr}`);
      }
      seenIds.add(actualIdStr);

      if (!text || text.trim().length < 20) {
        promptIssues.push('Empty or truncated prompt text (<20 characters)');
      }

      const lowerText = text.toLowerCase();

      // Photorealism check
      for (const term of FORBIDDEN_PHOTOREALISM_TERMS) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(lowerText)) {
          promptIssues.push(`Forbidden photorealism token: "${term}"`);
        }
      }

      // In-image text & label check
      for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
        if (lowerText.includes(pattern)) {
          promptIssues.push(`Forbidden in-image text/label pattern: "${pattern}"`);
        }
      }

      // Check for quoted capitalized abstract label words (e.g. "Knowledge", "Ignorance")
      const quoteMatches = text.match(/"([A-Z][a-zA-Z\\s]{2,20})"/g);
      if (quoteMatches) {
        promptIssues.push(`Forbidden quoted in-image text label: ${quoteMatches.join(', ')}`);
      }

      // Suspicious symbolic props check
      for (const sym of SUSPICIOUS_SYMBOLIC_INVENTIONS) {
        if (lowerText.includes(sym)) {
          promptIssues.push(`Suspicious unsupported symbolic invention: "${sym}"`);
        }
      }

      // Required style token checks
      const hasStickman = lowerText.includes('stickman') || lowerText.includes('stick figure');
      const has2D = lowerText.includes('2d');
      const hasWhiteBg = lowerText.includes('white background') || lowerText.includes('white paper');

      if (!hasStickman) promptIssues.push('Missing required stickman token');
      if (!has2D) promptIssues.push('Missing required 2D style token');
      if (!hasWhiteBg) promptIssues.push('Missing pure white background token');

      const verdict = promptIssues.length === 0 ? 'PASS' : 'FLAGGED';

      evaluatedPrompts.push({
        index: expectedIndex,
        id_str: expectedIdStr,
        prompt_text: text,
        verdict,
        issues: promptIssues
      });
    });

    const totalIssues = evaluatedPrompts.reduce((sum, p) => sum + p.issues.length, 0);

    return {
      pass: issues.length === 0 && totalIssues === 0,
      global_issues: issues,
      prompts: evaluatedPrompts,
      flagged_count: evaluatedPrompts.filter(p => p.verdict === 'FLAGGED').length
    };
  }

  /**
   * Tier B: Source Tracing
   * Associates each prompt with the corresponding sentence or beat from the voiceover script.
   */
  buildSourceTrace(prompts, scriptText, provider = 'groq', model = 'openai/gpt-oss-120b') {
    const sentences = scriptText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    const totalSentences = sentences.length;
    const totalPrompts = prompts.length;

    return prompts.map((p, idx) => {
      const sentenceIdx = Math.min(
        Math.floor((idx / totalPrompts) * totalSentences),
        totalSentences - 1
      );
      const sourceSpan = sentences[sentenceIdx] || scriptText.slice(0, 100);

      const text = p.prompt_text || '';
      const charMatch = text.match(/\b(Alex|Bob|hero|narrator|guide|worker|man|stickman)\b/i);
      const character = charMatch ? charMatch[0] : 'Alex (Stickman)';

      const objMatches = text.match(/\b(desk|laptop|computer|monitor|screen|phone|briefcase|chart|graph|arrow|clock|door|window|bed|code|key)\b/gi);
      const objects = objMatches ? [...new Set(objMatches.map(o => o.toLowerCase()))].join(', ') : 'none';

      const locMatches = text.match(/\b(bedroom|office|room|doorway|canvas|crossroads|space|hallway|desk)\b/gi);
      const location = locMatches ? locMatches[0] : 'minimalist canvas';

      return {
        prompt_index: idx + 1,
        prompt_id_str: String(idx + 1).padStart(3, '0'),
        clean_prompt_text: text,
        source_span: sourceSpan,
        scene_desc: p.visual_beat || `Scene ${idx + 1}`,
        characters: character,
        objects: objects,
        location: location,
        provider,
        model,
        qa_verdict: p.verdict || 'PASS',
        qa_details: JSON.stringify(p.issues || [])
      };
    });
  }

  /**
   * Tier C: Semantic / LLM QA Judge
   */
  async evaluateSemanticJudge(promptTraceItem, groqClient = null, model = 'openai/gpt-oss-120b') {
    const { prompt_id_str, clean_prompt_text, source_span, objects } = promptTraceItem;

    if (groqClient) {
      try {
        const judgePrompt = `You are a Strict Story Fidelity QA Auditor for an animated stickman series.
Check if the generated visual prompt accurately depicts the source narration without inventing unsupported characters, foreign symbolic objects, or ungrounded locations.

SOURCE SCRIPT SPAN:
"${source_span}"

GENERATED VISUAL PROMPT:
"${clean_prompt_text}"

DETECTION LAWS:
1. SUPPORTED: Does the visual prompt illustrate actions, people, or concepts grounded in the script span?
2. NO SYMBOLIC GOBBLEDYGOOK: Abstract concepts (e.g. "time", "wealth", "knowledge") must NOT be turned into bizarre invented props (e.g., "cube of knowledge", "dotted cage of fear") unless the script literally asked for them.
3. NO INVENTED CHARACTERS: Only the protagonist or figures named in the script may appear.
4. NO IN-IMAGE TEXT: Quoted signs or labels in the prompt are strictly forbidden.

Output pure JSON:
{
  "supported": true,
  "invented_characters": [],
  "invented_objects": [],
  "invented_actions": [],
  "invented_locations": [],
  "invented_facts": [],
  "reason": "Brief explanation of fidelity verdict"
}`;
        const res = await groqClient.chat.completions.create({
          model,
          messages: [{ role: 'user', content: judgePrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024
        });

        const parsed = JSON.parse(res.choices[0].message.content);
        const hasInventions = (parsed.invented_characters?.length || 0) > 0 ||
                              (parsed.invented_objects?.length || 0) > 0 ||
                              (parsed.invented_actions?.length || 0) > 0 ||
                              (parsed.invented_locations?.length || 0) > 0 ||
                              (parsed.invented_facts?.length || 0) > 0 ||
                              !parsed.supported;

        return {
          prompt_id: prompt_id_str,
          supported: !hasInventions,
          invented: [
            ...(parsed.invented_characters || []),
            ...(parsed.invented_objects || []),
            ...(parsed.invented_actions || []),
            ...(parsed.invented_locations || []),
            ...(parsed.invented_facts || [])
          ],
          reason: parsed.reason || 'Verified by Groq semantic judge'
        };
      } catch (err) {
        logger.warn('FIDELITY_QA', `Semantic LLM judge call failed: ${err.message}. Using deterministic heuristic.`);
      }
    }

    // Deterministic semantic check for known unsupported symbols
    const lowerPrompt = clean_prompt_text.toLowerCase();
    const lowerSource = source_span.toLowerCase();
    const invented = [];

    for (const sym of SUSPICIOUS_SYMBOLIC_INVENTIONS) {
      if (lowerPrompt.includes(sym) && !lowerSource.includes(sym)) {
        invented.push(`Unsupported symbolic invention: "${sym}"`);
      }
    }

    const allowedGenericProps = ['pen', 'paper', 'line', 'arrow', 'bed', 'chair', 'desk'];
    if (objects && objects !== 'none') {
      const objList = objects.split(', ');
      for (const obj of objList) {
        if (!lowerSource.includes(obj) && !allowedGenericProps.includes(obj)) {
          if (['cage', 'cube', 'dragon', 'car', 'gun', 'sword', 'castle'].includes(obj)) {
            invented.push(`Foreign object: "${obj}"`);
          }
        }
      }
    }

    return {
      prompt_id: prompt_id_str,
      supported: invented.length === 0,
      invented,
      reason: invented.length === 0 ? 'Consistent with source script span' : `Found ungrounded elements: ${invented.join('; ')}`
    };
  }
}

module.exports = new FidelityQA();
