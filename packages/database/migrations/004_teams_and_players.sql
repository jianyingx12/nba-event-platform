CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  abbreviation TEXT NOT NULL,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX players_team_id_idx ON players (team_id);
