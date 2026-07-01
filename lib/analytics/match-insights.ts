// ============================================================
// lib/analytics/match-insights.ts
// Central analytics engine: derives narrative insights from
// raw match data (momentum, xG, shots, events, stats).
// ============================================================

import type {
  MatchInsightsInput,
  MatchInsightsOutput,
  MatchNarrativeSummary,
  NarrativeChip,
  RankedMoment,
  FairnessInsight,
  NarrativeSummary,
  MomentumPoint,
  XgFlowPoint,
  ShotPoint,
  MatchEvent,
  ComparisonStat,
} from './match-analytics.types';

// ─── helpers ────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, d = 2) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

/** Returns momentum points within ±window minutes of `minute` */
function nearbyMomentum(
  momentum: MomentumPoint[],
  minute: number,
  window = 5,
): MomentumPoint[] {
  return momentum.filter(
    (p) => Math.abs(p.minute - minute) <= window,
  );
}

/** Returns xG flow points within ±window minutes of `minute` */
function nearbyXg(
  xgFlow: XgFlowPoint[],
  minute: number,
  window = 5,
): XgFlowPoint[] {
  return xgFlow.filter((p) => Math.abs(p.minute - minute) <= window);
}

/** Returns events within ±window minutes of `minute` */
function nearbyEvents(
  events: MatchEvent[],
  minute: number,
  window = 5,
): MatchEvent[] {
  return events.filter((e) => Math.abs(e.minute - minute) <= window);
}

/** Returns shots within ±window minutes of `minute` */
function nearbyShots(
  shots: ShotPoint[],
  minute: number,
  window = 5,
): ShotPoint[] {
  return shots.filter((s) => Math.abs(s.minute - minute) <= window);
}

// ─── summary builder ────────────────────────────────────────

function buildSummary(input: MatchInsightsInput): MatchNarrativeSummary {
  const { stats, momentum, xgFlow, homeTeamName, awayTeamName } = input;

  const totalHomeXg = xgFlow.length
    ? xgFlow[xgFlow.length - 1].homeXg
    : 0;
  const totalAwayXg = xgFlow.length
    ? xgFlow[xgFlow.length - 1].awayXg
    : 0;

  const chips: NarrativeChip[] = [];

  // xG dominance chip
  const xgDiff = totalHomeXg - totalAwayXg;
  if (Math.abs(xgDiff) >= 0.5) {
    const dominant = xgDiff > 0 ? homeTeamName : awayTeamName;
    chips.push({
      id: 'xg-dominance',
      label: `${dominant} dominated xG`,
      tone: 'info',
      description: `${dominant} generated ${round(Math.max(totalHomeXg, totalAwayXg))} xG vs ${round(Math.min(totalHomeXg, totalAwayXg))} for the opponent.`,
    });
  }

  // possession chip
  const possessionStat = stats.find((s) => s.key === 'possession');
  if (possessionStat) {
    const higher =
      possessionStat.home > possessionStat.away
        ? homeTeamName
        : awayTeamName;
    const pct = Math.max(possessionStat.home, possessionStat.away);
    if (pct >= 55) {
      chips.push({
        id: 'possession',
        label: `${higher} controlled possession`,
        tone: 'positive',
        description: `${higher} had ${pct}% possession.`,
      });
    }
  }

  // late pressure chip — check momentum in last 15 min
  const lateMomentum = momentum.filter((p) => p.minute >= 75);
  if (lateMomentum.length >= 3) {
    const homeAvg =
      lateMomentum.reduce((s, p) => s + p.home, 0) / lateMomentum.length;
    const awayAvg =
      lateMomentum.reduce((s, p) => s + p.away, 0) / lateMomentum.length;
    const diff = homeAvg - awayAvg;
    if (Math.abs(diff) >= 15) {
      const pressingTeam = diff > 0 ? homeTeamName : awayTeamName;
      chips.push({
        id: 'late-pressure',
        label: `${pressingTeam} pressed late`,
        tone: 'warning',
        description: `${pressingTeam} dominated the final 15 minutes in momentum.`,
      });
    }
  }

  const title =
    chips.length > 0
      ? `${homeTeamName} vs ${awayTeamName} — Analytics`
      : `${homeTeamName} vs ${awayTeamName}`;

  const subtitle =
    chips.length > 0
      ? chips[0].description
      : 'Match completed. No significant narrative detected.';

  return { title, subtitle, chips };
}

// ─── top moments builder ─────────────────────────────────────

function buildTopMoments(input: MatchInsightsInput): RankedMoment[] {
  const { momentum, xgFlow, shots, events, homeTeamName, awayTeamName } =
    input;
  const moments: RankedMoment[] = [];

  // Goal events are always top moments
  events
    .filter((e) => e.type === 'goal')
    .forEach((e) => {
      moments.push({
        minute: e.minute,
        score: 90,
        title: `Goal — ${e.label}`,
        description: `${e.team === 'home' ? homeTeamName : awayTeamName} scored at minute ${e.minute}.`,
        type: 'goal',
        team: e.team,
      });
    });

  // High-xG shots (xg >= 0.3)
  shots
    .filter((s) => s.xg >= 0.3 && s.outcome !== 'goal')
    .forEach((s) => {
      moments.push({
        minute: s.minute,
        score: clamp(Math.round(s.xg * 100), 30, 85),
        title: `Big Chance — ${s.player ?? (s.team === 'home' ? homeTeamName : awayTeamName)}`,
        description: `${s.xg.toFixed(2)} xG ${s.outcome === 'onTarget' ? 'saved' : 'missed'} at minute ${s.minute}.`,
        type: 'chance',
        team: s.team,
      });
    });

  // Momentum spikes — find local maxima where delta >= 30
  for (let i = 1; i < momentum.length - 1; i++) {
    const prev = momentum[i - 1];
    const curr = momentum[i];
    const next = momentum[i + 1];
    const homeDelta = curr.home - prev.home;
    const awayDelta = curr.away - prev.away;

    if (homeDelta >= 30 && curr.home > next.home) {
      moments.push({
        minute: curr.minute,
        score: clamp(homeDelta, 30, 80),
        title: `${homeTeamName} Momentum Surge`,
        description: `${homeTeamName} gained +${homeDelta} momentum at minute ${curr.minute}.`,
        type: 'pressure',
        team: 'home',
      });
    }
    if (awayDelta >= 30 && curr.away > next.away) {
      moments.push({
        minute: curr.minute,
        score: clamp(awayDelta, 30, 80),
        title: `${awayTeamName} Momentum Surge`,
        description: `${awayTeamName} gained +${awayDelta} momentum at minute ${curr.minute}.`,
        type: 'pressure',
        team: 'away',
      });
    }
  }

  // Red cards as turning points
  events
    .filter((e) => e.type === 'red')
    .forEach((e) => {
      moments.push({
        minute: e.minute,
        score: 75,
        title: `Red Card — ${e.label}`,
        description: `${e.team === 'home' ? homeTeamName : awayTeamName} reduced to 10 men at minute ${e.minute}.`,
        type: 'turning-point',
        team: e.team,
      });
    });

  // Late drama: goal after minute 85
  events
    .filter((e) => e.type === 'goal' && e.minute >= 85)
    .forEach((e) => {
      // Update existing goal moment to late-drama type
      const existing = moments.find(
        (m) => m.minute === e.minute && m.type === 'goal',
      );
      if (existing) {
        existing.type = 'late-drama';
        existing.score = 95;
        existing.title = `Late Drama — ${e.label}`;
      }
    });

  // Deduplicate by minute (keep highest score)
  const byMinute = new Map<number, RankedMoment>();
  for (const m of moments) {
    const existing = byMinute.get(m.minute);
    if (!existing || m.score > existing.score) {
      byMinute.set(m.minute, m);
    }
  }

  return Array.from(byMinute.values()).sort((a, b) => b.score - a.score);
}

// ─── fairness insight builder ────────────────────────────────

function buildFairness(input: MatchInsightsInput): FairnessInsight | null {
  const { xgFlow, shots, homeTeamName, awayTeamName } = input;

  if (!xgFlow.length) return null;

  const totalHomeXg = xgFlow[xgFlow.length - 1].homeXg;
  const totalAwayXg = xgFlow[xgFlow.length - 1].awayXg;
  const homeGoals = shots.filter(
    (s) => s.team === 'home' && s.outcome === 'goal',
  ).length;
  const awayGoals = shots.filter(
    (s) => s.team === 'away' && s.outcome === 'goal',
  ).length;

  const homeOverperform = homeGoals - totalHomeXg;
  const awayOverperform = awayGoals - totalAwayXg;
  const diff = homeOverperform - awayOverperform;

  if (Math.abs(diff) < 0.5) {
    return {
      label: 'Fair Result',
      text: `The scoreline reflected the xG balance. Both teams performed close to expectation.`,
      tone: 'positive',
    };
  }

  if (diff > 0.5) {
    return {
      label: `${homeTeamName} Fortunate`,
      text: `${homeTeamName} scored ${homeGoals} goals from ${round(totalHomeXg)} xG. The result may flatter them.`,
      tone: 'warning',
    };
  }

  return {
    label: `${awayTeamName} Fortunate`,
    text: `${awayTeamName} scored ${awayGoals} goals from ${round(totalAwayXg)} xG. The result may flatter them.`,
    tone: 'warning',
  };
}

// ─── minute context builder ──────────────────────────────────

function buildMinuteContext(
  input: MatchInsightsInput,
  minute: number,
): NarrativeSummary {
  const { xgFlow, shots, events, homeTeamName, awayTeamName } = input;

  const xgPoints = nearbyXg(xgFlow, minute);
  const lastXg = xgPoints[xgPoints.length - 1] ?? {
    homeXg: 0,
    awayXg: 0,
  };
  const nearEvents = nearbyEvents(events, minute);
  const nearShots = nearbyShots(shots, minute);
  const nearestEvent = nearEvents[0] ?? null;

  let narrative = `Around minute ${minute}: `;
  if (nearShots.length > 0) {
    narrative += `${nearShots.length} shot(s) were taken. `;
  }
  if (nearestEvent) {
    narrative += `Key event — ${nearestEvent.label}. `;
  }
  narrative += `xG at this point: ${homeTeamName} ${round(lastXg.homeXg)} – ${awayTeamName} ${round(lastXg.awayXg)}.`;

  return {
    minute,
    nearestEventLabel: nearestEvent ? nearestEvent.label : null,
    nearbyShotsCount: nearShots.length,
    nearbyEventsCount: nearEvents.length,
    homeXg: lastXg.homeXg,
    awayXg: lastXg.awayXg,
    nearbyEvents: nearEvents,
    narrative,
  };
}

// ─── public API ──────────────────────────────────────────────

export function createMatchInsights(
  input: MatchInsightsInput,
): MatchInsightsOutput {
  const summary = buildSummary(input);
  const topMoments = buildTopMoments(input);
  const fairness = buildFairness(input);

  const getMinuteContext = (
    minute: number | null,
  ): NarrativeSummary | null => {
    if (minute === null) return null;
    return buildMinuteContext(input, minute);
  };

  return { summary, topMoments, fairness, getMinuteContext };
}
