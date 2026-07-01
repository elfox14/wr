import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyMarketMove, calculateMatchPriceDelta } from '@/lib/pricingService';


const FOOTBALL_DATA_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

/**
 * Sync matches from football-data.org API.
 * Uses X-Auth-Token header for authentication.
 * Recalculates prices and generates market news automatically.
 */
export async function GET(request: Request) {
  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'FOOTBALL_DATA_API_KEY not set' }, { status: 500 });
    }

    const res = await fetch(FOOTBALL_DATA_URL, {
      headers: { 'X-Auth-Token': apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Football API Error:', res.status, errText);
      return NextResponse.json({ error: `API returned ${res.status}`, details: errText }, { status: 502 });
    }

    const data = await res.json();
    const matches = data.matches || [];

    let processedCount = 0;
    let priceUpdatesCount = 0;
    const newsGeneratedCount = 0;

    function mapStage(stage: string): string {
      const s = (stage || '').toUpperCase();
      if (s.includes('GROUP')) return 'group';
      if (s.includes('LAST_32') || s.includes('ROUND_OF_32')) return 'round_of_32';
      if (s.includes('LAST_16') || s.includes('ROUND_OF_16')) return 'round_of_16';
      if (s.includes('QUARTER')) return 'quarter_final';
      if (s.includes('SEMI')) return 'semi_final';
      if (s.includes('THIRD')) return 'third_place';
      if (s.includes('FINAL')) return 'final';
      return 'group';
    }

    function mapStatus(status: string): string {
      switch (status) {
        case 'FINISHED': return 'FINISHED';
        case 'IN_PLAY': case 'PAUSED': case 'LIVE': return 'IN_PLAY';
        default: return 'SCHEDULED';
      }
    }

    for (const m of matches) {
      const homeTla = m.homeTeam?.tla;
      const awayTla = m.awayTeam?.tla;
      if (!homeTla || !awayTla) continue;

      const homeTeam = await prisma.asset.findFirst({ where: { type: 'TEAM', code: homeTla } });
      const awayTeam = await prisma.asset.findFirst({ where: { type: 'TEAM', code: awayTla } });
      if (!homeTeam || !awayTeam) continue;

      const matchStatus = mapStatus(m.status);
      const stage = mapStage(m.stage);
      const externalId = String(m.id);
      const homeScore = m.score?.fullTime?.home ?? 0;
      const awayScore = m.score?.fullTime?.away ?? 0;
      const matchDate = m.utcDate ? new Date(m.utcDate) : new Date();

      await prisma.match.upsert({
        where: { externalId },
        update: {
          homeScore,
          awayScore,
          status: matchStatus,
          stage,
          groupPhase: m.group || stage,
        },
        create: {
          externalId,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          matchDate,
          homeScore,
          awayScore,
          status: matchStatus,
          stage,
          groupPhase: m.group || stage,
        },
      });

      processedCount++;
    }

    const allTeams = await prisma.asset.findMany({ where: { type: 'TEAM' } });

    for (const team of allTeams) {
      const teamMatches = await prisma.match.findMany({
        where: {
          OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
          status: 'FINISHED',
        },
        orderBy: { matchDate: 'asc' },
      });

      if (teamMatches.length === 0) continue;

      let simulatedPrice = team.fairValue && team.fairValue > 0 ? Math.round(team.fairValue) : team.current_price;
      let totalDelta = 0;
      let won = 0, drawn = 0, lost = 0;
      let lastContext: any = null;

      for (const match of teamMatches) {
        const isHome = match.homeTeamId === team.id;
        const gf = isHome ? match.homeScore : match.awayScore;
        const ga = isHome ? match.awayScore : match.homeScore;
        const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
        const opponent = allTeams.find(t => t.id === opponentId) || null;
        const wonMatch = gf > ga;
        const drawnMatch = gf === ga;
        const lostMatch = gf < ga;
        const isKnockout = match.stage !== 'group';
        const isEliminated = lostMatch && isKnockout;
        const wonTournament = wonMatch && match.stage === 'final';

        if (wonMatch) won++;
        else if (drawnMatch) drawn++;
        else lost++;

        const delta = calculateMatchPriceDelta({
          team,
          opponent,
          match,
          won: wonMatch,
          drawn: drawnMatch,
          lost: lostMatch,
          goalsFor: gf,
          goalsAgainst: ga,
          isEliminated,
          wonTournament,
        });

        simulatedPrice = applyMarketMove(simulatedPrice, delta);
        totalDelta += delta;
        lastContext = { match, opponent, gf, ga, delta, wonMatch, drawnMatch, lostMatch, isEliminated, wonTournament };
      }

      const newPrice = Math.max(1, Math.round(simulatedPrice));

      if (newPrice !== team.current_price) {
        const priceBefore = team.current_price;

        await prisma.asset.update({
          where: { id: team.id },
          data: {
            current_price: newPrice,
            marketPrice: newPrice,
            change: ((newPrice - priceBefore) / priceBefore) * 100,
            momentum: Math.max(0, Math.min(100, 50 + totalDelta)),
            high_price: Math.max(team.high_price, newPrice),
            low_price: Math.min(team.low_price, newPrice),
            priceHistory: { create: { price: newPrice } },
          },
        });

        priceUpdatesCount++;

        if (lastContext) {
          const newsContext: any = {
            reason: `نتائج ذكية حسب قوة الخصم والمرحلة (فوز: ${won}, تعادل: ${drawn}, خسارة: ${lost})`,
            stage: lastContext.match.stage || 'group',
            opponent: lastContext.opponent?.name || '',
            delta: Number(lastContext.delta.toFixed(2)),
          };

          if (lastContext.wonMatch && lastContext.opponent && (team.fifaRank || 99) > (lastContext.opponent.fifaRank || 99)) {
            newsContext.upsetWin = true;
          }
          if (lastContext.isEliminated) newsContext.eliminated = true;
          if (lastContext.wonTournament) newsContext.wonTournament = true;


        }
      }
    }

    return NextResponse.json({
      success: true,
      source: 'football-data.org',
      message: `Matches synced: ${processedCount}. Smart price updates: ${priceUpdatesCount}. News generated: ${newsGeneratedCount}.`,
    });
  } catch (error: any) {
    console.error('Match Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
