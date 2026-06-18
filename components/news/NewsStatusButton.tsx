'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CheckCircle2, FileText, Loader2 } from 'lucide-react';

type NewsStatus = 'draft' | 'published' | 'archived';

type Props = {
  id: string;
  currentStatus?: string | null;
  targetStatus?: NewsStatus;
  compact?: boolean;
};

function actionCopy(targetStatus: NewsStatus) {
  if (targetStatus === 'published') {
    return {
      label: 'نشر المسودة',
      confirmMessage: 'هل تريد نشر هذا المقال الآن؟ سيظهر للزوار وفي صفحة الأخبار.',
      icon: 'publish',
    };
  }
  if (targetStatus === 'archived') {
    return {
      label: 'أرشفة المقال',
      confirmMessage: 'هل تريد أرشفة هذا المقال؟ لن يظهر للزوار أو في الأخبار العامة.',
      icon: 'archive',
    };
  }
  return {
    label: 'تحويل لمسودة',
    confirmMessage: 'هل تريد تحويل هذا المقال إلى مسودة؟ لن يظهر للزوار.',
    icon: 'draft',
  };
}

export default function NewsStatusButton({ id, currentStatus = 'draft', targetStatus = 'published', compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = actionCopy(targetStatus);

  async function updateStatus() {
    if (currentStatus === targetStatus) return;
    if (!window.confirm(copy.confirmMessage)) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/news-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: targetStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'تعذر تحديث حالة المقال.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة المقال.');
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus === targetStatus) return null;

  const Icon = copy.icon === 'archive' ? Archive : copy.icon === 'draft' ? FileText : CheckCircle2;

  return (
    <div className={compact ? 'inline-flex flex-col gap-1' : 'inline-flex flex-col gap-1'}>
      <button
        type="button"
        onClick={updateStatus}
        disabled={loading}
        className={compact
          ? 'inline-flex items-center gap-1 rounded-lg border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-1 text-[10px] font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black disabled:cursor-not-allowed disabled:opacity-60'
          : targetStatus === 'archived'
            ? 'inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-xs font-black text-red-200 transition hover:bg-red-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-60'
            : 'inline-flex items-center gap-2 rounded-xl bg-[#FFD700] px-4 py-2.5 text-xs font-black text-black transition hover:bg-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-60'}
      >
        {loading ? <Loader2 size={compact ? 12 : 14} className="animate-spin" /> : <Icon size={compact ? 12 : 14} />}
        {loading ? 'جارٍ التحديث...' : copy.label}
      </button>
      {error && <span className="text-[10px] font-bold text-red-300">{error}</span>}
    </div>
  );
}
