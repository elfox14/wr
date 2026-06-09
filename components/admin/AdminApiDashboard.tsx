'use client';

import { useMemo, useState } from 'react';
import { Activity, Database, Eye, Loader2, Play, RefreshCcw, ShieldCheck, TestTube2, ListChecks, Radio } from 'lucide-react';

type ResultState = {
  title: string;
  status?: number;
  ok?: boolean;
  data?: any;
  error?: string;
};

type RecentMatch = {
  id: string;
  fixtureId: number;
  matchDate: string;
  status: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string; image?: string | null };
  awayTeam: { id: string; name: string; image?: string | null };
  performanceRecords: number;
};

type ProviderFixture = {
  fixtureId: number;
  date: string;
  status: string;
  statusLong?: string;
  league?: string;
  country?: string;
  round?: string;
  homeTeam: { id?: number; name?: string; logo?: string; winner?: boolean };
  awayTeam: { id?: number; name?: string; logo?: string; winner?: boolean };
  goals?: { home?: number; away?: number };
};

type ProviderPlayer = {
  providerPlayerId?: number;
  name?: string;
  teamName?: string;
  position?: string;
  minutes?: number;
  rating?: number | string;
  goals?: number;
  assists?: number;
  saves?: number;
  goalsConceded?: number;
  yellowCards?: number;
  redCards?: number;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function JsonBox({ result }: { result: ResultState | null }) {
  if (!result) {
    return <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-gray-400">اختر اختبارًا من اللوحة لعرض النتيجة هنا.</div>;
  }

  return (
    <details className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
      <summary className="cursor-pointer border-b border-white/10 px-4 py-3 font-black text-white">عرض البيانات الخام JSON — {result.title}</summary>
      <pre className="max-h-[620px] overflow-auto p-4 text-xs leading-6 text-[#0FF0FC] direction-ltr text-left whitespace-pre-wrap">
        {JSON.stringify(result.error ? { error: result.error, data: result.data } : result.data, null, 2)}
      </pre>
    </details>
  );
}

function Card({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-[#0FF0FC]/10 p-3 text-[#0FF0FC] border border-[#0FF0FC]/20">{icon}</div>
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FixturesTable({ title, fixtures, onPick }: { title: string; fixtures: ProviderFixture[]; onPick: (id: number) => void }) {
  if (!fixtures.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-white">{title}</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">{fixtures.length} مباراة</span>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="text-xs text-gray-400">
            <tr className="border-b border-white/10">
              <th className="py-3">Fixture</th>
              <th className="py-3">المباراة</th>
              <th className="py-3">النتيجة</th>
              <th className="py-3">الحالة</th>
              <th className="py-3">البطولة</th>
              <th className="py-3">التاريخ</th>
              <th className="py-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((fixture) => (
              <tr key={`${fixture.fixtureId}-${fixture.date}`} className="border-b border-white/5 text-gray-200">
                <td className="py-3 direction-ltr text-left font-mono text-xs">{fixture.fixtureId}</td>
                <td className="py-3 font-bold">{fixture.homeTeam?.name || '—'} × {fixture.awayTeam?.name || '—'}</td>
                <td className="py-3 font-black text-[#FFD700]">{fixture.goals?.home ?? 0} - {fixture.goals?.away ?? 0}</td>
                <td className="py-3"><span className="rounded-full bg-[#0FF0FC]/10 px-2 py-1 text-xs font-bold text-[#0FF0FC]">{fixture.status || '—'}</span></td>
                <td className="py-3 text-gray-400">{fixture.league || '—'}</td>
                <td className="py-3 text-xs text-gray-400">{fixture.date ? new Date(fixture.date).toLocaleString('ar-EG') : '—'}</td>
                <td className="py-3"><button onClick={() => onPick(fixture.fixtureId)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white hover:bg-red-400">جلب أداء اللاعبين</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayersTable({ players }: { players: ProviderPlayer[] }) {
  if (!players.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-white">إحصائيات اللاعبين المسحوبة من API</h3>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">{players.length} لاعب</span>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[900px] text-right text-sm">
          <thead className="text-xs text-gray-400">
            <tr className="border-b border-white/10">
              <th className="py-3">ID</th><th className="py-3">اللاعب</th><th className="py-3">المنتخب</th><th className="py-3">المركز</th><th className="py-3">دقائق</th><th className="py-3">تقييم</th><th className="py-3">أهداف</th><th className="py-3">أسيست</th><th className="py-3">كروت</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <tr key={`${player.providerPlayerId}-${index}`} className="border-b border-white/5 text-gray-200">
                <td className="py-3 direction-ltr text-left font-mono text-xs">{player.providerPlayerId || '—'}</td>
                <td className="py-3 font-bold text-white">{player.name || '—'}</td>
                <td className="py-3 text-gray-300">{player.teamName || '—'}</td>
                <td className="py-3 text-gray-400">{player.position || '—'}</td>
                <td className="py-3">{player.minutes ?? 0}</td>
                <td className="py-3 text-[#0FF0FC] font-black">{player.rating || '—'}</td>
                <td className="py-3">{player.goals ?? 0}</td>
                <td className="py-3">{player.assists ?? 0}</td>
                <td className="py-3 text-red-300">{player.yellowCards ?? 0} / {player.redCards ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminApiDashboard() {
  const [date, setDate] = useState(todayIso());
  const [fixtureId, setFixtureId] = useState('');
  const [force, setForce] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [providerFixtures, setProviderFixtures] = useState<ProviderFixture[]>([]);
  const [liveFixtures, setLiveFixtures] = useState<ProviderFixture[]>([]);
  const [providerPlayers, setProviderPlayers] = useState<ProviderPlayer[]>([]);

  const apiBase = useMemo(() => '/api/admin/control', []);

  async function runAction(title: string, action: string, params: Record<string, string | boolean | number> = {}) {
    setLoadingAction(action);
    setResult({ title, data: { loading: true } });
    try {
      const search = new URLSearchParams({ action });
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
      });
      const response = await fetch(`${apiBase}?${search.toString()}`, { method: 'GET', cache: 'no-store' });
      const data = await response.json().catch(() => null);
      setResult({ title, status: response.status, ok: response.ok, data });
      if (action === 'recent-matches' && data?.matches) setRecentMatches(data.matches);
      if (action === 'provider-fixtures' && data?.fixtures) setProviderFixtures(data.fixtures);
      if (action === 'provider-live' && data?.fixtures) setLiveFixtures(data.fixtures);
      if (action === 'provider-player-stats' && data?.players) setProviderPlayers(data.players);
    } catch (error: any) {
      setResult({ title, error: error.message || 'Request failed' });
    } finally {
      setLoadingAction(null);
    }
  }

  async function syncFixtureFromRow(match: RecentMatch) {
    setFixtureId(String(match.fixtureId));
    await runAction(`مزامنة مباراة ${match.homeTeam?.name || ''} × ${match.awayTeam?.name || ''}`, 'sync-performance', { fixtureId: String(match.fixtureId), force: true });
    await runAction('آخر المباريات', 'recent-matches', { limit: 40 });
  }

  async function fetchPlayerStatsForFixture(id: number | string) {
    setFixtureId(String(id));
    await runAction(`بيانات لاعبي Fixture ${id}`, 'provider-player-stats', { fixtureId: String(id) });
  }

  function Button({ action, title, children, params, variant = 'primary' }: { action: string; title: string; children: React.ReactNode; params?: Record<string, string | boolean | number>; variant?: 'primary' | 'gold' | 'danger' }) {
    const isLoading = loadingAction === action;
    const classes = variant === 'gold' ? 'bg-[#FFD700] text-black hover:bg-[#ffe45c]' : variant === 'danger' ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-[#0FF0FC] text-black hover:bg-[#70f7ff]';
    return <button onClick={() => runAction(title, action, params)} disabled={Boolean(loadingAction)} className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}>{isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}{children}</button>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0FF0FC]/10 via-white/[0.03] to-[#FFD700]/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><ShieldCheck size={14} /> لوحة إدارة MC PRIME Exchange</p><h1 className="text-3xl font-black md:text-5xl">إدارة واختبار كل APIs من المتصفح</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">اعرض بيانات API بشكل واضح، ثم شغّل المزامنة أو جلب الأداء بدون كشف المفاتيح في المتصفح.</p></div>
            <button onClick={() => runAction('فحص عام للنظام', 'health')} disabled={Boolean(loadingAction)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black hover:bg-white/15 disabled:opacity-60">{loadingAction === 'health' ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />} فحص سريع</button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <Card title="فحص النظام والبيئة" description="يتأكد من وجود متغيرات البيئة وقاعدة البيانات وعدد الأصول والمباريات." icon={<Activity size={22} />}><Button action="health" title="فحص عام للنظام">تشغيل Health Check</Button></Card>
            <Card title="بيانات API قبل المباراة" description="جلب مباريات تاريخ محدد وعرضها في جدول واضح." icon={<Eye size={22} />}><label className="mb-2 block text-xs font-bold text-gray-400">تاريخ الاختبار</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC]" /><Button action="provider-fixtures" title="عرض مباريات API" params={{ date }}>عرض مباريات API</Button></Card>
            <Card title="بيانات API أثناء المباراة" description="عرض المباريات الحية من المزود إن وجدت." icon={<Radio size={22} />}><Button action="provider-live" title="عرض المباريات الحية">عرض Live Scores</Button></Card>
            <Card title="حفظ ومزامنة المباريات" description="تشغيل دورة المزامنة الكاملة التي تعمل آليًا كل 5 دقائق على Vercel." icon={<Database size={22} />}><label className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300"><span>Force update للمباريات المتزامنة سابقًا</span><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /></label><Button action="auto-sync" title="تشغيل المزامنة التلقائية" params={{ date, force }} variant="gold">تشغيل Auto Sync</Button></Card>
            <Card title="آخر المباريات المحفوظة" description="اعرض المباريات المحفوظة في قاعدة البيانات مع حالة مزامنة الأداء." icon={<ListChecks size={22} />}><Button action="recent-matches" title="آخر المباريات" params={{ limit: 40 }}>عرض آخر المباريات</Button></Card>
            <Card title="بيانات لاعبي مباراة محددة" description="ضع fixtureId لعرض إحصائيات اللاعبين المسحوبة من API قبل حفظها." icon={<TestTube2 size={22} />}><input value={fixtureId} onChange={(e) => setFixtureId(e.target.value)} placeholder="مثال: 123456" className="mb-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC] direction-ltr text-left" /><div className="grid grid-cols-1 gap-2"><Button action="provider-player-stats" title="عرض أداء اللاعبين من API" params={{ fixtureId }}>عرض أداء اللاعبين</Button><Button action="sync-performance" title="مزامنة أداء مباراة محددة" params={{ fixtureId, force }} variant="danger">حفظ ومزامنة الأداء</Button></div></Card>
          </div>
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <FixturesTable title="المباريات المسحوبة من API" fixtures={providerFixtures} onPick={fetchPlayerStatsForFixture} />
            <FixturesTable title="المباريات الحية الآن" fixtures={liveFixtures} onPick={fetchPlayerStatsForFixture} />
            <PlayersTable players={providerPlayers} />
            {recentMatches.length > 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black text-white">آخر المباريات المحفوظة</h3><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">{recentMatches.length}</span></div><div className="max-h-[380px] space-y-2 overflow-auto pr-1">{recentMatches.map((match) => <div key={match.id} className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400"><span className="direction-ltr text-left">Fixture #{match.fixtureId}</span><span className={`rounded-full px-2 py-1 font-bold ${match.performanceRecords > 0 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-300'}`}>{match.performanceRecords > 0 ? `${match.performanceRecords} أداء` : 'لا يوجد أداء'}</span></div><div className="mb-2 text-sm font-bold text-white">{match.homeTeam?.image} {match.homeTeam?.name} {match.homeScore} - {match.awayScore} {match.awayTeam?.name} {match.awayTeam?.image}</div><div className="mb-3 flex items-center justify-between text-xs text-gray-500"><span>{match.status}</span><span>{new Date(match.matchDate).toLocaleString('ar-EG')}</span></div><div className="grid grid-cols-2 gap-2"><button onClick={() => fetchPlayerStatsForFixture(match.fixtureId)} disabled={Boolean(loadingAction)} className="rounded-xl bg-[#0FF0FC] px-3 py-2 text-xs font-black text-black hover:bg-[#70f7ff] disabled:opacity-60">عرض أداء API</button><button onClick={() => syncFixtureFromRow(match)} disabled={Boolean(loadingAction)} className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white hover:bg-red-400 disabled:opacity-60">حفظ ومزامنة</button></div></div>)}</div></div>}
            <JsonBox result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}
