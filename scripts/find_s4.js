const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const s4 = html.indexOf('id="step-4-panel"');
const s5 = html.indexOf('id="step-5-panel"');
console.log('s4:', s4, 's5:', s5);
