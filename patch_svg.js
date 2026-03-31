const fs = require('fs');
const path = require('path');

const svgSource = fs.readFileSync(path.join(__dirname, 'assets', 'svg animations', 'latteart_final_v2.svg'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'games', 'latte-art', 'index.html'), 'utf-8');

// Extract all <path> elements with their classes etc. We can just use regex.
// Wait, the latteart_final_v2.svg also contains defs. We want the <g> block or the specific paths.
const pathMatch = svgSource.match(/<path[^>]*d="[^"]*"[^>]*>/g);

if (!pathMatch) {
  console.error("No paths found");
  process.exit(1);
}

// Map the class names to the correct group as per README
// cls-2 : P15 -> group 0
// cls-6 : P13, P10 -> group 1
// cls-3 : P9, P6 -> group 2
// cls-1 : P4, P7 -> group 3
// cls-9 : P11, P12, P8 -> group 4
// cls-5 : P5 -> group 5
// cls-4 : P1, P3, P14 -> group 6
// cls-7 : P2 -> group 7
// cls-8 : P0 -> group 8

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

let newPathsHtml = '';
pathMatch.forEach((pathTag, idx) => {
  // Extract class
  const classMatch = pathTag.match(/class="(cls-\d+)"/);
  const colorClass = classMatch ? classMatch[1] : '';
  const group = classToGroup[colorClass] !== undefined ? classToGroup[colorClass] : 0;
  
  // Replace fill class with inline fill to be safe, or keep class since CSS has it? No we don't have these classes in the main css.
  // Actually, latteart_final_v2.svg has <style> with fills. Let's just keep the classes, we will inject the style too, or we can transform class to fill.
  const styleMatch = svgSource.match(/<style>([\s\S]*?)<\/style>/);
  let fillMap = {};
  if (styleMatch) {
    const rules = styleMatch[1].split('}');
    rules.forEach(rule => {
      const parts = rule.split('{');
      if (parts.length > 1) {
        const sel = parts[0].trim();
        const style = parts[1].trim();
        const fillMt = style.match(/fill:\s*(#[0-9a-fA-F]+)/);
        if (fillMt && sel.startsWith('.cls-')) {
          fillMap[sel.substring(1)] = fillMt[1];
        }
      }
    });
  }

  let finalPath = pathTag.replace(/class="[^"]*"/, `data-g="${group}" id="p${idx}" fill="${fillMap[colorClass]}" style="opacity: 0"`);
  // also handle standard styles
  if(!finalPath.includes('fill=')) {
     finalPath = finalPath.replace('>', ` fill="${fillMap[colorClass]}" style="opacity: 0">`);
  }
  newPathsHtml += '              ' + finalPath + '\n';
});

// Now replace the content of <g id="lotus-art">...</g> in index.html
const startTag = '<g id="lotus-art" transform="translate(130,130) scale(0.36) translate(-256,-256)" fill="#f0e6d6">';
const endTag = '</g>';

const re = new RegExp(startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?^\\s*<\\/g>', 'im');

const modifiedHtml = indexHtml.replace(re, startTag + '\n' + newPathsHtml + '          </g>');

fs.writeFileSync(path.join(__dirname, 'games', 'latte-art', 'index.html'), modifiedHtml);
console.log("Updated index.html");
