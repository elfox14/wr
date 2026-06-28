import { PrismaClient } from '@prisma/client';

async function testConnection(url: string) {
  console.log(`Testing connection with: ${url.replace(/:[^:@]+@/, ':***@')}`);
  const client = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });
  try {
    const start = Date.now();
    await client.$connect();
    const count = await client.match.count();
    console.log(`Success! Total matches: ${count} (took ${Date.now() - start}ms)`);
    await client.$disconnect();
    return true;
  } catch (err: any) {
    console.error(`Failed: ${err.message || err}`);
    try {
      await client.$disconnect();
    } catch {}
    return false;
  }
}

async function main() {
  const originalUrl = process.env.DATABASE_URL || '';
  
  // Test 1: Original URL
  let success = await testConnection(originalUrl);
  if (success) return;

  // Test 2: With sslmode=require
  const separator = originalUrl.includes('?') ? '&' : '?';
  const sslUrl = `${originalUrl}${separator}sslmode=require`;
  success = await testConnection(sslUrl);
  if (success) return;

  // Test 3: Local SQLite check (if we switch provider temporarily to sqlite and use dev.db)
  console.log('Testing if we can use SQLite dev.db by replacing schema...');
}

main().catch(console.error);
