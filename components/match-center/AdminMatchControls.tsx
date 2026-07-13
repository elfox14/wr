'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Message = { type: 'success' | 'error'; text: string };

function articleErrorMessage(code: string) {
  if (code.includes('MATCH_NOT_FOUND')) return 'تعذر العثور على المباراة.';
  if (code.includes('MATCH_NOT_FINAL')) return 'لا يمكن التوليد قبل انتهاء المباراة واعتماد النتيجة.';
  if (code.includes('VERIFIED_SNAPSHOT_NOT_FOUND')) return 'لا توجد لقطة إحصائية نهائية موثقة لهذه المباراة.';
  if (code.includes('INSUFFICIENT_VERIFIED_STATS')) return 'الإحصاءات الموثقة غير كافية.';
  return 'تعذر إكمال العملية الآن. راجع استجابة الخادم.';
}

export default function AdminMatchControls({ matchId }: { matchId: string }) {
  const [infographicLoading, setInfographicLoading] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [articleMessage, setArticleMessage] = useState<Message | null>(null);
  const [infographicMessage, setInfographicMessage] = useState<Message | null>(null);
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
      setArticleMessage({ type: 'error', text: 'تعذر الاتصال بالخادم.' });
    } finally {
      setArticleLoading(false);
    }
  };

  const collectVerifiedHeatmaps = async () => {
    if (heatmapLoading) return;
    setHeatmapLoading(true);
    setInfographicMessage(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/extras-snapshot?timeoutMs=60000`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const heatmaps = Number(data?.counts?.playerHeatmaps || 0);
      const points = Number(data?.counts?.heatmapPoints || 0);
      if (!res.ok || !data.ok) {
        setInfographicMessage({ type: 'error', text: String(data.error || 'تعذر جلب بيانات TheStats الكاملة.') });
        return;
      }
      if (!heatmaps || !points) {
        const diagnostics = data?.heatmapDiagnostics || {};
        const codes = diagnostics.failureCodes || {};
        const reason = Number(diagnostics.requestedPlayers || 0) === 0
          ? 'لم نجد معرفات لاعبين مشاركين صالحة لطلب الخرائط.'
          : Number(codes['429'] || codes.RATE_LIMITED || 0) > 0
            ? 'وصل المزود إلى حد الطلبات. أعد المحاولة بعد فترة.'
            : Number(codes['404'] || codes.NOT_FOUND || 0) > 0
              ? 'المزود لا يوفّر endpoint الخريطة لهذه المباراة أو هؤلاء اللاعبين.'
              : Number(codes.EMPTY_HEATMAP || 0) > 0
                ? 'المزود أعاد استجابات ناجحة بلا نقاط تمركز، ما يعني أن التغطية غير متاحة لهذه المباراة.'
                : 'لم يُرجع المزود نقاط خرائط حرارية صالحة.';
        setInfographicMessage({ type: 'error', text: `${reason} (طُلبت ${Number(diagnostics.requestedPlayers || 0).toLocaleString('ar-EG')} خريطة، المتاح ${heatmaps.toLocaleString('ar-EG')}).` });
        return;
      }
      setInfographicMessage({ type: 'success', text: `تم حفظ ${heatmaps.toLocaleString('ar-EG')} خريطة حرارية موثقة بإجمالي ${points.toLocaleString('ar-EG')} نقطة.` });
      router.refresh();
    } catch {
      setInfographicMessage({ type: 'error', text: 'تعذر الاتصال بالخادم أثناء جلب الخرائط.' });
    } finally {
      setHeatmapLoading(false);
    }
  };

  const generateInfographicData = async () => {
    if (infographicLoading) return;
    setInfographicLoading(true);
    setInfographicMessage(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/generate-infographic`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setInfographicMessage({ type: 'error', text: articleErrorMessage(String(data.error || res.status)) });
        return;
      }
      setInfographicMessage({ type: 'success', text: 'تم إنشاء مسودة الإنفوجرافيك من Snapshot الموثق. عاينها ثم اعتمدها.' });
      router.refresh();
    } catch {
      setInfographicMessage({ type: 'error', text: 'تعذر الاتصال بالخادم.' });
    } finally {
      setInfographicLoading(false);
    }
  };

  const approveInfographic = async () => {
    if (approvalLoading) return;
    setApprovalLoading(true);
    setInfographicMessage(null);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/infographic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const code = String(data.error || res.status);
        setInfographicMessage({ type: 'error', text: code.includes('VERIFIED_INFOGRAPHIC_REQUIRED') ? 'ولّد مسودة موثقة أولًا قبل الاعتماد.' : articleErrorMessage(code) });
        return;
      }
      setInfographicMessage({ type: 'success', text: 'تم اعتماد الإنفوجرافيك وأصبح ظاهرًا في صفحة المباراة.' });
      router.refresh();
    } catch {
      setInfographicMessage({ type: 'error', text: 'تعذر الاتصال بالخادم.' });
    } finally {
      setApprovalLoading(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 p-4" dir="rtl">
      <h3 className="mb-3 text-lg font-black text-white"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#F8C846]" />أدوات الإدارة</h3>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={generateArticle} disabled={articleLoading} aria-busy={articleLoading} className="rounded-xl bg-[#18E58F] px-4 py-2 text-sm font-black text-black transition hover:bg-[#18E58F]/80 disabled:cursor-wait disabled:opacity-60">
          {articleLoading ? 'جاري توليد المقال…' : 'توليد مقال تحليلي'}
        </button>
        <button type="button" onClick={collectVerifiedHeatmaps} disabled={heatmapLoading} className="rounded-xl border border-[#0FF0FC]/30 bg-[#0FF0FC]/10 px-4 py-2 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC]/20 disabled:opacity-50">
          {heatmapLoading ? 'جاري جلب خرائط اللاعبين…' : 'جلب الخرائط الحرارية الموثقة'}
        </button>
        <button type="button" onClick={generateInfographicData} disabled={infographicLoading} className="rounded-xl bg-[#F8C846] px-4 py-2 text-sm font-black text-black hover:bg-[#F8C846]/80 disabled:opacity-50">
          {infographicLoading ? 'جاري تجميع البيانات…' : 'إنشاء إنفوجرافيك موثّق'}
        </button>
        <button type="button" onClick={() => window.open(`/match-center/${matchId}/infographic`, '_blank')} className="rounded-xl border border-white/20 bg-black/50 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
          معاينة الإنفوجرافيك
        </button>
        <button type="button" onClick={approveInfographic} disabled={approvalLoading} className="rounded-xl border border-[#18E58F]/30 bg-[#18E58F]/10 px-4 py-2 text-sm font-black text-[#18E58F] hover:bg-[#18E58F]/20 disabled:opacity-50">
          {approvalLoading ? 'جاري الاعتماد…' : 'اعتماد الإنفوجرافيك'}
        </button>
      </div>

      {[articleMessage, infographicMessage].filter(Boolean).map((message, index) => (
        <p key={index} role={message!.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${message!.type === 'error' ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
          {message!.text}
        </p>
      ))}
      <p className="mt-3 text-xs font-bold text-slate-300">المقال والإنفوجرافيك لا يظهران للجمهور قبل الاعتماد التحريري.</p>
    </div>
  );
}
