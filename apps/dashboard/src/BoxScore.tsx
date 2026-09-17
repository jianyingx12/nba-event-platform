import type { PlayerGameStats } from '@nba-event-platform/schemas';

interface BoxScoreProps {
  players: PlayerGameStats[];
}

export function BoxScore({ players }: BoxScoreProps) {
  const sortedPlayers = [...players].sort(
    (left, right) => right.points - left.points,
  );

  return (
    <section className="box-score" aria-labelledby="box-score-heading">
      <header className="section-heading">
        <div>
          <p>Game totals</p>
          <h2 id="box-score-heading">Player box score</h2>
        </div>
        <span>{players.length} players</span>
      </header>

      {sortedPlayers.length > 0 ? (
        <div className="box-score__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Player ID</th>
                <th scope="col">PTS</th>
                <th scope="col">REB</th>
                <th scope="col">AST</th>
                <th scope="col">STL</th>
                <th scope="col">BLK</th>
                <th scope="col">TO</th>
                <th scope="col">FG</th>
                <th scope="col">3PT</th>
                <th scope="col">FT</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.playerId}>
                  <th scope="row">{player.playerId}</th>
                  <td className="box-score__points">{player.points}</td>
                  <td>{player.rebounds}</td>
                  <td>{player.assists}</td>
                  <td>{player.steals}</td>
                  <td>{player.blocks}</td>
                  <td>{player.turnovers}</td>
                  <td>
                    {player.fieldGoalsMade}-{player.fieldGoalsAttempted}
                  </td>
                  <td>
                    {player.threePointersMade}-{player.threePointersAttempted}
                  </td>
                  <td>
                    {player.freeThrowsMade}-{player.freeThrowsAttempted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="box-score__empty">No player stats have been processed.</p>
      )}
    </section>
  );
}
