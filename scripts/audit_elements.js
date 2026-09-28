const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');

const requiredElements = [
  'id="newProjectModal"',
  'id="tabNewProjMode1"',
  'id="tabNewProjMode2"',
  'id="newProjName"',
  'id="newProjVoiceoverPath"',
  'id="newProjDuration"',
  'id="newProjPacing"',
  'id="newProjMusicPath"',
  'id="newProjMusicVol"',
  'id="newProjCharName"',
  'id="newProjScript"',
  'id="newProjMasterPrompt"',
  'id="newProjPromptList"',
  'id="newProjScriptM2"',
  'id="step-4-panel"',
  'id="captionsMasterToggle"',
  'capcut_yellow',
  'cyber_cyan',
  'viral_box',
  'neon_purple',
  'clean_cinema',
  'red_impact',
  'id="captionFontSelect"',
  'id="captionFontSizeSlider"',
  'id="captionHighlightColor"',
  'id="captionStrokeSlider"',
  'id="captionAnimSelect"',
  'id="captionMarginSlider"',
  'id="fleetTotalPrompts"',
  'id="fleetTotalWorkers"',
  'id="fleetMetaWorkers"',
  'id="fleetFlowWorkers"',
  'id="fleetActiveQueued"',
  'id="settingsGroqKeyPool"',
  "openWorkerLogin('ALL')"
];

let allPassed = true;
requiredElements.forEach(el => {
  const found = html.includes(el);
  console.log((found ? '✅' : '❌') + ' ' + el);
  if (!found) allPassed = false;
});

console.log('\nAudit Result:', allPassed ? 'ALL REQUIRED UI ELEMENTS VERIFIED!' : 'SOME ELEMENTS MISSING');
