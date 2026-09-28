const fs = require('fs');
const path = require('path');
const p = 'E:/stickman-video-automation/studio/public/index.html';
let html = fs.readFileSync(p, 'utf8');

// 1. Google Fonts in Head
const fontTags = `  <!-- Google Fonts: Montserrat, Bebas Neue, Anton, Poppins, Outfit, Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Inter:wght@400;600;700;800;900&family=Montserrat:ital,wght@0,700;0,800;0,900;1,900&family=Outfit:wght@600;700;800;900&family=Poppins:wght@700;800;900&display=swap" rel="stylesheet">`;

if (!html.includes('family=Anton')) {
  html = html.replace('<link rel="stylesheet" href="/styles_v2.css">', fontTags + '\n  <link rel="stylesheet" href="/styles_v2.css">');
}

fs.writeFileSync(p, html, 'utf8');
console.log('Added Google Fonts to index.html');
