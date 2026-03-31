/**
 * Leaderboard component — shared across all games
 * Fetches from Cloudflare Worker API, renders into a container
 */

const API_BASE = '/api/leaderboard'

/**
 * Submit a score to the leaderboard
 * @param {Object} entry
 * @param {string} entry.game - 'latte-art' | 'tap-tap' | 'cup-stack'
 * @param {string} entry.nickname
 * @param {number} entry.score
 * @param {string} [entry.grade]
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
 * @param {string} game
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
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
 * Render leaderboard into a container element
 * @param {HTMLElement} container
 * @param {Array} scores
 * @param {Object} [options]
 * @param {number} [options.currentScore] - highlight matching score
 * @param {string} [options.currentNickname]
 * @param {boolean} [options.lowerIsBetter] - for latte-art (delta scoring)
 */
export function renderLeaderboard(container, scores, options = {}) {
  if (!scores.length) {
    container.innerHTML = `
      <div class="leaderboard">
        <div class="leaderboard-title">排行榜 · Leaderboard</div>
        <p style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:var(--space-lg)">
          暂无记录 · No scores yet
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
      <div class="leaderboard-row ${isHighlight ? 'highlight' : ''}">
        <span class="leaderboard-rank ${rankClass}">${rank}</span>
        <span class="leaderboard-name">${escapeHtml(s.nickname)}</span>
        <span class="leaderboard-score">${formatScore(s.score, options.lowerIsBetter)}</span>
      </div>`
  }).join('')

  container.innerHTML = `
    <div class="leaderboard">
      <div class="leaderboard-title">排行榜 · Leaderboard</div>
      ${rows}
    </div>`
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
