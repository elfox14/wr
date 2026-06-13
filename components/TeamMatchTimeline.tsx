import Link from 'next/link';
import { CalendarDays, Clock, CheckCircle2, Circle } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type Opponent = { id: string; name: string; image?: string | null };
export type Match = {
  id: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: Opponent | null;
  awayTeam?: Opponent | null;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  stage?: string | null;
  matchDate: Date | string;
};

type TeamMatchTimelineProps = {
  teamId: string;
  matches: Match[];
};

export default function TeamMatchTimeline({ teamId, matches }: TeamMatchTimelineProps) {
  if (!matches || matches.length === 0) return null;

  // Sort chronologically
  const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  return (
    <div className="rounded-3xl border border-white/10 bg-[#101217] p-5 shadow-card md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <CalendarDays size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">المسار الزمني للمباريات</h2>
          <p className="text-xs text-slate-400">سجل النتائج والمواجهات القادمة</p>
        </div>
      </div>

      <div className="relative pl-4 md:pl-8 before:absolute before:left-3 md:before:left-7 before:top-4 before:bottom-4 before:w-[2px] before:bg-white/10" dir="rtl">
        <div className="relative pr-6 md:pr-10 before:absolute before:right-2 md:before:right-4 before:top-4 before:bottom-4 before:w-[2px] before:bg-white/10 before:-translate-x-1/2">
          {sortedMatches.map((match, index) => {
            const isHome = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
            const opponent = isHome ? match.awayTeam : match.homeTeam;
            const finished = match.status === 'FINISHED';
            const live = ['IN_PLAY', 'LIVE'].includes(match.status);
            
            let result: 'W' | 'D' | 'L' | null = null;
            if (finished && typeof match.homeScore === 'number' && typeof match.awayScore === 'number') {
              const myScore = isHome ? match.homeScore : match.awayScore;
              const opScore = isHome ? match.awayScore : match.homeScore;
              if (myScore > opScore) result = 'W';
              else if (myScore < opScore) result = 'L';
              else result = 'D';
            }

            const matchDate = new Date(match.matchDate);
            const dateStr = matchDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
            const timeStr = matchDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={match.id} className="relative mb-6 last:mb-0">
                {/* Timeline Dot */}
                <div className={`absolute -right-[23px] md:-right-[31px] top-4 flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-full border-4 border-[#101217] ${
                  live ? 'bg-primary animate-pulse' :
                  result === 'W' ? 'bg-emerald-500' :
                  result === 'L' ? 'bg-rose-500' :
                  result === 'D' ? 'bg-slate-500' :
                  'bg-white/20'
                }`}>
                  {result === 'W' ? <CheckCircle2 size={14} className="text-white" /> :
                   result === 'L' || result === 'D' ? <span className="text-xs font-black text-white">{result}</span> :
                   <Circle size={10} className="text-white/50" />}
                </div>

                {/* Card */}
                <Link href={`/matches`} className={`block rounded-2xl border ${live ? 'border-primary/50 bg-primary/5' : 'border-white/5 bg-white/[0.02]'} p-4 transition hover:bg-white/[0.05] hover:border-white/10`}>
                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">
                      {dateStr} • {timeStr}
                    </span>
                    <span className={`rounded-lg px-2 py-1 font-black ${
                      live ? 'bg-primary/20 text-primary' : 
                      finished ? 'bg-white/10 text-slate-300' : 
                      'bg-white/5 text-slate-500'
                    }`}>
                      {live ? 'مباشرة الآن' : finished ? 'انتهت' : 'لم تبدأ'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AssetImage image={opponent?.image || ''} type="TEAM" name={opponent?.name || 'Opponent'} width={40} height={40} className="h-10 w-10 md:h-12 md:w-12 rounded-xl object-cover border border-white/10" />
                      <div>
                        <div className="text-sm font-black text-white md:text-base">ضد {opponent?.name || 'غير محدد'}</div>
                        <div className="text-xs text-slate-500">{match.stage === 'group' ? 'المجموعات' : match.stage || 'مباراة'}</div>
                      </div>
                    </div>
                    
                    {/* Score */}
                    {(finished || live) ? (
                      <div className="flex flex-col items-end">
                        <div className="text-2xl font-black tabular-nums text-white" dir="ltr">
                          {isHome ? match.homeScore : match.awayScore} - {isHome ? match.awayScore : match.homeScore}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock size={16} />
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
