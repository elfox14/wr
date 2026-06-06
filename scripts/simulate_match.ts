import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();

async function simulate() {
  console.log('--- STARTING MATCH SIMULATION ---');
  
  // 1. Get a high-risk player (e.g., Lamine Yamal or a generic Forward)
  let player = await prisma.asset.findFirst({
    where: { type: 'PLAYER', position: 'FWD' }
  });

  if (!player) {
    console.log('No player found to simulate. Creating a dummy player.');
    player = await prisma.asset.create({
      data: {
        id: 'player-test-sim',
        type: 'PLAYER',
        name: 'Test Striker',
        code: 'TEST9',
        image: '',
        current_price: 1000,
        high_price: 1000,
        low_price: 1000,
        market_cap: '1M',
        volume: '100K',
        change: 0,
        position: 'FWD',
        riskIndex: 1.0 // 1.0 = Max Risk = 25% Circuit Breaker
      }
    });
  }

  // Force price to 1000 for easy calculation
  await prisma.asset.update({
    where: { id: player.id },
    data: { current_price: 1000, riskIndex: 1.0 }
  });

  // Ensure price history exists for today to act as StartOfDay
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.priceHistory.deleteMany({ where: { assetId: player.id } });
  await prisma.priceHistory.create({
    data: {
      assetId: player.id,
      price: 1000,
      timestamp: today
    }
  });

  console.log(`[0:00] Match Starts. ${player.name} starting price: 1000 ¢. RiskIndex: 1.0 (Limit: +25% / 1250¢)`);

  // 2. Simulate Webhook: Player Scores a Goal (+10% Spike)
  console.log(`[15:00] GOAL! ${player.name} scores! Sending Webhook...`);
  
  const webhookRes = await fetch('http://localhost:3000/api/webhooks/sports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev_secret_123'
    },
    body: JSON.stringify({
      assetId: player.id,
      event: 'GOAL'
    })
  });
  
  const webhookData = await webhookRes.json();
  console.log('Webhook Response:', webhookData);

  // 3. Simulate Massive FOMO (Users buying pushes price up)
  // To avoid needing real users, we will directly test the liveEngine applyVolatilityCap logic
  // which is exactly what the AMM trade route does.
  
  console.log(`[16:00] Massive FOMO begins. 40,000 users want to buy the stock!`);
  
  const { applyVolatilityCap } = await import('../lib/liveEngine');
  
  // Current price is now ~1100. Let's say AMM formula dictates a +30% jump due to massive volume
  const simulatedAmmPrice = Math.round(1100 * 1.30); // 1430
  
  console.log(`[16:05] AMM dictates price should go to ${simulatedAmmPrice}¢ due to extreme demand.`);
  
  // Run it through the Volatility Cap
  const startOfDayPrice = 1000;
  const finalCappedPrice = applyVolatilityCap(startOfDayPrice, simulatedAmmPrice, 1.0);
  
  console.log(`[16:06] Circuit Breaker kicks in... Final allowed price: ${finalCappedPrice}¢`);
  
  if (finalCappedPrice === 1250) {
    console.log('✅ SUCCESS: Limit Up (+25%) successfully protected the market from a flash spike!');
  } else {
    console.error(`❌ FAILED: Price should be 1250 but got ${finalCappedPrice}`);
  }

  console.log('--- END SIMULATION ---');
}

simulate().catch(console.error).finally(() => prisma.$disconnect());
