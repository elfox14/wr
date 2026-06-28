import { getHomeGroupStandings } from '../lib/homeGroupStandings';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Row = { team: string; code: string; points: number; goalDifference: number; goalsFor: number };
type Group = { key: string; standings: Row[] };
type Qualifier = { group: string; rank: 1 | 2 | 3; row: Row; thirdRank?: number };

const GROUPS = 'ABCDEFGHIJKL'.split('');

function buildQualifiers(groups: Group[]) {
  const byGroup = new Map(groups.map((group) => [String(group.key).toUpperCase(), group]));
  const all: Qualifier[] = [];
  GROUPS.forEach((group) => {
    const rows = byGroup.get(group)?.standings || [];
    if (rows[0]) all.push({ group, rank: 1, row: rows[0] });
    if (rows[1]) all.push({ group, rank: 2, row: rows[1] });
    if (rows[2]) all.push({ group, rank: 3, row: rows[2] });
  });
  const bestThirds = all
    .filter((item) => item.rank === 3)
    .sort((a, b) => b.row.points - a.row.points || b.row.goalDifference - a.row.goalDifference || b.row.goalsFor - a.row.goalsFor)
    .slice(0, 8)
    .map((item, index) => ({ ...item, thirdRank: index + 1 }));
  return { direct: all.filter((item) => item.rank !== 3), bestThirds };
}

async function main() {
  for (let i = 0; i < 3; i++) {
    try {
      await prisma.$connect();
      break;
    } catch (e) {
      console.log(`Connection retry ${i+1} failed...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const groups = await getHomeGroupStandings().catch((err) => {
    console.error('getHomeGroupStandings error:', err);
    return [];
  });
  console.log(`Groups length: ${groups.length}`);
  
  const isGroupsVal = Array.isArray(groups) && groups.every((group) => group && typeof (group as any).key === 'string' && Array.isArray((group as any).standings));
  console.log(`isGroups: ${isGroupsVal}`);

  const safeGroups = isGroupsVal ? groups as any[] : [];
  const { direct, bestThirds } = buildQualifiers(safeGroups);
  console.log(`direct length: ${direct.length}`);
  console.log(`bestThirds length: ${bestThirds.length}`);
  const ready = safeGroups.length > 0 && direct.length >= 24;
  console.log(`ready: ${ready}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
