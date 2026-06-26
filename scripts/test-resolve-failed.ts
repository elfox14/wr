import { PrismaClient } from '@prisma/client';
import { resolveTheStatsProviderId, defaultTheStatsQuery } from '../lib/theStatsMatchExtras';

const prisma = new PrismaClient();

async function main() {
  const matchNames = ['England vs Croatia', 'Scotland vs Morocco', 'Brazil vs Haiti'];
  
  for (const name of matchNames) {
    console.log(`\n========================================`);
    console.log(`Resolving for match: ${name}`);
    const [home, away] = name.split(' vs ');
    const match = await prisma.match.findFirst({
      where: {
        homeTeam: { name: home },
        awayTeam: { name: away }
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    if (!match) {
      console.log(`Match not found in DB: ${name}`);
      continue;
    }

    // Call resolveTheStatsProviderId directly, but bypassing existingProviderId
    // We can temporarily modify the match or pass a query that doesn't use the cache.
    // Actually, we can check what the API returns around that date.
    const query = defaultTheStatsQuery(new URLSearchParams());
    
    // We want to force it to call the API, so we temporarily clear the cached ID.
    // To do this, we can temporarily bypass existingProviderId by passing a custom resolve function.
    // Or we can just copy-paste the API search logic here.
    
    const matchDateVal = match.matchDate ? new Date(match.matchDate) : null;
    const params = new URLSearchParams();
    params.set('competition_id', 'comp_6107');
    params.set('season_id', 'sn_118868');
    params.set('providerMatchesPerPage', '100');
    if (matchDateVal && !isNaN(matchDateVal.getTime())) {
      params.set('date_from', new Date(matchDateVal.getTime() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0]);
      params.set('date_to', new Date(matchDateVal.getTime() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0]);
    }
    
    const urlParams = defaultTheStatsQuery(params);
    console.log(`Query params:`, JSON.stringify(urlParams));
    
    // We import the fetch function from lib/theStatsMatchExtras
    const { theStatsApiFetch } = require('../lib/theStatsApi');
    try {
      const payload = await theStatsApiFetch('/api/football/matches', urlParams, { timeoutMs: 15000 });
      const matchesList = payload?.data || payload?.response || payload?.result || payload || [];
      console.log(`API returned ${matchesList.length || 0} matches in date range.`);
      
      const providerMatches = (Array.isArray(matchesList) ? matchesList : matchesList.matches || []).map((row: any) => {
        const fixture = row?.fixture || row?.match || row;
        const teams = row?.teams || row?.participants || {};
        const homeT = teams?.home || row?.home || row?.homeTeam || row?.home_team || {};
        const awayT = teams?.away || row?.away || row?.awayTeam || row?.away_team || {};
        return {
          id: fixture?.id || row?.id,
          home: homeT?.name || homeT,
          away: awayT?.name || awayT,
          date: fixture?.utc_date || fixture?.date || row?.date
        };
      });

      console.log(`Candidates:`);
      providerMatches.forEach((m: any) => {
        console.log(`  - ID: ${m.id} | ${m.home} vs ${m.away} | Date: ${m.date}`);
      });
      
    } catch (err: any) {
      console.error(`API Call failed:`, err.message || err);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
