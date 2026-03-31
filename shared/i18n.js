/**
 * Simple i18n — Chinese default, toggle to English
 */

const STORAGE_KEY = 'coffee_locale'

export function getLocale() {
  return localStorage.getItem(STORAGE_KEY) || 'zh'
}

export function setLocale(locale) {
  localStorage.setItem(STORAGE_KEY, locale)
}

export function toggleLocale() {
  const next = getLocale() === 'zh' ? 'en' : 'zh'
  setLocale(next)
  applyLocale()
  window.dispatchEvent(new CustomEvent('localechange', { detail: next }))
  return next
}

/**
 * Apply locale to all elements with data-zh / data-en attributes
 */
export function applyLocale() {
  const locale = getLocale()
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'

  document.querySelectorAll('[data-zh][data-en]').forEach(el => {
    el.textContent = el.getAttribute(`data-${locale}`)
  })

  // Update placeholder attributes
  document.querySelectorAll('[data-zh-placeholder][data-en-placeholder]').forEach(el => {
    el.placeholder = el.getAttribute(`data-${locale}-placeholder`)
  })

  // Update toggle button label
  const toggleBtn = document.getElementById('locale-toggle')
  if (toggleBtn) {
    toggleBtn.textContent = locale === 'zh' ? 'EN' : '中'
  }
}

/**
 * Inject the locale toggle button and apply locale on load
 */
export function initLocale() {
  // Create toggle button
  const btn = document.createElement('button')
  btn.id = 'locale-toggle'
  btn.className = 'locale-toggle'
  btn.textContent = getLocale() === 'zh' ? 'EN' : '中'
  btn.addEventListener('click', toggleLocale)
  document.body.appendChild(btn)

  // Apply on load
  applyLocale()
}
