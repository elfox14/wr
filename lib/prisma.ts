import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prismaOptions =
  process.env.NODE_ENV === 'development'
    ? { log: ['query', 'warn', 'error'] as const }
    : { log: ['warn', 'error'] as const };

export const prisma = globalForPrisma.prisma || new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
