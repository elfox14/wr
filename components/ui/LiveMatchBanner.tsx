import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Radio } from 'lucide-react';

function scoreLabel(match: { homeScore: number; awayScore: number }) {
  return `${match.homeScore || 0} - ${match.awayScore || 0}`;
}

export async function LiveMatchBanner() {
  const match = await prisma.match.findFirst({
    where: { status: { in: ['IN_PLAY', 'LIVE'] } },
    orderBy: { matchDate: 'asc' },
    select: {
      animationMatchId: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  if (!match) return null;

  const href = match.animationMatchId
    ? `/animation-live?matchId=${encodeURIComponent(String(match.animationMatchId))}&lang=en&statsPanel=hide&teamPanel=1`
    : '/matches';

  return (
    <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 text-center text-xs font-black md:text-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-white">
          <Radio size={14} className="animate-pulse" /> مباشر الآن
        </span>
        <span>{match.homeTeam.name}</span>
        <span className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 font-mono text-[#FFD700]">{scoreLabel(match)}</span>
        <span>{match.awayTeam.name}</span>
        <Link href={href} className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-[#FFD700] hover:bg-[#FFD700] hover:text-black">
          {match.animationMatchId ? 'شاهد بث الأنيميشن' : 'تفاصيل المباراة'}
        </Link>
      </div>
    </div>
  );
}
