'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminMatchControls({ matchId }: { matchId: string }) {
  const [loadingArticle, setLoadingArticle] = useState(false);
  const router = useRouter();

  const generateArticle = async () => {
    setLoadingArticle(true);
    try {
      const res = await fetch(`/api/admin/match/${matchId}/generate-article`, { method: 'POST' });
      const data = await res.json();
      if (data.slug) {
        alert('تم إنشاء المقال بنجاح!');
        router.push(`/articles/${data.slug}`);
      } else {
        alert(data.error || 'حدث خطأ أثناء توليد المقال.');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    } finally {
      setLoadingArticle(false);
    }
  };

  const generateInfographic = () => {
    window.open(`/match-infographic/rich/${matchId}`, '_blank');
  };

  return (
    <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4" dir="rtl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black text-white">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500"></span>
          أدوات الإدارة (Admin Only)
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generateArticle}
          disabled={loadingArticle}
          className="flex items-center gap-2 rounded-xl bg-[#18E58F] px-4 py-2 text-sm font-black text-black hover:bg-[#18E58F]/80 disabled:opacity-50"
        >
          {loadingArticle ? 'جاري التوليد عبر AI...' : '🤖 توليد مقال AI ومراجعته'}
        </button>
        
        <button
          onClick={generateInfographic}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-black text-white hover:bg-blue-600"
        >
          📸 توليد إنفوجرافيك الإحصائيات (Rich)
        </button>
      </div>
    </div>
  );
}
