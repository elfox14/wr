import prisma from '../lib/prisma';

async function main() {
  const match = await prisma.match.findFirst({
    where: {
      homeTeam: { name: 'Sweden' },
      awayTeam: { name: 'Tunisia' }
    }
  });

  if (!match) {
    console.error('Match not found');
    return;
  }

  const query: any = {};
  const matchDateVal = match.matchDate ? new Date(match.matchDate) : null;
  const params = new URLSearchParams();
  
  const compId = String(query.competition_id || process.env.THE_STATS_API_WORLD_CUP_COMPETITION_ID || 'comp_6107');
  const seasonId = String(query.season_id || process.env.THE_STATS_API_WORLD_CUP_SEASON_ID || 'sn_118868');
  params.set('competition_id', compId);
  params.set('season_id', seasonId);
  params.set('providerMatchesPerPage', String(query.per_page || 100));

  if (query.status) params.set('status', String(query.status));
  if (query.stage) params.set('stage', String(query.stage));
  if (query.group) params.set('group', String(query.group));
  if (query.utc_offset) params.set('utc_offset', String(query.utc_offset));

  if (query.date_from) {
    params.set('date_from', String(query.date_from));
  } else if (matchDateVal && !isNaN(matchDateVal.getTime())) {
    const dateFrom = new Date(matchDateVal.getTime() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0];
    params.set('date_from', dateFrom);
  }

  if (query.date_to) {
    params.set('date_to', String(query.date_to));
  } else if (matchDateVal && !isNaN(matchDateVal.getTime())) {
    const dateTo = new Date(matchDateVal.getTime() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0];
    params.set('date_to', dateTo);
  }

  console.log('Generated params:');
  params.forEach((val, key) => {
    console.log(`  ${key}: ${val}`);
  });
}

main().finally(() => prisma.$disconnect());
