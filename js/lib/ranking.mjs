// Pure ranking logic for the pool's homepage, kept separate from rendering
// so it's testable without a DOM (see tests/ranking.test.mjs).

export function summarizePerson(owner, codes, teams) {
  const summary = {
    owner,
    teams: codes.map((code) => teams[code]).filter(Boolean),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };
  for (const team of summary.teams) {
    summary.played += team.played;
    summary.won += team.won;
    summary.drawn += team.drawn;
    summary.lost += team.lost;
    summary.goalsFor += team.goalsFor;
    summary.goalsAgainst += team.goalsAgainst;
    summary.points += team.points;
  }
  summary.goalDiff = summary.goalsFor - summary.goalsAgainst;
  return summary;
}

// Ranks by points, then goal difference, then owner name alphabetically.
export function compareSummaries(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  return a.owner.localeCompare(b.owner);
}
