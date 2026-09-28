const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const s6 = html.lastIndexOf('<section id="step-6-panel"', html.indexOf('id="step-6-panel"') + 30);
const s6End = html.indexOf('</section>', s6) + 10;
console.log('s6:', s6, 's6End:', s6End);
console.log('s6 chunk:', html.substring(s6, s6 + 100));
