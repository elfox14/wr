'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Sparkles } from 'lucide-react';

type Props = {
  matchId: string;
};

export default function GenerateMatchArticleButton({ matchId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newsUrl, setNewsUrl] = useState<string | null>(null);
  const [categoryUrl, setCategoryUrl] = useState<string | null>(null);

  async function generateArticle() {
    setLoading(true);
    setMessage(null);
    setNewsUrl(null);
    setCategoryUrl(null);

    try {
      const response = await fetch('/api/admin/match-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, status: 'published', mode: 'upsert' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'تعذر إنشاء المقال من بيانات المباراة.');
      setNewsUrl(payload.url || null);
      setCategoryUrl(payload.categoryUrl || null);
      setMessage('تم إنشاء/تحديث المقال بنجاح داخل تصنيف تحليل صفحة المباراة.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء المقال.');
    } finally {
      setLoading(false);
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
            أنشئ مقالًا حصريًا من نتيجة المباراة، الإحصائيات، الأحداث، والزخم، واحفظه في تصنيف تحليل صفحة المباراة.
          </p>
        </div>
        <button
          type="button"
          onClick={generateArticle}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFD700] px-4 text-sm font-black text-black transition hover:bg-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {loading ? 'جارٍ إنشاء المقال...' : 'إنشاء مقال من هذه المباراة'}
        </button>
      </div>

      {message && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs font-bold leading-6 text-gray-300">
          {message}
          <div className="mt-2 flex flex-wrap gap-3">
            {newsUrl && <Link href={newsUrl} className="text-[#0FF0FC] hover:underline">فتح المقال</Link>}
            {categoryUrl && <Link href={categoryUrl} className="text-[#FFD700] hover:underline">فتح التصنيف</Link>}
          </div>
        </div>
      )}
    </section>
  );
}
