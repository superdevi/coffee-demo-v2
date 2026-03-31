CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  nickname TEXT NOT NULL,
  company TEXT DEFAULT '',
  score REAL NOT NULL,
  grade TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores (game, score ASC);
