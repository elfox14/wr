'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Eye, FileText, Loader2, Save, Sparkles } from 'lucide-react';

type ExistingArticle = {
  title: string;
  url: string;
  status?: string | null;
  updatedAt?: Date | string | null;
  count?: number | null;
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

function formatArticleDate(value?: Date | string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ar-EG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [draftLoading, setDraftLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newsUrl, setNewsUrl] = useState<string | null>(existingArticle?.url || null);
  const [categoryUrl, setCategoryUrl] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(existingArticle?.status || null);

  const notes = useMemo(() => qualityNotes(previewItem), [previewItem]);
  const previewWords = previewItem ? wordCount(previewItem.body) : 0;
  const currentArticleUrl = newsUrl || existingArticle?.url || null;
  const hasExistingArticle = Boolean(currentArticleUrl);
  const articleCount = Math.max(0, Number(existingArticle?.count || 0));
  const lastUpdated = formatArticleDate(existingArticle?.updatedAt || null);
  const busy = previewLoading || draftLoading || publishLoading;

  async function requestArticle(mode: 'preview' | 'upsert', status: 'draft' | 'published' = 'published') {
    if (mode === 'preview') setPreviewLoading(true);
    else if (status === 'draft') setDraftLoading(true);
    else setPublishLoading(true);
    setMessage(null);
    if (mode === 'preview') {
      setCategoryUrl(null);
    }

    try {
      const response = await fetch('/api/admin/match-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, status, mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'تعذر إنشاء المقال من بيانات المباراة.');

      if (mode === 'preview') {
        setPreviewItem(payload.item || null);
        setMessage('تم تجهيز معاينة المقال. راجع النص والملاحظات، ثم احفظه كمسودة أو انشره.');
      } else {
        setNewsUrl(payload.url || null);
        setCategoryUrl(payload.categoryUrl || null);
        setPreviewItem(payload.item || previewItem);
        setCurrentStatus(status);
        setMessage(status === 'draft'
          ? 'تم حفظ المقال كمسودة. سيظهر للأدمن فقط ولن يظهر في صفحة الأخبار العامة.'
          : 'تم نشر/تحديث المقال بنجاح داخل تصنيف تحليل صفحة المباراة.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء المقال.');
    } finally {
      if (mode === 'preview') setPreviewLoading(false);
      else if (status === 'draft') setDraftLoading(false);
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
            أنشئ معاينة لمقال حصري من نتيجة المباراة، الإحصائيات، والأحداث، ثم احفظه كمسودة أو انشره بعد المراجعة.
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
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 text-sm font-black text-[#EAFBFF] transition hover:bg-[#0FF0FC] hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {previewLoading ? 'جارٍ تجهيز المعاينة...' : 'معاينة المقال'}
          </button>
          <button
            type="button"
            onClick={() => requestArticle('upsert', 'draft')}
            disabled={busy || !previewItem}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 text-sm font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {draftLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {draftLoading ? 'جارٍ حفظ المسودة...' : 'حفظ كمسودة'}
          </button>
          <button
            type="button"
            onClick={() => requestArticle('upsert', 'published')}
            disabled={busy || !previewItem}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 text-sm font-black text-black transition hover:bg-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {publishLoading ? 'جارٍ النشر...' : hasExistingArticle ? 'نشر/تحديث' : 'نشر المقال'}
          </button>
        </div>
      </div>

      {hasExistingArticle && existingArticle && (
        <div className="mt-3 grid gap-3 rounded-xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/5 p-3 text-xs font-bold leading-6 text-gray-300 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div>
              يوجد مقال مرتبط بهذه المباراة بالفعل: {existingArticle.url ? <Link href={existingArticle.url} className="text-[#0FF0FC] hover:underline">{existingArticle.title || 'فتح المقال'}</Link> : <span>{existingArticle.title || 'بدون عنوان'}</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
              {(currentStatus || existingArticle.status) && <span>الحالة: {currentStatus || existingArticle.status}</span>}
              {articleCount > 0 && <span>عدد المقالات المرتبطة: {articleCount}</span>}
              {lastUpdated && <span>آخر تحديث: {lastUpdated}</span>}
            </div>
          </div>
          {existingArticle.url && (
            <Link href={existingArticle.url} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#0FF0FC]/20 bg-black/20 px-3 py-2 text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black">
              فتح المقال <ExternalLink size={12} />
            </Link>
          )}
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
                معاينة قبل الحفظ أو النشر
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
