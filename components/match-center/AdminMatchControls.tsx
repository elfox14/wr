'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminMatchControls({ matchId }: { matchId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const generateInfographicData = async () => {
    setLoading(true);
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
    } catch (err) {
      alert('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
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
          onClick={generateInfographicData}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-[#F8C846] px-4 py-2 text-sm font-black text-black hover:bg-[#F8C846]/80 disabled:opacity-50"
        >
          {loading ? 'جاري التوليد عبر AI...' : '✨ توليد بيانات الإنفوجرافيك'}
        </button>
        
        <button
          onClick={viewInfographic}
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/50 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
        >
          👁️ عرض الإنفوجرافيك المولد
        </button>
      </div>
    </div>
  );
}
