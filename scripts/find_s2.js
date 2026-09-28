const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const s2 = html.lastIndexOf('<section id="step-2-panel"', html.indexOf('id="step-2-panel"') + 30);
const s3 = html.indexOf('<!-- ==================== STEP 3', s2);
console.log('s2:', s2, 's3:', s3);
console.log('s2 preview:', html.substring(s2, s2 + 150));
