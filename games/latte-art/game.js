/**
 * 8.88 Latte Art Game
 * Hold to pour milk. Release as close to 8.88 seconds as possible.
 */

import { getNickname, getCompany } from '/shared/utils.js'
import { vibrateShort, vibrateMedium, vibrateHeavy, vibratePattern } from '/shared/haptics.js'
import { submitScore, fetchLeaderboard, renderLeaderboard } from '/shared/leaderboard.js'
import { initLocale, getLocale } from '/shared/i18n.js'

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
const bgGlow = $('.bg-glow')
const pourBtn = $('.pour-btn')
const pourHint = $('.pour-hint')
const revealMask = $('#reveal-mask-circle')
const milkGlow = $('#milk-glow')
const gameScreen = $('#game-screen')
const resultScreen = $('#result-screen')

// --- SVG Reveal ---
const REVEAL_RADIUS_MAX = 130 // enough to show full art

function setRevealProgress(progress) {
  const radius = progress * REVEAL_RADIUS_MAX
  revealMask.setAttribute('r', radius)
  // milk impact glow
  milkGlow.setAttribute('r', Math.min(radius * 0.4, 30))
  milkGlow.style.opacity = state.phase === 'pouring' ? 0.6 : 0
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

  // Haptic rhythm at 8s+
  if (elapsed >= 8.0 && elapsed < TARGET) {
    const beatInterval = elapsed >= 8.5 ? 200 : 400
    const timeSinceBeat = ((elapsed - 8.0) * 1000) % beatInterval
    if (timeSinceBeat < 20) {
      vibrateShort()
    }
  }

  // Danger zone (past target)
  if (elapsed > TARGET) {
    cupContainer.classList.add('shake')
    overflowRing.classList.add('active')
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
  setRevealProgress(easeOutCubic(progress))
  updateTimer(state.elapsed)
  updateTension(state.elapsed)

  state.animFrame = requestAnimationFrame(gameLoop)
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

// --- Pour Start ---
function startPour() {
  if (state.phase !== 'idle') return
  state.phase = 'pouring'
  state.startTime = performance.now()
  state.elapsed = 0

  pourStream.classList.add('active')
  steamContainer.classList.add('active')
  pourBtn.classList.add('pressing')
  pourHint.textContent = getLocale() === 'zh' ? '松开' : 'Release'
  vibrateMedium()

  state.animFrame = requestAnimationFrame(gameLoop)
}

// --- Pour End ---
function endPour() {
  if (state.phase !== 'pouring') return
  state.phase = 'result'

  cancelAnimationFrame(state.animFrame)
  pourStream.classList.remove('active')
  pourBtn.classList.remove('pressing')
  steamContainer.classList.remove('active')
  cupContainer.classList.remove('shake')
  heartbeatRing.classList.remove('active', 'fast')
  overflowRing.classList.remove('active')
  bgGlow.classList.remove('active', 'intense')

  vibrateHeavy()

  // Screen flash
  const delta = Math.abs(state.elapsed - TARGET)
  const flash = document.createElement('div')
  flash.className = `screen-flash ${delta < 0.05 ? 'white' : delta < 0.3 ? 'gold' : ''}`
  if (flash.classList.contains('white') || flash.classList.contains('gold')) {
    document.body.appendChild(flash)
    flash.addEventListener('animationend', () => flash.remove())
  }

  // Brief pause then show result
  setTimeout(() => showResult(state.elapsed), 700)
}

// --- Result Screen ---
function showResult(elapsed) {
  const delta = Math.abs(elapsed - TARGET)
  const grade = GRADES.find(g => delta < g.maxDelta)
  const sign = elapsed >= TARGET ? '+' : '-'

  // Store for locale re-render
  state.lastResult = { elapsed, delta, grade, sign }

  // Mini cup SVG in result
  const resultCup = $('#result-cup-svg')
  const resultMask = resultCup.querySelector('#result-reveal-circle')
  const progress = Math.min(elapsed / TARGET, 1)
  resultMask.setAttribute('r', easeOutCubic(progress) * 55)

  // Render locale-dependent text
  renderResultText()

  // Show result screen
  gameScreen.classList.add('hidden')
  resultScreen.classList.remove('hidden')

  // Submit score & load leaderboard
  const locale = getLocale()
  const nickname = getNickname() || (locale === 'zh' ? '匿名玩家' : 'Anonymous')
  const company = getCompany()
  submitScore({ game: 'latte-art', nickname, company, score: delta, grade: locale === 'zh' ? grade.cn : grade.en })
  loadLeaderboard(delta, nickname)
}

function renderResultText() {
  if (!state.lastResult) return
  const { elapsed, delta, grade, sign } = state.lastResult
  const locale = getLocale()
  const messages = locale === 'zh' ? grade.messagesZh : grade.messagesEn
  const message = messages[Math.floor(Math.random() * messages.length)]

  $('#result-time').textContent = elapsed.toFixed(2)
  $('#result-delta').textContent = `${sign}${delta.toFixed(2)}s`
  $('#result-grade').textContent = locale === 'zh' ? grade.cn : grade.en
  $('#result-grade').className = `result-grade ${grade.cls}`
  $('#result-message').textContent = message
}

async function loadLeaderboard(currentScore, currentNickname) {
  const scores = await fetchLeaderboard('latte-art', 10)
  const container = $('#leaderboard-container')
  renderLeaderboard(container, scores, {
    currentScore,
    currentNickname,
    lowerIsBetter: true,
  })
}

// --- Reset ---
function resetGame() {
  state.phase = 'idle'
  state.elapsed = 0
  setRevealProgress(0)
  updateTimer(0)
  pourHint.textContent = getLocale() === 'zh' ? '按住倒奶' : 'Hold to Pour'
  timerEl.classList.remove('warm', 'hot', 'target', 'danger')
  resultScreen.classList.add('hidden')
  gameScreen.classList.remove('hidden')
}

// --- Event Binding ---
// Pointer events for unified touch/mouse
pourBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  startPour()
})

pourBtn.addEventListener('pointerup', (e) => {
  e.preventDefault()
  endPour()
})

pourBtn.addEventListener('pointerleave', (e) => {
  if (state.phase === 'pouring') endPour()
})

// Prevent context menu on long press
pourBtn.addEventListener('contextmenu', (e) => e.preventDefault())

// Prevent scrolling
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

// Again button
$('#btn-again').addEventListener('click', resetGame)

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
