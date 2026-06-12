'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clipboard, KeyRound, Link2, RefreshCw, Search, XCircle } from 'lucide-react';

type Candidate = { fixtureId: number; homeName: string; awayName: string; date?: string; status?: string; score?: string; confidence: number; reasons: string[]; day?: string };
type Payload = { ok: boolean; provider: string; externalRequestsUsed: number; searchedDates: string[]; localMatch: any; candidates: Candidate[] };

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function confidenceTone(value: number) {
  if (value >= 90) return 'text-[#00FF88] border-[#00FF88]/20 bg-[#00FF88]/10';
  if (value >= 70) return 'text-[#FFD700] border-[#FFD700]/20 bg-[#FFD700]/10';
  return 'text-red-300 border-red-500/20 bg-red-500/10';
}

export default function ISportsCandidatesPage() {
  const [secret, setSecret] = useState('');
  const [matchId, setMatchId] = useState('');
  const [nearby, setNearby] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key') || localStorage.getItem('liveHealthKey') || '';
    const id = params.get('id') || params.get('matchId') || '';
    if (key) setSecret(key);
    if (id) setMatchId(id);
    if (key && id) void search(key, id);
  }, []);

  async function search(keyValue = secret, idValue = matchId) {
    if (!keyValue || !idValue) {
      setError('ضع السر و matchId المحلي أولاً.');
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem('liveHealthKey', keyValue);
      const res = await fetch(`/api/admin/isports-candidates?key=${encodeURIComponent(keyValue)}&id=${encodeURIComponent(idValue)}&nearby=${nearby ? 'true' : 'false'}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to load candidates');
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'فشل جلب مرشحين iSports');
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1600);
    } catch {}
  }

  function manualLinkHref(candidate: Candidate) {
    if (!data?.localMatch) return '#';
    const url = new URL('/api/admin/manual-link-match', window.location.origin);
    url.searchParams.set('key', secret);
    url.searchParams.set('id', data.localMatch.id);
    url.searchParams.set('animationMatchId', String(candidate.fixtureId));
    url.searchParams.set('status', data.localMatch.status || 'SCHEDULED');
    url.searchParams.set('homeScore', String(data.localMatch.homeScore ?? 0));
    url.searchParams.set('awayScore', String(data.localMatch.awayScore ?? 0));
    return url.toString();
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-[2rem] border border-white/8 bg-gradient-to-br from-[#111] to-black p-6 shadow-2xl">
          <Link href="/admin/unlinked-matches" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-[#0FF0FC] hover:text-white"><ArrowRight size={14} /> رجوع إلى المباريات غير المرتبطة</Link>
          <h1 className="text-3xl font-black sm:text-4xl">مرشحو iSports للربط</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-400">ابحث عن أقرب مباريات iSports لمباراة محلية باستخدام matchId المحلي.</p>
        </section>

        <section className="mb-8 rounded-3xl border border-white/5 bg-[#111] p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><KeyRound size={14} /> السر</label>
              <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="ADMIN_API_SECRET أو CRON_SECRET" />
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400"><Search size={14} /> matchId المحلي</label>
              <input value={matchId} onChange={(e) => setMatchId(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none focus:border-[#0FF0FC]/50" placeholder="cmq..." />
            </div>
            <label className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-gray-300 md:self-end">
              <input type="checkbox" checked={nearby} onChange={(e) => setNearby(e.target.checked)} />
              بحث ± يوم
            </label>
            <button onClick={() => search()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black disabled:opacity-50 md:self-end"><RefreshCw size={16} /> بحث</button>
          </div>
        </section>

        {error && <div className="mb-6 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"><XCircle size={16} /> {error}</div>}
        {loading && <div className="mb-6 rounded-2xl border border-white/5 bg-[#111] p-4 text-center text-gray-500">جاري البحث في iSports...</div>}

        {data && (
          <>
            <section className="mb-8 rounded-3xl border border-white/5 bg-[#111] p-5">
              <div className="text-xs text-gray-500">المباراة المحلية</div>
              <div className="mt-2 text-xl font-black text-white">{data.localMatch?.homeTeam?.name} × {data.localMatch?.awayTeam?.name}</div>
              <div className="mt-2 text-sm text-gray-400">{formatDate(data.localMatch?.matchDate)} — الحالة: {data.localMatch?.status} — الطلبات الخارجية: {data.externalRequestsUsed}</div>
            </section>

            <section className="space-y-4">
              {data.candidates.length === 0 && <div className="rounded-3xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-8 text-center text-[#FFD700]">لا توجد مرشحات واضحة في iSports.</div>}
              {data.candidates.map((candidate) => (
                <div key={candidate.fixtureId} className="rounded-3xl border border-white/5 bg-[#111] p-5">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-black text-white">{candidate.homeName} × {candidate.awayName}</div>
                      <div className="mt-1 text-xs text-gray-500">iSports ID: <span className="font-mono">{candidate.fixtureId}</span> — {formatDate(candidate.date)} — {candidate.status || 'غير متوفر'} — {candidate.score}</div>
                    </div>
                    <div className={`rounded-2xl border px-4 py-2 text-center text-sm font-black ${confidenceTone(candidate.confidence)}`}>{candidate.confidence}%</div>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {candidate.reasons.map((reason) => <span key={reason} className="rounded-full border border-white/10 bg-black px-3 py-1 text-[11px] text-gray-400">{reason}</span>)}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <button onClick={() => copy(String(candidate.fixtureId))} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC]"><Clipboard size={16} /> {copied === String(candidate.fixtureId) ? 'تم النسخ' : 'نسخ animationMatchId'}</button>
                    <a href={manualLinkHref(candidate)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700]"><Link2 size={16} /> ربط مباشر</a>
                    <Link href={`/admin/unlinked-matches`} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-gray-300">رجوع للصفحة</Link>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
