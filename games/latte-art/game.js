/**
 * 8.88 Latte Art Game
 * Hold to pour milk. Release as close to 8.88 seconds as possible.
 */

import { getNickname, setNickname, getCompany, setCompany } from '/shared/utils.js'
import { vibrateShort, vibrateMedium, vibrateHeavy, vibratePattern } from '/shared/haptics.js'
import { submitScore, fetchLeaderboard, renderLeaderboard } from '/shared/leaderboard.js'
import { initLocale, getLocale } from '/shared/i18n.js'
import { sfxPourStart, sfxPourLoop, sfxTick, sfxHeartbeat, sfxRelease, sfxWarning, sfxClick, sfxKeystroke } from '/shared/sfx.js'

let stopPourLoop = null

const TARGET = 8.88
const MAX_TIME = 12
const GRADES = [
  { maxDelta: 0.01, cn: '封神!', en: 'GODLIKE!', cls: 'master', messagesZh: ['你是开挂的吧?!', '离谱 直接封神'], messagesEn: ['Are you cheating?!', 'Absolutely godlike'] },
  { maxDelta: 0.05, cn: '精准降落', en: 'INSANE!', cls: 'precision', messagesZh: ['这也太稳了', '丝滑得不像话'], messagesEn: ['Way too clean', 'Impossibly smooth'] },
  { maxDelta: 0.15, cn: '太强了', en: 'SICK!', cls: 'beautiful', messagesZh: ['就差亿点点!', '这手感绝了'], messagesEn: ['Just a hair off!', 'Incredible feel'] },
  { maxDelta: 0.40, cn: '666', en: 'Nice!', cls: 'beautiful', messagesZh: ['有点东西哦', '稳住 下把封神'], messagesEn: ['You got this!', 'Next one is the one'] },
  { maxDelta: 0.80, cn: '差点意思', en: 'Almost!', cls: 'notbad',
    overZh: ['奶多了一点点', '再冲一把?'], underZh: ['再大胆一点!', '感觉快了 冲!'],
    overEn: ['A bit too much milk', 'One more try?'], underEn: ['Be braver!', 'Almost there!'] },
  { maxDelta: 1.50, cn: '翻车了', en: 'Oops!', cls: 'tryagain',
    overZh: ['做成卡布奇诺了', '奶倒太多 拉花都没了'], underZh: ['太早松手了吧', '咖啡还没准备好呢'],
    overEn: ['Made a cappuccino instead', 'Too much milk'], underEn: ['Let go too early', 'Coffee wasn\'t ready yet'] },
  { maxDelta: 3.00, cn: '离谱', en: 'Bruh', cls: 'tryagain',
    overZh: ['这是在做牛奶吧', '咖啡说：我呢?'], underZh: ['就这? 还没开始呢', '杯子都没捂热'],
    overEn: ['This is just milk now', 'Coffee says: where am I?'], underEn: ['That\'s it?', 'Cup isn\'t even warm'] },
  { maxDelta: Infinity, cn: '???', en: '???', cls: 'tryagain',
    overZh: ['你在干嘛...', '手粘住了?'], underZh: ['碰都没碰吧', '是不是走错片场了'],
    overEn: ['What are you doing...', 'Finger stuck?'], underEn: ['Did you even try?', 'Wrong game?'] },
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
const pourBtn = $('.pour-touch-target')
const pourHint = $('#pour-hint')
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
    tb.setAttribute("baseFrequency", "0.001");
    tb.setAttribute("numOctaves", "2");
    tb.setAttribute("seed", "1");
    tb.setAttribute("result", "t");

    const dp = document.createElementNS(ns, "feDisplacementMap");
    dp.setAttribute("in", "SourceGraphic");
    dp.setAttribute("in2", "t");
    dp.setAttribute("scale", "250");
    dp.setAttribute("result", "dp");
    dp.setAttribute("xChannelSelector", "R");
    dp.setAttribute("yChannelSelector", "G");

    const bl = document.createElementNS(ns, "feGaussianBlur");
    bl.setAttribute("in", "dp");
    bl.setAttribute("stdDeviation", "2.5");

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

    gf.displacement.setAttribute("scale", String(250 * (1 - groupProgress)));
    gf.blur.setAttribute("stdDeviation", String(2.5 * (1 - groupProgress)));
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

  // milk impact glow — instant feedback on pour start
  const glowRad = 20 + Math.min(progress, 1) * 40;
  milkGlow.setAttribute('r', String(glowRad));
  milkGlow.style.opacity = state.phase === 'pouring' ? '0.7' : '0';

  // Overflow distortion when past target — art warps and stays warped
  if (elapsed > TARGET) {
    const overAmount = Math.min((elapsed - TARGET) / (10 - TARGET), 1); // 0→1, fully white by 10s
    cremaWhiten.setAttribute('opacity', String(overAmount));
    overflowFlood.setAttribute('r', String(Math.min(40 + overAmount * 68, 108)));
    overflowFlood.setAttribute('opacity', String(overAmount));

    // Fade the art when over-pouring — fully gone at max
    lotusArt.setAttribute('opacity', String(1 - overAmount));
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
}

// --- Tension Escalation ---
function updateTension(elapsed) {
  // --- Timer color: pink/red → green → gold ---
  timerEl.classList.remove('warm', 'hot', 'target', 'danger', 'perfect-zone')
  if (elapsed >= 8.50 && elapsed <= 9.26) {
    timerEl.classList.add('perfect-zone')
  } else if (elapsed > TARGET) {
    timerEl.classList.add('danger')
  } else if (elapsed >= 8.0) {
    timerEl.classList.add('target')
  } else if (elapsed >= 7.0) {
    timerEl.classList.add('hot')
  } else if (elapsed >= 5.0) {
    timerEl.classList.add('warm')
  }

  // --- Screen border flash in perfect zone ---
  if (elapsed >= 8.50 && elapsed <= 9.26) {
    gameScreen.classList.add('perfect-zone')
  } else {
    gameScreen.classList.remove('perfect-zone')
  }

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

  // --- Haptic heartbeat: starts at 6s, accelerates toward 8.88 ---
  if (elapsed >= 6.0 && elapsed < TARGET) {
    // Beat interval: 600ms at 6s → 150ms at 8.88s (accelerating)
    const t = (elapsed - 6.0) / (TARGET - 6.0)
    const beatInterval = 600 - t * 450
    const timeSinceBeat = ((elapsed - 6.0) * 1000) % beatInterval
    if (timeSinceBeat < 20) {
      if (elapsed >= 8.0) {
        vibrateMedium()
        sfxHeartbeat(elapsed >= 8.5)
      } else {
        vibrateShort()
      }
    }
  }

  // --- Cup shake: starts at 7s with gentle ease-in, intensifies past target ---
  if (elapsed >= 7.0) {
    cupContainer.classList.add('shake')
    const shakeT = elapsed > TARGET
      ? 1.0
      : Math.pow((elapsed - 7.0) / (TARGET - 7.0), 2)
    cupContainer.style.setProperty('--shake-intensity', shakeT.toFixed(3))
  } else {
    cupContainer.classList.remove('shake')
    cupContainer.style.removeProperty('--shake-intensity')
  }

  // --- Danger zone (past target): screen shake + overflow ---
  if (elapsed > TARGET) {
    overflowRing.classList.add('active')
    gameScreen.classList.add('overpour')
    if ((elapsed % 0.3) < 0.02) {
      sfxWarning()
      vibrateHeavy()
    }
  } else {
    overflowRing.classList.remove('active')
    gameScreen.classList.remove('overpour')
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
  // Start quick so users see immediate feedback, ease out toward the end
  return Math.pow(t, 0.7)
}

// --- Pour Start ---
function startPour() {
  if (state.phase !== 'idle') return
  state.phase = 'pouring'
  state.startTime = performance.now()
  state.elapsed = 0

  if (pourStream) pourStream.classList.add('active')
  steamContainer.classList.add('active')
  bagua.classList.add('pouring')
  cupContainer.classList.add('pouring')
  gameScreen.classList.add('pouring')
  vibrateMedium()
  sfxPourStart()
  stopPourLoop = sfxPourLoop()


  state.animFrame = requestAnimationFrame(gameLoop)
}

// --- Pour End ---
function endPour() {
  if (state.phase !== 'pouring') return
  state.phase = 'result'

  cancelAnimationFrame(state.animFrame)
  if (pourStream) pourStream.classList.remove('active')
  cupContainer.classList.remove('pouring')
  gameScreen.classList.remove('pouring')

  if (stopPourLoop) { stopPourLoop(); stopPourLoop = null }
  sfxRelease(Math.abs(state.elapsed - TARGET))
  bagua.classList.remove('pouring')
  steamContainer.classList.remove('active')
  cupContainer.classList.remove('shake')
  cupContainer.style.removeProperty('--shake-intensity')
  heartbeatRing.classList.remove('active', 'fast')
  overflowRing.classList.remove('active')
  bgGlow.classList.remove('active', 'intense')
  gameScreen.classList.remove('perfect-zone', 'overpour')
  timerEl.classList.remove('warm', 'hot', 'target', 'danger', 'perfect-zone')

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
  const { sign } = state.lastResult
  const over = sign === '+'
  let msgs
  if (grade.overZh) {
    msgs = locale === 'zh' ? (over ? grade.overZh : grade.underZh) : (over ? grade.overEn : grade.underEn)
  } else {
    msgs = locale === 'zh' ? grade.messagesZh : grade.messagesEn
  }
  $('#result-message').textContent = msgs[Math.floor(Math.random() * msgs.length)]
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
  timerEl.textContent = '8.88'
  timerEl.classList.remove('warm', 'hot', 'target', 'danger')
  timerEl.classList.add('target')
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
  const cx = W / 2

  // 1. Base image (with QR code baked in) — cover-fit to preserve aspect ratio
  try {
    const baseImg = await loadImage('/assets/bg_final/bg_share_base.webp')
    const imgRatio = baseImg.width / baseImg.height
    const canvasRatio = W / H
    let sx = 0, sy = 0, sw = baseImg.width, sh = baseImg.height
    if (imgRatio < canvasRatio) {
      // Image is taller — crop top/bottom
      sh = baseImg.width / canvasRatio
      sy = (baseImg.height - sh) / 2
    } else {
      // Image is wider — crop left/right
      sw = baseImg.height * canvasRatio
      sx = (baseImg.width - sw) / 2
    }
    ctx.drawImage(baseImg, sx, sy, sw, sh, 0, 0, W, H)
  } catch {
    ctx.fillStyle = '#2a1e18'
    ctx.fillRect(0, 0, W, H)
  }

  // Cup is baked into base image — center ~55% from top, liquid ~500px
  const cupCy = H * 0.50
  const cupSize = 480

  // 2. Latte art SVG — centered
  const cupSvg = $('.cup-svg')
  const svgData = new XMLSerializer().serializeToString(cupSvg)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const svgImg = await loadImage(svgUrl)
    ctx.drawImage(svgImg, cx - cupSize / 2, cupCy - cupSize / 2, cupSize, cupSize)
  } catch {}
  URL.revokeObjectURL(svgUrl)

  // 3. Text above cup: username → score → grade (top to bottom)
  const nickname = getNickname()
  const locale = getLocale()
  const scoreY = cupCy - cupSize / 2 - 180
  ctx.textAlign = 'center'

  // Username (above score)
  if (nickname) {
    ctx.fillStyle = 'rgba(232, 201, 160, 0.7)'
    ctx.font = '500 48px Inter, sans-serif'
    ctx.fillText(nickname.toUpperCase(), cx, scoreY - 100)
  }

  if (state.lastResult) {
    const { elapsed, grade } = state.lastResult

    // Time
    ctx.fillStyle = '#ffffff'
    ctx.font = '300 96px "JetBrains Mono", monospace'
    ctx.shadowColor = 'rgba(45, 212, 168, 0.4)'
    ctx.shadowBlur = 30
    ctx.fillText(elapsed.toFixed(2), cx, scoreY)
    ctx.shadowBlur = 0

    // Grade
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '300 36px Inter, sans-serif'
    ctx.letterSpacing = '0.2em'
    ctx.fillText(locale === 'zh' ? grade.cn : grade.en, cx, scoreY + 55)
  }

  // Save via Web Share API (mobile), fallback to download
  const filename = `latte-art-${Date.now()}.jpg`
  canvas.toBlob(async (blob) => {
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'image/jpeg' })
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
  }, 'image/jpeg', 0.9)
}

// --- Event Binding ---
pourBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  pourBtn.setPointerCapture(e.pointerId)
  startPour()
})

pourBtn.addEventListener('pointerup', (e) => {
  e.preventDefault()
  endPour()
})

pourBtn.addEventListener('pointercancel', () => {
  if (state.phase === 'pouring') endPour()
})

// Prevent context menu on long press
// Block all long-press behaviors (Huawei browser screenshot, context menus, etc.)
pourBtn.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('contextmenu', (e) => e.preventDefault())

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
    label.textContent = locale === 'zh' ? '拉花挑战8.88' : 'TARGET 8.88'
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
    }
  updateUserPourLabel()
})

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
  panelNickname.addEventListener('input', () => { setNickname(panelNickname.value); updateUserPourLabel() })
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
