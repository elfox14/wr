import prisma from '../lib/prisma';

async function check() {
  const now = new Date();
  const upcomingUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const liveWindowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const tickerStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const tickerEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  const ACTIVE_HOME_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', 'LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'HT'];

  const upcomingMatchesRaw = await prisma.match.findMany({
    where: {
      status: { in: ACTIVE_HOME_STATUSES },
      matchDate: { gte: liveWindowStart, lte: upcomingUntil },
    },
    orderBy: { matchDate: 'asc' },
    take: 4,
  });
  
  console.log('upcomingMatchesRaw length:', upcomingMatchesRaw.length);
  upcomingMatchesRaw.forEach(m => console.log(m.externalId, m.matchDate));

  const tickerMatchesRaw = await prisma.match.findMany({
    where: { matchDate: { gte: tickerStart, lte: tickerEnd } },
    orderBy: { matchDate: 'asc' },
    take: 8,
  });

  console.log('tickerMatchesRaw length:', tickerMatchesRaw.length);
  tickerMatchesRaw.forEach(m => console.log(m.externalId, m.matchDate));
}
check();
