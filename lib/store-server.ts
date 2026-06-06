import prisma from '@/lib/prisma';

export async function getAssets() {
  const assets = await prisma.asset.findMany({
    include: {
      priceHistory: {
        orderBy: { timestamp: 'asc' },
      },
      players: true
    }
  });
  
  // Parse/stringify to ensure Date objects are serialized correctly for Client Components
  return JSON.parse(JSON.stringify(assets));
}
