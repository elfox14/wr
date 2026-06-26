'use client';

import { useMemo, useState } from 'react';

type SnapshotCounts = {
  stats: number;
  events: number;
  shots: number;
  players: number;
  playerRatings: number;
  lineups: number;
};

type Snapshot = {
  provider: string;
  providerMatchId: number | null;
  capturedAt: string;
  homePossession?: number | null;
  awayPossession?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeShotsOnTarget?: number | null;
  awayShotsOnTarget?: number | null;
  counts?: SnapshotCounts;
};

type ArticleInfo = {
  slug: string;
  status: string;
  heroImageUrl: string | null;
  infographicImageUrl: string | null;
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
  article: ArticleInfo | null;
};

type Props = {
  adminKey: string;
  matches: MatchRow[];
};

type Filter = 'next' | 'live' | 'finished' | 'needsFinal' | 'needsLiveSync' | 'content';

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

function isFinished(status: string) {
  return ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'].includes(status.toUpperCase());
}

function isLive(status: string) {
  return ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'PAUSED'].includes(status.toUpperCase());
}

function isUpcoming(match: MatchRow) {
  return !isFinished(match.status) && !isLive(match.status) && new Date(match.matchDate).getTime() >= Date.now() - 3 * 60 * 60 * 1000;
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'cyan' | 'amber' | 'violet' }) {
  const styles = {
    slate: 'bg-slate-800 text-slate-200 ring-slate-700',
    green: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
    red: 'bg-red-500/15 text-red-200 ring-red-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-200 ring-cyan-500/30',
    amber: 'bg-amber-400/15 text-amber-100 ring-amber-400/30',
    violet: 'bg-violet-500/15 text-violet-100 ring-violet-500/30',
  }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${styles}`}>{children}</span>;
}

function StatPill({ label, value, ok }: { label: string; value: string | number; ok?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-black ${ok ? 'text-emerald-300' : 'text-white'}`}>{value}</div>
    </div>
  );
}

export default function AdminMatchToolsClient({ adminKey, matches }: Props) {
  const [log, setLog] = useState('جاهز.');
  const [running, setRunning] = useState<string | null>(null);
  const [providerIds, setProviderIds] = useState<Record<string, string>>({});
  const [animationIds, setAnimationIds] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('next');

  const filtered = useMemo(() => {
    return matches.filter((match) => {
      if (filter === 'next') return isUpcoming(match);
      if (filter === 'live') return isLive(match.status);
      if (filter === 'finished') return isFinished(match.status);
      if (filter === 'needsFinal') return isFinished(match.status) && !match.latestTheStatsSnapshot;
      if (filter === 'needsLiveSync') return isUpcoming(match) && !match.animationMatchId;
      if (filter === 'content') return isFinished(match.status) && Boolean(match.latestTheStatsSnapshot) && !match.article;
      return true;
    });
  }, [filter, matches]);

  const counters = useMemo(() => {
    return {
      next: matches.filter(isUpcoming).length,
      live: matches.filter((m) => isLive(m.status)).length,
      finished: matches.filter((m) => isFinished(m.status)).length,
      needsFinal: matches.filter((m) => isFinished(m.status) && !m.latestTheStatsSnapshot).length,
      needsLiveSync: matches.filter((m) => isUpcoming(m) && !m.animationMatchId).length,
      content: matches.filter((m) => isFinished(m.status) && Boolean(m.latestTheStatsSnapshot) && !m.article).length,
    };
  }, [matches]);

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

  async function postAction(label: string, url: string, body: Record<string, unknown>) {
    setRunning(label);
    setLog(`تشغيل: ${label}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      setLog(`${label}\nHTTP ${res.status}\n${shortJson(data)}`);
      if ((data as any)?.articleUrl) {
        setLog((old) => `${old}\n\nرابط المقال: ${(data as any).articleUrl}`);
      }
    } catch (error: any) {
      setLog(`${label}\nERROR: ${error?.message || String(error)}`);
    } finally {
      setRunning(null);
    }
  }

  function autoFinal(match: MatchRow) {
    const url = `/api/cron/the-stats-finalize-matches?key=${enc(adminKey)}&matchId=${enc(match.id)}&apply=true&limit=1&days=60&requestsPerMinute=110&timeoutMs=20000&includeRaw=false&writeMatchEvents=false&purgeISportsSnapshots=false&dryRun=false`;
    return callUrl(`جلب الإحصائيات النهائية — ${match.homeTeam} vs ${match.awayTeam}`, url);
  }

  function manualFinal(match: MatchRow) {
    const providerMatchId = providerIds[match.id] || match.externalId || '';
    if (!providerMatchId.trim()) {
      setLog('ضع TheStats ID أولًا مثل mt_894046563، ثم اضغط حفظ، وبعدها اضغط أحداث + تقييمات بلا تكرار.');
      return;
    }
    const url = `/api/cron/manual-final-import?key=${enc(adminKey)}&matchId=${enc(match.id)}&providerMatchId=${enc(providerMatchId)}&scope=full&dryRun=false&includeRaw=false&syncAnimation=true&timeoutMs=25000&delayMs=1000`;
    return callUrl(`أحداث نهائية + تقييمات بلا تكرار — ${match.homeTeam} vs ${match.awayTeam}`, url);
  }

  function syncLive(match?: MatchRow) {
    const url = `/api/cron/sync-animation-matches?key=${enc(adminKey)}&limit=80&lookbackHours=12&lookaheadHours=120&threshold=65&dryRun=false&includeAlreadyLinked=false`;
    return callUrl(match ? `مزامنة البث المباشر — ${match.homeTeam} vs ${match.awayTeam}` : 'مزامنة البث المباشر للمباريات القريبة', url);
  }

  function liveIngestNow() {
    const url = `/api/cron/live-ingest?key=${enc(adminKey)}&finishedHours=0&limit=4&maxExternalRequests=4&maxBrowserlessRequests=2&lookaheadMinutes=45&lookbackHours=3&minIntervalSeconds=60`;
    return callUrl('تشغيل الجلب المباشر الآن', url);
  }

  function footballDataResults() {
    const url = `/api/cron/football-data-results-sync?key=${enc(adminKey)}&quick=true`;
    return callUrl('تحديث النتائج والحالات', url);
  }

  function generateContent(match: MatchRow) {
    return postAction(
      `إنشاء مقال + إنفوغرافيك — ${match.homeTeam} vs ${match.awayTeam}`,
      `/api/admin/match-content?key=${enc(adminKey)}`,
      { matchId: match.id, autoPublish: false },
    );
  }

  function saveProviderId(match: MatchRow) {
    return postAction('حفظ TheStats ID', `/api/admin/matches-tools?key=${enc(adminKey)}`, {
      action: 'set-the-stats-id',
      matchId: match.id,
      providerMatchId: providerIds[match.id] ?? match.externalId,
    });
  }

  function saveAnimationId(match: MatchRow) {
    return postAction('حفظ iSports ID', `/api/admin/matches-tools?key=${enc(adminKey)}`, {
      action: 'set-animation-id',
      matchId: match.id,
      animationMatchId: animationIds[match.id] ?? match.animationMatchId,
    });
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl">
          <p className="text-sm font-bold text-emerald-300">لوحة إدارة المباريات</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">تشغيل البث المباشر والمحتوى النهائي</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            الصفحة مبسطة: المباريات القادمة لمزامنة البث، المباريات المباشرة للجلب الحي، والمباريات المنتهية لجلب الإحصائيات والأحداث وتقييمات اللاعبين ثم إنشاء المقال والإنفوغرافيك.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button onClick={() => syncLive()} disabled={Boolean(running)} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">مزامنة البث للمباريات القريبة</button>
            <button onClick={liveIngestNow} disabled={Boolean(running)} className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">تشغيل الجلب المباشر</button>
            <button onClick={footballDataResults} disabled={Boolean(running)} className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">تحديث النتائج والحالات</button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ['next', 'القادمة', counters.next],
            ['live', 'المباشرة', counters.live],
            ['finished', 'المنتهية', counters.finished],
            ['needsLiveSync', 'تحتاج بث', counters.needsLiveSync],
            ['needsFinal', 'تحتاج إحصائيات', counters.needsFinal],
            ['content', 'تحتاج مقال', counters.content],
          ].map(([value, label, count]) => (
            <button key={value} onClick={() => setFilter(value as Filter)} className={`rounded-3xl border p-4 text-right transition ${filter === value ? 'border-white bg-white text-slate-950' : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600'}`}>
              <div className="text-xs font-bold opacity-70">{label}</div>
              <div className="mt-2 text-3xl font-black">{count}</div>
            </button>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-300">لا توجد مباريات في هذا القسم.</div>
            ) : filtered.map((match) => {
              const finalCounts = match.latestTheStatsSnapshot?.counts;
              const hasFinalStats = Boolean(match.latestTheStatsSnapshot);
              const hasPlayerRatings = Boolean(finalCounts?.playerRatings);
              const hasFinalEvents = Boolean(finalCounts?.events);
              const isMatchUpcoming = isUpcoming(match);
              const isMatchFinished = isFinished(match.status);
              const isMatchLive = isLive(match.status);

              return (
                <article key={match.id} className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        {isMatchUpcoming ? <Badge tone="cyan">قادمة</Badge> : null}
                        {isMatchLive ? <Badge tone="green">مباشرة</Badge> : null}
                        {isMatchFinished ? <Badge tone="slate">منتهية</Badge> : null}
                        {hasFinalStats ? <Badge tone="green">إحصائيات نهائية</Badge> : <Badge tone="amber">بدون نهائي</Badge>}
                        {hasFinalEvents ? <Badge tone="green">أحداث {finalCounts?.events}</Badge> : <Badge tone="slate">أحداث نهائية غير مؤكدة</Badge>}
                        {hasPlayerRatings ? <Badge tone="violet">تقييمات لاعبين {finalCounts?.playerRatings}</Badge> : <Badge tone="slate">بدون تقييمات</Badge>}
                        {match.article ? <Badge tone="green">مقال جاهز</Badge> : null}
                      </div>

                      <h2 className="mt-3 text-xl font-black text-white">{match.homeTeam} × {match.awayTeam}</h2>
                      <p className="mt-1 text-sm text-slate-400">{localDate(match.matchDate)} · {match.groupPhase || match.stage} · النتيجة {match.score}</p>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <StatPill label="استحواذ" value={`${match.latestSnapshot?.homePossession ?? '—'} - ${match.latestSnapshot?.awayPossession ?? '—'}`} />
                        <StatPill label="تسديدات" value={`${match.latestSnapshot?.homeShots ?? '—'} - ${match.latestSnapshot?.awayShots ?? '—'}`} />
                        <StatPill label="على المرمى" value={`${match.latestSnapshot?.homeShotsOnTarget ?? '—'} - ${match.latestSnapshot?.awayShotsOnTarget ?? '—'}`} />
                        <StatPill label="إحصائيات" value={finalCounts?.stats ?? 0} ok={Boolean(finalCounts?.stats)} />
                        <StatPill label="أحداث" value={finalCounts?.events ?? 0} ok={Boolean(finalCounts?.events)} />
                        <StatPill label="لاعبين" value={finalCounts?.players ?? 0} ok={Boolean(finalCounts?.players)} />
                      </div>
                    </div>

                    <div className="w-full space-y-2 xl:w-72">
                      {isMatchUpcoming ? (
                        <button onClick={() => syncLive(match)} disabled={Boolean(running)} className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">مزامنة البث المباشر</button>
                      ) : null}

                      {isMatchLive ? (
                        <button onClick={liveIngestNow} disabled={Boolean(running)} className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">تشغيل الجلب الحي</button>
                      ) : null}

                      {isMatchFinished ? (
                        <>
                          <button onClick={() => autoFinal(match)} disabled={Boolean(running)} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">جلب الإحصائيات النهائية</button>
                          <button onClick={() => manualFinal(match)} disabled={Boolean(running)} className="w-full rounded-2xl bg-violet-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">أحداث + تقييمات بلا تكرار</button>
                          <button onClick={() => generateContent(match)} disabled={Boolean(running) || !hasFinalStats} className="w-full rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">إنشاء مقال + إنفوغرافيك</button>
                          {match.article?.slug ? (
                            <a href={`/articles/${match.article.slug}`} target="_blank" className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-bold text-slate-100">فتح المقال</a>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                    <summary className="cursor-pointer text-sm font-bold text-slate-300">خيارات متقدمة و IDs</summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs text-slate-400">TheStats ID</label>
                        <div className="mt-1 flex gap-2">
                          <input value={providerIds[match.id] ?? match.externalId ?? ''} onChange={(e) => setProviderIds((old) => ({ ...old, [match.id]: e.target.value }))} placeholder="mt_..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                          <button onClick={() => saveProviderId(match)} disabled={Boolean(running)} className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold disabled:opacity-50">حفظ</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">iSports ID</label>
                        <div className="mt-1 flex gap-2">
                          <input value={animationIds[match.id] ?? String(match.animationMatchId ?? '')} onChange={(e) => setAnimationIds((old) => ({ ...old, [match.id]: e.target.value }))} placeholder="animationMatchId" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
                          <button onClick={() => saveAnimationId(match)} disabled={Boolean(running)} className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold disabled:opacity-50">حفظ</button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] leading-5 text-slate-500">Match ID: {match.id}</div>
                  </details>
                </article>
              );
            })}
          </div>

          <aside className="h-max rounded-[2rem] border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-black">نتيجة آخر عملية</h2>
              {running ? <Badge tone="amber">يعمل الآن</Badge> : <Badge>جاهز</Badge>}
            </div>
            <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-3 text-xs leading-6 text-slate-200">{log}</pre>
          </aside>
        </section>
      </div>
    </main>
  );
}
