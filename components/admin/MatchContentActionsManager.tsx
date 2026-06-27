'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';

type MatchRow = {
  id: string;
  matchDate: string;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  snapshotId: string | null;
  snapshotProvider: string | null;
  articleSlug: string | null;
  articleStatus: string | null;
  infographicUrl: string | null;
  infographicStatus: string | null;
};

type Props = { matches: MatchRow[] };
type BusyState = { matchId: string; action: 'article' | 'infographic' } | null;

type ActionResult = {
  ok?: boolean;
  action?: string;
  article?: { slug?: string | null; status?: string | null } | null;
  infographic?: { imageUrl?: string | null; status?: string | null } | null;
  articleUrl?: string | null;
  infographicUrl?: string | null;
  error?: string;
  note?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function score(row: MatchRow) {
  if (row.homeScore === null || row.homeScore === undefined || row.awayScore === null || row.awayScore === undefined) return 'VS';
  return `${row.homeScore} - ${row.awayScore}`;
}

function badgeTone(value?: string | null) {
  const text = String(value || '').toUpperCase();
  if (text === 'PUBLISHED' || text === 'READY') return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200';
  if (text.includes('DRAFT')) return 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]';
  return 'border-white/10 bg-white/[0.04] text-slate-400';
}

export default function MatchContentActionsManager({ matches }: Props) {
  const [rows, setRows] = useState(matches);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(matchId: string, action: 'article' | 'infographic') {
    setBusy({ matchId, action });
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/match-content-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, action, autoPublish: true }),
      });
      const data = (await res.json()) as ActionResult;
      if (!res.ok || !data.ok) throw new Error(data.error || 'فشل تنفيذ العملية');

      setRows((items) => items.map((item) => {
        if (item.id !== matchId) return item;
        return {
          ...item,
          articleSlug: data.article?.slug || item.articleSlug,
          articleStatus: data.article?.status || (action === 'article' ? 'PUBLISHED' : item.articleStatus),
          infographicUrl: data.infographic?.imageUrl || data.infographicUrl || item.infographicUrl,
          infographicStatus: data.infographic?.status || (action === 'infographic' ? 'READY' : item.infographicStatus),
        };
      }));

      setMessage(action === 'article' ? 'تم إنشاء/نشر مقال المباراة بنجاح.' : 'تم تجهيز الإنفوغرافيك بنجاح.');
    } catch (err: any) {
      setError(err?.message || 'فشل تنفيذ العملية');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black text-white"><Sparkles className="text-[#F8C846]" /> أدوات مقال المباراة</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-slate-400">الأزرار هنا للأدمن فقط. المقال والإنفوغرافيك يتم توليدهما من آخر Snapshot محفوظة في قاعدة البيانات، بدون جلب خارجي وقت الضغط.</p>
          </div>
          <Link href="/admin/content-studio" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-black text-slate-300 hover:border-[#18E58F]/30 hover:text-white">استوديو المحتوى</Link>
        </div>

        <div className="grid gap-3">
          {rows.map((match) => {
            const articleBusy = busy?.matchId === match.id && busy.action === 'article';
            const infographicBusy = busy?.matchId === match.id && busy.action === 'infographic';
            const canGenerate = Boolean(match.snapshotId);
            return (
              <article key={match.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-500">
                      <span>{formatDate(match.matchDate)}</span>
                      <span>·</span>
                      <span>{match.status}</span>
                      <span>·</span>
                      <span>{match.snapshotProvider || 'لا توجد Snapshot'}</span>
                    </div>
                    <h3 className="text-lg font-black text-white">{match.homeTeamName} <span className="mx-2 text-[#F8C846]">{score(match)}</span> {match.awayTeamName}</h3>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                      <span className={`rounded-full border px-3 py-1 ${badgeTone(match.articleStatus)}`}>المقال: {match.articleStatus || 'غير موجود'}</span>
                      <span className={`rounded-full border px-3 py-1 ${badgeTone(match.infographicStatus)}`}>الإنفوغرافيك: {match.infographicStatus || 'غير موجود'}</span>
                      {!canGenerate ? <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-red-200">يحتاج Snapshot نهائية</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={!canGenerate || Boolean(busy)}
                      onClick={() => runAction(match.id, 'article')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-4 py-3 text-xs font-black text-[#18E58F] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#18E58F] hover:text-black"
                    >
                      {articleBusy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      إنشاء المقال
                    </button>
                    <button
                      type="button"
                      disabled={!canGenerate || Boolean(busy)}
                      onClick={() => runAction(match.id, 'infographic')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#F8C846]/25 bg-[#F8C846]/10 px-4 py-3 text-xs font-black text-[#F8C846] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#F8C846] hover:text-black"
                    >
                      {infographicBusy ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      تجهيز الإنفوغرافيك
                    </button>
                    <Link href={`/match-center/${match.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs font-black text-slate-400 hover:text-white">
                      صفحة المباراة <ArrowLeft size={13} />
                    </Link>
                    {match.articleSlug ? <Link href={`/articles/${match.articleSlug}`} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs font-black text-slate-400 hover:text-white">فتح المقال</Link> : null}
                    {match.infographicUrl ? <a href={match.infographicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs font-black text-slate-400 hover:text-white">فتح الصورة</a> : null}
                  </div>
                </div>
              </article>
            );
          })}

          {!rows.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold text-slate-500">لا توجد مباريات حديثة للعرض.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
