import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { calculateNewPrice } from '@/lib/pricingService';
import { generateMarketNews } from '@/lib/marketNewsService';

const prisma = new PrismaClient();

const OPENFOOTBALL_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2022/worldcup.json'; // Use 2022 since 2026 isn't fully published with matches yet, but we can change later.

// Map openfootball stage names to our stages
function mapStage(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('group')) return 'group';
  if (n.includes('16')) return 'round_of_16';
  if (n.includes('quarter')) return 'quarter_final';
  if (n.includes('semi')) return 'semi_final';
  if (n.includes('third')) return 'third_place';
  if (n.includes('final')) return 'final';
  return 'group';
}

export async function GET(request: Request) {
  try {
    const res = await fetch(OPENFOOTBALL_URL);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }
    const data = await res.json();
    
    let processedCount = 0;
    let priceUpdatesCount = 0;
    let newsGeneratedCount = 0;

    // We process rounds
    const rounds = data.rounds || [];
    
    for (const round of rounds) {
      const stage = mapStage(round.name);
      const matches = round.matches || [];

      for (const m of matches) {
        // Find teams by country code (openfootball uses e.g. ARG, FRA)
        const homeCode = m.team1?.code;
        const awayCode = m.team2?.code;

        if (!homeCode || !awayCode) continue;

        const homeTeam = await prisma.asset.findFirst({ where: { type: 'TEAM', code: homeCode } });
        const awayTeam = await prisma.asset.findFirst({ where: { type: 'TEAM', code: awayCode } });

        if (!homeTeam || !awayTeam) continue;

        const hasScore = typeof m.score1 === 'number' && typeof m.score2 === 'number';
        const matchStatus = hasScore ? 'FINISHED' : 'SCHEDULED';
        const externalId = `${m.date}-${homeCode}-${awayCode}`;

        // Create or Update Match
        const dbMatch = await prisma.match.upsert({
          where: { externalId },
          update: {
            homeScore: m.score1 || 0,
            awayScore: m.score2 || 0,
            status: matchStatus,
            stage
          },
          create: {
            externalId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchDate: new Date(m.date),
            homeScore: m.score1 || 0,
            awayScore: m.score2 || 0,
            status: matchStatus,
            stage
          }
        });

        processedCount++;

        // Trigger Pricing and News if the match is FINISHED and it was just updated 
        // Note: For a production app, we would only trigger pricing if this specific match result was JUST added.
        // For simplicity in this demo, we'll recalculate prices for all finished matches if they haven't been priced yet.
      }
    }

    // --- RECALCULATE PRICES FOR ALL TEAMS ---
    // Instead of doing it match-by-match, doing it globally is safer to prevent duplicate price bumps
    const allTeams = await prisma.asset.findMany({ where: { type: 'TEAM' } });

    for (const team of allTeams) {
      // Get all FINISHED matches for this team
      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { homeTeamId: team.id },
            { awayTeamId: team.id }
          ],
          status: 'FINISHED'
        }
      });

      let won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;

      for (const match of matches) {
        const isHome = match.homeTeamId === team.id;
        const gf = isHome ? match.homeScore : match.awayScore;
        const ga = isHome ? match.awayScore : match.homeScore;

        goalsFor += gf;
        goalsAgainst += ga;

        if (gf > ga) won++;
        else if (gf === ga) drawn++;
        else lost++;
      }

      // Calculate new price based on stats
      const newPrice = calculateNewPrice(team, { won, drawn, lost, goalsFor, goalsAgainst });
      
      if (newPrice !== team.current_price) {
        const priceBefore = team.current_price;
        
        // Update Price
        await prisma.asset.update({
          where: { id: team.id },
          data: {
            current_price: newPrice,
            change: ((newPrice - priceBefore) / priceBefore) * 100,
            priceHistory: {
              create: { price: newPrice }
            }
          }
        });

        priceUpdatesCount++;

        // Generate Market News
        const newsContext = {
          reason: `بعد تحليل آخر نتائج المباريات (فوز: ${won}, تعادل: ${drawn}, خسارة: ${lost})`
        };
        const news = await generateMarketNews(team, priceBefore, newPrice, newsContext);
        if (news) newsGeneratedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Matches synced: ${processedCount}. Price updates: ${priceUpdatesCount}. News generated: ${newsGeneratedCount}.`
    });

  } catch (error: any) {
    console.error('Match Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
