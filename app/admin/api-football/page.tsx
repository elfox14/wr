'use client';

import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, CalendarDays, CheckCircle2, Database, RefreshCw, Search, ShieldAlert, Zap } from 'lucide-react';

type Fixture = {
  fixtureId: number;
  date: string;
  status: string;
  statusLong?: string;
  league?: string;
  country?: string;
  season?: number;
  round?: string;
  homeTeam: { id?: number; name?: string; logo?: string };
  awayTeam: { id?: number; name?: string; logo?: string };
  goals?: { home?: number; away?: number };
  alreadySynced?: boolean;
};

type Usage = {
  dailyBudget: number;
  dailyReserve: number;
  safeLimit: number;
  usedToday: number;
  remainingSafe: number;
  updatedPlayers: number;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status?: string) {
  if (!status) return '—';
  if (['FT', 'AET', 'PEN'].includes(status)) return 'انتهت';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(status)) return 'مباشرة';
  if (['NS', 'TBD'].includes(status)) return 'قادمة';
  return status;
}

export default function ApiFootballAdminPage() {
  const [date, setDate] = useState(todayIsoDate());
  const [league, setLeague] = useState('');
  const [season, setSeason] = useState('');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [syncingFixture, setSyncingFixture] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [syncResults, setSyncResults] = useState<Record<number, any>>({});

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/admin/api-football-usage');
      const data = await res.json();
      if (res.ok) setUsage(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFixtures = async () => {
    setLoadingFixtures(true);
    setError('');
    setMessage('');
    try {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (league) params.set('league', league);
      if (season) params.set('season', season);

      const res = await fetch(`/api/admin/api-football-fixtures?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || 'فشل جلب المباريات');
        return;
      }

      setFixtures(data.fixtures || []);
      setMessage(`تم جلب ${data.fixtures?.length || 0} مباراة. استهلاك خارجي تقديري: طلب واحد.`);
      await fetchUsage();
    } catch (e: any) {
      setError(e.message || 'فشل جلب المباريات');
    } finally {
      setLoadingFixtures(false);
    }
  };

  const syncPerformance = async (fixtureId: number, dryRun = false, force = false) => {
    setSyncingFixture(fixtureId);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/sync-player-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, limit: 80, dryRun, force }),
      });
      const data = await res.json();

      setSyncResults((prev) => ({ ...prev, [fixtureId]: data }));

      if (!res.ok) {
        setError(data.message || data.error || 'فشل مزامنة الأداء');
        return;
      }

      if (data.skipped) {
        setMessage(`تم تخطي المباراة ${fixtureId}: تمت مزامنتها سابقًا ولا يوجد استهلاك جديد.`);
      } else {
        setMessage(`${dryRun ? 'Dry Run' : 'Sync'} للمباراة ${fixtureId}: matched=${data.matched || 0}, updated=${data.updated || 0}, notMatched=${data.notMatched || 0}`);
      }

      if (!dryRun) {
        setFixtures((prev) => prev.map((fixture) => fixture.fixtureId === fixtureId ? { ...fixture, alreadySynced: true } : fixture));
      }
      await fetchUsage();
    } catch (e: any) {
      setError(e.message || 'فشل مزامنة الأداء');
    } finally {
      setSyncingFixture(null);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary">
                <Database size={16} /> API-FOOTBALL SYNC CENTER
              </div>
              <h1 className="text-2xl font-black text-white md:text-3xl">مركز مزامنة API-Football</h1>
              <p className="mt-1 max-w-3xl text-sm text-gray-400">
                اجلب مباريات يوم محدد، اختر Fixture ID، ثم نفّذ Dry Run أو مزامنة أداء اللاعبين. الصفحات العامة تقرأ من قاعدة البيانات فقط.
              </p>
            </div>
            <button onClick={fetchUsage} className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">
              تحديث الاستهلاك <RefreshCw size={16} />
            </button>
          </div>

          {usage && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/5 bg-black/25 p-4"><div className="text-xs text-gray-500">الحد اليومي</div><div className="text-2xl font-black text-white">{usage.dailyBudget}</div></div>
              <div className="rounded-2xl border border-white/5 bg-black/25 p-4"><div className="text-xs text-gray-500">الحد الآمن</div><div className="text-2xl font-black text-primary">{usage.safeLimit}</div></div>
              <div className="rounded-2xl border border-white/5 bg-black/25 p-4"><div className="text-xs text-gray-500">مستخدم اليوم</div><div className="text-2xl font-black text-yellow-300">{usage.usedToday}</div></div>
              <div className="rounded-2xl border border-white/5 bg-black/25 p-4"><div className="text-xs text-gray-500">المتبقي الآمن</div><div className="text-2xl font-black text-success">{usage.remainingSafe}</div></div>
              <div className="rounded-2xl border border-white/5 bg-black/25 p-4"><div className="text-xs text-gray-500">لاعبون محدثون</div><div className="text-2xl font-black text-accent">{usage.updatedPlayers}</div></div>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Search size={20} className="text-primary" /> جلب مباريات من API-Football</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">التاريخ</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">League ID اختياري</span>
              <input value={league} onChange={(e) => setLeague(e.target.value)} placeholder="مثال: 1" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">Season اختياري</span>
              <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="مثال: 2026" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" />
            </label>
            <button onClick={fetchFixtures} disabled={loadingFixtures} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-black hover:bg-primary/90 disabled:opacity-50">
              {loadingFixtures ? 'جاري الجلب...' : 'جلب المباريات'} <CalendarDays size={18} />
            </button>
          </div>
        </section>

        {message && <div className="mb-4 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold text-success"><CheckCircle2 className="ml-2 inline" size={16} />{message}</div>}
        {error && <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger"><ShieldAlert className="ml-2 inline" size={16} />{error}</div>}

        <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">المباريات</h2>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">{fixtures.length} مباراة</span>
          </div>

          {fixtures.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-background/40 p-10 text-center text-gray-400">
              <AlertCircle className="mx-auto mb-3 text-gray-500" size={36} />
              اختر التاريخ واضغط جلب المباريات.
            </div>
          ) : (
            <div className="space-y-4">
              {fixtures.map((fixture) => {
                const result = syncResults[fixture.fixtureId];
                return (
                  <div key={fixture.fixtureId} className="rounded-3xl border border-white/5 bg-background/40 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-black text-primary">Fixture #{fixture.fixtureId}</span>
                          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">{statusLabel(fixture.status)}</span>
                          {fixture.alreadySynced && <span className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-xs font-bold text-success">تمت المزامنة</span>}
                        </div>
                        <div className="mb-2 text-xs text-gray-500">{fixture.league} · {fixture.round} · {formatDate(fixture.date)}</div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          <div className="flex items-center gap-3">
                            {fixture.homeTeam.logo && <img src={fixture.homeTeam.logo} alt="" className="h-10 w-10 rounded-xl object-contain" />}
                            <span className="font-black text-white">{fixture.homeTeam.name}</span>
                          </div>
                          <div className="rounded-xl bg-white/5 px-3 py-2 text-sm font-black text-gray-400">
                            {fixture.goals?.home != null ? `${fixture.goals.home} - ${fixture.goals.away}` : 'VS'}
                          </div>
                          <div className="flex items-center justify-end gap-3 text-left">
                            <span className="font-black text-white">{fixture.awayTeam.name}</span>
                            {fixture.awayTeam.logo && <img src={fixture.awayTeam.logo} alt="" className="h-10 w-10 rounded-xl object-contain" />}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button onClick={() => syncPerformance(fixture.fixtureId, true)} disabled={syncingFixture === fixture.fixtureId} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:border-primary/30 disabled:opacity-50">
                          Dry Run
                        </button>
                        <button onClick={() => syncPerformance(fixture.fixtureId, false)} disabled={syncingFixture === fixture.fixtureId || fixture.alreadySynced} className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-black text-primary hover:bg-primary hover:text-black disabled:opacity-50">
                          Sync Performance
                        </button>
                        <button onClick={() => syncPerformance(fixture.fixtureId, false, true)} disabled={syncingFixture === fixture.fixtureId} className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-black text-danger hover:bg-danger hover:text-white disabled:opacity-50">
                          Force
                        </button>
                      </div>
                    </div>

                    {result && (
                      <pre className="mt-4 max-h-56 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-gray-300">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
