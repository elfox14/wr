export type TeamMatchPerformanceInput = {
  averagePlayerRating: number;
  playerCount: number;
  goalsFor: number;
  goalsAgainst: number;
  yellowCards: number;
  redCards: number;
};

export type TeamMatchPerformanceResult = {
  teamRating: number;
  momentumImpact: number;
  marketImpact: number;
};

function value(n?: number | null) {
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function calculateTeamMatchPerformanceRating(input: TeamMatchPerformanceInput): TeamMatchPerformanceResult {
  const averagePlayerRating = value(input.averagePlayerRating);
  const goalsFor = value(input.goalsFor);
  const goalsAgainst = value(input.goalsAgainst);
  const yellowCards = value(input.yellowCards);
  const redCards = value(input.redCards);
  const goalDiff = goalsFor - goalsAgainst;

  let rating = 50;

  // Match result layer.
  if (goalDiff > 0) rating += 10;
  else if (goalDiff === 0) rating += 2;
  else rating -= 8;

  rating += clamp(goalDiff * 3, -12, 12);

  // Squad performance layer. The average player rating is the most stable signal.
  rating += (averagePlayerRating - 50) * 0.45;

  // Tactical box-score layer.
  rating += goalsFor * 4;
  if (goalsAgainst === 0) rating += 6;
  else rating -= goalsAgainst * 3;

  // Discipline layer.
  rating -= yellowCards * 0.8;
  rating -= redCards * 5;

  const teamRating = Math.round(clamp(rating) * 10) / 10;

  let momentumImpact = 0;
  let marketImpact = 0;

  if (teamRating >= 85) {
    momentumImpact = 14;
    marketImpact = 10;
  } else if (teamRating >= 75) {
    momentumImpact = 8;
    marketImpact = 5;
  } else if (teamRating >= 65) {
    momentumImpact = 3;
    marketImpact = 2;
  } else if (teamRating < 35) {
    momentumImpact = -14;
    marketImpact = -10;
  } else if (teamRating < 45) {
    momentumImpact = -8;
    marketImpact = -5;
  }

  return { teamRating, momentumImpact, marketImpact };
}

export function blendTeamFundamental(currentFundamental: number | null | undefined, teamRating: number) {
  const current = Number.isFinite(Number(currentFundamental)) ? Number(currentFundamental) : 50;
  return Math.round(((current * 0.80) + (teamRating * 0.20)) * 10) / 10;
}
