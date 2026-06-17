'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Eye, FileText, Loader2, Sparkles } from 'lucide-react';

type ExistingArticle = {
  title: string;
  url: string;
  status?: string | null;
} | null;

type Props = {
  matchId: string;
  existingArticle?: ExistingArticle;
};

type PreviewItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  sourceName: string;
  sourceUrl?: string | null;
  tags?: { keywords?: string[] } | string[] | null;
};

function wordCount(text: string) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function qualityNotes(item: PreviewItem | null) {
  if (!item) return [];
  const notes: string[] = [];
  const words = wordCount(item.body);
  if (words < 450) notes.push(`المقال قصير نسبيًا: ${words} كلمة تقريبًا. راجعه إذا كنت تستهدف مقالًا أطول.`);
  if (item.body.includes('تعتمد هذه القراءة على أحداث الأهداف')) notes.push('تنبيه: النتيجة اعتمدت على أحداث الأهداف لأن نتيجة جدول المباراة قد تكون غير مكتملة.');
  if (!item.body.includes('عن طريق ')) notes.push('تنبيه: أسماء اللاعبين غير متوفرة في الأحداث، لذلك استخدم القالب لقطة المباراة بدل نجم المباراة.');
  if (item.body.includes('غير متوفرة') || item.body.includes('غير مكتملة')) notes.push('توجد إشارة إلى بيانات غير مكتملة داخل المقال؛ راجعها قبل النشر النهائي.');
  if (!notes.length) notes.push('المقال يبدو جاهزًا للنشر من ناحية البنية الأساسية والبيانات المتاحة.');
  return notes;
}

export default function GenerateMatchArticleButton({ matchId, existingArticle = null }: Props) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newsUrl, setNewsUrl] = useState<string | null>(existingArticle?.url || null);
  const [categoryUrl, setCategoryUrl] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);

  const notes = useMemo(() => qualityNotes(previewItem), [previewItem]);
  const previewWords = previewItem ? wordCount(previewItem.body) : 0;
  const currentArticleUrl = newsUrl || existingArticle?.url || null;

  async function requestArticle(mode: 'preview' | 'upsert') {
    if (mode === 'preview') setPreviewLoading(true);
    else setPublishLoading(true);
    setMessage(null);
    if (mode === 'preview') {
      setCategoryUrl(null);
    }

    try {
      const response = await fetch('/api/admin/match-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, status: 'published', mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'تعذر إنشاء المقال من بيانات المباراة.');

      if (mode === 'preview') {
        setPreviewItem(payload.item || null);
        setMessage('تم تجهيز معاينة المقال. راجع النص والملاحظات، ثم اضغط نشر/تحديث.');
      } else {
        setNewsUrl(payload.url || null);
        setCategoryUrl(payload.categoryUrl || null);
        setPreviewItem(payload.item || previewItem);
        setMessage('تم نشر/تحديث المقال بنجاح داخل تصنيف تحليل صفحة المباراة.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء المقال.');
    } finally {
      if (mode === 'preview') setPreviewLoading(false);
      else setPublishLoading(false);
    }
  }

  return (
    <section className="rounded-[1.25rem] border border-[#FFD700]/20 bg-[#FFD700]/5 p-4 text-right shadow-card" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-[#FFD700]">
            <Sparkles size={16} /> أداة إدارية مؤقتة
          </div>
          <p className="mt-1 text-xs font-bold leading-6 text-gray-400">
            أنشئ معاينة لمقال حصري من نتيجة المباراة، الإحصائيات، والأحداث، ثم انشره بعد المراجعة في تصنيف تحليل صفحة المباراة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentArticleUrl && (
            <Link
              href={currentArticleUrl}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:border-[#FFD700]/40 hover:bg-white/10"
            >
              <ExternalLink size={16} /> فتح المقال الحالي
            </Link>
          )}
          <button
            type="button"
            onClick={() => requestArticle('preview')}
            disabled={previewLoading || publishLoading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 text-sm font-black text-[#EAFBFF] transition hover:bg-[#0FF0FC] hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {previewLoading ? 'جارٍ تجهيز المعاينة...' : 'معاينة المقال'}
          </button>
          <button
            type="button"
            onClick={() => requestArticle('upsert')}
            disabled={previewLoading || publishLoading || !previewItem}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 text-sm font-black text-black transition hover:bg-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {publishLoading ? 'جارٍ النشر...' : existingArticle ? 'تحديث المقال' : 'نشر المقال'}
          </button>
        </div>
      </div>

      {existingArticle && (
        <div className="mt-3 rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-3 text-xs font-bold leading-6 text-gray-300">
          يوجد مقال مرتبط بهذه المباراة بالفعل: <Link href={existingArticle.url} className="text-[#0FF0FC] hover:underline">{existingArticle.title}</Link>
          {existingArticle.status && <span className="mr-2 text-gray-500">الحالة: {existingArticle.status}</span>}
        </div>
      )}

      {message && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs font-bold leading-6 text-gray-300">
          {message}
          <div className="mt-2 flex flex-wrap gap-3">
            {currentArticleUrl && <Link href={currentArticleUrl} className="text-[#0FF0FC] hover:underline">فتح المقال</Link>}
            {categoryUrl && <Link href={categoryUrl} className="text-[#FFD700] hover:underline">فتح التصنيف</Link>}
          </div>
        </div>
      )}

      {previewItem && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
          <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-[11px] font-black text-[#FFD700]">
                معاينة قبل النشر
              </span>
              <span className="text-[11px] font-bold text-gray-500">{previewWords} كلمة تقريبًا</span>
            </div>
            <h3 className="text-base font-black leading-7 text-white">{previewItem.title}</h3>
            <div className="mt-3 max-h-96 overflow-auto whitespace-pre-line rounded-xl border border-white/5 bg-black/30 p-3 text-xs font-bold leading-7 text-gray-300">
              {previewItem.body}
            </div>
          </article>

          <aside className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-[#0FF0FC]">
              <CheckCircle2 size={16} /> ملاحظات الجودة
            </div>
            <ul className="mt-3 space-y-2 text-xs font-bold leading-6 text-gray-300">
              {notes.map((note) => (
                <li key={note} className="rounded-xl border border-white/5 bg-white/[0.03] p-2">{note}</li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}
