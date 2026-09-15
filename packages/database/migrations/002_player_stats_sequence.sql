ALTER TABLE player_game_stats
  ADD COLUMN last_processed_sequence INTEGER NOT NULL DEFAULT 0
  CHECK (last_processed_sequence >= 0);
