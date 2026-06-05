import prisma from '@/lib/prisma';

export async function checkAndAwardAchievements(userId: string, profit: number = 0) {
  try {
    const achievementsToAward: string[] = [];

    // 1. Wolf of Wall Street: Made > 1000 profit in a single trade
    if (profit >= 1000) {
      achievementsToAward.push('WOLF_OF_WALL_STREET');
    }

    // Check existing achievements
    const existing = await prisma.userAchievement.findMany({
      where: { userId }
    });
    const existingBadgeIds = new Set(existing.map(a => a.badgeId));

    for (const badgeId of achievementsToAward) {
      if (!existingBadgeIds.has(badgeId)) {
        await prisma.userAchievement.create({
          data: { userId, badgeId }
        });

        const badgeNames: Record<string, string> = {
          'WOLF_OF_WALL_STREET': 'ذئب وول ستريت 🐺📈'
        };

        // Notify user
        await prisma.notification.create({
          data: {
            userId,
            title: 'إنجاز جديد! 🏆',
            message: `لقد فتحت إنجاز: ${badgeNames[badgeId] || badgeId}`,
            type: 'SUCCESS'
          }
        });
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }
}
