const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const idx1 = html.indexOf('id="newProjectModal"');
const idx2 = html.indexOf('id="rangesModal"');

const startTag = html.lastIndexOf('<div id="newProjectModal"', idx1);
const endTag = html.lastIndexOf('<div id="rangesModal"', idx2);
console.log('startTag:', startTag, 'endTag:', endTag);
console.log('Before startTag:', JSON.stringify(html.substring(startTag - 30, startTag)));
console.log('Before endTag:', JSON.stringify(html.substring(endTag - 30, endTag)));
