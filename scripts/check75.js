const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.match.findUnique({ where: { externalId: 'sim-r32-75' }, include: { homeTeam: true, awayTeam: true } }).then(m => { console.log(m.homeTeam.name, m.homeScore, '-', m.awayScore, m.awayTeam.name); }).finally(() => prisma.$disconnect());
