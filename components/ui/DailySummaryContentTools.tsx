'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Archive, Copy, FileText, Image as ImageIcon, Loader2, Newspaper, Sparkles, Video } from 'lucide-react';

type Props = { script: string; headline: string; summaryLine: string; digestDate?: string };
function trimText(value: string, max = 220) { if (!value) return ''; return value.length > max ? `${value.slice(0, max - 3).trim()}...` : value; }
async function copyText(text: string) { if (text) await navigator.clipboard?.writeText(text); }

export default function DailySummaryContentTools({ script, headline, summaryLine, digestDate }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pack = useMemo(() => {
    const hashtags = '#بورصة_المونديال #كأس_العالم #ملخص_اليوم';
    const shortSummary = trimText(summaryLine || headline, 260);
    return {
      facebookPost: `${headline}\n\n${shortSummary}\n\nملخص كروي ورصد صحفي من بورصة المونديال.\nتنبيه: المحتوى ليس توصية تداول.\n\n${hashtags}`,
      youtubeTitle: trimText(`${headline} | ملخص اليوم من بورصة المونديال`, 92),
      youtubeDescription: `${shortSummary}\n\nفي هذا الملخص نراجع نتائج اليوم، الأخبار الصحفية، وأبرز إشارات السوق الافتراضي مع فصل واضح بين التحليل الكروي والتداول.\n\n${hashtags}`,
      infographicPoints: [`عنوان اليوم: ${headline}`, summaryLine || 'راجع نتائج اليوم والأخبار المرتبطة بالمباريات.', 'نتائج ومباريات قادمة من قاعدة بيانات المنصة.', 'أخبار السوق الافتراضي منفصلة عن التحليل الكروي.', 'لا توجد توصية شراء أو بيع.'],
    };
  }, [headline, summaryLine]);

  async function handleCopy(key: string, text: string) { await copyText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1400); }
  async function saveDigest(saveAsNews = false) {
    setSaving(saveAsNews ? 'news' : 'archive'); setError(null); setMessage(null);
    try {
      const res = await fetch('/api/admin/daily-digests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ digestDate: digestDate || new Date().toISOString().slice(0, 10), headline, summary: summaryLine || headline, videoScript: script, facebookPost: pack.facebookPost, youtubeTitle: pack.youtubeTitle, youtubeDescription: pack.youtubeDescription, infographicPoints: pack.infographicPoints, saveAsNews }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ ملخص اليوم');
      setMessage(saveAsNews ? 'تم حفظ ملخص اليوم كخبر داخلي.' : 'تم حفظ ملخص اليوم في الأرشيف.');
    } catch (err: any) { setError(err?.message || 'فشل حفظ ملخص اليوم'); }
    finally { setSaving(null); }
  }

  return <section className="rounded-[2rem] border border-[#FFD700]/15 bg-[#FFD700]/[0.035] p-5 md:p-6">
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="flex items-center gap-2 text-2xl font-black"><Sparkles className="text-[#FFD700]" /> باقة محتوى ملخص اليوم</h2><p className="mt-1 text-xs font-bold text-gray-500">انسخ السكربت أو احفظ الملخص في الأرشيف أو كخبر داخلي.</p></div><div className="flex flex-wrap items-center gap-2">{copied && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">تم النسخ</span>}<button type="button" onClick={() => saveDigest(false)} disabled={Boolean(saving)} className="inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black disabled:opacity-60">{saving === 'archive' ? <Loader2 className="animate-spin" size={15} /> : <Archive size={15} />} حفظ في الأرشيف</button><button type="button" onClick={() => saveDigest(true)} disabled={Boolean(saving)} className="inline-flex items-center gap-2 rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-3 text-xs font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC] hover:text-black disabled:opacity-60">{saving === 'news' ? <Loader2 className="animate-spin" size={15} /> : <Newspaper size={15} />} حفظ كخبر</button></div></div>
    {message && <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs font-bold text-emerald-200">{message}</div>}{error && <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-xs font-bold text-red-200">{error}</div>}
    <div className="grid gap-4 lg:grid-cols-2"><ContentBox title="سكريبت الفيديو" icon={<Video size={16} />} text={script} onCopy={() => handleCopy('script', script)} /><ContentBox title="منشور فيسبوك" icon={<FileText size={16} />} text={pack.facebookPost} onCopy={() => handleCopy('facebook', pack.facebookPost)} /><ContentBox title="عنوان ووصف يوتيوب" icon={<Video size={16} />} text={`${pack.youtubeTitle}\n\n${pack.youtubeDescription}`} onCopy={() => handleCopy('youtube', `${pack.youtubeTitle}\n\n${pack.youtubeDescription}`)} /><ContentBox title="نقاط إنفوجرافيك" icon={<ImageIcon size={16} />} text={pack.infographicPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')} onCopy={() => handleCopy('infographic', pack.infographicPoints.map((point, index) => `${index + 1}. ${point}`).join('\n'))} /></div>
  </section>;
}
function ContentBox({ title, text, icon, onCopy }: { title: string; text: string; icon: ReactNode; onCopy: () => void }) { return <article className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="inline-flex items-center gap-2 text-sm font-black text-white">{icon}{title}</h3><button type="button" onClick={onCopy} className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-black text-gray-400 transition hover:border-[#0FF0FC]/30 hover:text-[#0FF0FC]"><Copy size={13} /> نسخ</button></div><pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/35 p-3 text-xs font-bold leading-6 text-gray-300">{text}</pre></article>; }
