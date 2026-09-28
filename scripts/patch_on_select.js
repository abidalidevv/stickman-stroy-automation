const fs = require('fs');
const p = 'E:/stickman-video-automation/studio/public/app_v2.js';
let js = fs.readFileSync(p, 'utf8');

const targetSelectFunc = `    // Refresh active panel content
    goToStep(currentStep);
  } catch (err) {
    console.error('Error selecting project:', err);
  }
}`;

const replacementSelectFunc = `    // Pre-populate Step 1 & Audio Director inputs from project data
    if (currentProjectData.voiceover_path) {
      const v1 = document.getElementById('m1VoiceoverPath');
      if (v1) v1.value = currentProjectData.voiceover_path;
      const v2 = document.getElementById('m2VoiceoverPath');
      if (v2) v2.value = currentProjectData.voiceover_path;
    }
    if (currentProjectData.voiceover_duration) {
      const d1 = document.getElementById('m1Duration');
      if (d1) d1.value = currentProjectData.voiceover_duration;
      const b1 = document.getElementById('m1DurationBadge');
      if (b1) b1.textContent = currentProjectData.voiceover_duration + 's';
      const d2 = document.getElementById('m2Duration');
      if (d2) d2.value = currentProjectData.voiceover_duration;
      const b2 = document.getElementById('m2DurationBadge');
      if (b2) b2.textContent = currentProjectData.voiceover_duration + 's';
    }
    if (currentProjectData.pacing_preset) {
      const p1 = document.getElementById('m1Pacing');
      if (p1) p1.value = currentProjectData.pacing_preset;
      const p2 = document.getElementById('m2Pacing');
      if (p2) p2.value = currentProjectData.pacing_preset;
    }
    if (currentProjectData.music_path) {
      const mu1 = document.getElementById('m1MusicPath');
      if (mu1) mu1.value = currentProjectData.music_path;
      const mu2 = document.getElementById('m2MusicPath');
      if (mu2) mu2.value = currentProjectData.music_path;
    }
    const volPct = Math.round((currentProjectData.music_volume !== undefined ? currentProjectData.music_volume : 0.07) * 100);
    const mVol = document.getElementById('m1MusicVol');
    if (mVol) mVol.value = volPct;
    const mVolLbl = document.getElementById('m1MusicVolLabel');
    if (mVolLbl) mVolLbl.textContent = volPct + '% (Auto-Ducked)';

    if (currentProjectData.script_text) {
      const sc = document.getElementById('m1ScriptInput');
      if (sc) sc.value = currentProjectData.script_text;
      if (typeof updateM1ScriptWordCount === 'function') updateM1ScriptWordCount();
    }
    if (currentProjectData.name) {
      const vt = document.getElementById('m1VideoTitle');
      if (vt) vt.value = currentProjectData.name;
    }
    if (currentProjectData.character) {
      const cRef = document.getElementById('m1CharacterRef');
      if (cRef) cRef.value = currentProjectData.character.description || '';
      const cName = document.getElementById('m1CharacterName');
      if (cName) cName.value = currentProjectData.character.character_name || 'Main Stickman';
    }
    if (currentProjectData.master_prompt) {
      const mp = document.getElementById('m1MasterPrompt');
      if (mp) mp.value = currentProjectData.master_prompt;
    }

    if (typeof updateM1PromptEstimate === 'function') updateM1PromptEstimate();
    if (typeof loadFleetCalculation === 'function') loadFleetCalculation();

    // Refresh active panel content
    goToStep(currentStep);
  } catch (err) {
    console.error('Error selecting project:', err);
  }
}`;

if (!js.includes(targetSelectFunc)) {
  console.error('Target select func not found in app_v2.js');
  process.exit(1);
}

js = js.replace(targetSelectFunc, replacementSelectFunc);
fs.writeFileSync(p, js, 'utf8');
console.log('Successfully updated onSelectProject in app_v2.js');
