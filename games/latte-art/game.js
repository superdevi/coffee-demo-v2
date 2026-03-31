/**
 * 8.88 Latte Art Game
 * Hold to pour milk. Release as close to 8.88 seconds as possible.
 */

import { getNickname, getCompany } from '/shared/utils.js'
import { vibrateShort, vibrateMedium, vibrateHeavy, vibratePattern } from '/shared/haptics.js'
import { submitScore, fetchLeaderboard, renderLeaderboard } from '/shared/leaderboard.js'
import { initLocale, getLocale } from '/shared/i18n.js'
import { initFoliageBorder } from '/shared/foliage-border.js'
import { sfxPourStart, sfxPourLoop, sfxTick, sfxHeartbeat, sfxRelease, sfxWarning } from '/shared/sfx.js'

let foliage = null
let stopPourLoop = null
initFoliageBorder(document.getElementById('foliage-canvas')).then(f => { foliage = f })

const TARGET = 8.88
const MAX_TIME = 12
const GRADES = [
  { maxDelta: 0.01, cn: '大师', en: 'Master', cls: 'master', messagesZh: ['完美的一手', '你就是拉花之神'], messagesEn: ['Perfection in a pour', 'The latte art deity'] },
  { maxDelta: 0.10, cn: '精准', en: 'Precision', cls: 'precision', messagesZh: ['几乎完美', '极致专注'], messagesEn: ['Almost flawless', 'Razor-sharp focus'] },
  { maxDelta: 0.30, cn: '漂亮', en: 'Beautiful', cls: 'beautiful', messagesZh: ['手感不错', '越来越近了'], messagesEn: ['Good instinct', 'Getting closer'] },
  { maxDelta: 1.00, cn: '不错', en: 'Not Bad', cls: 'notbad', messagesZh: ['继续练习', '感觉在了'], messagesEn: ['Keep practicing', 'The feel is there'] },
  { maxDelta: Infinity, cn: '再来', en: 'Try Again', cls: 'tryagain', messagesZh: ['时间是门艺术', '再倒一杯'], messagesEn: ['Timing is an art', 'Pour another'] },
]

// --- State ---
let state = {
  phase: 'idle', // idle | pouring | result
  startTime: 0,
  elapsed: 0,
  animFrame: null,
  lastResult: null, // { elapsed, delta, grade, sign }
}

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel)
const timerEl = $('.timer')
const cupContainer = $('.cup-container')
const pourStream = $('.pour-stream')
const steamContainer = $('.steam-container')
const heartbeatRing = $('.heartbeat-ring')
const overflowRing = $('.overflow-ring')
const bagua = $('.bagua')
const bgGlow = $('.bg-glow')
const pourBtn = $('.pour-btn')
const pourHint = $('.pour-hint')
const milkGlow = $('#milk-glow')
const lotusArt = $('#lotus-art')
const overflowFlood = $('#overflow-flood')
const cremaWhiten = $('#crema-whiten')
const gameScreen = $('#game-screen')
const endGlow = $('#end-glow')

// --- SVG Reveal ---
const REVEAL_RADIUS_MAX = 130 // enough to show full art
const LOTUS_BASE_TRANSFORM = 'translate(130,130) scale(0.20) translate(-395.4,-416.4)'


// --- Advanced SVG Animation Setup (matches latte_art_animation.txt) ---
const GROUPS_COUNT = 9;
const thresholds = [0, 0.08, 0.16, 0.24, 0.35, 0.46, 0.57, 0.72, 0.88];
// Per-group: filter refs (shared across paths in group)
let groupFilters = []; // { displacement, blur }
// Per-path: individual mask + maxDist
let pathData = []; // { el, group, gradient, maxDist }

function initAdvancedLatteArt() {
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.querySelector(".cup-svg defs");
  const paths = Array.from(document.querySelectorAll("#lotus-art path"));

  if (paths.length === 0) return;

  // Compute stem point (center-bottom of bounding box union)
  let mx = 9999, mxx = -9999, my = -9999;
  paths.forEach(p => {
    let b = p.getBBox();
    if (b.x < mx) mx = b.x;
    if (b.x + b.width > mxx) mxx = b.x + b.width;
    if (b.y + b.height > my) my = b.y + b.height;
  });
  const sx = (mx + mxx) / 2;
  const sy = my;

  // Create one filter per group (shared by all paths in the group)
  for (let g = 0; g < GROUPS_COUNT; g++) {
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

    f.appendChild(tb); f.appendChild(dp); f.appendChild(bl);
    defs.appendChild(f);

    groupFilters[g] = { displacement: dp, blur: bl };
  }

  // Create per-path radial mask (each path gets its own gradient + mask with its own maxDist)
  paths.forEach(p => {
    const gAttr = p.getAttribute("data-g");
    if (gAttr === null) return;
    const g = parseInt(gAttr, 10);
    if (g < 0 || g >= GROUPS_COUNT) return;

    const idx = p.id; // e.g. "p15"

    // Per-path maxDist from stem point
    const bb = p.getBBox();
    let md = 0;
    const corners = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]];
    corners.forEach(([cx, cy]) => {
      const dd = Math.hypot(cx - sx, cy - sy);
      if (dd > md) md = dd;
    });

    // Radial gradient for this path's mask
    const gr = document.createElementNS(ns, "radialGradient");
    gr.id = "r" + idx;
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
    gr.appendChild(s1); gr.appendChild(s2);
    defs.appendChild(gr);

    // Mask using this gradient
    const mk = document.createElementNS(ns, "mask");
    mk.id = "m" + idx;
    const mr = document.createElementNS(ns, "rect");
    mr.setAttribute("x", "-200"); mr.setAttribute("y", "-300");
    mr.setAttribute("width", "1200"); mr.setAttribute("height", "1400");
    mr.setAttribute("fill", "url(#r" + idx + ")");
    mk.appendChild(mr);
    defs.appendChild(mk);

    // Apply per-path mask + group filter
    p.setAttribute("mask", "url(#m" + idx + ")");
    p.setAttribute("filter", "url(#f" + g + ")");
    p.style.opacity = "0";

    pathData.push({ el: p, group: g, gradient: gr, maxDist: md });
  });
}

initAdvancedLatteArt()

function setRevealProgress(progress, elapsed) {
  // Update per-group filters (displacement + blur)
  for (let g = 0; g < GROUPS_COUNT; g++) {
    const gf = groupFilters[g];
    if (!gf) continue;

    const groupProgress = Math.max(0, Math.min(1,
      (progress - thresholds[g]) / (1 - thresholds[g])
    ));

    gf.displacement.setAttribute("scale", String(180 * (1 - groupProgress)));
    gf.blur.setAttribute("stdDeviation", String(1.5 * (1 - groupProgress)));
  }

  // Update per-path masks and opacity
  pathData.forEach(({ el, group, gradient, maxDist }) => {
    const groupProgress = Math.max(0, Math.min(1,
      (progress - thresholds[group]) / (1 - thresholds[group])
    ));

    // Per-path radial mask radius
    gradient.setAttribute("r", String(groupProgress * maxDist * 1.2));

    // Opacity fade-in
    el.style.opacity = groupProgress > 0 ? String(Math.min(1, groupProgress * 3)) : "0";
  });

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
    
    // Fade the art when over-pouring (no scale change)
    lotusArt.setAttribute('opacity', String(1 - overAmount * 0.4));
  } else {
    cremaWhiten.setAttribute('opacity', '0');
    overflowFlood.setAttribute('r', '0');
    overflowFlood.setAttribute('opacity', '0');
    lotusArt.setAttribute('transform', LOTUS_BASE_TRANSFORM);
    lotusArt.removeAttribute('opacity');
  }
}

// --- Timer Display ---
function updateTimer(elapsed) {
  timerEl.textContent = elapsed.toFixed(2)

  // Color phases
  timerEl.classList.remove('warm', 'hot', 'target', 'danger')
  if (elapsed >= 8.50 && elapsed <= 9.26) {
    timerEl.classList.add('target')
  } else if (elapsed > TARGET) {
    timerEl.classList.add('danger')
  } else if (elapsed >= 7.0) {
    timerEl.classList.add('hot')
  } else if (elapsed >= 6.0) {
    timerEl.classList.add('warm')
  }
}

// --- Tension Escalation ---
function updateTension(elapsed) {
  // Background glow
  bgGlow.classList.remove('active', 'intense')
  if (elapsed >= 8.0) {
    bgGlow.classList.add('intense')
  } else if (elapsed >= 7.0) {
    bgGlow.classList.add('active')
  }

  // Heartbeat ring
  heartbeatRing.classList.remove('active', 'fast')
  if (elapsed >= 8.0) {
    heartbeatRing.classList.add('active', 'fast')
  } else if (elapsed >= 7.5) {
    heartbeatRing.classList.add('active')
  }

  // Tick sound — every ~0.5s, pitch rises with time
  const tickInterval = elapsed >= 7.0 ? 0.25 : 0.5
  if (elapsed > 0.5 && (elapsed % tickInterval) < 0.02) {
    sfxTick(elapsed, TARGET)
  }

  // Haptic + heartbeat sound at 8s+
  if (elapsed >= 8.0 && elapsed < TARGET) {
    const beatInterval = elapsed >= 8.5 ? 200 : 400
    const timeSinceBeat = ((elapsed - 8.0) * 1000) % beatInterval
    if (timeSinceBeat < 20) {
      vibrateShort()
      sfxHeartbeat(elapsed >= 8.5)
    }
  }

  // Danger zone (past target)
  if (elapsed > TARGET) {
    cupContainer.classList.add('shake')
    overflowRing.classList.add('active')
    // Warning buzz every 0.3s
    if ((elapsed % 0.3) < 0.02) {
      sfxWarning()
    }
  } else {
    cupContainer.classList.remove('shake')
    overflowRing.classList.remove('active')
  }
}

// --- Game Loop ---
function gameLoop() {
  if (state.phase !== 'pouring') return

  const now = performance.now()
  state.elapsed = (now - state.startTime) / 1000

  // Auto-stop at max
  if (state.elapsed >= MAX_TIME) {
    state.elapsed = MAX_TIME
    endPour()
    return
  }

  // Update visuals
  const progress = Math.min(state.elapsed / TARGET, 1)
  setRevealProgress(revealCurve(progress), state.elapsed)
  updateTimer(state.elapsed)
  updateTension(state.elapsed)

  state.animFrame = requestAnimationFrame(gameLoop)
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Reveal curve — keeps lotus subtle until ~7s, then blooms rapidly toward 8.88s.
 * At t=0.5 (~4.4s) only ~10% revealed. At t=0.8 (~7.1s) ~35%. Fills at t=1.0.
 */
function revealCurve(t) {
  return Math.pow(t, 3.5)
}

// --- Pour Start ---
function startPour() {
  if (state.phase !== 'idle') return
  state.phase = 'pouring'
  state.startTime = performance.now()
  state.elapsed = 0

  pourStream.classList.add('active')
  steamContainer.classList.add('active')
  bagua.classList.add('pouring')
  pourBtn.classList.add('pressing')
  pourHint.textContent = getLocale() === 'zh' ? '松开' : 'Release'
  vibrateMedium()
  sfxPourStart()
  stopPourLoop = sfxPourLoop()
  if (foliage) foliage.setRustling(true)

  state.animFrame = requestAnimationFrame(gameLoop)
}

// --- Pour End ---
function endPour() {
  if (state.phase !== 'pouring') return
  state.phase = 'result'

  cancelAnimationFrame(state.animFrame)
  pourStream.classList.remove('active')
  pourBtn.classList.remove('pressing')
  releaseDrag()
  if (foliage) foliage.setRustling(false)
  if (stopPourLoop) { stopPourLoop(); stopPourLoop = null }
  sfxRelease(Math.abs(state.elapsed - TARGET))
  bagua.classList.remove('pouring')
  steamContainer.classList.remove('active')
  cupContainer.classList.remove('shake')
  heartbeatRing.classList.remove('active', 'fast')
  overflowRing.classList.remove('active')
  bgGlow.classList.remove('active', 'intense')

  vibrateHeavy()

  // Full-screen glow transition
  endGlow.classList.add('active')

  // Brief pause, then show result and fade glow out
  setTimeout(() => {
    showResult(state.elapsed)
    setTimeout(() => {
      endGlow.classList.remove('active')
    }, 1500)
  }, 800)
}

// --- Result Screen ---
function showResult(elapsed) {
  const delta = Math.abs(elapsed - TARGET)
  const grade = GRADES.find(g => delta < g.maxDelta)
  const sign = elapsed >= TARGET ? '+' : '-'

  // Store for locale re-render
  state.lastResult = { elapsed, delta, grade, sign }

  // Render locale-dependent text
  renderResultText()

  // Switch to result phase
  gameScreen.classList.add('result')

  // Submit score & load leaderboard
  const locale = getLocale()
  const nickname = getNickname() || (locale === 'zh' ? '匿名玩家' : 'Anonymous')
  const company = getCompany()
  submitScore({ game: 'latte-art', nickname, company, score: delta, grade: locale === 'zh' ? grade.cn : grade.en })
  loadLeaderboard(delta, nickname)
}

function renderResultText() {
  if (!state.lastResult) return
  const { elapsed, grade } = state.lastResult
  const locale = getLocale()

  $('#result-time').textContent = elapsed.toFixed(2)
  $('#result-grade').textContent = locale === 'zh' ? grade.cn : grade.en
  $('#result-grade').className = `result-grade ${grade.cls}`
}

async function loadLeaderboard(currentScore, currentNickname) {
  const scores = await fetchLeaderboard('latte-art', 10)
  const container = $('#leaderboard-container')
  renderLeaderboard(container, scores, {
    game: 'latte-art',
    currentScore,
    currentNickname,
    lowerIsBetter: true,
  })
}

// --- Reset ---
function resetGame() {
  state.phase = 'idle'
  state.elapsed = 0
  setRevealProgress(0, 0)
  updateTimer(0)
  pourHint.textContent = getLocale() === 'zh' ? '按住倒奶' : 'Hold to Pour'
  timerEl.classList.remove('warm', 'hot', 'target', 'danger')
  endGlow.classList.remove('active')
  gameScreen.classList.remove('result')
}

// --- Download Wallpaper ---
async function downloadWallpaper() {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Wood background
  const woodGrad = ctx.createLinearGradient(0, 0, 0, H)
  woodGrad.addColorStop(0, '#1a120e')
  woodGrad.addColorStop(0.3, '#2a1e18')
  woodGrad.addColorStop(0.5, '#352820')
  woodGrad.addColorStop(0.7, '#2a1e18')
  woodGrad.addColorStop(1, '#1a120e')
  ctx.fillStyle = woodGrad
  ctx.fillRect(0, 0, W, H)

  // Wood grain lines
  ctx.strokeStyle = 'rgba(139, 109, 78, 0.06)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 35) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 8, H)
    ctx.stroke()
  }

  // Center coordinates
  const cx = W / 2, cy = H * 0.42

  // Teal glow rings
  for (let i = 3; i >= 1; i--) {
    const r = 220 + i * 40
    const alpha = 0.06 + i * 0.04
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(45, 212, 168, ${alpha})`
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Glow effect
    ctx.shadowColor = 'rgba(45, 212, 168, 0.3)'
    ctx.shadowBlur = 20
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Radial teal glow behind cup
  const glowGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 320)
  glowGrad.addColorStop(0, 'rgba(45, 212, 168, 0.12)')
  glowGrad.addColorStop(0.5, 'rgba(45, 212, 168, 0.05)')
  glowGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, W, H)

  // Cup - render the SVG onto canvas
  const cupSvg = $('.cup-svg')
  const svgData = new XMLSerializer().serializeToString(cupSvg)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })

  const cupSize = 420
  ctx.drawImage(img, cx - cupSize / 2, cy - cupSize / 2, cupSize, cupSize)
  URL.revokeObjectURL(url)

  // Outer rim glow on cup
  ctx.beginPath()
  ctx.arc(cx, cy, cupSize / 2 + 4, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(45, 212, 168, 0.2)'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(45, 212, 168, 0.4)'
  ctx.shadowBlur = 15
  ctx.stroke()
  ctx.shadowBlur = 0

  // Branding at bottom
  ctx.fillStyle = 'rgba(232, 201, 160, 0.4)'
  ctx.font = '600 14px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('8.88 · SUPER DEVI', cx, H - 80)

  // Trigger download
  const link = document.createElement('a')
  link.download = `latte-art-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// --- Free-Drag Physics ---
const MAX_DRAG = 50
let dragOriginX = 0, dragOriginY = 0
let dragX = 0, dragY = 0
let velX = 0, velY = 0
let springFrame = null

function applyDragTransform() {
  const dist = Math.sqrt(dragX * dragX + dragY * dragY)
  const progress = Math.min(dist / MAX_DRAG, 1)
  // Rubber-band: the further you drag, the more resistance
  const rubber = 1 - progress * 0.4
  const rx = dragX * rubber
  const ry = dragY * rubber
  const scale = 1 - progress * 0.1
  const rot = dragX * 0.15 // slight tilt toward drag direction
  pourBtn.style.transform = `translate(${rx}px, ${ry}px) scale(${scale}) rotate(${rot}deg)`

  // Glow intensifies with distance
  const glowSize = 20 + progress * 40
  const glowAlpha = 0.08 + progress * 0.3
  pourBtn.style.boxShadow = `0 0 ${glowSize}px rgba(45, 212, 168, ${glowAlpha}), 0 0 ${glowSize * 2}px rgba(45, 212, 168, ${glowAlpha * 0.3})`
}

function springBack() {
  // Damped spring simulation
  const stiffness = 0.15
  const damping = 0.7

  velX += -dragX * stiffness
  velY += -dragY * stiffness
  velX *= damping
  velY *= damping
  dragX += velX
  dragY += velY

  applyDragTransform()

  if (Math.abs(dragX) < 0.3 && Math.abs(dragY) < 0.3 && Math.abs(velX) < 0.1 && Math.abs(velY) < 0.1) {
    dragX = 0; dragY = 0; velX = 0; velY = 0
    pourBtn.style.transform = ''
    pourBtn.style.boxShadow = ''
    cancelAnimationFrame(springFrame)
    springFrame = null
    return
  }
  springFrame = requestAnimationFrame(springBack)
}

function releaseDrag() {
  if (springFrame) cancelAnimationFrame(springFrame)
  // Kick off spring with current velocity
  springFrame = requestAnimationFrame(springBack)
}

// --- Event Binding ---
pourBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  pourBtn.setPointerCapture(e.pointerId)
  if (springFrame) { cancelAnimationFrame(springFrame); springFrame = null }
  dragOriginX = e.clientX
  dragOriginY = e.clientY
  dragX = 0; dragY = 0; velX = 0; velY = 0
  startPour()
})

pourBtn.addEventListener('pointermove', (e) => {
  if (state.phase !== 'pouring') return
  const newX = e.clientX - dragOriginX
  const newY = e.clientY - dragOriginY
  // Track velocity for spring release
  velX = (newX - dragX) * 0.5
  velY = (newY - dragY) * 0.5
  dragX = newX
  dragY = newY
  applyDragTransform()
})

pourBtn.addEventListener('pointerup', (e) => {
  e.preventDefault()
  releaseDrag()
  endPour()
})

pourBtn.addEventListener('pointercancel', () => {
  releaseDrag()
  if (state.phase === 'pouring') endPour()
})

// Prevent context menu on long press
pourBtn.addEventListener('contextmenu', (e) => e.preventDefault())

// Prevent scrolling
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

// Again button
$('#btn-again').addEventListener('click', resetGame)

// Download wallpaper button
$('#btn-download').addEventListener('click', downloadWallpaper)

// Init locale
initLocale()

// Re-render result screen when locale toggles
window.addEventListener('localechange', () => {
  if (state.phase === 'result' && state.lastResult) {
    renderResultText()
    // Re-render leaderboard in new locale
    const nickname = getNickname() || (getLocale() === 'zh' ? '匿名玩家' : 'Anonymous')
    loadLeaderboard(state.lastResult.delta, nickname)
  }
  // Update pour hint if on idle screen
  if (state.phase === 'idle') {
    pourHint.textContent = getLocale() === 'zh' ? '按住倒奶' : 'Hold to Pour'
  }
})

// Export for potential external use
export { resetGame }
