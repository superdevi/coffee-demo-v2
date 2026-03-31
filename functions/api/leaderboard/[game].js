// GET /api/leaderboard/:game — fetch top scores
export async function onRequestGet(context) {
  const { DB } = context.env
  const game = context.params.game
  const url = new URL(context.request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50)

  try {
    const { results } = await DB.prepare(
      'SELECT nickname, company, score, grade, created_at FROM scores WHERE game = ? ORDER BY score ASC LIMIT ?'
    ).bind(game, limit).all()

    return Response.json({ scores: results })
  } catch (err) {
    return Response.json({ scores: [] }, { status: 500 })
  }
}
