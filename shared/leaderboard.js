/**
 * Leaderboard component — shared across all games
 * Fetches from Cloudflare Worker API, renders into a container
 * Long-press a row to delete it
 */

import { getLocale } from '/shared/i18n.js'

const API_BASE = '/api/leaderboard'

/**
 * Submit a score to the leaderboard
 */
export async function submitScore(entry) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    return res.ok ? await res.json() : null
  } catch {
    console.warn('Leaderboard submit failed — offline?')
    return null
  }
}

/**
 * Fetch top scores for a game
 */
export async function fetchLeaderboard(game, limit = 10) {
  try {
    const res = await fetch(`${API_BASE}/${game}?limit=${limit}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.scores || []
  } catch {
    console.warn('Leaderboard fetch failed — offline?')
    return []
  }
}

/**
 * Delete a score by id
 */
async function deleteScore(game, id) {
  try {
    const res = await fetch(`${API_BASE}/${game}?id=${id}`, { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Render leaderboard into a container element
 */
export function renderLeaderboard(container, scores, options = {}) {
  const zh = getLocale() === 'zh'
  const t = zh
    ? { title: '排行榜', empty: '暂无记录', del: '删除', cancel: '取消', confirmMsg: '删除这条记录？' }
    : { title: 'Leaderboard', empty: 'No scores yet', del: 'Delete', cancel: 'Cancel', confirmMsg: 'Delete this score?' }

  if (!scores.length) {
    container.innerHTML = `
      <div class="leaderboard">
        <div class="leaderboard-title">${t.title}</div>
        <p style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:var(--space-lg)">
          ${t.empty}
        </p>
      </div>`
    return
  }

  const rows = scores.map((s, i) => {
    const isHighlight =
      options.currentNickname &&
      s.nickname === options.currentNickname &&
      Math.abs(s.score - options.currentScore) < 0.001
    const rankClass = i < 3 ? 'top-3' : ''
    const medals = ['🥇', '🥈', '🥉']
    const rank = i < 3 ? medals[i] : `${i + 1}`

    return `
      <div class="leaderboard-row ${isHighlight ? 'highlight' : ''}" data-id="${s.id}">
        <span class="leaderboard-rank ${rankClass}">${rank}</span>
        <span class="leaderboard-name">${escapeHtml(s.nickname)}</span>
        <span class="leaderboard-score">${formatScore(s.score, options.lowerIsBetter)}</span>
      </div>`
  }).join('')

  container.innerHTML = `
    <div class="leaderboard">
      <div class="leaderboard-title">${t.title}</div>
      ${rows}
    </div>`

  // Long-press to delete
  let pressTimer = null
  const rowEls = container.querySelectorAll('.leaderboard-row')

  rowEls.forEach(row => {
    const startPress = (e) => {
      pressTimer = setTimeout(() => {
        pressTimer = null
        const id = row.dataset.id
        const name = row.querySelector('.leaderboard-name').textContent
        showDeleteModal(container, t, name, () => {
          deleteScore(options.game, id).then(ok => {
            if (ok) {
              row.remove()
            }
          })
        })
      }, 600)
    }

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer)
        pressTimer = null
      }
    }

    row.addEventListener('pointerdown', startPress)
    row.addEventListener('pointerup', cancelPress)
    row.addEventListener('pointerleave', cancelPress)
    row.addEventListener('contextmenu', e => e.preventDefault())
  })
}

function showDeleteModal(container, t, name, onConfirm) {
  // Remove any existing modal
  const existing = document.querySelector('.lb-modal-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'lb-modal-overlay'
  overlay.innerHTML = `
    <div class="lb-modal">
      <div class="lb-modal-name">${escapeHtml(name)}</div>
      <div class="lb-modal-msg">${t.confirmMsg}</div>
      <div class="lb-modal-actions">
        <button class="btn lb-modal-cancel">${t.cancel}</button>
        <button class="btn btn-danger lb-modal-delete">${t.del}</button>
      </div>
    </div>`

  overlay.querySelector('.lb-modal-cancel').addEventListener('click', () => overlay.remove())
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  overlay.querySelector('.lb-modal-delete').addEventListener('click', () => {
    onConfirm()
    overlay.remove()
  })

  document.body.appendChild(overlay)
}

function formatScore(score, lowerIsBetter) {
  if (lowerIsBetter) {
    return `±${score.toFixed(2)}s`
  }
  return `${Math.round(score)}`
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
