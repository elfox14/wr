import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import prisma from '@/lib/prisma';
import { Radio } from 'lucide-react';

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scoreLabel(match: { homeScore: number; awayScore: number }, snapshot?: { homeScore?: number | null; awayScore?: number | null } | null) {
  const homeScore = nullableNumber(snapshot?.homeScore) ?? nullableNumber(match.homeScore) ?? 0;
  const awayScore = nullableNumber(snapshot?.awayScore) ?? nullableNumber(match.awayScore) ?? 0;
  return `${homeScore} - ${awayScore}`;
}

async function getLatestScoreSnapshot(matchId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT "homeScore", "awayScore", "capturedAt"
      FROM "MatchStatsSnapshot"
      WHERE "matchId" = '${String(matchId).replace(/'/g, "''")}'
      ORDER BY "capturedAt" DESC
      LIMIT 1
    `);
    return rows[0] || null;
  } catch (error: any) {
    if (!String(error?.message || '').includes('MatchStatsSnapshot')) {
      console.warn('live banner score snapshot lookup failed:', error?.message || error);
    }
    return null;
  }
}

export async function LiveMatchBanner() {
  noStore();

  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const liveWindowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const match = await prisma.match.findFirst({
    where: {
      status: { in: ['IN_PLAY', 'LIVE'] },
      matchDate: { gte: liveWindowStart, lte: liveWindowEnd },
    },
    orderBy: { matchDate: 'asc' },
    select: {
      id: true,
      animationMatchId: true,
      homeScore: true,
      awayScore: true,
      matchDate: true,
      status: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  if (!match) return null;

  const snapshot = await getLatestScoreSnapshot(match.id);

  return (
    <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 text-center text-xs font-black md:text-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-white">
          <Radio size={14} className="animate-pulse" /> مباشر الآن
        </span>
        <span>{match.homeTeam.name}</span>
        <span className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 font-mono text-[#FFD700]">{scoreLabel(match, snapshot)}</span>
        <span>{match.awayTeam.name}</span>
        <Link href="/live" className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-[#FFD700] hover:bg-[#FFD700] hover:text-black">
          متابعة المباشر
        </Link>
      </div>
    </div>
  );
}
