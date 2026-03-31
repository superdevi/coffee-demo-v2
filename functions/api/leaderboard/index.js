// POST /api/leaderboard — submit a score (keep best only per nickname+game)
export async function onRequestPost(context) {
  const { DB } = context.env

  try {
    const body = await context.request.json()
    const { game, nickname, company, score, grade } = body

    if (!game || !nickname || score == null) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check for existing score by this player in this game
    const existing = await DB.prepare(
      'SELECT id, score FROM scores WHERE game = ? AND nickname = ?'
    ).bind(game, nickname).first()

    if (existing) {
      // Only update if new score is better (lower = closer to 8.88)
      if (score < existing.score) {
        await DB.prepare(
          'UPDATE scores SET score = ?, grade = ?, company = ?, created_at = datetime(\'now\') WHERE id = ?'
        ).bind(score, grade || '', company || '', existing.id).run()
        return Response.json({ ok: true, updated: true })
      }
      return Response.json({ ok: true, kept: true })
    }

    // New player — insert
    await DB.prepare(
      'INSERT INTO scores (game, nickname, company, score, grade) VALUES (?, ?, ?, ?, ?)'
    ).bind(game, nickname, company || '', score, grade || '').run()

    return Response.json({ ok: true, created: true })
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
