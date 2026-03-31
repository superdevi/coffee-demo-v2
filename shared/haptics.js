/**
 * Haptic feedback wrapper — degrades gracefully
 */
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch { /* silently fail on iOS / restricted contexts */ }
}

export function vibrateShort() { vibrate(15) }
export function vibrateMedium() { vibrate(40) }
export function vibrateHeavy() { vibrate(80) }
export function vibratePattern(pattern) { vibrate(pattern) }
