'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';

type SourceReviewActionsProps = {
  reportId: string;
};

export default function SourceReviewActions({ reportId }: SourceReviewActionsProps) {
  const [loadingAction, setLoadingAction] = useState<'approve' | 'dismiss' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const runAction = async (action: 'approve' | 'dismiss') => {
    const confirmed = action === 'dismiss'
      ? window.confirm('سيتم حذف تقرير المراجعة من قاعدة البيانات. هل تريد المتابعة؟')
      : window.confirm('سيتم اعتماد هذا التقرير وإزالة حالة NEEDS_REVIEW. هل تريد المتابعة؟');

    if (!confirmed) return;

    setLoadingAction(action);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`/api/admin/source-review/${reportId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json() as { success?: boolean; error?: string; status?: string };

      if (!res.ok || !data.success) {
        setError(data.error || 'فشل تنفيذ الإجراء.');
        return;
      }

      setMessage(action === 'approve' ? 'تم اعتماد التقرير.' : 'تم تجاهل التقرير.');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'فشل تنفيذ الإجراء.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => runAction('approve')}
        disabled={Boolean(loadingAction)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-xs font-black text-success hover:border-success/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingAction === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
        اعتماد التقرير
      </button>
      <button
        type="button"
        onClick={() => runAction('dismiss')}
        disabled={Boolean(loadingAction)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-black text-danger hover:border-danger/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingAction === 'dismiss' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        تجاهل المصدر
      </button>
      {message && <div className="sm:col-span-2 rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-xs font-bold text-success">{message}</div>}
      {error && <div className="sm:col-span-2 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</div>}
    </div>
  );
}
