const fs = require('fs');
const html = fs.readFileSync('E:/stickman-video-automation/studio/public/index.html', 'utf8');
const m1 = html.indexOf('id="subViewMode1"');
const m2 = html.indexOf('id="subViewMode2"');
const mq = html.indexOf('id="subViewQueue"');
console.log('m1:', m1, 'm2:', m2, 'mq:', mq);
console.log('m1 to m2 length:', m2 - m1);
