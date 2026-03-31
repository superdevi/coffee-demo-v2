/**
 * SFX — procedural cyberpunk sounds using Web Audio API.
 * No audio files needed. Teal-themed digital tones.
 */

let ctx = null
let masterGain = null
let unlocked = false

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.3
    masterGain.connect(ctx.destination)
  }
  return ctx
}

function dest() {
  getCtx()
  return masterGain
}

// iOS requires AudioContext to be resumed inside a user gesture.
// We unlock on the first touch/click, then play a silent buffer to fully activate.
function unlockAudio() {
  if (unlocked) return
  const c = getCtx()
  if (c.state === 'suspended') {
    c.resume()
  }
  // Play a silent buffer to fully unlock on iOS
  const buf = c.createBuffer(1, 1, c.sampleRate)
  const src = c.createBufferSource()
  src.buffer = buf
  src.connect(c.destination)
  src.start(0)
  unlocked = true
}

document.addEventListener('touchstart', unlockAudio, { once: false, passive: true })
document.addEventListener('touchend', unlockAudio, { once: false, passive: true })
document.addEventListener('pointerdown', unlockAudio, { passive: true })

/**
 * Soft digital "drip" — plays on pour start
 */
export function sfxPourStart() {
  const c = getCtx()
  const t = c.currentTime

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, t)
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.15)
  gain.gain.setValueAtTime(0.25, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)

  osc.connect(gain)
  gain.connect(dest())
  osc.start(t)
  osc.stop(t + 0.2)
}

/**
 * Gentle water/pour loop — ambient bubbling while pouring.
 * Returns a stop function.
 */
export function sfxPourLoop() {
  const c = getCtx()
  const out = dest()

  // White noise filtered to sound like liquid
  const bufferSize = c.sampleRate * 2
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5
  }

  const noise = c.createBufferSource()
  noise.buffer = buffer
  noise.loop = true

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 600
  filter.Q.value = 1.5

  // LFO to modulate filter for bubbling effect
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = 3
  lfoGain.gain.value = 200
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)

  const gain = c.createGain()
  gain.gain.setValueAtTime(0, c.currentTime)
  gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.5)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  lfo.start()
  noise.start()

  return function stop() {
    const t = c.currentTime
    gain.gain.linearRampToValueAtTime(0, t + 0.3)
    setTimeout(() => {
      try { noise.stop(); lfo.stop() } catch (e) {}
    }, 400)
  }
}

/**
 * Tick sound — subtle digital click, plays periodically during pour.
 * Pitch rises with elapsed time for tension.
 */
export function sfxTick(elapsed, target) {
  const c = getCtx()
  const t = c.currentTime
  const progress = Math.min(elapsed / target, 1.2)

  const osc = c.createOscillator()
  const gain = c.createGain()

  osc.type = 'triangle'
  // Pitch rises as you approach target
  const freq = 400 + progress * 600
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.06)

  const vol = 0.06 + progress * 0.1
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)

  osc.connect(gain)
  gain.connect(dest())
  osc.start(t)
  osc.stop(t + 0.07)
}

/**
 * Heartbeat pulse — low thump when near target (8s+)
 */
export function sfxHeartbeat(fast) {
  const c = getCtx()
  const t = c.currentTime

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(fast ? 70 : 55, t)
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.15)
  gain.gain.setValueAtTime(0.2, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)

  osc.connect(gain)
  gain.connect(dest())
  osc.start(t)
  osc.stop(t + 0.2)
}

/**
 * Release chime — plays when pour ends. Pitch depends on accuracy.
 */
export function sfxRelease(delta) {
  const c = getCtx()
  const t = c.currentTime

  // More accurate = higher, brighter chord
  const baseFreq = delta < 0.1 ? 523 : delta < 0.3 ? 440 : delta < 1 ? 349 : 261

  const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5]

  for (let i = 0; i < notes.length; i++) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = notes[i]

    const delay = i * 0.04
    gain.gain.setValueAtTime(0, t + delay)
    gain.gain.linearRampToValueAtTime(0.15, t + delay + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.6)

    osc.connect(gain)
    gain.connect(dest())
    osc.start(t + delay)
    osc.stop(t + delay + 0.6)
  }
}

/**
 * Warning buzz — when past target, danger zone
 */
export function sfxWarning() {
  const c = getCtx()
  const t = c.currentTime

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(120, t)

  gain.gain.setValueAtTime(0.04, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)

  osc.connect(gain)
  gain.connect(dest())
  osc.start(t)
  osc.stop(t + 0.1)
}

/**
 * UI button click — soft digital tap
 */
export function sfxClick() {
  const c = getCtx()
  const t = c.currentTime

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(660, t)
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.04)
  gain.gain.setValueAtTime(0.12, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)

  osc.connect(gain)
  gain.connect(dest())
  osc.start(t)
  osc.stop(t + 0.07)
}

/**
 * Keystroke — tiny high-pitched tick for typing
 */
export function sfxKeystroke() {
  const c = getCtx()
  const t = c.currentTime

  // Randomize pitch slightly for each keystroke
  const freq = 1200 + Math.random() * 400

  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.025)
  gain.gain.setValueAtTime(0.06, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03)

  osc.connect(gain)
  gain.connect(dest())
  osc.start(t)
  osc.stop(t + 0.04)
}
