/**
 * inject-latte-svg.js
 * Injects the latteart_final_v2.svg paths into the latte-art game,
 * replacing the old lotus art reveal system with the new multi-layer
 * liquid-displacement animated SVG.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SVG_SRC = path.join(ROOT, 'assets/svg animations/latteart_final_v2.svg')
const HTML_FILE = path.join(ROOT, 'games/latte-art/index.html')
const JS_FILE = path.join(ROOT, 'games/latte-art/game.js')

// ── 1. Parse the source SVG paths ────────────────────────────────────────────
const svgSrc = fs.readFileSync(SVG_SRC, 'utf8')

// Extract CSS class → fill color map
const colorMap = {}
const styleRe = /\.(cls-\d+)\s*\{[^}]*fill:\s*(#[0-9a-fA-F]+)/g
let m
while ((m = styleRe.exec(svgSrc)) !== null) {
  colorMap[m[1]] = m[2]
}

// Extract all <path> elements and map to layer groups
// Layer groups (from README): [[15],[13,10],[9,6],[4,7],[11,12,8],[5],[1,3,14],[2],[0]]
// In the SVG file paths are identified by their class and position in DOM order.
// We identify them by data-g attribute from latte_art_animation.txt.
// The SVG file (latteart_final_v2.svg) doesn't have id/data-g but the order matches:
// Order in SVG: p0(cls-8), p1(cls-4), p2(cls-7), p3(cls-4), p4(cls-1),
//               p5(cls-5), p6(cls-3), p7(cls-1), p8(cls-9), p9(cls-3),
//               p10(cls-6), p11(cls-9), p12(cls-9), p13(cls-6), p14(cls-4), p15(cls-2)
// Groups from animation.txt layers array:
const LAYERS = [[15],[13,10],[9,6],[4,7],[11,12,8],[5],[1,3,14],[2],[0]]

// Map class to color
const pathColorMap = {
  'cls-8': '#ba1f3a', // p0
  'cls-4': '#92b542', // p1,p3,p14
  'cls-7': '#d1b916', // p2
  'cls-1': '#41a13f', // p4,p7
  'cls-5': '#ca5d92', // p5
  'cls-3': '#3a66a7', // p6,p9
  'cls-9': '#2daa8f', // p8,p11,p12
  'cls-6': '#6b1e7d', // p10,p13
  'cls-2': '#a58cb7', // p15
}

// Extract all path d-attributes from the SVG in DOM order
const pathRe = /<path class="(cls-\d+)" d="([^"]+)"/g
const rawPaths = []
let pm
while ((pm = pathRe.exec(svgSrc)) !== null) {
  rawPaths.push({ cls: pm[1], d: pm[2] })
}

// Assign IDs based on the id→class mapping from README/animation.txt
// Order in SVG dom: p0,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12,p13,p14,p15
// But SVG file groups p14 and p15 inside a <g> at the end.
// From the file reading: paths appear at lines 46-63 in order:
// Line 46: p0 cls-8, Line 47: p1 cls-4, Line 48: p2 cls-7, Line 49: p3 cls-4,
// Line 50: p4 cls-1, Line 51: p5 cls-5, Line 52: p6 cls-3, Line 53: p7 cls-1,
// Line 54: p8 cls-9, Line 55: p9 cls-3, Line 56: p10 cls-6, Line 57: p11 cls-9,
// Line 58: p12 cls-9, Line 59: p13 cls-6, Line 61: p14 cls-4, Line 62: p15 cls-2

if (rawPaths.length < 16) {
  console.error(`Expected 16 paths, got ${rawPaths.length}`)
  process.exit(1)
}

// Assign p0..p15 in order
const paths = rawPaths.slice(0, 16).map((p, i) => ({
  id: `p${i}`,
  fill: pathColorMap[p.cls] || '#ffffff',
  d: p.d,
  g: LAYERS.findIndex(group => group.includes(i))
}))

// ── 2. Build the new SVG <defs> + path block ─────────────────────────────────
function buildLatteArtSVG() {
  const pathLines = paths.map(p =>
    `              <path id="${p.id}" data-g="${p.g}" fill="${p.fill}" opacity="0" d="${p.d}"/>`
  ).join('\n')

  return `        <g clip-path="url(#cup-clip)">
          <g id="latte-art-container">
            <svg id="latte-art-svg" x="22" y="22" width="216" height="216" viewBox="0 0 790.87 832.89" preserveAspectRatio="xMidYMid meet" overflow="hidden" xmlns="http://www.w3.org/2000/svg">
              <defs></defs>
${pathLines}
            </svg>
          </g>
          <circle id="overflow-flood" cx="130" cy="130" r="0" fill="rgba(240,230,214,0.6)" opacity="0"/>
        </g>`
}

// ── 3. Patch index.html ──────────────────────────────────────────────────────
let html = fs.readFileSync(HTML_FILE, 'utf8')

// Replace defs section (remove reveal-gradient and reveal-mask, add clipPath)
html = html.replace(
  /(<defs>[\s\S]*?<radialGradient id="crema-gradient"[\s\S]*?<\/radialGradient>)[\s\S]*?(<\/defs>)/,
  `$1\n          <clipPath id="cup-clip">\n            <circle cx="130" cy="130" r="105"/>\n          </clipPath>\n        $2`
)

// Replace the old lotus art group with new latte art SVG
const lotusPattern = /<g mask="url\(#reveal-mask\)"[\s\S]*?<\/g>\s*(?=\s*<circle cx="130" cy="130" r="118")/
if (!lotusPattern.test(html)) {
  console.error('Could not find lotus art group pattern in index.html')
  process.exit(1)
}
html = html.replace(lotusPattern, buildLatteArtSVG() + '\n\n        ')

fs.writeFileSync(HTML_FILE, html, 'utf8')
console.log('✓ index.html patched')

// ── 4. Patch game.js ─────────────────────────────────────────────────────────
let js = fs.readFileSync(JS_FILE, 'utf8')

// 4a. Replace DOM refs for revealMask and lotusArt
js = js.replace(
  /const revealMask = \$\('#reveal-mask-circle'\)\n/,
  ''
)
js = js.replace(
  /const lotusArt = \$\('#lotus-art'\)/,
  `const latteArtContainer = document.getElementById('latte-art-container')`
)

// 4b. Replace the SVG Reveal section + setRevealProgress function
const newRevealSection = `
// --- Latte Art Animation System ---
const LAYERS = [[15],[13,10],[9,6],[4,7],[11,12,8],[5],[1,3,14],[2],[0]]
const THRESHOLDS = [0, 0.08, 0.16, 0.24, 0.35, 0.46, 0.57, 0.72, 0.88]
let latteArtRefs = []

function initLatteArtSystem() {
  const svgEl = document.getElementById('latte-art-svg')
  if (!svgEl) return
  const ns = 'http://www.w3.org/2000/svg'
  const defs = svgEl.querySelector('defs')

  // Compute stem point (center-bottom of all paths)
  const allPaths = svgEl.querySelectorAll('path')
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of allPaths) {
    const b = p.getBBox()
    if (b.x < minX) minX = b.x
    if (b.x + b.width > maxX) maxX = b.x + b.width
    if (b.y + b.height > maxY) maxY = b.y + b.height
  }
  const stemX = (minX + maxX) / 2
  const stemY = maxY

  for (let g = 0; g < LAYERS.length; g++) {
    const filter = document.createElementNS(ns, 'filter')
    filter.id = 'la-f' + g
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    filter.setAttribute('x', '-10%'); filter.setAttribute('y', '-10%')
    filter.setAttribute('width', '120%'); filter.setAttribute('height', '120%')

    const turb = document.createElementNS(ns, 'feTurbulence')
    turb.setAttribute('type', 'fractalNoise')
    turb.setAttribute('baseFrequency', '0.0015')
    turb.setAttribute('numOctaves', '1')
    turb.setAttribute('seed', '1')
    turb.setAttribute('result', 't')

    const disp = document.createElementNS(ns, 'feDisplacementMap')
    disp.setAttribute('in', 'SourceGraphic'); disp.setAttribute('in2', 't')
    disp.setAttribute('scale', '180'); disp.setAttribute('result', 'dp')
    disp.setAttribute('xChannelSelector', 'R'); disp.setAttribute('yChannelSelector', 'G')

    const blur = document.createElementNS(ns, 'feGaussianBlur')
    blur.setAttribute('in', 'dp'); blur.setAttribute('stdDeviation', '1.5')

    filter.appendChild(turb); filter.appendChild(disp); filter.appendChild(blur)
    defs.appendChild(filter)

    const groupRef = { disp, blur, paths: [] }

    for (const idx of LAYERS[g]) {
      const el = document.getElementById('p' + idx)
      if (!el) continue
      const bb = el.getBBox()
      let maxDist = 0
      const corners = [[bb.x, bb.y],[bb.x+bb.width, bb.y],[bb.x, bb.y+bb.height],[bb.x+bb.width, bb.y+bb.height]]
      for (const [cx, cy] of corners) {
        const d = Math.hypot(cx - stemX, cy - stemY)
        if (d > maxDist) maxDist = d
      }

      const grad = document.createElementNS(ns, 'radialGradient')
      grad.id = 'la-r' + idx
      grad.setAttribute('gradientUnits', 'userSpaceOnUse')
      grad.setAttribute('cx', stemX); grad.setAttribute('cy', stemY)
      grad.setAttribute('r', '0')
      const s1 = document.createElementNS(ns, 'stop')
      s1.setAttribute('offset', '0.82'); s1.setAttribute('stop-color', 'white')
      const s2 = document.createElementNS(ns, 'stop')
      s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', 'black')
      grad.appendChild(s1); grad.appendChild(s2)
      defs.appendChild(grad)

      const mask = document.createElementNS(ns, 'mask')
      mask.id = 'la-m' + idx
      const mr = document.createElementNS(ns, 'rect')
      mr.setAttribute('x', '-200'); mr.setAttribute('y', '-300')
      mr.setAttribute('width', '1200'); mr.setAttribute('height', '1400')
      mr.setAttribute('fill', 'url(#la-r' + idx + ')')
      mask.appendChild(mr)
      defs.appendChild(mask)

      el.setAttribute('mask', 'url(#la-m' + idx + ')')
      el.setAttribute('filter', 'url(#la-f' + g + ')')

      groupRef.paths.push({ el, maxDist, grad })
    }
    latteArtRefs.push(groupRef)
  }
}

function updateLatteArtProgress(progress) {
  for (let g = 0; g < latteArtRefs.length; g++) {
    const ref = latteArtRefs[g]
    const threshold = THRESHOLDS[g]
    const gp = Math.max(0, Math.min(1, (progress - threshold) / (1 - threshold + 0.001)))
    ref.disp.setAttribute('scale', String(180 * (1 - gp)))
    ref.blur.setAttribute('stdDeviation', String(1.5 * (1 - gp)))
    for (const { el, maxDist, grad } of ref.paths) {
      grad.setAttribute('r', String(gp * maxDist * 1.2))
      el.style.opacity = gp > 0 ? String(Math.min(1, gp * 3)) : '0'
    }
  }
}

function resetLatteArt() {
  for (const ref of latteArtRefs) {
    ref.disp.setAttribute('scale', '180')
    ref.blur.setAttribute('stdDeviation', '1.5')
    for (const { el, grad } of ref.paths) {
      grad.setAttribute('r', '0')
      el.style.opacity = '0'
    }
  }
}

// --- SVG Reveal ---
function setRevealProgress(progress, elapsed) {
  // Milk impact glow
  milkGlow.setAttribute('r', String(Math.min(progress * REVEAL_RADIUS_MAX * 0.4, 30)))
  milkGlow.style.opacity = state.phase === 'pouring' ? '0.6' : '0'

  // Drive the latte art layer-by-layer reveal
  updateLatteArtProgress(progress)

  // Overflow distortion when past target
  if (elapsed > TARGET) {
    const overAmount = (elapsed - TARGET) / (MAX_TIME - TARGET)
    cremaWhiten.setAttribute('opacity', String(Math.min(overAmount * 0.6, 0.55)))
    overflowFlood.setAttribute('r', String(40 + overAmount * 100))
    overflowFlood.setAttribute('opacity', String(Math.min(overAmount * 0.8, 0.7)))
    latteArtContainer.setAttribute('opacity', String(1 - overAmount * 0.4))
  } else {
    cremaWhiten.setAttribute('opacity', '0')
    overflowFlood.setAttribute('r', '0')
    overflowFlood.setAttribute('opacity', '0')
    latteArtContainer.setAttribute('opacity', '1')
  }
}
`

js = js.replace(
  /\/\/ --- SVG Reveal ---[\s\S]*?^}/m,
  newRevealSection.trim()
)

// 4c. Patch resetGame to call resetLatteArt
js = js.replace(
  /function resetGame\(\) \{[\s\S]*?state\.phase = 'idle'\n  state\.elapsed = 0\n  setRevealProgress\(0, 0\)/,
  `function resetGame() {\n  state.phase = 'idle'\n  state.elapsed = 0\n  resetLatteArt()\n  milkGlow.setAttribute('r', '0')\n  milkGlow.style.opacity = '0'`
)

// 4d. Add initLatteArtSystem() call near initLocale()
js = js.replace(
  /  initLocale\(\)\n/,
  `  initLatteArtSystem()\n  initLocale()\n`
)

fs.writeFileSync(JS_FILE, js, 'utf8')
console.log('✓ game.js patched')

console.log('\nDone! Latte art SVG integrated into the game.')
console.log('Layer groups:', LAYERS.length, '| Paths:', paths.length)
