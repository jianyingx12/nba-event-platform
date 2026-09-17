import type {
  GameAnalytics as GameAnalyticsData,
  Team,
} from '@nba-event-platform/schemas';

interface GameAnalyticsProps {
  analytics: GameAnalyticsData | null;
  teams: Team[];
}

interface ComparisonRow {
  away: string;
  home: string;
  label: string;
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function shootingLine(made: number, attempted: number, percentage: number) {
  return `${made}-${attempted} · ${formatPercentage(percentage)}`;
}

function comparisons(analytics: GameAnalyticsData): ComparisonRow[] {
  const { awayTeam: away, homeTeam: home } = analytics;

  return [
    {
      label: 'Field goals',
      away: shootingLine(
        away.fieldGoalsMade,
        away.fieldGoalsAttempted,
        away.fieldGoalPercentage,
      ),
      home: shootingLine(
        home.fieldGoalsMade,
        home.fieldGoalsAttempted,
        home.fieldGoalPercentage,
      ),
    },
    {
      label: 'Three-pointers',
      away: shootingLine(
        away.threePointersMade,
        away.threePointersAttempted,
        away.threePointPercentage,
      ),
      home: shootingLine(
        home.threePointersMade,
        home.threePointersAttempted,
        home.threePointPercentage,
      ),
    },
    {
      label: 'Free throws',
      away: shootingLine(
        away.freeThrowsMade,
        away.freeThrowsAttempted,
        away.freeThrowPercentage,
      ),
      home: shootingLine(
        home.freeThrowsMade,
        home.freeThrowsAttempted,
        home.freeThrowPercentage,
      ),
    },
    {
      label: 'Turnovers',
      away: String(away.turnovers),
      home: String(home.turnovers),
    },
  ];
}

export function GameAnalytics({ analytics, teams }: GameAnalyticsProps) {
  const teamLabel = (teamId: string) =>
    teams.find((team) => team.teamId === teamId)?.abbreviation ?? teamId;

  return (
    <section className="analytics" aria-labelledby="analytics-heading">
      <header className="section-heading">
        <div>
          <p>Team comparison</p>
          <h2 id="analytics-heading">Game analytics</h2>
        </div>
        {analytics ? (
          <span>Through event #{analytics.lastProcessedSequence}</span>
        ) : null}
      </header>

      {analytics ? (
        <div className="analytics__board">
          <div className="analytics__teams" aria-hidden="true">
            <span>{teamLabel(analytics.awayTeam.teamId)}</span>
            <span>Away / Home</span>
            <span>{teamLabel(analytics.homeTeam.teamId)}</span>
          </div>
          {comparisons(analytics).map((comparison) => (
            <div className="analytics__row" key={comparison.label}>
              <strong>{comparison.away}</strong>
              <span>{comparison.label}</span>
              <strong>{comparison.home}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="analytics__empty">Analytics have not been calculated.</p>
      )}
    </section>
  );
}
