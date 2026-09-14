CREATE TABLE games (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (
    status IN ('scheduled', 'live', 'final', 'postponed', 'cancelled')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (home_team_id <> away_team_id)
);

CREATE TABLE game_events (
  event_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'period_start',
      'period_end',
      'shot_made',
      'shot_missed',
      'free_throw_made',
      'free_throw_missed',
      'rebound',
      'assist',
      'turnover',
      'steal',
      'block',
      'foul',
      'substitution',
      'timeout',
      'game_end'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL,
  period INTEGER NOT NULL CHECK (period > 0),
  clock TEXT NOT NULL,
  source TEXT NOT NULL,
  source_event_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, sequence)
);

CREATE UNIQUE INDEX game_events_source_event_id_unique
  ON game_events (source, source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE TABLE processed_events (
  consumer TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES game_events(event_id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consumer, event_id)
);

CREATE TABLE game_state (
  game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score INTEGER NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  period INTEGER NOT NULL DEFAULT 0 CHECK (period >= 0),
  clock TEXT NOT NULL DEFAULT '12:00',
  status TEXT NOT NULL CHECK (
    status IN ('scheduled', 'live', 'final', 'postponed', 'cancelled')
  ),
  last_processed_sequence INTEGER NOT NULL DEFAULT 0 CHECK (
    last_processed_sequence >= 0
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (home_team_id <> away_team_id)
);

CREATE TABLE player_game_stats (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  rebounds INTEGER NOT NULL DEFAULT 0 CHECK (rebounds >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  steals INTEGER NOT NULL DEFAULT 0 CHECK (steals >= 0),
  blocks INTEGER NOT NULL DEFAULT 0 CHECK (blocks >= 0),
  turnovers INTEGER NOT NULL DEFAULT 0 CHECK (turnovers >= 0),
  field_goals_made INTEGER NOT NULL DEFAULT 0 CHECK (field_goals_made >= 0),
  field_goals_attempted INTEGER NOT NULL DEFAULT 0 CHECK (
    field_goals_attempted >= field_goals_made
  ),
  three_pointers_made INTEGER NOT NULL DEFAULT 0 CHECK (
    three_pointers_made >= 0
  ),
  three_pointers_attempted INTEGER NOT NULL DEFAULT 0 CHECK (
    three_pointers_attempted >= three_pointers_made
  ),
  free_throws_made INTEGER NOT NULL DEFAULT 0 CHECK (free_throws_made >= 0),
  free_throws_attempted INTEGER NOT NULL DEFAULT 0 CHECK (
    free_throws_attempted >= free_throws_made
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, player_id)
);

CREATE INDEX game_events_game_sequence_idx
  ON game_events (game_id, sequence);
