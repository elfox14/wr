export type PlayerPerformanceInput = {
  position?: string | null;
  minutes?: number | null;
  started?: boolean | null;
  goals?: number | null;
  assists?: number | null;
  shotsTotal?: number | null;
  shotsOnTarget?: number | null;
  passes?: number | null;
  keyPasses?: number | null;
  passAccuracy?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  saves?: number | null;
  goalsConceded?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  apiRating?: number | null;
};

export type PlayerPerformanceResult = {
  internalRating: number;
  momentumImpact: number;
  marketImpact: number;
};

function value(n?: number | null) {
  return Number.isFinite(Number(n)) ? Number(n) : 0;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function calculatePlayerPerformanceRating(input: PlayerPerformanceInput): PlayerPerformanceResult {
  const position = String(input.position || '').toUpperCase();
  const minutes = value(input.minutes);
  const goals = value(input.goals);
  const assists = value(input.assists);
  const shotsTotal = value(input.shotsTotal);
  const shotsOnTarget = value(input.shotsOnTarget);
  const passes = value(input.passes);
  const keyPasses = value(input.keyPasses);
  const passAccuracy = value(input.passAccuracy);
  const tackles = value(input.tackles);
  const interceptions = value(input.interceptions);
  const saves = value(input.saves);
  const goalsConceded = value(input.goalsConceded);
  const yellowCards = value(input.yellowCards);
  const redCards = value(input.redCards);
  const apiRating = input.apiRating == null ? null : value(input.apiRating);

  let rating = 50;

  rating += goals * 12;
  rating += assists * 8;
  rating += shotsOnTarget * 3;
  rating += Math.max(0, shotsTotal - shotsOnTarget) * 1;
  rating += keyPasses * 2;

  if (passes >= 20) {
    if (passAccuracy >= 90) rating += 5;
    else if (passAccuracy >= 80) rating += 3;
    else if (passAccuracy > 0 && passAccuracy < 60) rating -= 4;
  }

  rating += tackles * 2;
  rating += interceptions * 2;

  if (position === 'GK') {
    rating += saves * 3;
    rating -= goalsConceded * 4;
  } else if (position === 'DEF') {
    rating -= Math.max(0, goalsConceded - 1) * 2;
  }

  rating -= yellowCards * 3;
  rating -= redCards * 12;

  if (input.started) rating += 5;
  if (minutes >= 75) rating += 5;
  else if (minutes > 0 && minutes < 30) rating -= 3;

  // Blend provider rating when available, but keep MC PRIME game economy logic in control.
  // API-Football ratings are usually 0-10, so convert to 0-100.
  if (apiRating && apiRating > 0) {
    const normalizedApiRating = apiRating <= 10 ? apiRating * 10 : apiRating;
    rating = (rating * 0.65) + (normalizedApiRating * 0.35);
  }

  const internalRating = Math.round(clamp(rating) * 10) / 10;

  let momentumImpact = 0;
  let marketImpact = 0;

  if (internalRating >= 85) {
    momentumImpact = 12;
    marketImpact = 8;
  } else if (internalRating >= 75) {
    momentumImpact = 6;
    marketImpact = 4;
  } else if (internalRating >= 65) {
    momentumImpact = 2;
    marketImpact = 1;
  } else if (internalRating < 35) {
    momentumImpact = -12;
    marketImpact = -8;
  } else if (internalRating < 45) {
    momentumImpact = -6;
    marketImpact = -4;
  }

  return { internalRating, momentumImpact, marketImpact };
}

export function blendRecentFundamental(currentFundamental: number | null | undefined, performanceRating: number) {
  const current = Number.isFinite(Number(currentFundamental)) ? Number(currentFundamental) : 50;
  return Math.round(((current * 0.75) + (performanceRating * 0.25)) * 10) / 10;
}
