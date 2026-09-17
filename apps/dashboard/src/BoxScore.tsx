import type {
  Player,
  PlayerGameStats,
  Team,
} from '@nba-event-platform/schemas';

interface BoxScoreProps {
  awayTeamId: string;
  homeTeamId: string;
  players: Player[];
  stats: PlayerGameStats[];
  teams: Team[];
}

interface TeamBoxScoreProps {
  playersById: Map<string, Player>;
  side: 'Away' | 'Home' | 'Team unavailable';
  stats: PlayerGameStats[];
  team?: Team;
}

function TeamBoxScore({ playersById, side, stats, team }: TeamBoxScoreProps) {
  const sortedStats = [...stats].sort(
    (left, right) => right.points - left.points,
  );

  return (
    <section className="box-score__team">
      <header className="box-score__team-heading">
        <span>{side}</span>
        <strong>
          {team ? `${team.city} ${team.name}` : 'Unassigned players'}
        </strong>
      </header>
      <div className="box-score__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Player</th>
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
            {sortedStats.map((playerStats) => (
              <tr key={playerStats.playerId}>
                <th scope="row">
                  {playersById.get(playerStats.playerId)?.displayName ??
                    playerStats.playerId}
                </th>
                <td className="box-score__points">{playerStats.points}</td>
                <td>{playerStats.rebounds}</td>
                <td>{playerStats.assists}</td>
                <td>{playerStats.steals}</td>
                <td>{playerStats.blocks}</td>
                <td>{playerStats.turnovers}</td>
                <td>
                  {playerStats.fieldGoalsMade}-{playerStats.fieldGoalsAttempted}
                </td>
                <td>
                  {playerStats.threePointersMade}-
                  {playerStats.threePointersAttempted}
                </td>
                <td>
                  {playerStats.freeThrowsMade}-{playerStats.freeThrowsAttempted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BoxScore({
  awayTeamId,
  homeTeamId,
  players,
  stats,
  teams,
}: BoxScoreProps) {
  const playersById = new Map(
    players.map((player) => [player.playerId, player]),
  );
  const teamForPlayer = (playerId: string) => playersById.get(playerId)?.teamId;
  const awayStats = stats.filter(
    (playerStats) => teamForPlayer(playerStats.playerId) === awayTeamId,
  );
  const homeStats = stats.filter(
    (playerStats) => teamForPlayer(playerStats.playerId) === homeTeamId,
  );
  const unassignedStats = stats.filter((playerStats) => {
    const teamId = teamForPlayer(playerStats.playerId);
    return teamId !== awayTeamId && teamId !== homeTeamId;
  });
  const findTeam = (teamId: string) =>
    teams.find((team) => team.teamId === teamId);

  return (
    <section className="box-score" aria-labelledby="box-score-heading">
      <header className="section-heading">
        <div>
          <p>Game totals</p>
          <h2 id="box-score-heading">Player box score</h2>
        </div>
        <span>{stats.length} players</span>
      </header>

      {stats.length > 0 ? (
        <div className="box-score__teams">
          <TeamBoxScore
            playersById={playersById}
            side="Away"
            stats={awayStats}
            team={findTeam(awayTeamId)}
          />
          <TeamBoxScore
            playersById={playersById}
            side="Home"
            stats={homeStats}
            team={findTeam(homeTeamId)}
          />
          {unassignedStats.length > 0 ? (
            <TeamBoxScore
              playersById={playersById}
              side="Team unavailable"
              stats={unassignedStats}
            />
          ) : null}
        </div>
      ) : (
        <p className="box-score__empty">No player stats have been processed.</p>
      )}
    </section>
  );
}
