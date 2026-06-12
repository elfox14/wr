'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, KeyRound, Play, RefreshCw, Shield, XCircle } from 'lucide-react';

type HealthPayload = {
  ok: boolean;
  updatedAt: string;
  environment: { cronBaseUrl?: string | null; apiFootballCronEnabled: boolean; apiFootballProtection: boolean; providerMode: string };
  counters: Record<string, number>;
  latest: { marketNews: any; priceHistory: any };
  todayWindowMatches: any[];
  unlinkedImportant: any[];
  blockers: string[];
  recommendations: string[];
};

type ActionState = { label: string; loading: boolean; result: string | null };

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function CounterCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-[#00FF88]' : tone === 'warn' ? 'text-[#FFD700]' : tone === 'bad' ? 'text-red-300' : 'text-white';
  return <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">{label}</div><div className={`mt-2 text-2xl font-black ${color}`}>{value}</div></div>;
}

export default function LiveHealthPage() {
  const [secret, setSecret] = useState('');
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionState>({ label: '', loading: false, result: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key') || localStorage.getItem('liveHealthKey') || '';
    if (key) {
      setSecret(key);
      void load(key);
    }
  }, []);

  async function load(keyValue = secret) {
    if (!keyValue) {
      setError('ضع ADMIN_API_SECRET أو CRON_SECRET لعرض لوحة الصحة.');
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem('liveHealthKey', keyValue);
      const res = await fetch(`/api/admin/live-health?key=${encodeURIComponent(keyValue)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load health');
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'خطأ في تحميل لوحة الصحة');
    } finally {
      setLoading(false);
    }
  }

  async function runMasterSync(label: string, params: Record<string, string> = {}) {
    if (!secret) {
      setError('ضع السر أولاً قبل تشغيل المزامنة.');
      return;
    }
    setAction({ label, loading: true, result: null });
    try {
      const url = new URL('/api/cron/master-sync', window.location.origin);
      url.searchParams.set('cronSecret', secret);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok && res.status !== 207) throw new Error(json?.error || `HTTP ${res.status}`);
      const summary = json?.ok ? 'تم التشغيل بنجاح' : 'تم التشغيل مع ملاحظات';
      const ran = [json?.animationSyncRan ? 'Animation' : null, json?.liveMarketSyncRan ? 'Live' : null, json?.footballAutoSyncRan ? 'FootballAuto' : null].filter(Boolean).join(' + ') || 'كل الخطوات skipped';
      setAction({ label, loading: false, result: `${summary}: ${ran}` });
      await load(secret);
    } catch (err: any) {
      setAction({ label, loading: false, result: err?.message || 'فشل تشغيل المزامنة' });
    }
  }

  useEffect(() => {
    if (!secret) return;
    const timer = setInterval(() => load(secret), 30_000);
    return () => clearInterval(timer);
  }, [secret]);

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/8 bg-gradient-to-br from-[#111] to-black p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]"><Shield size={15} /> Live Health</div>
              <h1 className="text-3xl font-black sm:text-4xl">لوحة صحة اللايف</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">مراقبة الربط، الأخبار، تحركات الأسعار، والـ cron بدون فتح JSON يدويًا.</p>
            </div>
            <button onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC] disabled:opacity-50"><RefreshCw size={16} /> تحديث</button>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/5 bg-[#111] p-4">
          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><KeyRound size={14} /> ADMIN_API_SECRET أو CRON_SECRET</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="ضع السر هنا" />
            <button onClick={() => load()} className="rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black">دخول</button>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/5 bg-[#111] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-white"><Play size={16} className="text-[#00FF88]" /> تشغيل يدوي سريع</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button disabled={action.loading} onClick={() => runMasterSync('Master Sync')} className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC] disabled:opacity-50">تشغيل Master Sync</button>
            <button disabled={action.loading} onClick={() => runMasterSync('Force Animation', { forceAnimation: 'true' })} className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] disabled:opacity-50">ربط Animation الآن</button>
            <button disabled={action.loading} onClick={() => runMasterSync('Force Live', { forceLive: 'true' })} className="rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 px-4 py-3 text-sm font-black text-[#00FF88] disabled:opacity-50">تحديث Live الآن</button>
          </div>
          {action.loading && <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm text-gray-400">جاري تنفيذ: {action.label}...</div>}
          {action.result && <div className="mt-3 rounded-2xl border border-white/5 bg-black/30 p-3 text-sm text-gray-300">{action.label}: {action.result}</div>}
        </section>

        {error && <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"><XCircle size={16} /> {error}</div>}
        {loading && <div className="mb-6 rounded-2xl border border-white/5 bg-[#111] p-4 text-center text-gray-500">جاري التحميل...</div>}

        {data && (
          <>
            <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              <CounterCard label="كل المباريات" value={data.counters.totalMatches || 0} />
              <CounterCard label="مرتبطة" value={data.counters.linkedMatches || 0} tone="good" />
              <CounterCard label="غير مرتبطة" value={data.counters.unlinkedMatches || 0} tone={(data.counters.unlinkedMatches || 0) ? 'warn' : 'good'} />
              <CounterCard label="مباشر" value={data.counters.liveMatches || 0} tone={(data.counters.liveMatches || 0) ? 'bad' : 'default'} />
              <CounterCard label="قريبة" value={data.counters.nearMatches || 0} tone="warn" />
              <CounterCard label="غير مرتبطة قريبة" value={data.counters.unlinkedNearMatches || 0} tone={(data.counters.unlinkedNearMatches || 0) ? 'bad' : 'good'} />
              <CounterCard label="أخبار آخر ساعة" value={data.counters.marketNewsLastHour || 0} />
              <CounterCard label="أخبار 24 ساعة" value={data.counters.marketNewsLast24h || 0} />
              <CounterCard label="أسعار آخر ساعة" value={data.counters.priceHistoryLastHour || 0} />
              <CounterCard label="أسعار 24 ساعة" value={data.counters.priceHistoryLast24h || 0} />
            </section>

            <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/5 bg-[#111] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><CheckCircle2 className="text-[#00FF88]" /> حالة البيئة</h2>
                <div className="space-y-3 text-sm text-gray-300">
                  <div>Base URL: <span className="font-mono text-white">{data.environment.cronBaseUrl || 'غير مضبوط'}</span></div>
                  <div>Provider: <span className="text-[#0FF0FC]">{data.environment.providerMode}</span></div>
                  <div>API-Football Cron: <span className={data.environment.apiFootballCronEnabled ? 'text-red-300' : 'text-[#00FF88]'}>{data.environment.apiFootballCronEnabled ? 'مفعل' : 'محمي/متوقف'}</span></div>
                  <div>آخر تحديث: {formatDate(data.updatedAt)}</div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/5 bg-[#111] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><AlertTriangle className="text-[#FFD700]" /> التنبيهات</h2>
                <div className="space-y-3">
                  {data.blockers.length ? data.blockers.map((item, idx) => <div key={idx} className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-3 text-sm text-[#FFD700]">{item}</div>) : <div className="rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-3 text-sm text-[#00FF88]">لا توجد Blockers حاليًا.</div>}
                </div>
              </div>
            </section>

            <section className="mb-8 rounded-3xl border border-white/5 bg-[#111] p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Clock className="text-[#0FF0FC]" /> مباريات نافذة اليوم والقريبة</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-xs text-gray-500"><tr><th className="p-3 text-right">المباراة</th><th className="p-3">الحالة</th><th className="p-3">النتيجة</th><th className="p-3">iSports</th><th className="p-3">الوقت</th></tr></thead>
                  <tbody>
                    {data.todayWindowMatches.map((match) => <tr key={match.id} className="border-t border-white/5"><td className="p-3 font-bold">{match.homeTeam} × {match.awayTeam}</td><td className="p-3 text-center">{match.status}</td><td className="p-3 text-center font-mono">{match.score}</td><td className="p-3 text-center font-mono">{match.animationMatchId || '—'}</td><td className="p-3 text-center text-gray-500">{formatDate(match.matchDate)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>

            {data.unlinkedImportant.length > 0 && <section className="rounded-3xl border border-red-500/10 bg-red-500/5 p-5"><h2 className="mb-4 text-xl font-black text-red-200">مباريات قريبة غير مرتبطة</h2><div className="space-y-2">{data.unlinkedImportant.map((match) => <div key={match.id} className="rounded-2xl bg-black/30 p-3 text-sm">{match.homeTeam} × {match.awayTeam} — {formatDate(match.matchDate)}</div>)}</div></section>}
          </>
        )}
      </div>
    </main>
  );
}
