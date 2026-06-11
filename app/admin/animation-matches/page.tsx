'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Database, Radio, RefreshCw, Save, Wand2 } from 'lucide-react';

type AnimationMatch = {
  id: string;
  externalId?: string | null;
  animationMatchId?: number | null;
  suggestedAnimationMatchId?: number | null;
  suggestionScore?: number;
  matchDate: string;
  groupPhase?: string | null;
  status: string;
  homeTeam: { id: string; name: string; image?: string | null; code?: string | null };
  awayTeam: { id: string; name: string; image?: string | null; code?: string | null };
  providerCandidates?: Array<{
    matchId: number;
    homeName?: string;
    awayName?: string;
    matchTime?: string;
    score: number;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status?: string) {
  if (status === 'IN_PLAY' || status === 'LIVE') return 'مباشرة';
  if (status === 'FINISHED') return 'انتهت';
  return 'قادمة';
}

export default function AnimationMatchesAdminPage() {
  const [matches, setMatches] = useState<AnimationMatch[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadMatches = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/animation-matches', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل جلب المباريات');
        return;
      }
      setMatches(data.matches || []);
      setProviderErrors(data.providerErrors || {});
      const nextValues: Record<string, string> = {};
      (data.matches || []).forEach((match: AnimationMatch) => {
        nextValues[match.id] = String(match.animationMatchId || match.suggestedAnimationMatchId || '');
      });
      setValues(nextValues);
      setMessage(`تم جلب ${data.matches?.length || 0} مباراة مع اقتراحات Match ID.`);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const saveMatch = async (matchId: string) => {
    setSavingId(matchId);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/animation-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, animationMatchId: values[matchId] || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل حفظ Match ID');
        return;
      }
      setMatches((prev) => prev.map((match) => match.id === matchId ? { ...match, animationMatchId: data.match.animationMatchId } : match));
      setMessage('تم حفظ Match ID بنجاح.');
    } catch (err: any) {
      setError(err.message || 'فشل الحفظ');
    } finally {
      setSavingId(null);
    }
  };

  const syncAll = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/animation-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل مزامنة Match ID');
        return;
      }
      setMessage(`تمت مزامنة ${data.updated || 0} مباراة تلقائيًا.`);
      await loadMatches();
    } catch (err: any) {
      setError(err.message || 'فشل المزامنة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const linkedCount = matches.filter((match) => match.animationMatchId).length;
  const suggestedCount = matches.filter((match) => !match.animationMatchId && match.suggestedAnimationMatchId).length;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-[#FFD700]/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-[#FFD700]">
                <Radio size={16} /> FOOTBALL ANIMATION LIVE
              </div>
              <h1 className="text-2xl font-black text-white md:text-3xl">ربط Match ID للبث الأنيميشن</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">
                هذه الصفحة تجلب جدول المباريات من iSports وتحاول مطابقة Match ID تلقائيًا مع مباريات المنصة حسب اسم المنتخبين وتوقيت المباراة.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={loadMatches} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary disabled:opacity-50">
                تحديث <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={syncAll} disabled={loading || suggestedCount === 0} className="inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black disabled:opacity-50">
                مزامنة المقترحات <Wand2 size={16} />
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-black/25 p-4"><div className="text-xs text-gray-500">المباريات</div><div className="text-2xl font-black text-white">{matches.length}</div></div>
            <div className="rounded-2xl border border-success/20 bg-success/10 p-4"><div className="text-xs text-success/80">مرتبطة بالبث</div><div className="text-2xl font-black text-success">{linkedCount}</div></div>
            <div className="rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-4"><div className="text-xs text-[#FFD700]/80">اقتراحات جاهزة</div><div className="text-2xl font-black text-[#FFD700]">{suggestedCount}</div></div>
          </div>
        </section>

        {message && <div className="mb-4 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold text-success"><CheckCircle2 className="ml-2 inline" size={16} />{message}</div>}
        {error && <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger"><AlertCircle className="ml-2 inline" size={16} />{error}</div>}

        {Object.keys(providerErrors).length > 0 && (
          <div className="mb-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm leading-7 text-yellow-100">
            <div className="mb-2 font-black">ملاحظات من مزود iSports</div>
            {Object.entries(providerErrors).map(([date, providerError]) => <div key={date}>{date}: {providerError}</div>)}
          </div>
        )}

        <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><Database size={20} className="text-primary" /> جدول المباريات</h2>
            <Link href="/animation-live" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-[#FFD700]/40 hover:text-[#FFD700]">فتح صفحة البث</Link>
          </div>

          {loading && matches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-background/40 p-10 text-center text-gray-400">جاري جلب المباريات والاقتراحات...</div>
          ) : matches.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-background/40 p-10 text-center text-gray-400">لا توجد مباريات قادمة.</div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="rounded-3xl border border-white/5 bg-background/40 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-black text-primary">{statusLabel(match.status)}</span>
                        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">{match.groupPhase || 'دور المجموعات'}</span>
                        {match.animationMatchId && <span className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-xs font-bold text-success">بث مرتبط</span>}
                        {!match.animationMatchId && match.suggestedAnimationMatchId && <span className="rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-xs font-bold text-[#FFD700]">اقتراح: {match.suggestedAnimationMatchId} · {match.suggestionScore}%</span>}
                      </div>
                      <div className="mb-3 text-xs text-gray-500">{formatDate(match.matchDate)} · Platform Match: {match.id}</div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 text-2xl">{match.homeTeam.image || '⚽'}</div>
                          <span className="font-black text-white">{match.homeTeam.name}</span>
                        </div>
                        <div className="rounded-xl bg-white/5 px-3 py-2 text-sm font-black text-gray-400">VS</div>
                        <div className="flex items-center justify-end gap-3 text-left">
                          <span className="font-black text-white">{match.awayTeam.name}</span>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 text-2xl">{match.awayTeam.image || '⚽'}</div>
                        </div>
                      </div>

                      {match.providerCandidates && match.providerCandidates.length > 0 && (
                        <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-3 text-xs text-gray-400">
                          <div className="mb-2 font-black text-gray-300">أقرب نتائج من iSports:</div>
                          <div className="space-y-1">
                            {match.providerCandidates.map((candidate) => (
                              <button
                                key={candidate.matchId}
                                onClick={() => setValues((prev) => ({ ...prev, [match.id]: String(candidate.matchId) }))}
                                className="block w-full rounded-xl px-2 py-1 text-right hover:bg-white/5 hover:text-white"
                              >
                                #{candidate.matchId} · {candidate.homeName} × {candidate.awayName} · score {candidate.score}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full max-w-sm shrink-0 space-y-2">
                      <label className="block text-xs font-bold text-gray-500">isportslive8 Match ID</label>
                      <input
                        value={values[match.id] || ''}
                        onChange={(event) => setValues((prev) => ({ ...prev, [match.id]: event.target.value }))}
                        placeholder="مثال: 123456"
                        className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 font-mono text-white outline-none focus:border-[#FFD700]"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveMatch(match.id)} disabled={savingId === match.id} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-2 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black disabled:opacity-50">
                          حفظ <Save size={15} />
                        </button>
                        {match.animationMatchId && (
                          <Link href={`/animation-live?matchId=${match.animationMatchId}&lang=en&statsPanel=simple&teamPanel=1`} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
                            مشاهدة
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
