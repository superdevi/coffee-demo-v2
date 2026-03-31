import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gameJsPath = path.join(__dirname, 'games', 'latte-art', 'game.js');
let gameJs = fs.readFileSync(gameJsPath, 'utf-8');

// 1. We need to add initAdvancedLatteArt function
const newLogic = `
// --- Advanced SVG Animation Setup ---
const GROUPS_COUNT = 9;
const thresholds = [0, 0.08, 0.16, 0.24, 0.35, 0.46, 0.57, 0.72, 0.88];
let groupElements = [];

function initAdvancedLatteArt() {
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.querySelector(".cup-svg defs");
  const paths = Array.from(document.querySelectorAll("#lotus-art path"));
  
  if (paths.length === 0) return; // Not injected yet or wrong page

  let mx = 9999, mxx = -9999, my = -9999;
  paths.forEach(p => {
    let b = p.getBBox();
    if (b.x < mx) mx = b.x;
    if (b.x + b.width > mxx) mxx = b.x + b.width;
    if (b.y + b.height > my) my = b.y + b.height;
  });
  const sx = (mx + mxx) / 2;
  const sy = my;

  // Initialize group data
  for (let g = 0; g < GROUPS_COUNT; g++) {
    groupElements.push({ paths: [], gradient: null, filter: null, maxDist: 0, displacement: null, blur: null });
  }

  paths.forEach((p) => {
    const gUrl = p.getAttribute("data-g");
    if (gUrl === null) return;
    const g = parseInt(gUrl, 10);
    if (!groupElements[g]) return;
    
    groupElements[g].paths.push(p);

    let bb = p.getBBox();
    let cx = [bb.x, bb.x + bb.width];
    let cy = [bb.y, bb.y + bb.height];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let dd = Math.hypot(cx[i] - sx, cy[j] - sy);
        if (dd > groupElements[g].maxDist) {
          groupElements[g].maxDist = dd;
        }
      }
    }
  });

  // Create filters and masks for each group
  for (let g = 0; g < GROUPS_COUNT; g++) {
    const grp = groupElements[g];
    if (grp.paths.length === 0) continue;

    const f = document.createElementNS(ns, "filter");
    f.id = "f" + g;
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.setAttribute("x", "-10%"); f.setAttribute("y", "-10%");
    f.setAttribute("width", "120%"); f.setAttribute("height", "120%");

    const tb = document.createElementNS(ns, "feTurbulence");
    tb.setAttribute("type", "fractalNoise");
    tb.setAttribute("baseFrequency", "0.0015");
    tb.setAttribute("numOctaves", "1");
    tb.setAttribute("seed", "1");
    tb.setAttribute("result", "t");

    const dp = document.createElementNS(ns, "feDisplacementMap");
    dp.setAttribute("in", "SourceGraphic");
    dp.setAttribute("in2", "t");
    dp.setAttribute("scale", "180");
    dp.setAttribute("result", "dp");
    dp.setAttribute("xChannelSelector", "R");
    dp.setAttribute("yChannelSelector", "G");

    const bl = document.createElementNS(ns, "feGaussianBlur");
    bl.setAttribute("in", "dp");
    bl.setAttribute("stdDeviation", "1.5");

    f.appendChild(tb);
    f.appendChild(dp);
    f.appendChild(bl);
    defs.appendChild(f);

    grp.filter = f;
    grp.displacement = dp;
    grp.blur = bl;

    const gr = document.createElementNS(ns, "radialGradient");
    gr.id = "r" + g;
    gr.setAttribute("gradientUnits", "userSpaceOnUse");
    gr.setAttribute("cx", sx);
    gr.setAttribute("cy", sy);
    gr.setAttribute("r", "0");
    
    const s1 = document.createElementNS(ns, "stop");
    s1.setAttribute("offset", "0.82");
    s1.setAttribute("stop-color", "white");
    
    const s2 = document.createElementNS(ns, "stop");
    s2.setAttribute("offset", "1");
    s2.setAttribute("stop-color", "black");

    gr.appendChild(s1);
    gr.appendChild(s2);
    defs.appendChild(gr);

    grp.gradient = gr;

    const mk = document.createElementNS(ns, "mask");
    mk.id = "m" + g;
    const mr = document.createElementNS(ns, "rect");
    mr.setAttribute("x", "-200"); mr.setAttribute("y", "-300");
    mr.setAttribute("width", "1200"); mr.setAttribute("height", "1400");
    mr.setAttribute("fill", "url(#r" + g + ")");
    mk.appendChild(mr);
    defs.appendChild(mk);

    grp.paths.forEach(p => {
      p.setAttribute("mask", "url(#m" + g + ")");
      p.setAttribute("filter", "url(#f" + g + ")");
      p.style.opacity = "0";
    });
  }
}
`;

// Insert the new logic before setRevealProgress
gameJs = gameJs.replace('function setRevealProgress(progress, elapsed) {', newLogic + '\nfunction setRevealProgress(progress, elapsed) {');

// 2. We need to overwrite setRevealProgress entirely
const newSetRevealProgress = `function setRevealProgress(progress, elapsed) {
  // Advanced SVG group layers
  for (let g = 0; g < GROUPS_COUNT; g++) {
    const grp = groupElements[g];
    if (!grp.paths.length) continue;

    const groupProgress = Math.max(0, Math.min(1,
      (progress - thresholds[g]) / (1 - thresholds[g])
    ));

    // Calculate radius to exceed maxDist
    const targetRadius = grp.maxDist * 1.2;
    grp.gradient.setAttribute("r", String(groupProgress * targetRadius));
    
    grp.displacement.setAttribute("scale", String(180 * (1 - groupProgress)));
    grp.blur.setAttribute("stdDeviation", String(1.5 * (1 - groupProgress)));
    
    const ops = groupProgress > 0 ? String(Math.min(1, groupProgress * 3)) : "0";
    grp.paths.forEach(p => p.style.opacity = ops);
  }

  // milk impact glow (keep from original)
  const glowRad = Math.min(progress, 1) * 130 * 0.4;
  milkGlow.setAttribute('r', Math.min(glowRad, 30));
  milkGlow.style.opacity = state.phase === 'pouring' ? 0.6 : 0;

  // Overflow distortion when past target
  if (elapsed > TARGET) {
    const overAmount = (elapsed - TARGET) / (MAX_TIME - TARGET); // 0→1
    cremaWhiten.setAttribute('opacity', String(Math.min(overAmount * 0.6, 0.55)));
    overflowFlood.setAttribute('r', String(40 + overAmount * 100));
    overflowFlood.setAttribute('opacity', String(Math.min(overAmount * 0.8, 0.7)));
    
    // Distort the lotus via SVG transform attribute
    const scale = 0.36 * (1 + overAmount * 0.25);
    const skewX = Math.sin(elapsed * 3) * overAmount * 8;
    lotusArt.setAttribute('transform', \`translate(130,130) scale(\${scale}) skewX(\${skewX}) translate(-256,-256)\`);
    lotusArt.setAttribute('opacity', String(1 - overAmount * 0.4));
  } else {
    cremaWhiten.setAttribute('opacity', '0');
    overflowFlood.setAttribute('r', '0');
    overflowFlood.setAttribute('opacity', '0');
    lotusArt.setAttribute('transform', LOTUS_BASE_TRANSFORM);
    lotusArt.removeAttribute('opacity');
  }
}`;

// Replace the old setRevealProgress
gameJs = gameJs.replace(/function setRevealProgress[\s\S]*?\/\/\s*---\s*Timer Display\s*---/, newSetRevealProgress + '\n\n// --- Timer Display ---');

// 3. Call initAdvancedLatteArt() when DOM is ready
if (!gameJs.includes('initAdvancedLatteArt()')) {
  // It shouldn't yet
  gameJs = gameJs.replace('initLocale()', 'initLocale()\n\n// Init Advanced SVG\ninitAdvancedLatteArt()');
}

fs.writeFileSync(gameJsPath, gameJs);
console.log("Updated game.js successfully.");
