'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function articleErrorMessage(code: string) {
  if (code.includes('MATCH_NOT_FOUND')) return 'تعذر العثور على المباراة.';
  if (code.includes('MATCH_NOT_FINAL')) return 'لا يمكن توليد المقال قبل انتهاء المباراة واعتماد النتيجة.';
  if (code.includes('VERIFIED_SNAPSHOT_NOT_FOUND')) return 'لا توجد لقطة إحصائية نهائية موثقة لهذه المباراة.';
  if (code.includes('INSUFFICIENT_VERIFIED_STATS')) return 'الإحصاءات الموثقة غير كافية لتوليد مقال.';
  return 'تعذر توليد المقال الآن. حاول مرة أخرى أو راجع سجل التوليد.';
}

export default function AdminMatchControls({ matchId }: { matchId: string }) {
  const [infographicLoading, setInfographicLoading] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleMessage, setArticleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const generateArticle = async () => {
    if (articleLoading) return;
    setArticleLoading(true);
    setArticleMessage(null);
    try {
      const res = await fetch('/api/admin/match-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.articleId) {
        setArticleMessage({ type: 'error', text: articleErrorMessage(String(data.error || res.status)) });
        return;
      }
      setArticleMessage({ type: 'success', text: 'تم توليد المسودة الموثقة. جارٍ فتح شاشة المراجعة…' });
      router.push(`/admin/match-articles/${data.articleId}`);
      router.refresh();
    } catch {
      setArticleMessage({ type: 'error', text: 'تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.' });
    } finally {
      setArticleLoading(false);
    }
  };

  const generateInfographicData = async () => {
    setInfographicLoading(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/generate-infographic`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        alert(`خطأ من الخادم (${res.status}): ${text.slice(0, 100)}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        alert('تم توليد بيانات الإنفوجرافيك بنجاح!');
        router.refresh();
      } else {
        alert(data.error || 'حدث خطأ أثناء التوليد.');
      }
    } catch {
      alert('خطأ في الاتصال بالخادم.');
    } finally {
      setInfographicLoading(false);
    }
  };

  const viewInfographic = () => {
    window.open(`/match-center/${matchId}/infographic`, '_blank');
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4" dir="rtl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black text-white">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#F8C846]"></span>
          أدوات الإدارة (Admin)
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateArticle}
          disabled={articleLoading}
          aria-busy={articleLoading}
          className="flex items-center gap-2 rounded-xl bg-[#18E58F] px-4 py-2 text-sm font-black text-black transition hover:bg-[#18E58F]/80 disabled:cursor-wait disabled:opacity-60"
        >
          {articleLoading ? 'جاري توليد المقال الموثق…' : 'توليد مقال تحليلي'}
        </button>

        <button
          type="button"
          onClick={generateInfographicData}
          disabled={infographicLoading}
          className="flex items-center gap-2 rounded-xl bg-[#F8C846] px-4 py-2 text-sm font-black text-black hover:bg-[#F8C846]/80 disabled:opacity-50"
        >
          {infographicLoading ? 'جاري التوليد عبر AI...' : '✨ توليد بيانات الإنفوجرافيك'}
        </button>

        <button
          type="button"
          onClick={viewInfographic}
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/50 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
        >
          👁️ عرض الإنفوجرافيك المولد
        </button>
      </div>

      {articleMessage && (
        <p
          role={articleMessage.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${
            articleMessage.type === 'error'
              ? 'border-red-400/30 bg-red-500/10 text-red-200'
              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {articleMessage.text}
        </p>
      )}
      <p className="mt-3 text-xs font-bold text-slate-300">
        المقال يُحفظ كمسودة للمراجعة ولا يُنشر تلقائيًا.
      </p>
    </div>
  );
}
