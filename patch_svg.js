import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgSource = fs.readFileSync(path.join(__dirname, 'assets', 'svg animations', 'latteart_final_v2.svg'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'games', 'latte-art', 'index.html'), 'utf-8');

const pathMatch = svgSource.match(/<path[^>]*d="[^"]*"[^>]*>/g);
if (!pathMatch) {
  console.error("No paths found");
  process.exit(1);
}

const classToGroup = {
  'cls-2': 0,
  'cls-6': 1,
  'cls-3': 2,
  'cls-1': 3,
  'cls-9': 4,
  'cls-5': 5,
  'cls-4': 6,
  'cls-7': 7,
  'cls-8': 8
}

const styleMatch = svgSource.match(/<style>([\s\S]*?)<\/style>/);
let fillMap = {};
if (styleMatch) {
  const rules = styleMatch[1].split('}');
  rules.forEach(rule => {
    const parts = rule.split('{');
    if (parts.length > 1) {
      const sels = parts[0].split(',').map(s => s.trim());
      const style = parts[1].trim();
      const fillMt = style.match(/fill:\s*(#[0-9a-fA-F]+)/);
      if (fillMt) {
        sels.forEach(sel => {
          if (sel.startsWith('.cls-')) fillMap[sel.substring(1)] = fillMt[1];
        });
      }
    }
  });
}

let newPathsHtml = '';
pathMatch.forEach((pathTag, idx) => {
  const classMatch = pathTag.match(/class="(cls-\d+)"/);
  const colorClass = classMatch ? classMatch[1] : '';
  const group = classToGroup[colorClass] !== undefined ? classToGroup[colorClass] : 0;
  
  const fill = fillMap[colorClass] || '#fff';
  let finalPath = pathTag.replace(/class="[^"]*"/, `data-g="${group}" id="p${idx}" fill="${fill}" style="opacity: 0"`);
  if (!finalPath.includes('fill=')) {
     finalPath = finalPath.replace('>', ` fill="${fill}" style="opacity: 0">`);
  }
  newPathsHtml += '              ' + finalPath + '\n';
});

const startTag = '<g id="lotus-art" transform="translate(130,130) scale(0.36) translate(-256,-256)" fill="#f0e6d6">';
const parts = indexHtml.split(startTag);
if(parts.length < 2) {
  console.error("Could not find lotus-art group in index.html");
  process.exit(1);
}

const afterStart = parts[1];
const endIdx = afterStart.indexOf('</g>');
const newHtml = parts[0] + startTag + '\n' + newPathsHtml + '          ' + afterStart.substring(endIdx);

fs.writeFileSync(path.join(__dirname, 'games', 'latte-art', 'index.html'), newHtml);
console.log("Updated index.html safely.");
