import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiFootballFetch } from '@/lib/apiFootball';
import { importOfficialSquad } from '@/lib/officialSquadImport';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 mins on vercel

export async function POST(request: Request) {
  try {
    console.log('--- STARTING PLAYER WIPE AND RESEED (API) ---');

    console.log('Deleting player-related holdings...');
    await prisma.holding.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related transactions...');
    await prisma.transaction.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related market news...');
    await prisma.marketNews.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related price history...');
    await prisma.priceHistory.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related captain selections...');
    await prisma.captainSelection.deleteMany({ where: { asset: { type: 'PLAYER' } } });
    
    console.log('Deleting player-related performances...');
    await prisma.playerPerformance.deleteMany({ where: { asset: { type: 'PLAYER' } } });

    console.log('Deleting all player assets...');
    const deletedPlayers = await prisma.asset.deleteMany({ where: { type: 'PLAYER' } });
    console.log(`✅ Successfully deleted ${deletedPlayers.count} players.`);

    const teams = await prisma.asset.findMany({
      where: { 
        type: 'TEAM',
        apiFootballId: { not: null }
      },
      select: { id: true, name: true, code: true, apiFootballId: true }
    });

    let totalImported = 0;
    const results = [];

    for (const team of teams) {
      if (!team.apiFootballId) continue;
      
      try {
        const apiResponse = await apiFootballFetch('/players/squads', { team: team.apiFootballId });
        const apiPlayers = apiResponse?.response?.[0]?.players || [];
        
        if (apiPlayers.length === 0) {
          results.push({ team: team.name, status: 'no_players' });
          continue;
        }
        
        const inputPlayers = apiPlayers.map((p: any) => ({
          name: p.name,
          position: p.position,
          age: p.age,
          image: p.photo,
          shirtNumber: p.number,
          externalId: p.id
        }));

        const result = await importOfficialSquad({
          teamId: team.id,
          teamCode: team.code || undefined,
          teamName: team.name,
          sourceName: 'ISPORTS API',
          sourceUrl: 'http://api.isportsapi.com',
          replaceExisting: false, 
          players: inputPlayers
        });

        if (result.ok) {
          totalImported += result.imported || 0;
          results.push({ team: team.name, status: 'success', imported: result.imported });
        } else {
          results.push({ team: team.name, status: 'failed' });
        }
      } catch (error: any) {
        results.push({ team: team.name, status: 'error', message: error.message });
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: deletedPlayers.count,
      totalImported,
      results
    });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
