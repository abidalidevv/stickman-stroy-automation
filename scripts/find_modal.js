const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const idx1 = html.indexOf('id="newProjectModal"');
const idx2 = html.indexOf('id="rangesModal"');
console.log('idx1:', idx1, 'idx2:', idx2);
if (idx1 !== -1 && idx2 !== -1) {
  const modalChunk = html.substring(idx1 - 40, idx2 - 40);
  console.log('Found chunk length:', modalChunk.length);
}
