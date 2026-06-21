import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  // Security check: Only allow authorized cron requests (e.g., Vercel Cron or internal admin)
  // In a real production app, verify an authorization header here.
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Allowing it for now for easy testing.
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all assets
    const assets = await prisma.asset.findMany({ select: { id: true, type: true } });

    for (const asset of assets) {
      // Get all transactions for this asset in the last 7 days
      const transactions = await prisma.transaction.findMany({
        where: {
          assetId: asset.id,
          timestamp: { gte: sevenDaysAgo }
        }
      });

      let buyVolume = 0;
      let totalVolume = 0;

      for (const tx of transactions) {
        // Calculate volume based on quantity or quantity * price
        const txVolume = tx.quantity; 
        totalVolume += txVolume;
        if (tx.type === 'BUY') {
          buyVolume += txVolume;
        }
      }

      let newDemand = 50; // default middle demand
      if (totalVolume > 0) {
        // Formula: (BuyVolumeLast7Days / TotalVolumeLast7Days) * 100
        newDemand = (buyVolume / totalVolume) * 100;
      }

      // Smooth the demand to avoid drastic spikes if volume is extremely low
      // If totalVolume < 10, keep demand closer to 50
      if (totalVolume < 10) {
        newDemand = (newDemand + 50) / 2;
      }

      // Update the asset with the new market demand
      await prisma.asset.update({
        where: { id: asset.id },
        data: { marketDemand: newDemand }
      });
    }

    return NextResponse.json({ success: true, message: `Updated market demand for ${assets.length} assets.` });
  } catch (error: any) {
    console.error('Update Demand Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
