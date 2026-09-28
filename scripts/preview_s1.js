const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const s1Start = html.lastIndexOf('<!-- SUB VIEW A: MODE 1', 8700);
const s1End = html.indexOf('<!-- SUB VIEW C: PROJECT PROMPTS QUEUE', 15400);
console.log(html.substring(s1Start, s1Start + 500));
console.log('--- END OF PREVIEW ---');
console.log(html.substring(s1End - 300, s1End));
