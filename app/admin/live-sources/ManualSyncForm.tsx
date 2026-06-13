'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Play, Wrench } from 'lucide-react';

export default function ManualSyncForm({ defaultMatchId = '365760925' }: { defaultMatchId?: string }) {
  const [matchId, setMatchId] = useState(defaultMatchId);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const playerHref = useMemo(() => `/animation-live/player?matchId=${encodeURIComponent(matchId || defaultMatchId)}`, [matchId, defaultMatchId]);

  async function runSync() {
    const cleanMatchId = matchId.trim();
    const cleanSecret = secret.trim();
    if (!cleanMatchId) {
      setError('اكتب matchId أولًا.');
      return;
    }
    if (!cleanSecret) {
      setError('اكتب مفتاح الإدارة key أولًا.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const url = `/api/cron/isports-safe-sync?key=${encodeURIComponent(cleanSecret)}&matchId=${encodeURIComponent(cleanMatchId)}&debug=true`;
      const response = await fetch(url, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(json?.error || `فشل الطلب: ${response.status}`);
      } else {
        setResult(json);
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر تشغيل المزامنة.');
    } finally {
      setLoading(false);
    }
  }

  const firstStatus = result?.processed?.[0]?.status;
  const saved = Boolean(result?.processed?.some((item: any) => item?.status === 'saved' || item?.snapshotId));
  const limited = Boolean(result?.processed?.some((item: any) => item?.status === 'isports_limit_reached' || item?.status === 'isports_guard_active'));

  return (
    <div className="rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-4">
      <div className="flex items-center gap-2 text-sm font-black text-[#0FF0FC]"><Wrench size={16} /> مزامنة مباراة محددة</div>
      <p className="mt-2 text-xs leading-6 text-gray-400">اكتب iSports matchId ومفتاح الإدارة، ثم اضغط مزامنة. المفتاح لا يُخزن داخل الصفحة.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1">
          <span className="text-[11px] font-black text-gray-400">matchId</span>
          <input value={matchId} onChange={(event) => setMatchId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#0FF0FC]/60" placeholder="365760925" />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-black text-gray-400">key</span>
          <input value={secret} onChange={(event) => setSecret(event.target.value)} type="password" className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#0FF0FC]/60" placeholder="ADMIN_API_SECRET أو CRON_SECRET" />
        </label>
        <button onClick={runSync} disabled={loading} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0FF0FC] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          مزامنة الآن
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-bold leading-6 text-red-200"><AlertTriangle size={14} className="inline" /> {error}</div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className={`rounded-xl border p-3 text-xs font-bold leading-6 ${saved ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : limited ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 bg-white/[0.035] text-gray-300'}`}>
            {saved ? <CheckCircle2 size={14} className="inline" /> : <AlertTriangle size={14} className="inline" />} الحالة: {firstStatus || result.mode || 'تم التنفيذ'}
            {limited ? ' — iSports وصل للحد وتم الاعتماد على football-data.org للنتيجة والحالة.' : ''}
          </div>
          <a href={playerHref} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-black text-[#0FF0FC] hover:bg-white/5">افتح صفحة الأنيميشن لهذه المباراة</a>
          <pre className="max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-black/55 p-3 text-xs leading-6 text-gray-200">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
