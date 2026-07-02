const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.match.count({ where: { stage: 'round_of_32' } }).then(c => console.log('Count:', c)).finally(()=>prisma.$disconnect());
