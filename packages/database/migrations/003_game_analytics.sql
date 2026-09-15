CREATE TABLE game_analytics (
  game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  home_team JSONB NOT NULL,
  away_team JSONB NOT NULL,
  last_processed_sequence INTEGER NOT NULL DEFAULT 0 CHECK (
    last_processed_sequence >= 0
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
