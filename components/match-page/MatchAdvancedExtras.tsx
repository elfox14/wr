import prisma from '@/lib/prisma';

const ar = new Intl.NumberFormat('ar-EG');

function rawObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function list(value: any): any[] {
  return Array.isArray(value) ? value : [];
}
function fmt(value: any, suffix = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Number.isInteger(n) ? ar.format(n) : n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}${suffix}`;
}
function text(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
function pairRows(stats: Record<string, any>) {
  const labels: Record<string, string> = {
    possession: 'الاستحواذ',
    shots: 'التسديدات',
    shotsOnTarget: 'على المرمى',
    shotsOffTarget: 'خارج المرمى',
    corners: 'الركنيات',
    xg: 'xG',
    fouls: 'الأخطاء',
    offsides: 'التسللات',
    yellowCards: 'بطاقات صفراء',
    redCards: 'بطاقات حمراء',
    bigChances: 'فرص كبيرة',
    goalkeeperSaves: 'تصديات الحارس',
  };
  return Object.entries(stats || {}).map(([key, value]) => ({ key, label: labels[key] || key, home: value?.home, away: value?.away }));
}
function eventLabel(type: string) {
  const map: Record<string, string> = {
    goal: 'هدف', shot_on_target: 'تسديدة على المرمى', shot_off_target: 'تسديدة خارج المرمى', shot_blocked: 'تسديدة محجوبة',
    corner_kick: 'ركنية', foul: 'خطأ', yellow_card: 'بطاقة صفراء', red_card: 'بطاقة حمراء', substitution: 'تبديل', var: 'VAR', offside: 'تسلل', added_time: 'وقت بدل ضائع', period_start: 'بداية شوط', period_end: 'نهاية شوط',
  };
  return map[type] || type;
}
function minuteLabel(item: any) {
  const minute = item?.minute;
  const extra = item?.extraTime ?? item?.extra_time;
  if (minute === null || minute === undefined) return '—';
  return extra ? `د${ar.format(Number(minute))}+${ar.format(Number(extra))}` : `د${ar.format(Number(minute))}`;
}
function Availability({ label, count, ok }: { label: string; count?: number; ok?: boolean }) {
  const ready = Boolean(ok || Number(count || 0) > 0);
  return <div className={`rounded-2xl border p-3 ${ready ? 'border-[#18E58F]/25 bg-[#18E58F]/10' : 'border-white/10 bg-black/20'}`}><p className="text-xs font-black text-slate-300">{label}</p><p className={`mt-1 text-lg font-black ${ready ? 'text-[#18E58F]' : 'text-slate-500'}`}>{count !== undefined ? ar.format(count) : ready ? 'متاح' : 'غير متاح الآن'}</p></div>;
}
function MiniTable({ rows, homeName, awayName }: { rows: any[]; homeName: string; awayName: string }) {
  if (!rows.length) return <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-slate-400">لا توجد إحصائيات محفوظة في هذا الجزء حتى الآن.</p>;
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <div key={row.key} className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-center text-xs font-black text-[#F8C846]">{row.label}</p><div className="mt-2 grid grid-cols-2 gap-2 text-center"><span className="rounded-xl bg-white/[0.06] p-2 text-sm font-black text-white"><b className="block text-[10px] text-slate-400">{homeName}</b>{fmt(row.home)}</span><span className="rounded-xl bg-white/[0.06] p-2 text-sm font-black text-white"><b className="block text-[10px] text-slate-400">{awayName}</b>{fmt(row.away)}</span></div></div>)}</div>;
}

export default async function MatchAdvancedExtras({ matchId }: { matchId: string }) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  const snapshot = await prisma.matchStatsSnapshot.findFirst({ where: { matchId, provider: 'THE_STATS_API_EXTRAS' }, orderBy: { capturedAt: 'desc' } });
  const raw = rawObject(snapshot?.rawData);
  const normalized = rawObject(raw.normalized);
  const matchInfo = rawObject(normalized.matchInfo);
  const liveStats = rawObject(normalized.liveStats);
  const events = list(rawObject(normalized.eventsDetailed).all);
  const shots = list(normalized.shotmap);
  const playerStats = list(normalized.playerStats);
  const lineups = rawObject(normalized.lineups);
  const endpoints = list(raw.endpoints);
  const homeName = match?.homeTeam?.name || 'صاحب الأرض';
  const awayName = match?.awayTeam?.name || 'الضيف';
  const isFinished = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'].includes(String(match?.status || '').toUpperCase());
  const liveRows = pairRows(rawObject(liveStats.stats));
  const npxg = rawObject(matchInfo.npxgSummary);

  return <section className="mx-auto mt-5 max-w-7xl rounded-[1.65rem] border border-[#18E58F]/20 bg-[#04110D] p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,.28)] sm:p-5" dir="rtl">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black sm:text-2xl">بيانات TheStats المتقدمة</h2><p className="mt-1 text-xs font-bold text-slate-400">تُقرأ من قاعدة البيانات من Snapshot: THE_STATS_API_EXTRAS، ويمكن استخدامها لاحقًا في التحليل والملعب التفاعلي والأقسام الأخرى.</p></div>
      <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-slate-300">آخر حفظ: {snapshot?.capturedAt ? new Date(snapshot.capturedAt).toLocaleString('ar-EG') : 'لم يُحفظ بعد'}</span>
    </div>

    {!snapshot ? <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center"><p className="font-black text-[#F8C846]">لم يتم حفظ البيانات المتقدمة بعد</p><p className="mt-2 text-sm font-bold leading-7 text-slate-400">شغّل كرون live-match-full-sync أو /api/admin/match-extra-data لحفظ أول Snapshot، وبعدها سيظهر هذا القسم تلقائيًا.</p></div> : null}

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Availability label="بيانات المباراة" ok={Boolean(matchInfo.venue || matchInfo.referee || matchInfo.score)} />
      <Availability label="إحصائيات حية" count={liveRows.length} />
      <Availability label="أحداث Timeline" count={events.length} />
      <Availability label="Shotmap" count={shots.length} />
      <Availability label="Player Stats" count={playerStats.length} />
    </div>

    <div className="mt-5 grid gap-3 lg:grid-cols-4">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-xs font-black text-slate-400">الملعب</p><p className="mt-1 text-sm font-black text-white">{text(matchInfo.venue)}</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-xs font-black text-slate-400">المدينة</p><p className="mt-1 text-sm font-black text-white">{text(matchInfo.city)}</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-xs font-black text-slate-400">الحكم</p><p className="mt-1 text-sm font-black text-white">{text(matchInfo.referee)}</p></div>
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-xs font-black text-slate-400">npxG</p><p className="mt-1 text-sm font-black text-white">{npxg.live ? `${fmt(npxg.live.home_team)} - ${fmt(npxg.live.away_team)}` : '—'}</p></div>
    </div>

    <div className="mt-5"><h3 className="mb-3 text-lg font-black text-white">كل الإحصائيات المتاحة الآن</h3><MiniTable rows={liveRows} homeName={homeName} awayName={awayName} /></div>

    <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-[#F8C846]/35" /><span className="rounded-full border border-[#F8C846]/35 bg-[#F8C846]/10 px-4 py-2 text-xs font-black text-[#F8C846]">تتوفر بعد انتهاء المباراة</span><span className="h-px flex-1 bg-[#F8C846]/35" /></div>

    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-white">الأحداث التفصيلية</h3><span className="text-xs font-black text-slate-400">{ar.format(events.length)} حدث</span></div>{events.length ? <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{events.map((event, index) => <article key={`${event.sequence || index}-${event.type}`} className="rounded-xl border border-white/10 bg-white/[0.045] p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><b className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white">{minuteLabel(event)}</b><span className="rounded-full bg-[#18E58F]/15 px-2 py-1 text-[10px] font-black text-[#18E58F]">{eventLabel(event.type)}</span><span className="truncate text-xs font-black text-[#F8C846]">{event.playerName || event.teamName || ''}</span></div><p className="text-xs font-bold leading-5 text-slate-300">{text(event.detail || event.outcome || event.reason || event.period)}</p></article>)}</div> : <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-slate-400">{isFinished ? 'لم يحفظ المصدر Timeline لهذه المباراة بعد.' : 'عادةً تظهر الأحداث التفصيلية بعد نهاية المباراة عندما تصبح التغطية Full.'}</p>}</div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-white">Shotmap وإحداثيات التسديدات</h3><span className="text-xs font-black text-slate-400">{ar.format(shots.length)} تسديدة</span></div>{shots.length ? <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{shots.map((shot, index) => <article key={`${shot.id || index}`} className="rounded-xl border border-white/10 bg-white/[0.045] p-3"><div className="flex flex-wrap items-center gap-2"><b className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-white">{minuteLabel(shot)}</b><span className={`rounded-full px-2 py-1 text-[10px] font-black ${shot.isGoal ? 'bg-[#18E58F] text-black' : shot.isOnTarget ? 'bg-[#F8C846] text-black' : 'bg-white/10 text-slate-300'}`}>{shot.isGoal ? 'هدف' : shot.isOnTarget ? 'على المرمى' : 'خارج/محجوبة'}</span><span className="truncate text-xs font-black text-white">{shot.playerName}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-black text-slate-300"><span className="rounded-lg bg-black/25 p-2">x/y<br />{fmt(shot.x)} / {fmt(shot.y)}</span><span className="rounded-lg bg-black/25 p-2">xG<br />{fmt(shot.xg)}</span><span className="rounded-lg bg-black/25 p-2">القدم/الرأس<br />{text(shot.bodyPart)}</span></div></article>)}</div> : <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-slate-400">{isFinished ? 'لم يحفظ المصدر Shotmap لهذه المباراة بعد.' : 'Shotmap الحقيقي يظهر غالبًا بعد المباراة أو عند اكتمال التغطية.'}</p>}</div>
    </div>

    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-black text-white">إحصائيات اللاعبين بعد المباراة</h3><span className="text-xs font-black text-slate-400">{ar.format(playerStats.length)} لاعب</span></div>{playerStats.length ? <div className="max-h-[430px] overflow-x-auto overflow-y-auto"><table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-right text-xs"><thead className="text-slate-500"><tr><th className="px-2">اللاعب</th><th>الفريق</th><th>تقييم</th><th>دقائق</th><th>تسديدات</th><th>تمريرات</th><th>Key passes</th><th>تدخلات</th><th>اعتراضات</th><th>تصديات</th></tr></thead><tbody>{playerStats.map((p, i) => <tr key={`${p.playerId || p.playerName || i}`} className="bg-white/[0.045] text-white"><td className="rounded-r-xl px-2 py-3 font-black">{p.playerName}</td><td>{p.teamName || '—'}</td><td>{fmt(p.rating)}</td><td>{fmt(p.minutes)}</td><td>{fmt(p.shots)}</td><td>{fmt(p.passes)}</td><td>{fmt(p.keyPasses)}</td><td>{fmt(p.tackles)}</td><td>{fmt(p.interceptions)}</td><td className="rounded-l-xl">{fmt(p.saves)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-slate-400">Player Stats تتوفر غالبًا بعد نهاية المباراة إذا أتاحها TheStats لهذه المباراة.</p>}</div>

    <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3"><summary className="cursor-pointer text-sm font-black text-slate-300">حالة endpoints المحفوظة</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{endpoints.map((endpoint, index) => <div key={`${endpoint.key}-${index}`} className={`rounded-xl border p-2 text-xs font-bold ${endpoint.ok ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]' : 'border-white/10 bg-white/[0.04] text-slate-400'}`}>{endpoint.key}: {endpoint.ok ? 'OK' : text(endpoint.error?.status || endpoint.error?.message)}</div>)}</div></details>
  </section>;
}
