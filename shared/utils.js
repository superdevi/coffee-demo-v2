/**
 * Get/set player nickname from localStorage
 */
export function getNickname() {
  return localStorage.getItem('coffee_nickname') || ''
}

export function setNickname(name) {
  localStorage.setItem('coffee_nickname', name.trim())
}

export function getCompany() {
  return localStorage.getItem('coffee_company') || ''
}

export function setCompany(name) {
  localStorage.setItem('coffee_company', name.trim())
}

/**
 * Clamp a number between min and max
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

/**
 * Ease-out curve (deceleration)
 */
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Lerp between two values
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Navigate to a game or screen
 */
export function navigateTo(path) {
  window.location.href = path
}
