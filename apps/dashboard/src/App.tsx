import { useState, type FormEvent } from 'react';

import { loadDashboardGame, type DashboardGame } from './api.js';

export function App() {
  const [gameId, setGameId] = useState(
    new URLSearchParams(window.location.search).get('game') ?? '',
  );
  const [game, setGame] = useState<DashboardGame | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function openGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedGameId = gameId.trim();
    if (!requestedGameId) return;

    setLoading(true);
    setStatus(`Loading ${requestedGameId}…`);

    try {
      const nextGame = await loadDashboardGame(requestedGameId);
      setGame(nextGame);
      setStatus('');
      window.history.replaceState(null, '', `?game=${requestedGameId}`);
    } catch (error) {
      setGame(null);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Event operations</p>
          <h1>Court signal</h1>
        </div>
        <span className="system-mark" aria-label="NBA event platform">
          NEP / 01
        </span>
      </header>

      <form className="game-picker" onSubmit={openGame}>
        <label htmlFor="game-id">Game ID</label>
        <div className="game-picker__controls">
          <input
            id="game-id"
            value={gameId}
            onChange={(event) => setGameId(event.target.value)}
            placeholder="0022400247"
            autoComplete="off"
          />
          <button disabled={loading} type="submit">
            {loading ? 'Opening…' : 'Open game'}
          </button>
        </div>
      </form>

      {status ? (
        <p className="status" role="status">
          {status}
        </p>
      ) : null}

      {game ? (
        <section className="loaded-game" aria-label="Loaded game">
          <span>{game.game.awayTeamId}</span>
          <strong>
            {game.state?.awayScore ?? '–'} : {game.state?.homeScore ?? '–'}
          </strong>
          <span>{game.game.homeTeamId}</span>
        </section>
      ) : (
        <div className="empty-state">
          <svg
            className="court-diagram"
            viewBox="0 0 500 470"
            role="img"
            aria-label="Basketball half court"
          >
            <rect className="court-line" x="2" y="2" width="496" height="466" />
            <path className="court-line" d="M30 2v138M470 2v138" />
            <path className="court-line" d="M30 140a235 235 0 0 0 440 0" />
            <rect
              className="court-line"
              x="170"
              y="2"
              width="160"
              height="188"
            />
            <circle className="court-line" cx="250" cy="190" r="60" />
            <path
              className="court-line court-line--muted"
              d="M190 190a60 60 0 0 0 120 0"
            />
            <path className="court-line" d="M215 46h70" />
            <circle className="court-rim" cx="250" cy="66" r="10" />
            <path className="court-line" d="M210 66a40 40 0 0 0 80 0" />
            <path className="court-line" d="M190 468a60 60 0 0 1 120 0" />
          </svg>
          <div className="empty-state__copy">
            <strong>No game loaded</strong>
            <span>
              Open a game to inspect its score, player stats, and event stream.
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
