import prisma from '../lib/prisma';

async function updateUpcoming() {
  const matches = await prisma.match.findMany({
    where: { status: { in: ['SCHEDULED', 'TIMED', 'NOT_STARTED'] } },
    orderBy: { matchDate: 'asc' },
  });

  console.log(`Found ${matches.length} scheduled matches.`);
  
  // Shift them to start from 2 hours from now, spaced by 4 hours
  const now = new Date();
  
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const newDate = new Date(now.getTime() + (i * 4 + 2) * 60 * 60 * 1000);
    await prisma.match.update({
      where: { id: m.id },
      data: { matchDate: newDate }
    });
    console.log(`Updated ${m.externalId} to ${newDate}`);
  }

  await prisma.$disconnect();
}
updateUpcoming();