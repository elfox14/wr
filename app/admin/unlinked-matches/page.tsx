'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, Link2, RefreshCw, Search, Shield, XCircle } from 'lucide-react';

type Team = { id: string; name: string; code?: string; image?: string };
type Match = { id: string; externalId?: string | null; animationMatchId?: number | null; status: string; score: string; homeScore: number; awayScore: number; matchDate: string; groupPhase?: string | null; homeTeam: Team | null; awayTeam: Team | null };
type Payload = { ok: boolean; updatedAt: string; counters: { unlinkedInWindow: number; linkedInWindow: number; totalUnlinked: number }; environment: { cronBaseUrl?: string | null; cronBaseUrlRecommended: string; apiFootballCronEnabled: boolean }; matches: Match[] };

type LinkState = { [matchId: string]: { animationMatchId: string; status: string; homeScore: string; awayScore: string; loading?: boolean; result?: string; error?: string } };

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function UnlinkedMatchesPage() {
  const [secret, setSecret] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [states, setStates] = useState<LinkState>({});
  const [hours, setHours] = useState(72);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key') || localStorage.getItem('liveHealthKey') || '';
    if (key) {
      setSecret(key);
      void load(key, hours);
    }
  }, []);

  const missingCronBase = useMemo(() => {
    if (!data) return false;
    return data.environment.cronBaseUrl !== data.environment.cronBaseUrlRecommended;
  }, [data]);

  function candidatesHref(matchId: string) {
    const params = new URLSearchParams({ id: matchId });
    if (secret) params.set('key', secret);
    return `/admin/isports-candidates?${params.toString()}`;
  }

  async function load(keyValue = secret, hoursValue = hours) {
    if (!keyValue) {
      setError('ضع ADMIN_API_SECRET أو CRON_SECRET أولاً.');
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem('liveHealthKey', keyValue);
      const res = await fetch(`/api/admin/unlinked-matches?key=${encodeURIComponent(keyValue)}&hours=${encodeURIComponent(String(hoursValue))}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load unlinked matches');
      setData(json);
      setError(null);
      setStates((prev) => {
        const next = { ...prev };
        for (const match of json.matches || []) {
          if (!next[match.id]) {
            next[match.id] = { animationMatchId: '', status: match.status || 'SCHEDULED', homeScore: String(match.homeScore ?? 0), awayScore: String(match.awayScore ?? 0) };
          }
        }
        return next;
      });
    } catch (err: any) {
      setError(err?.message || 'خطأ في تحميل المباريات غير المرتبطة');
    } finally {
      setLoading(false);
    }
  }

  function updateState(matchId: string, patch: Partial<LinkState[string]>) {
    setStates((prev) => ({ ...prev, [matchId]: { ...(prev[matchId] || { animationMatchId: '', status: 'SCHEDULED', homeScore: '0', awayScore: '0' }), ...patch } }));
  }

  async function linkMatch(match: Match) {
    if (!secret) {
      setError('ضع السر أولاً.');
      return;
    }
    const state = states[match.id];
    const animationMatchId = Number(state?.animationMatchId || 0);
    if (!Number.isFinite(animationMatchId) || animationMatchId <= 0) {
      updateState(match.id, { error: 'ضع animationMatchId صحيح.' });
      return;
    }
    updateState(match.id, { loading: true, error: undefined, result: undefined });
    try {
      const url = new URL('/api/admin/manual-link-match', window.location.origin);
      url.searchParams.set('key', secret);
      url.searchParams.set('id', match.id);
      url.searchParams.set('animationMatchId', String(animationMatchId));
      url.searchParams.set('status', state?.status || 'SCHEDULED');
      url.searchParams.set('homeScore', state?.homeScore || '0');
      url.searchParams.set('awayScore', state?.awayScore || '0');
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      updateState(match.id, { loading: false, result: `تم الربط: ${json.match?.animationMatchId}`, error: undefined });
      await load(secret, hours);
    } catch (err: any) {
      updateState(match.id, { loading: false, error: err?.message || 'فشل الربط' });
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-white/8 bg-gradient-to-br from-[#111] to-black p-6 shadow-2xl">
          <Link href="/admin/live-health" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-[#0FF0FC] hover:text-white"><ArrowRight size={14} /> رجوع إلى Live Health</Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-4 py-2 text-xs font-black text-[#FFD700]"><Shield size={15} /> Unlinked Matches</div>
              <h1 className="text-3xl font-black sm:text-4xl">إدارة المباريات غير المرتبطة</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">اربط مباريات المنصة بـ animationMatchId من iSports مباشرة من الواجهة.</p>
            </div>
            <button onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC] disabled:opacity-50"><RefreshCw size={16} /> تحديث</button>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-white/5 bg-[#111] p-4">
          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><KeyRound size={14} /> ADMIN_API_SECRET أو CRON_SECRET</label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
            <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="min-w-0 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="ضع السر هنا" />
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50">
              <option value={24}>24 ساعة</option>
              <option value={72}>72 ساعة</option>
              <option value={168}>7 أيام</option>
              <option value={720}>30 يوم</option>
            </select>
            <button onClick={() => load()} className="rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black">تحميل</button>
          </div>
        </section>

        {error && <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"><XCircle size={16} /> {error}</div>}
        {missingCronBase && <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-4 text-sm text-[#FFD700]"><AlertTriangle size={16} /> اضبط CRON_BASE_URL في Render على: <span className="font-mono text-white">{data?.environment.cronBaseUrlRecommended}</span></div>}

        {data && (
          <>
            <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">غير مرتبطة في النافذة</div><div className="mt-2 text-2xl font-black text-[#FFD700]">{data.counters.unlinkedInWindow}</div></div>
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">مرتبطة في النافذة</div><div className="mt-2 text-2xl font-black text-[#00FF88]">{data.counters.linkedInWindow}</div></div>
              <div className="rounded-3xl border border-white/5 bg-[#111] p-4"><div className="text-xs text-gray-500">إجمالي غير مرتبطة</div><div className="mt-2 text-2xl font-black text-red-300">{data.counters.totalUnlinked}</div></div>
            </section>

            <section className="space-y-4">
              {data.matches.length === 0 && <div className="rounded-3xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-8 text-center text-[#00FF88]"><CheckCircle2 className="mx-auto mb-3" /> لا توجد مباريات غير مرتبطة في هذه النافذة.</div>}
              {data.matches.map((match) => {
                const state = states[match.id] || { animationMatchId: '', status: match.status, homeScore: String(match.homeScore || 0), awayScore: String(match.awayScore || 0) };
                return (
                  <div key={match.id} className="rounded-3xl border border-white/5 bg-[#111] p-5">
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-lg font-black text-white">{match.homeTeam?.name || 'غير متوفر'} × {match.awayTeam?.name || 'غير متوفر'}</div>
                        <div className="mt-1 text-xs text-gray-500">ID: <span className="font-mono">{match.id}</span> — {formatDate(match.matchDate)} — {match.status}</div>
                      </div>
                      <div className="rounded-2xl bg-black px-4 py-2 text-center font-mono text-xl font-black text-[#FFD700]">{match.score}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_150px_120px_120px_auto_auto]">
                      <input value={state.animationMatchId} onChange={(e) => updateState(match.id, { animationMatchId: e.target.value })} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="animationMatchId من iSports" />
                      <select value={state.status} onChange={(e) => updateState(match.id, { status: e.target.value })} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50">
                        <option value="SCHEDULED">SCHEDULED</option>
                        <option value="IN_PLAY">IN_PLAY</option>
                        <option value="FINISHED">FINISHED</option>
                      </select>
                      <input value={state.homeScore} onChange={(e) => updateState(match.id, { homeScore: e.target.value })} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="Home" />
                      <input value={state.awayScore} onChange={(e) => updateState(match.id, { awayScore: e.target.value })} className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="Away" />
                      <button disabled={state.loading} onClick={() => linkMatch(match)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black disabled:opacity-50"><Link2 size={16} /> ربط</button>
                      <Link href={candidatesHref(match.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC]"><Search size={16} /> مرشحو iSports</Link>
                    </div>
                    {state.result && <div className="mt-3 rounded-2xl border border-[#00FF88]/20 bg-[#00FF88]/10 p-3 text-sm text-[#00FF88]">{state.result}</div>}
                    {state.error && <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{state.error}</div>}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
