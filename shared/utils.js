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

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}
