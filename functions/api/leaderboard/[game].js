// GET /api/leaderboard/:game — fetch top scores
export async function onRequestGet(context) {
  const { DB } = context.env
  const game = context.params.game
  const url = new URL(context.request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50)

  try {
    const { results } = await DB.prepare(
      'SELECT id, nickname, company, score, grade, created_at FROM scores WHERE game = ? ORDER BY score ASC LIMIT ?'
    ).bind(game, limit).all()

    return Response.json({ scores: results })
  } catch (err) {
    return Response.json({ scores: [] }, { status: 500 })
  }
}

// DELETE /api/leaderboard/:game?id=123 — delete a score
export async function onRequestDelete(context) {
  const { DB } = context.env
  const game = context.params.game
  const url = new URL(context.request.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return Response.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    await DB.prepare(
      'DELETE FROM scores WHERE id = ? AND game = ?'
    ).bind(id, game).run()

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
