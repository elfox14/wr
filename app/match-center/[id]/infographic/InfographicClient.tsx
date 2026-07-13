'use client';

import { motion } from 'framer-motion';
import type { MatchPageData, MatchPlayerStatItem } from '@/lib/match-page/types';
import TeamHeatmap from '@/components/match-center/visuals/TeamHeatmap';
import CompactStatCell from '@/components/match-center/visuals/CompactStatCell';

interface InfographicProps {
  matchData: MatchPageData;
  info: Record<string, any>;
  isPreview?: boolean;
}

const ar = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });

function value(input: number | null | undefined, suffix = '') {
  return input === null || input === undefined ? '—' : `${ar.format(input)}${suffix}`;
}

function TeamIdentity({ team, accent }: { team: MatchPageData['homeTeam']; accent: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-3xl border bg-black/30 p-2 sm:h-24 sm:w-28" style={{ borderColor: `${accent}55` }}>
        {team.image ? <img src={team.image} alt={team.name} className="h-full w-full object-contain" /> : <span className="text-xl font-black" style={{ color: accent }}>{team.code || team.name.slice(0, 3)}</span>}
      </div>
      <h2 className="mt-3 max-w-full truncate text-lg font-black text-white sm:text-3xl">{team.name}</h2>
    </div>
  );
}

function playerSide(player: MatchPlayerStatItem, matchData: MatchPageData) {
  if (player.teamId === matchData.homeTeam.id || player.teamId === matchData.homeTeam.code) return 'home';
  if (player.teamId === matchData.awayTeam.id || player.teamId === matchData.awayTeam.code) return 'away';
  return null;
}

export default function InfographicClient({ matchData, info, isPreview = false }: InfographicProps) {
  const availableStats = matchData.stats.filter((metric) => metric.available && metric.home !== null && metric.away !== null).slice(0, 15);
  const momentum = matchData.advanced.momentum || [];
  const momentumMax = Math.max(1, ...momentum.flatMap((point) => [point.home, point.away]));
  const homeHeatmapPoints = matchData.advanced.teamHeatmaps?.home?.points || [];
  const awayHeatmapPoints = matchData.advanced.teamHeatmaps?.away?.points || [];
  const topPlayers = (matchData.advanced.playerStats || [])
    .filter((player) => (player.started === true || player.played === true || Number(player.minutes || 0) > 0) && typeof player.rating === 'number')
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 3);
  const source = info?.source || {};
  const xg = matchData.advanced.xg;
  const npxg = matchData.advanced.npxg;

  return (
    <main className="min-h-screen bg-[#020604] px-2 py-5 text-white sm:px-5" dir="rtl">
      {isPreview && (
        <div className="sticky top-2 z-50 mx-auto mb-3 max-w-[1080px] rounded-2xl border border-amber-300/30 bg-amber-300/15 px-4 py-3 text-center text-sm font-black text-amber-100 backdrop-blur">
          معاينة إدارية — هذا الإنفوجرافيك غير ظاهر للجمهور حتى يتم اعتماده.
        </div>
      )}

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#07110d] shadow-[0_30px_100px_rgba(0,0,0,.65)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#F8C846]/15 blur-[110px]" />
        <div className="pointer-events-none absolute -left-40 top-52 h-96 w-96 rounded-full bg-[#0FF0FC]/15 blur-[110px]" />

        <div className="relative p-4 sm:p-8 lg:p-12">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="inline-flex rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-1 text-xs font-black text-[#18E58F]">MATCH INTELLIGENCE · بيانات موثقة</div>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">قصة المباراة بالأرقام</h1>
              <p className="mt-2 text-sm font-bold text-slate-400">{matchData.competition} · {matchData.stageLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left text-[10px] font-bold leading-5 text-slate-500" dir="ltr">
              <div>Source: {source.provider || 'THE_STATS'}</div>
              <div>Snapshot: {String(source.snapshotId || '').slice(0, 12) || '—'}</div>
            </div>
          </header>

          <section className="mt-7 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[2rem] border border-white/10 bg-black/20 p-4 sm:gap-8 sm:p-8">
            <TeamIdentity team={matchData.homeTeam} accent="#0FF0FC" />
            <div className="text-center">
              <div className="flex items-center gap-3 text-4xl font-black tabular-nums sm:text-7xl">
                <span className="text-[#0FF0FC]">{value(matchData.score.home)}</span>
                <span className="text-white/25">–</span>
                <span className="text-[#F8C846]">{value(matchData.score.away)}</span>
              </div>
              <span className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black text-slate-300">{matchData.status.shortLabel || matchData.status.label}</span>
            </div>
            <TeamIdentity team={matchData.awayTeam} accent="#F8C846" />
          </section>

          {(xg?.home !== null && xg?.home !== undefined && xg?.away !== null && xg?.away !== undefined) && (
            <section className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 p-5">
                <p className="text-xs font-black text-[#0FF0FC]">جودة الفرص · xG</p>
                <div className="mt-3 flex items-end justify-between"><b className="text-4xl font-black">{value(xg.home)}</b><span className="text-slate-500">مقابل</span><b className="text-4xl font-black">{value(xg.away)}</b></div>
              </div>
              {(npxg?.home !== null && npxg?.home !== undefined && npxg?.away !== null && npxg?.away !== undefined) && (
                <div className="rounded-3xl border border-[#F8C846]/20 bg-[#F8C846]/5 p-5">
                  <p className="text-xs font-black text-[#F8C846]">xG دون ركلات الجزاء · npxG</p>
                  <div className="mt-3 flex items-end justify-between"><b className="text-4xl font-black">{value(npxg.home)}</b><span className="text-slate-500">مقابل</span><b className="text-4xl font-black">{value(npxg.away)}</b></div>
                </div>
              )}
            </section>
          )}

          {momentum.length >= 2 && (
            <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="text-xl font-black">زخم المباراة</h3><p className="mt-1 text-[11px] font-bold text-slate-500">{momentum.some((point) => point.source === 'PROVIDER') ? 'سلسلة المزود' : 'محسوب من التسديدات وxG الموثقة'}</p></div>
                <div className="flex gap-3 text-xs font-black"><span className="text-[#0FF0FC]">{matchData.homeTeam.name}</span><span className="text-[#F8C846]">{matchData.awayTeam.name}</span></div>
              </div>
              <div className="mt-5 overflow-x-auto">
                <div className="flex h-48 min-w-[650px] items-center gap-1">
                  {momentum.map((point) => (
                    <div key={point.minute} className="flex flex-1 flex-col items-center justify-center">
                      <div className="flex h-[80px] w-full items-end justify-center"><div className="w-3/4 rounded-t bg-[#0FF0FC]" style={{ height: Math.max(2, point.home / momentumMax * 76) }} /></div>
                      <span className="my-1 text-[8px] font-black text-slate-600">{point.minute}′</span>
                      <div className="flex h-[80px] w-full items-start justify-center"><div className="w-3/4 rounded-b bg-[#F8C846]" style={{ height: Math.max(2, point.away / momentumMax * 76) }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {availableStats.length > 0 && (
            <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <h3 className="text-xl font-black">المقارنة الكاملة</h3>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableStats.map((metric) => <CompactStatCell key={metric.key} label={metric.label} h={value(metric.home, metric.suffix)} a={value(metric.away, metric.suffix)} />)}
              </div>
            </section>
          )}

          {(homeHeatmapPoints.length > 0 || awayHeatmapPoints.length > 0) && (
            <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div><h3 className="text-xl font-black">بصمة التمركز</h3><p className="mt-1 text-[11px] font-bold text-slate-500">خرائط مجمعة من نقاط اللاعبين الفعلية فقط</p></div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {homeHeatmapPoints.length > 0 && <div className="flex justify-center"><TeamHeatmap teamName={matchData.homeTeam.name} isHome points={homeHeatmapPoints} /></div>}
                {awayHeatmapPoints.length > 0 && <div className="flex justify-center"><TeamHeatmap teamName={matchData.awayTeam.name} isHome={false} points={awayHeatmapPoints} /></div>}
              </div>
            </section>
          )}

          {topPlayers.length > 0 && (
            <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
              <div><h3 className="text-xl font-black">الأعلى تقييمًا</h3><p className="mt-1 text-[11px] font-bold text-slate-500">ترتيب مباشر من تقييمات مزود البيانات، وليس اختيارًا مولدًا.</p></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {topPlayers.map((player, index) => {
                  const side = playerSide(player, matchData);
                  return (
                    <article key={player.playerId || player.playerName} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="flex items-center justify-between"><span className="text-xs font-black text-slate-500">#{index + 1}</span><b className="rounded-full bg-[#18E58F]/10 px-3 py-1 text-lg font-black text-[#18E58F]">{value(player.rating)}</b></div>
                      <h4 className="mt-4 text-lg font-black">{player.playerName}</h4>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{side === 'home' ? matchData.homeTeam.name : side === 'away' ? matchData.awayTeam.name : player.teamName || ''}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black text-slate-300">
                        {player.minutes !== null && player.minutes !== undefined && <span>{value(player.minutes)} دقيقة</span>}
                        {Number(player.goals || 0) > 0 && <span>{value(player.goals)} هدف</span>}
                        {Number(player.assists || 0) > 0 && <span>{value(player.assists)} أسيست</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[10px] font-bold text-slate-600">
            <span>لا يعرض هذا الإنفوجرافيك أي رقم غير موجود في Snapshot الموثق.</span>
            <span>{info?.approvedAt ? `اعتمد في ${new Date(info.approvedAt).toLocaleDateString('ar-EG', { timeZone: 'UTC' })}` : 'بانتظار الاعتماد التحريري'}</span>
          </footer>
        </div>
      </motion.article>
    </main>
  );
}
