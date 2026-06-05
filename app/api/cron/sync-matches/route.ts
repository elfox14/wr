import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateNewPrice } from '@/lib/pricingService';
import { generateMarketNews } from '@/lib/market-news/generator';

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

    // Fetch matches from football-data.org
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
    let newsGeneratedCount = 0;

    // Map football-data.org stage names to our stages
    function mapStage(stage: string): string {
      const s = (stage || '').toUpperCase();
      if (s.includes('GROUP')) return 'group';
      if (s.includes('LAST_16') || s.includes('ROUND_OF_16')) return 'round_of_16';
      if (s.includes('QUARTER')) return 'quarter_final';
      if (s.includes('SEMI')) return 'semi_final';
      if (s.includes('THIRD')) return 'third_place';
      if (s.includes('FINAL')) return 'final';
      return 'group';
    }

    // Map football-data.org status to our status
    function mapStatus(status: string): string {
      switch (status) {
        case 'FINISHED': return 'FINISHED';
        case 'IN_PLAY': case 'PAUSED': case 'LIVE': return 'IN_PLAY';
        default: return 'SCHEDULED';
      }
    }

    // Process each match
    for (const m of matches) {
      const homeTeamName = m.homeTeam?.name;
      const awayTeamName = m.awayTeam?.name;
      const homeTla = m.homeTeam?.tla; // 3-letter code e.g. "ARG"
      const awayTla = m.awayTeam?.tla;

      if (!homeTla || !awayTla) continue;

      // Find teams in our DB by code
      const homeTeam = await prisma.asset.findFirst({ where: { type: 'TEAM', code: homeTla } });
      const awayTeam = await prisma.asset.findFirst({ where: { type: 'TEAM', code: awayTla } });

      if (!homeTeam || !awayTeam) continue;

      const hasScore = m.score?.fullTime?.home != null && m.score?.fullTime?.away != null;
      const matchStatus = mapStatus(m.status);
      const stage = mapStage(m.stage);
      const externalId = String(m.id); // football-data.org match ID

      const homeScore = m.score?.fullTime?.home ?? 0;
      const awayScore = m.score?.fullTime?.away ?? 0;
      const matchDate = m.utcDate ? new Date(m.utcDate) : new Date();

      // Upsert match
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

    // --- RECALCULATE PRICES FOR ALL TEAMS ---
    const allTeams = await prisma.asset.findMany({ where: { type: 'TEAM' } });

    for (const team of allTeams) {
      const teamMatches = await prisma.match.findMany({
        where: {
          OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
          status: 'FINISHED',
        },
      });

      let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;

      for (const match of teamMatches) {
        const isHome = match.homeTeamId === team.id;
        const gf = isHome ? match.homeScore : match.awayScore;
        const ga = isHome ? match.awayScore : match.homeScore;
        goalsFor += gf;
        goalsAgainst += ga;
        if (gf > ga) won++;
        else if (gf === ga) drawn++;
        else lost++;
      }

      if (teamMatches.length === 0) continue; // No finished matches yet

      const newPrice = calculateNewPrice(team, { won, drawn, lost, goalsFor, goalsAgainst });

      if (newPrice !== team.current_price) {
        const priceBefore = team.current_price;

        await prisma.asset.update({
          where: { id: team.id },
          data: {
            current_price: newPrice,
            change: ((newPrice - priceBefore) / priceBefore) * 100,
            high_price: Math.max(team.high_price, newPrice),
            low_price: Math.min(team.low_price, newPrice),
            priceHistory: { create: { price: newPrice } },
          },
        });

        priceUpdatesCount++;

        // Determine context for news
        const lastMatch = teamMatches[teamMatches.length - 1];
        const isHome = lastMatch.homeTeamId === team.id;
        const opponentId = isHome ? lastMatch.awayTeamId : lastMatch.homeTeamId;
        const opponent = allTeams.find(t => t.id === opponentId);
        const lastGf = isHome ? lastMatch.homeScore : lastMatch.awayScore;
        const lastGa = isHome ? lastMatch.awayScore : lastMatch.homeScore;

        const newsContext: any = {
          reason: `نتائج المباريات (فوز: ${won}, تعادل: ${drawn}, خسارة: ${lost})`,
          stage: lastMatch.stage || 'group',
          opponent: opponent?.name || '',
        };

        // Check for upset win (lower-ranked team beats higher-ranked)
        if (lastGf > lastGa && opponent && (team.fifaRank || 99) > (opponent.fifaRank || 99)) {
          newsContext.upsetWin = true;
        }

        const news = await generateMarketNews({
          assetId: team.id,
          before: priceBefore,
          after: newPrice,
          context: newsContext,
        });
        if (news) newsGeneratedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      source: 'football-data.org',
      message: `Matches synced: ${processedCount}. Price updates: ${priceUpdatesCount}. News generated: ${newsGeneratedCount}.`,
    });
  } catch (error: any) {
    console.error('Match Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
