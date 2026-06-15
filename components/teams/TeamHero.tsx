'use client';

import { getTeamFlag } from '@/lib/teamFlags';

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return 'غير متوفر في المصادر';
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getOpponent(teamId: string, match: any) {
  if (match?.homeTeam?.id === teamId) return match?.awayTeam?.name;
  if (match?.awayTeam?.id === teamId) return match?.homeTeam?.name;
  return null;
}

function getNextMatch(teamId: string, matches: any[]) {
  const now = Date.now();
  return [...(matches || [])]
    .filter((match) => String(match?.status || '').toUpperCase() !== 'FINISHED')
    .filter((match) => {
      const date = parseDate(match?.matchDate);
      return !date || date.getTime() >= now - 6 * 60 * 60 * 1000;
    })
    .sort((a, b) => (parseDate(a?.matchDate)?.getTime() || 0) - (parseDate(b?.matchDate)?.getTime() || 0))[0];
}

function getDataCompleteness(team: any, matches: any[], players: any[], report: any) {
  const checks = [
    Boolean(team?.name),
    Boolean(team?.group),
    Boolean(team?.coach),
    Boolean(team?.fifaRank),
    matches.length > 0,
    players.length > 0,
    Boolean(report?.summary || report?.body),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function TeamHero({ team, matches = [], players = [], report }: { team: any; matches?: any[]; players?: any[]; report?: any }) {
  const nextMatch = getNextMatch(team.id, matches);
  const nextOpponent = nextMatch ? getOpponent(team.id, nextMatch) : null;
  const completeness = getDataCompleteness(team, matches, players, report);
  const flag = getTeamFlag(team);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-8">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-white/20 bg-white/10 text-6xl shadow-inner shadow-black/30">
            {flag || <span className="text-3xl font-black">{team.name?.charAt(0) || '؟'}</span>}
          </div>
        </div>
        
        <div className="text-center md:text-right flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-black">{team.name}</h1>
            <span className="px-3 py-1 text-sm font-bold bg-white/10 rounded-full border border-white/10 text-gray-300">
              {team.group ? `المجموعة ${String(team.group).replace('Group ', '')}` : 'المجموعة غير متوفرة'}
            </span>
            <span className="px-3 py-1 text-sm font-bold bg-[#0FF0FC]/10 text-[#0FF0FC] rounded-full border border-[#0FF0FC]/20">
              تصنيف فيفا: {team.fifaRank || 'غير متوفر'}
            </span>
            {team.isDemo && (
              <span className="px-3 py-1 text-xs font-bold bg-yellow-500/10 text-yellow-300 rounded-full border border-yellow-500/20">
                صفحة اختبار بدون بيانات موثقة
              </span>
            )}
          </div>
          <p className="text-gray-400 font-medium">
            المدرب: {team.coach || 'غير متوفر في المصادر'} • القارة: {team.continent || 'غير متوفر'} • المشاركات: {team.participations ?? 'غير متوفر'}
          </p>
          {team.dataNotice && <p className="mt-3 text-sm text-yellow-200/80">{team.dataNotice}</p>}
        </div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">المباراة القادمة</p>
          <p className="font-bold text-sm">{nextOpponent ? `ضد ${nextOpponent}` : 'غير متوفر في المصادر'}</p>
          {nextMatch?.matchDate && <p className="mt-1 text-xs text-gray-500">{formatDate(nextMatch.matchDate)}</p>}
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">وضع المجموعة</p>
          <p className="font-bold text-sm">يُحسب من جدول المجموعة عند توفره</p>
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">نسبة اكتمال البيانات</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${completeness}%` }} />
            </div>
            <span className="text-xs font-bold text-green-400">{completeness}%</span>
          </div>
        </div>
        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">مصدر آخر تحديث</p>
          <p className="font-bold text-sm text-[#0FF0FC]">{report?.sourceName || (matches.length || players.length ? 'قاعدة البيانات / ISPORTS' : 'غير متوفر')}</p>
        </div>
      </div>
    </div>
  );
}
