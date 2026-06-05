import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Seeding database: Admin user only...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create Demo Admin User
  await prisma.user.upsert({
    where: { email: 'admin@worldcup.com' },
    update: {},
    create: {
      name: 'Admin Investor',
      username: 'investor_pro',
      email: 'admin@worldcup.com',
      password: hashedPassword,
      balance: 150000,
      total_profit: 0,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created/updated.');
  console.log('ℹ️  Team & player data is now managed by seedApi.ts (football-data.org API).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
