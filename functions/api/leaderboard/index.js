// POST /api/leaderboard — submit a score
export async function onRequestPost(context) {
  const { DB } = context.env

  try {
    const body = await context.request.json()
    const { game, nickname, company, score, grade } = body

    if (!game || !nickname || score == null) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await DB.prepare(
      'INSERT INTO scores (game, nickname, company, score, grade) VALUES (?, ?, ?, ?, ?)'
    ).bind(game, nickname, company || '', score, grade || '').run()

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
