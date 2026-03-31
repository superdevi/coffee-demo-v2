/**
 * 8.88 Latte Art Game
 * Hold to pour milk. Release as close to 8.88 seconds as possible.
 */

import { getNickname, getCompany } from '/shared/utils.js'
import { vibrateShort, vibrateMedium, vibrateHeavy, vibratePattern } from '/shared/haptics.js'
import { submitScore, fetchLeaderboard, renderLeaderboard } from '/shared/leaderboard.js'
import { initLocale, getLocale } from '/shared/i18n.js'
import { initFoliageBorder } from '/shared/foliage-border.js'
import { sfxPourStart, sfxPourLoop, sfxTick, sfxHeartbeat, sfxRelease, sfxWarning, sfxClick, sfxKeystroke } from '/shared/sfx.js'

let foliage = null
let stopPourLoop = null

// --- BG style & test mode from URL params ---
const params = new URLSearchParams(window.location.search)
let bgStyle = parseInt(params.get('bg') || '1')

function applyBgStyle(style) {
  bgStyle = style
  const plants = document.querySelector('.bg-plants')
  const petals = document.querySelector('.bg-petals')
  const foliageCanvas = document.getElementById('foliage-canvas')

  if (style === 2) {
    // Style 2: static plants + petals, no animated foliage
    if (plants) plants.style.display = ''
    if (petals) petals.style.display = ''
    if (foliageCanvas) foliageCanvas.style.display = 'none'
  } else {
    // Style 1: animated foliage canvas, no static overlays
    if (plants) plants.style.display = 'none'
    if (petals) petals.style.display = 'none'
    if (foliageCanvas) foliageCanvas.style.display = ''
  }

  // Update toggle button label
  const btn = document.getElementById('bg-toggle')
  if (btn) btn.textContent = `BG ${style}`
}

// Init foliage for style 1
if (bgStyle === 1) {
  initFoliageBorder(document.getElementById('foliage-canvas')).then(f => { foliage = f })
} else {
  // Still init but hide canvas
  initFoliageBorder(document.getElementById('foliage-canvas')).then(f => { foliage = f })
}

// Apply initial style
applyBgStyle(bgStyle)

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
const pourBtnLabel = $('.pour-btn-label')
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

  // Overflow distortion when past target — art warps and stays warped
  if (elapsed > TARGET) {
    const overAmount = Math.min((elapsed - TARGET) / (MAX_TIME - TARGET), 1); // 0→1
    cremaWhiten.setAttribute('opacity', String(Math.min(overAmount * 0.6, 0.55)));
    overflowFlood.setAttribute('r', String(Math.min(40 + overAmount * 100, 108)));
    overflowFlood.setAttribute('opacity', String(Math.min(overAmount * 0.8, 0.7)));

    // Fade the art when over-pouring — no skew/scale, just opacity + flood
    lotusArt.setAttribute('opacity', String(1 - overAmount * 0.35));
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
 * Reveal curve — art starts appearing around 1.5-2s, fills gradually toward 8.88s.
 * At t=0.2 (~1.8s) ~8% revealed. At t=0.5 (~4.4s) ~35%. Fills at t=1.0.
 */
function revealCurve(t) {
  return Math.pow(t, 1.8)
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
  pourBtnLabel.innerHTML = getLocale() === 'zh' ? '松开<br>结束' : 'RELEASE<br>TO FINISH'
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
  pourBtnLabel.innerHTML = getLocale() === 'zh' ? '按住<br>倒奶' : 'HOLD TO<br>POUR'
  timerEl.classList.remove('warm', 'hot', 'target', 'danger')
  endGlow.classList.remove('active')
  gameScreen.classList.remove('result')
  if (lbPanel) lbPanel.classList.remove('open')
}

// --- Download Wallpaper ---
async function loadImage(src) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = src
  })
  return img
}

async function downloadWallpaper() {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const cx = W / 2, cy = H * 0.42

  // 1. Wood background
  try {
    const woodImg = await loadImage('/assets/bg_final/bg_wood_00000.png')
    ctx.drawImage(woodImg, 0, 0, W, H)
  } catch {
    ctx.fillStyle = '#2a1e18'
    ctx.fillRect(0, 0, W, H)
  }

  // Dark overlay for readability
  const darkGrad = ctx.createLinearGradient(0, 0, 0, H)
  darkGrad.addColorStop(0, 'rgba(10,6,4,0.7)')
  darkGrad.addColorStop(0.4, 'rgba(10,6,4,0.5)')
  darkGrad.addColorStop(0.6, 'rgba(10,6,4,0.5)')
  darkGrad.addColorStop(1, 'rgba(10,6,4,0.7)')
  ctx.fillStyle = darkGrad
  ctx.fillRect(0, 0, W, H)

  // 2. Plants overlay (if bg style 2)
  if (bgStyle === 2) {
    try {
      const plantsImg = await loadImage('/assets/bg_final/bg_plants_00000.png')
      ctx.globalAlpha = 0.6
      ctx.drawImage(plantsImg, 0, 0, W, H)
      ctx.globalAlpha = 1
    } catch {}
    try {
      const petalsImg = await loadImage('/assets/bg_final/bg_pedal_00000.png')
      ctx.globalAlpha = 0.5
      ctx.drawImage(petalsImg, 0, 0, W, H)
      ctx.globalAlpha = 1
    } catch {}
  }

  // 3. Bagua glow
  const glowGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 320)
  glowGrad.addColorStop(0, 'rgba(88, 230, 218, 0.12)')
  glowGrad.addColorStop(0.5, 'rgba(88, 230, 218, 0.05)')
  glowGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, W, H)

  // 4. Ornate cup image
  try {
    const cupBgImg = await loadImage('/assets/bg_final/bg_cup_00000.png')
    const cupBgSize = 550
    ctx.drawImage(cupBgImg,
      cupBgImg.width * 0.2, cupBgImg.height * 0.3, cupBgImg.width * 0.6, cupBgImg.width * 0.6,
      cx - cupBgSize / 2, cy - cupBgSize / 2, cupBgSize, cupBgSize
    )
  } catch {}

  // 5. Latte art SVG
  const cupSvg = $('.cup-svg')
  const svgData = new XMLSerializer().serializeToString(cupSvg)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const svgImg = await loadImage(svgUrl)
    const cupSize = 420
    ctx.drawImage(svgImg, cx - cupSize / 2, cy - cupSize / 2, cupSize, cupSize)
  } catch {}
  URL.revokeObjectURL(svgUrl)

  // 6. Score + grade text
  if (state.lastResult) {
    const { elapsed, grade } = state.lastResult
    const locale = getLocale()

    ctx.textAlign = 'center'

    // Time
    ctx.fillStyle = '#ffffff'
    ctx.font = '300 72px "JetBrains Mono", monospace'
    ctx.shadowColor = 'rgba(45, 212, 168, 0.4)'
    ctx.shadowBlur = 30
    ctx.fillText(elapsed.toFixed(2), cx, cy - 280)
    ctx.shadowBlur = 0

    // Grade
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '300 28px Inter, sans-serif'
    ctx.letterSpacing = '0.2em'
    ctx.fillText(locale === 'zh' ? grade.cn : grade.en, cx, cy - 230)
  }

  // 7. User info at bottom
  const nickname = getNickname()
  const company = getCompany()
  const locale = getLocale()

  ctx.textAlign = 'center'
  ctx.shadowBlur = 0

  // "CREATED BY" label
  ctx.fillStyle = 'rgba(232, 201, 160, 0.35)'
  ctx.font = '300 18px Inter, sans-serif'
  ctx.fillText(locale === 'zh' ? '作者' : 'CREATED BY', cx, H - 200)

  // Username
  if (nickname) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '400 32px Inter, sans-serif'
    ctx.shadowColor = 'rgba(232, 201, 160, 0.3)'
    ctx.shadowBlur = 12
    ctx.fillText(nickname.toUpperCase(), cx, H - 160)
    ctx.shadowBlur = 0
  }

  // Company
  if (company) {
    ctx.fillStyle = 'rgba(232, 201, 160, 0.5)'
    ctx.font = '300 22px Inter, sans-serif'
    ctx.fillText(company.toUpperCase(), cx, H - 125)
  }

  // WeChat ID line
  ctx.fillStyle = 'rgba(45, 212, 168, 0.4)'
  ctx.font = '300 16px Inter, sans-serif'
  ctx.fillText('MAXMAYONNAISE', cx, H - 85)

  // 8.88 branding
  ctx.fillStyle = 'rgba(232, 201, 160, 0.25)'
  ctx.font = '200 14px Inter, sans-serif'
  ctx.fillText('8.88 · SUPER DEVI', cx, H - 50)

  // Save to album via Web Share API (mobile), fallback to download
  const filename = `latte-art-${Date.now()}.png`
  canvas.toBlob(async (blob) => {
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/png' })
      const shareData = { files: [file] }
      if (navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData)
          return
        } catch (e) {
          // User cancelled or share failed — fall through to download
        }
      }
    }
    // Fallback: trigger download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
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
$('#btn-again').addEventListener('click', () => { sfxClick(); resetGame() })

// Download wallpaper button
$('#btn-download').addEventListener('click', () => { sfxClick(); downloadWallpaper() })

// Global: click sound on all buttons, keystroke on all text inputs
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('button, a.cyber-btn, .corner-btn, .lb-panel-close')
  if (el && el !== pourBtn) sfxClick()
})
document.addEventListener('input', (e) => {
  if (e.target.matches('input[type="text"], input:not([type])')) sfxKeystroke()
})

// Init locale + username label
initLocale()

function updateUserPourLabel() {
  const label = $('#user-pour-label')
  if (!label) return
  const name = getNickname()
  const locale = getLocale()
  if (name) {
    label.textContent = locale === 'zh' ? `${name.toUpperCase()} 的拉花` : `${name.toUpperCase()}'S POUR`
  } else {
    label.textContent = locale === 'zh' ? '拉花挑战' : 'LATTE ART'
  }
}
updateUserPourLabel()

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
    pourBtnLabel.innerHTML = getLocale() === 'zh' ? '按住<br>倒奶' : 'HOLD TO<br>POUR'
  }
  updateUserPourLabel()
})

// --- BG toggle button ---
const bgToggle = document.getElementById('bg-toggle')
if (bgToggle) {
  bgToggle.addEventListener('click', () => {
    const next = bgStyle === 1 ? 2 : 1
    applyBgStyle(next)
  })
}

// --- User panel ---
const userPanel = document.getElementById('user-panel')
const userBtn = document.getElementById('user-btn')
const panelNickname = document.getElementById('panel-nickname')
const panelCompany = document.getElementById('panel-company')
const panelClose = document.getElementById('user-panel-close')

if (userBtn && userPanel) {
  // Open
  userBtn.addEventListener('click', () => {
    panelNickname.value = getNickname()
    panelCompany.value = getCompany()
    userPanel.classList.add('open')
    panelNickname.focus()
  })

  // Save on input
  panelNickname.addEventListener('input', () => setNickname(panelNickname.value))
  panelCompany.addEventListener('input', () => setCompany(panelCompany.value))

  // Close
  panelClose.addEventListener('click', () => userPanel.classList.remove('open'))
  userPanel.addEventListener('click', (e) => {
    if (e.target === userPanel) userPanel.classList.remove('open')
  })
}

// --- Leaderboard slide panel (swipe left to open, swipe right to close) ---
const lbPanel = $('#lb-panel')
const lbClose = $('#lb-panel-close')
let touchStartX = 0
let touchStartY = 0

function openLbPanel() {
  lbPanel.classList.add('open')
}

function closeLbPanel() {
  lbPanel.classList.remove('open')
}

lbClose.addEventListener('click', closeLbPanel)

// Swipe detection on the whole document
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}, { passive: true })

document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY

  // Only trigger on horizontal swipes (not vertical scroll)
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return

  if (dx < -60 && state.phase === 'result' && !lbPanel.classList.contains('open')) {
    openLbPanel()
  } else if (dx > 60 && lbPanel.classList.contains('open')) {
    closeLbPanel()
  }
})

export { resetGame }
