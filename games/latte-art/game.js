/**
 * 8.88 Latte Art Game
 * Hold to pour milk. Release as close to 8.88 seconds as possible.
 */

import { getNickname } from '/shared/utils.js'
import { vibrateShort, vibrateMedium, vibrateHeavy, vibratePattern } from '/shared/haptics.js'
import { submitScore, fetchLeaderboard, renderLeaderboard } from '/shared/leaderboard.js'

const TARGET = 8.88
const MAX_TIME = 12
const GRADES = [
  { maxDelta: 0.01, cn: '大师', en: 'Master', cls: 'master', messages: ['完美的一手 · Perfection in a pour', '你就是拉花之神 · The latte art deity'] },
  { maxDelta: 0.10, cn: '精准', en: 'Precision', cls: 'precision', messages: ['几乎完美 · Almost flawless', '极致专注 · Razor-sharp focus'] },
  { maxDelta: 0.30, cn: '漂亮', en: 'Beautiful', cls: 'beautiful', messages: ['手感不错 · Good instinct', '越来越近了 · Getting closer'] },
  { maxDelta: 1.00, cn: '不错', en: 'Not Bad', cls: 'notbad', messages: ['继续练习 · Keep practicing', '感觉在了 · The feel is there'] },
  { maxDelta: Infinity, cn: '再来', en: 'Try Again', cls: 'tryagain', messages: ['时间是门艺术 · Timing is an art', '再倒一杯 · Pour another'] },
]

// --- State ---
let state = {
  phase: 'idle', // idle | pouring | result
  startTime: 0,
  elapsed: 0,
  animFrame: null,
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
  pourHint.textContent = '松开 · Release'
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
  const message = grade.messages[Math.floor(Math.random() * grade.messages.length)]
  const sign = elapsed >= TARGET ? '+' : '-'

  // Populate result
  $('#result-time').textContent = elapsed.toFixed(2)
  $('#result-delta').textContent = `${sign}${delta.toFixed(2)}s`
  $('#result-grade').textContent = `${grade.cn} · ${grade.en}`
  $('#result-grade').className = `result-grade ${grade.cls}`
  $('#result-message').textContent = message

  // Mini cup SVG in result (clone and show revealed state)
  const resultCup = $('#result-cup-svg')
  const resultMask = resultCup.querySelector('#result-reveal-circle')
  const progress = Math.min(elapsed / TARGET, 1)
  resultMask.setAttribute('r', easeOutCubic(progress) * 55)

  // Show result screen
  gameScreen.classList.add('hidden')
  resultScreen.classList.remove('hidden')

  // Submit score & load leaderboard
  const nickname = getNickname() || '匿名玩家'
  submitScore({ game: 'latte-art', nickname, score: delta, grade: `${grade.cn} · ${grade.en}` })
  loadLeaderboard(delta, nickname)
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
  pourHint.textContent = '按住倒奶 · Hold to Pour'
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

// Export for potential external use
export { resetGame }
