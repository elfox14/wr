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
  console.log('--- Cleaning Up Old Articles ---');
  
  try {
    const jobs = await prisma.$executeRawUnsafe(`DELETE FROM "ArticleGenerationJob"`);
    console.log(`Deleted ${jobs} jobs from ArticleGenerationJob.`);

    const infographics = await prisma.$executeRawUnsafe(`DELETE FROM "MatchInfographic"`);
    console.log(`Deleted ${infographics} infographics from MatchInfographic.`);

    const assets = await prisma.$executeRawUnsafe(`DELETE FROM "MediaAsset" WHERE "assetType" IN ('ARTICLE_HERO', 'INFOGRAPHIC')`);
    console.log(`Deleted ${assets} media assets from MediaAsset.`);

    const matchArticles = await prisma.$executeRawUnsafe(`DELETE FROM "MatchArticle"`);
    console.log(`Deleted ${matchArticles} match articles from MatchArticle.`);

    const pressNews = await prisma.$executeRawUnsafe(`DELETE FROM "PressNews"`);
    console.log(`Deleted ${pressNews} news items from PressNews.`);

    console.log('Successfully wiped all old articles and news entries!');
  } catch (err: any) {
    console.error('Error during cleanup:', err.message);
  }
}

main().finally(() => prisma.$disconnect());
