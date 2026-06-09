'use client';

import { useMemo, useState } from 'react';
import { Activity, CalendarDays, Database, Loader2, Play, RefreshCcw, ShieldCheck, TestTube2, ListChecks } from 'lucide-react';

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function JsonBox({ result }: { result: ResultState | null }) {
  if (!result) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-gray-400">
        اختر اختبارًا من اللوحة لعرض النتيجة هنا.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-black text-white">{result.title}</p>
          <p className="text-xs text-gray-400">
            {result.status ? `HTTP ${result.status}` : 'Local'} {typeof result.ok === 'boolean' ? result.ok ? '• OK' : '• Failed' : ''}
          </p>
        </div>
      </div>
      <pre className="max-h-[620px] overflow-auto p-4 text-xs leading-6 text-[#0FF0FC] direction-ltr text-left whitespace-pre-wrap">
        {JSON.stringify(result.error ? { error: result.error, data: result.data } : result.data, null, 2)}
      </pre>
    </div>
  );
}

function Card({ title, description, icon, children }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-[#0FF0FC]/10 p-3 text-[#0FF0FC] border border-[#0FF0FC]/20">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
      </div>
      {children}
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

  const apiBase = useMemo(() => '/api/admin/control', []);

  async function runAction(title: string, action: string, params: Record<string, string | boolean | number> = {}) {
    setLoadingAction(action);
    setResult({ title, data: { loading: true } });

    try {
      const search = new URLSearchParams({ action });
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
      });

      const response = await fetch(`${apiBase}?${search.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      setResult({ title, status: response.status, ok: response.ok, data });

      if (action === 'recent-matches' && data?.matches) {
        setRecentMatches(data.matches);
      }
    } catch (error: any) {
      setResult({ title, error: error.message || 'Request failed' });
    } finally {
      setLoadingAction(null);
    }
  }

  async function syncFixtureFromRow(match: RecentMatch) {
    setFixtureId(String(match.fixtureId));
    await runAction(`مزامنة مباراة ${match.homeTeam?.name || ''} × ${match.awayTeam?.name || ''}`, 'sync-performance', {
      fixtureId: String(match.fixtureId),
      force: true,
    });
    await runAction('آخر المباريات', 'recent-matches', { limit: 40 });
  }

  function Button({ action, title, children, params, variant = 'primary' }: {
    action: string;
    title: string;
    children: React.ReactNode;
    params?: Record<string, string | boolean | number>;
    variant?: 'primary' | 'gold' | 'danger';
  }) {
    const isLoading = loadingAction === action;
    const classes = variant === 'gold'
      ? 'bg-[#FFD700] text-black hover:bg-[#ffe45c]'
      : variant === 'danger'
        ? 'bg-red-500 text-white hover:bg-red-400'
        : 'bg-[#0FF0FC] text-black hover:bg-[#70f7ff]';

    return (
      <button
        onClick={() => runAction(title, action, params)}
        disabled={Boolean(loadingAction)}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
      >
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
        {children}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0FF0FC]/10 via-white/[0.03] to-[#FFD700]/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
                <ShieldCheck size={14} /> لوحة إدارة MC PRIME Exchange
              </p>
              <h1 className="text-3xl font-black md:text-5xl">إدارة واختبار كل APIs من المتصفح</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
                هذه الصفحة تشغّل اختبارات آمنة من السيرفر بدون إظهار مفاتيح API أو أسرار الأدمن داخل المتصفح.
              </p>
            </div>
            <button
              onClick={() => runAction('فحص عام للنظام', 'health')}
              disabled={Boolean(loadingAction)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black hover:bg-white/15 disabled:opacity-60"
            >
              {loadingAction === 'health' ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
              فحص سريع
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <Card
              title="فحص النظام والبيئة"
              description="يتأكد من وجود متغيرات البيئة وقاعدة البيانات وعدد الأصول والمباريات."
              icon={<Activity size={22} />}
            >
              <Button action="health" title="فحص عام للنظام">
                تشغيل Health Check
              </Button>
            </Card>

            <Card
              title="قبل المباراة"
              description="جلب مباريات اليوم من API-Football ثم iSports عند الحاجة."
              icon={<CalendarDays size={22} />}
            >
              <label className="mb-2 block text-xs font-bold text-gray-400">تاريخ الاختبار</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mb-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC]"
              />
              <Button action="fixtures" title="جلب مباريات اليوم" params={{ date }}>
                جلب Fixtures
              </Button>
            </Card>

            <Card
              title="قبل / أثناء / بعد المباراة"
              description="تشغيل دورة المزامنة الكاملة التي تعمل آليًا كل 5 دقائق على Vercel."
              icon={<Database size={22} />}
            >
              <label className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300">
                <span>Force update للمباريات المتزامنة سابقًا</span>
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              </label>
              <Button action="auto-sync" title="تشغيل المزامنة التلقائية" params={{ date, force }} variant="gold">
                تشغيل Auto Sync
              </Button>
            </Card>

            <Card
              title="آخر المباريات المحفوظة"
              description="اعرض المباريات التي تم جلبها واختر أي مباراة لمزامنة أدائها بضغطة واحدة."
              icon={<ListChecks size={22} />}
            >
              <Button action="recent-matches" title="آخر المباريات" params={{ limit: 40 }}>
                عرض آخر المباريات
              </Button>
            </Card>

            <Card
              title="اختبار مباراة محددة"
              description="ضع fixtureId لتحديث أداء اللاعبين والمنتخب لهذه المباراة مباشرة."
              icon={<TestTube2 size={22} />}
            >
              <input
                value={fixtureId}
                onChange={(e) => setFixtureId(e.target.value)}
                placeholder="مثال: 123456"
                className="mb-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC] direction-ltr text-left"
              />
              <Button
                action="sync-performance"
                title="مزامنة أداء مباراة محددة"
                params={{ fixtureId, force }}
                variant="danger"
              >
                مزامنة Fixture
              </Button>
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {recentMatches.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-black text-white">آخر المباريات</h3>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">{recentMatches.length}</span>
                </div>
                <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
                  {recentMatches.map((match) => (
                    <div key={match.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                        <span className="direction-ltr text-left">Fixture #{match.fixtureId}</span>
                        <span className={`rounded-full px-2 py-1 font-bold ${match.performanceRecords > 0 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-300'}`}>
                          {match.performanceRecords > 0 ? `${match.performanceRecords} أداء` : 'لا يوجد أداء'}
                        </span>
                      </div>
                      <div className="mb-2 text-sm font-bold text-white">
                        {match.homeTeam?.image} {match.homeTeam?.name} {match.homeScore} - {match.awayScore} {match.awayTeam?.name} {match.awayTeam?.image}
                      </div>
                      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                        <span>{match.status}</span>
                        <span>{new Date(match.matchDate).toLocaleString('ar-EG')}</span>
                      </div>
                      <button
                        onClick={() => syncFixtureFromRow(match)}
                        disabled={Boolean(loadingAction)}
                        className="w-full rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white hover:bg-red-400 disabled:opacity-60"
                      >
                        مزامنة أداء هذه المباراة
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <JsonBox result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}
