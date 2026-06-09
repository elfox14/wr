'use client';

import { useState } from 'react';
import { Loader2, RefreshCcw, ShieldCheck, Trash2, Eye, Database } from 'lucide-react';

type ResultState = {
  title: string;
  status?: number;
  ok?: boolean;
  data?: any;
  error?: string;
};

function JsonBox({ result }: { result: ResultState | null }) {
  if (!result) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-gray-400">
        اختر معاينة أو بدء من الصفر لعرض النتيجة هنا.
      </div>
    );
  }

  const preview = result.data?.preview;
  const saved = result.data?.saved;
  const fetched = result.data?.fetched;
  const resetDeleted = result.data?.resetDeleted;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">{result.title}</h2>
            <p className="text-xs text-gray-400">{result.status ? `HTTP ${result.status}` : 'Local'} {typeof result.ok === 'boolean' ? result.ok ? '• OK' : '• Failed' : ''}</p>
          </div>
        </div>

        {fetched && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Object.entries(fetched).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
                <p className="text-xs text-gray-400">{key}</p>
                <p className="mt-1 text-2xl font-black text-[#0FF0FC]">{String(value)}</p>
              </div>
            ))}
          </div>
        )}

        {saved && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {Object.entries(saved).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-center">
                <p className="text-xs text-gray-300">Saved {key}</p>
                <p className="mt-1 text-2xl font-black text-green-300">{String(value)}</p>
              </div>
            ))}
          </div>
        )}

        {resetDeleted && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="mb-2 font-black text-red-300">تم حذف بيانات قديمة قبل إعادة البناء</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {Object.entries(resetDeleted).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-black/20 p-3 text-center text-xs">
                  <p className="text-gray-400">{key}</p>
                  <p className="font-black text-white">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview?.teams?.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-3 font-black text-white">معاينة المنتخبات</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {preview.teams.map((team: any) => (
              <div key={team.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                {team.logo ? <img src={team.logo} alt="" className="h-10 w-10 rounded-full object-contain" /> : <div className="h-10 w-10 rounded-full bg-white/10" />}
                <div>
                  <p className="font-bold text-white">{team.name}</p>
                  <p className="text-xs text-gray-400">ID {team.id} • {team.group || 'بدون مجموعة'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview?.fixtures?.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-3 font-black text-white">معاينة المباريات</h3>
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="text-xs text-gray-400">
                <tr className="border-b border-white/10">
                  <th className="py-3">Fixture</th><th className="py-3">المباراة</th><th className="py-3">الدور</th><th className="py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {preview.fixtures.map((fixture: any) => (
                  <tr key={fixture.fixtureId} className="border-b border-white/5 text-gray-200">
                    <td className="py-3 direction-ltr text-left font-mono text-xs">{fixture.fixtureId}</td>
                    <td className="py-3 font-bold">{fixture.home} × {fixture.away}</td>
                    <td className="py-3 text-gray-400">{fixture.round || '—'}</td>
                    <td className="py-3 text-xs text-gray-400">{fixture.date ? new Date(fixture.date).toLocaleString('ar-EG') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="rounded-2xl border border-white/10 bg-black/50 overflow-hidden">
        <summary className="cursor-pointer border-b border-white/10 px-4 py-3 font-black text-white">عرض JSON الخام</summary>
        <pre className="max-h-[620px] overflow-auto p-4 text-xs leading-6 text-[#0FF0FC] direction-ltr text-left whitespace-pre-wrap">
          {JSON.stringify(result.error ? { error: result.error, data: result.data } : result.data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function WorldCupBootstrapDashboard() {
  const [leagueId, setLeagueId] = useState('1');
  const [season, setSeason] = useState('2026');
  const [maxTeams, setMaxTeams] = useState('64');
  const [includePlayers, setIncludePlayers] = useState(true);
  const [includeFixtures, setIncludeFixtures] = useState(true);
  const [includeGroups, setIncludeGroups] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  async function run(title: string, params: Record<string, string | boolean>) {
    setLoading(title);
    setResult({ title, data: { loading: true } });
    try {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
      search.set('leagueId', leagueId);
      search.set('season', season);
      search.set('maxTeams', maxTeams);
      search.set('includePlayers', String(includePlayers));
      search.set('includeFixtures', String(includeFixtures));
      search.set('includeGroups', String(includeGroups));

      const response = await fetch(`/api/admin/worldcup-bootstrap?${search.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      setResult({ title, status: response.status, ok: response.ok, data });
    } catch (error: any) {
      setResult({ title, error: error.message || 'Request failed' });
    } finally {
      setLoading(null);
    }
  }

  const isLoading = Boolean(loading);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-red-500/10 via-white/[0.03] to-[#0FF0FC]/10 p-6 md:p-8">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><ShieldCheck size={14} /> إعادة بناء بيانات كأس العالم</p>
          <h1 className="text-3xl font-black md:text-5xl">ابدأ بيانات البطولة من API-Football / iSports</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-300 md:text-base">هذه الصفحة تجلب المنتخبات، صور المنتخبات، اللاعبين، صور اللاعبين، المباريات، والمجموعات من المزود. استخدم المعاينة أولًا، ثم ابدأ من الصفر عند التأكد.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-4 text-lg font-black">إعدادات الجلب</h2>
              <label className="mb-2 block text-xs font-bold text-gray-400">World Cup League ID</label>
              <input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} className="mb-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC] direction-ltr text-left" />
              <label className="mb-2 block text-xs font-bold text-gray-400">Season</label>
              <input value={season} onChange={(e) => setSeason(e.target.value)} className="mb-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC] direction-ltr text-left" />
              <label className="mb-2 block text-xs font-bold text-gray-400">Max Teams</label>
              <input value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} className="mb-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#0FF0FC] direction-ltr text-left" />
              <div className="space-y-2 text-sm text-gray-300">
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span>جلب اللاعبين وصورهم</span><input type="checkbox" checked={includePlayers} onChange={(e) => setIncludePlayers(e.target.checked)} /></label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span>جلب المباريات</span><input type="checkbox" checked={includeFixtures} onChange={(e) => setIncludeFixtures(e.target.checked)} /></label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span>جلب المجموعات</span><input type="checkbox" checked={includeGroups} onChange={(e) => setIncludeGroups(e.target.checked)} /></label>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <button disabled={isLoading} onClick={() => run('معاينة بيانات البطولة', { dryRun: true, reset: false })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-4 py-3 text-sm font-black text-black hover:bg-[#70f7ff] disabled:opacity-60">
                {loading === 'معاينة بيانات البطولة' ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />} معاينة قبل الحفظ
              </button>
              <button disabled={isLoading} onClick={() => run('إضافة/تحديث بدون حذف', { dryRun: false, reset: false })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-4 py-3 text-sm font-black text-black hover:bg-[#ffe45c] disabled:opacity-60">
                {loading === 'إضافة/تحديث بدون حذف' ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />} إضافة/تحديث بدون حذف
              </button>
              <button disabled={isLoading} onClick={() => run('بدء من الصفر وحذف القديم', { dryRun: false, reset: true })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60">
                {loading === 'بدء من الصفر وحذف القديم' ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />} بدء من الصفر
              </button>
              <button disabled={isLoading} onClick={() => run('معاينة بعد الإعدادات', { dryRun: true, reset: false })} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15 disabled:opacity-60">
                <RefreshCcw size={18} /> تحديث المعاينة
              </button>
            </div>

            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm leading-7 text-red-100">
              زر “بدء من الصفر” يحذف الأصول والمباريات والمحافظ والتداولات المرتبطة بها. استخدمه فقط لو تريد إعادة بناء البطولة بالكامل.
            </div>
          </div>

          <JsonBox result={result} />
        </div>
      </div>
    </div>
  );
}
