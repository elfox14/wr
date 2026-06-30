import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Load .env manually
let loadedUrl = '';
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    for (const line of envFile.split('\n')) {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
        if (key === 'DATABASE_URL') loadedUrl = val;
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env file:', e);
}

console.log('--- Env Debug ---');
console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'not set');
console.log('loadedUrl from .env file:', loadedUrl ? loadedUrl.replace(/:[^:@]+@/, ':***@') : 'not set');
console.log('-----------------');

async function testUrl(url: string, name: string) {
  console.log(`Testing [${name}]: ${url.replace(/:[^:@]+@/, ':***@')}`);
  const client = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });
  try {
    await client.$connect();
    const count = await client.match.count();
    console.log(`✅ [${name}] SUCCESS: Total matches: ${count}`);
    await client.$disconnect();
    return true;
  } catch (err: any) {
    console.log(`❌ [${name}] FAILED: ${err.message || err}`);
    try { await client.$disconnect(); } catch {}
    return false;
  }
}

async function main() {
  const urlInEnv = process.env.DATABASE_URL || '';
  await testUrl(urlInEnv, 'DATABASE_URL from process.env');
  
  if (loadedUrl && loadedUrl !== urlInEnv) {
    await testUrl(loadedUrl, 'Loaded DATABASE_URL from .env file');
  }
}

main().catch(console.error);
