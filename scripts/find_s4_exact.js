const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const s4 = html.lastIndexOf('<section id="step-4-panel"', 23000);
const s5 = html.lastIndexOf('<!-- ==================== STEP 5', 26600);
console.log('s4 start:', s4, 's5 start:', s5);
console.log('Chunk length:', s5 - s4);
