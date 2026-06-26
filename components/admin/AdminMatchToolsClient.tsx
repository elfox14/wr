'use client';

import { useMemo, useState } from 'react';

type Snapshot = {
  provider: string;
  providerMatchId: number | null;
  capturedAt: string;
  homePossession?: number | null;
  awayPossession?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
};

type MatchRow = {
  id: string;
  externalId: string | null;
  animationMatchId: number | null;
  homeTeam: string;
  awayTeam: string;
  homeCode: string | null;
  awayCode: string | null;
  matchDate: string;
  status: string;
  score: string;
  stage: string;
  groupPhase: string | null;
  latestSnapshot: Snapshot | null;
  latestTheStatsSnapshot: Snapshot | null;
  eventsCount: number;
};

type Props = {
  adminKey: string;
  matches: MatchRow[];
};

function enc(value: string | number | null | undefined) {
  return encodeURIComponent(String(value ?? ''));
}

function localDate(value: string) {
  try {
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function shortJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 6000);
}

export default function AdminMatchToolsClient({ adminKey, matches }: Props) {
  const [log, setLog] = useState('جاهز.');
  const [running, setRunning] = useState<string | null>(null);
  const [providerIds, setProviderIds] = useState<Record<string, string>>({});
  const [animationIds, setAnimationIds] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live' | 'finished' | 'missingFinal' | 'missingAnimation'>('all');

  const filtered = useMemo(() => {
    const now = Date.now();
    return matches.filter((match) => {
      const status = match.status.toUpperCase();
      const isFinished = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'].includes(status);
      const isLive = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'PAUSED'].includes(status);
      const isUpcoming = !isFinished && new Date(match.matchDate).getTime() >= now - 3 * 60 * 60 * 1000;
      if (filter === 'finished') return isFinished;
      if (filter === 'live') return isLive;
      if (filter === 'upcoming') return isUpcoming;
      if (filter === 'missingFinal') return isFinished && !match.latestTheStatsSnapshot;
      if (filter === 'missingAnimation') return !match.animationMatchId && isUpcoming;
      return true;
    });
  }, [filter, matches]);

  async function callUrl(label: string, url: string) {
    setRunning(label);
    setLog(`تشغيل: ${label}\n${url}`);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      let data: unknown = text;
      try { data = JSON.parse(text); } catch {}
      setLog(`${label}\nHTTP ${res.status}\n${shortJson(data)}`);
    } catch (error: any) {
      setLog(`${label}\nERROR: ${error?.message || String(error)}`);
    } finally {
      setRunning(null);
    }
  }

  async function postAction(label: string, body: Record<string, unknown>) {
    setRunning(label);
    setLog(`تشغيل: ${label}`);
    try {
      const res = await fetch(`/api/admin/matches-tools?key=${enc(adminKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      setLog(`${label}\nHTTP ${res.status}\n${shortJson(data)}`);
    } catch (error: any) {
      setLog(`${label}\nERROR: ${error?.message || String(error)}`);
    } finally {
      setRunning(null);
    }
  }

  function autoFinal(match: MatchRow) {
    const url = `/api/cron/the-stats-finalize-matches?key=${enc(adminKey)}&matchId=${enc(match.id)}&apply=true&limit=1&days=60&requestsPerMinute=110&timeoutMs=20000&includeRaw=false&writeMatchEvents=false&purgeISportsSnapshots=false&dryRun=false`;
    return callUrl(`TheStats Auto Final — ${match.homeTeam} vs ${match.awayTeam}`, url);
  }

  function manualFinal(match: MatchRow, scope: 'basic' | 'full') {
    const providerMatchId = providerIds[match.id] || match.externalId || '';
    if (!providerMatchId.trim()) {
      setLog('ضع TheStats ID أولًا مثل mt_894046563، أو احفظه في externalId من الزر المجاور.');
      return;
    }
    const url = `/api/cron/manual-final-import?key=${enc(adminKey)}&matchId=${enc(match.id)}&providerMatchId=${enc(providerMatchId)}&scope=${scope}&dryRun=false&includeRaw=false&syncAnimation=true&timeoutMs=25000&delayMs=1000`;
    return callUrl(`Manual TheStats ${scope} — ${match.homeTeam} vs ${match.awayTeam}`, url);
  }

  function syncAnimationWindow() {
    const url = `/api/cron/sync-animation-matches?key=${enc(adminKey)}&limit=80&lookbackHours=12&lookaheadHours=120&threshold=65&dryRun=false&includeAlreadyLinked=false`;
    return callUrl('مزامنة iSports للمباريات القريبة', url);
  }

  function liveIngestNow() {
    const url = `/api/cron/live-ingest?key=${enc(adminKey)}&finishedHours=0&limit=4&maxExternalRequests=4&maxBrowserlessRequests=2&lookaheadMinutes=45&lookbackHours=3&minIntervalSeconds=60`;
    return callUrl('تشغيل live-ingest الآن', url);
  }

  function footballDataResults() {
    const url = `/api/cron/football-data-results-sync?key=${enc(adminKey)}&quick=true`;
    return callUrl('Football-Data results sync', url);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl">
          <p className="text-sm text-emerald-300">لوحة إدارة كأس العالم</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">إدارة مزامنة المباريات والإحصائيات النهائية</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            استخدم هذه الصفحة لتجهيز المباراة قبل البداية عبر iSports، تشغيل الجلب المباشر، وتثبيت الإحصائيات النهائية من TheStats بعد نهاية المباراة. لا تظهر هذه الصفحة للزائرين ولا تعرض أسماء المصادر في واجهة المستخدم العامة.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={syncAnimationWindow} disabled={Boolean(running)} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">مزامنة iSports للمباريات القريبة</button>
            <button onClick={liveIngestNow} disabled={Boolean(running)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">تشغيل Live Ingest الآن</button>
            <button onClick={footballDataResults} disabled={Boolean(running)} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">تحديث النتائج والحالات</button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  ['all', 'كل المباريات'],
                  ['upcoming', 'القادمة'],
                  ['live', 'المباشرة'],
                  ['finished', 'المنتهية'],
                  ['missingFinal', 'منتهية بدون TheStats'],
                  ['missingAnimation', 'قادمة بدون iSports'],
                ].map(([value, label]) => (
                  <button key={value} onClick={() => setFilter(value as any)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === value ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
                ))}
              </div>
              <p className="text-xs text-slate-400">المعروض: {filtered.length} / {matches.length}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-right">المباراة</th>
                    <th className="px-3 py-2 text-right">الموعد</th>
                    <th className="px-3 py-2 text-right">الحالة</th>
                    <th className="px-3 py-2 text-right">IDs</th>
                    <th className="px-3 py-2 text-right">آخر بيانات</th>
                    <th className="px-3 py-2 text-right">إجراءات TheStats</th>
                    <th className="px-3 py-2 text-right">إجراءات iSports</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((match) => (
                    <tr key={match.id} className="rounded-2xl bg-slate-800/70 align-top">
                      <td className="rounded-r-2xl px-3 py-3">
                        <div className="font-bold">{match.homeTeam} × {match.awayTeam}</div>
                        <div className="mt-1 text-xs text-slate-400">{match.groupPhase || match.stage} · {match.score}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{match.id}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">{localDate(match.matchDate)}</td>
                      <td className="px-3 py-3"><span className="rounded-full bg-slate-950 px-2 py-1 text-xs">{match.status}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <div>TheStats: <span className="text-emerald-300">{match.externalId || '—'}</span></div>
                        <div>iSports: <span className="text-cyan-300">{match.animationMatchId || '—'}</span></div>
                        <div>Events: {match.eventsCount}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        <div>Final: {match.latestTheStatsSnapshot ? match.latestTheStatsSnapshot.provider : '—'}</div>
                        <div>Latest: {match.latestSnapshot ? match.latestSnapshot.provider : '—'}</div>
                        <div>Shots: {match.latestSnapshot?.homeShots ?? '—'} - {match.latestSnapshot?.awayShots ?? '—'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <button onClick={() => autoFinal(match)} disabled={Boolean(running)} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">جلب نهائي تلقائي</button>
                          <div className="flex gap-2">
                            <input value={providerIds[match.id] ?? match.externalId ?? ''} onChange={(e) => setProviderIds((old) => ({ ...old, [match.id]: e.target.value }))} placeholder="mt_..." className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none" />
                            <button onClick={() => postAction('حفظ TheStats ID', { action: 'set-the-stats-id', matchId: match.id, providerMatchId: providerIds[match.id] ?? match.externalId })} disabled={Boolean(running)} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-50">حفظ</button>
                          </div>
                          <button onClick={() => manualFinal(match, 'full')} disabled={Boolean(running)} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">جلب يدوي كامل</button>
                          <button onClick={() => manualFinal(match, 'basic')} disabled={Boolean(running)} className="rounded-lg bg-violet-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">جلب يدوي خفيف</button>
                        </div>
                      </td>
                      <td className="rounded-l-2xl px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <input value={animationIds[match.id] ?? String(match.animationMatchId ?? '')} onChange={(e) => setAnimationIds((old) => ({ ...old, [match.id]: e.target.value }))} placeholder="iSports ID" className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none" />
                            <button onClick={() => postAction('حفظ iSports ID', { action: 'set-animation-id', matchId: match.id, animationMatchId: animationIds[match.id] ?? match.animationMatchId })} disabled={Boolean(running)} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">حفظ</button>
                          </div>
                          <button onClick={syncAnimationWindow} disabled={Boolean(running)} className="rounded-lg bg-cyan-900 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50">بحث وربط تلقائي</button>
                          <button onClick={liveIngestNow} disabled={Boolean(running) || !match.animationMatchId} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">بدء الجلب المباشر</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">نتيجة آخر عملية</h2>
              {running ? <span className="rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-slate-950">يعمل الآن</span> : null}
            </div>
            <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-3 text-xs leading-6 text-slate-200">{log}</pre>
          </aside>
        </section>
      </div>
    </main>
  );
}
