import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Load .env manually
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
      }
    }
  }
} catch (e) {}

const prisma = new PrismaClient();

async function main() {
  console.log('--- Inspecting MatchArticle Table ---');
  try {
    const matchArticles = await prisma.$queryRawUnsafe<any[]>('SELECT "id", "matchId", "title", "slug", "status", "publishedAt" FROM "MatchArticle"');
    console.log(`Found ${matchArticles.length} MatchArticles:`);
    matchArticles.forEach((art, i) => {
      console.log(`${i+1}. [${art.id}] MatchId: ${art.matchId} | Slug: ${art.slug} | Status: ${art.status} | Title: "${art.title}"`);
    });
  } catch (err: any) {
    console.error('Error querying MatchArticle:', err.message);
  }

  console.log('\n--- Inspecting PressNews Table ---');
  try {
    const pressNews = await prisma.$queryRawUnsafe<any[]>('SELECT "id", "title", "status", "category", "publishedAt" FROM "PressNews" ORDER BY "publishedAt" DESC');
    console.log(`Found ${pressNews.length} PressNews entries:`);
    pressNews.forEach((news, i) => {
      console.log(`${i+1}. [${news.id}] Title: "${news.title}" | Status: ${news.status} | Category: ${news.category}`);
    });
  } catch (err: any) {
    console.error('Error querying PressNews:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
