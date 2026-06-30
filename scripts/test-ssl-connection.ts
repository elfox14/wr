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
  const separator = originalUrl.includes('?') ? '&' : '?';
  
  // Test with sslmode=require
  const sslUrl = `${originalUrl}${separator}sslmode=require`;
  await testConnection(sslUrl);
}

main().catch(console.error);
