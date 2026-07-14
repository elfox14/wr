'use client';

import { useState } from 'react';
import { CheckCircle2, Database, Loader2, RefreshCcw, ShieldCheck, TriangleAlert } from 'lucide-react';

type StageCoverage = {
  stage: string;
  expected: number;
  persisted: number;
  complete: boolean;
};

type SyncResponse = {
  ok?: boolean;
  error?: string;
  durationMs?: number;
  result?: {
    requestedStagesComplete?: boolean;
    stageCoverage?: StageCoverage[];
  };
};

const stageLabels: Record<string, string> = {
  round_of_32: 'دور الـ32',
  round_of_16: 'دور الـ16',
  quarter_finals: 'ربع النهائي',
  semi_finals: 'نصف النهائي',
};

const nf = new Intl.NumberFormat('ar-EG');

export default function KnockoutSyncDashboard() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SyncResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  async function runSync() {
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);

    try {
      const request = await fetch('/api/cron/fifa-knockout-sync', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await request.json().catch(() => ({ ok: false, error: 'تعذر قراءة رد المزامنة.' })) as SyncResponse;
      setHttpStatus(request.status);
      setResponse(payload);
    } catch (error: unknown) {
      setResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'تعذر الاتصال بخدمة المزامنة.',
      });
    } finally {
      setLoading(false);
    }
  }

  const coverage = response?.result?.stageCoverage || [];
  const succeeded = Boolean(response?.ok);
  const complete = Boolean(response?.result?.requestedStagesComplete);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-emerald-300/20 bg-black/20 p-3 text-emerald-300">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">مزامنة آمنة من FIFA</h2>
            <p className="mt-1 text-sm font-bold leading-7 text-emerald-100/75">
              تضيف أو تحدّث مباريات الأدوار الإقصائية الموثقة فقط. لا تحذف المباريات ولا تنشئ مواجهة قبل تحديد طرفيها رسميًا.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-xl font-black text-white">تحديث دور الـ32 حتى نصف النهائي</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-gray-400">
              العدد المتوقع: 16 مباراة في دور الـ32، و8 في دور الـ16، و4 في ربع النهائي، ومباراتان في نصف النهائي.
            </p>
          </div>
          <button
            type="button"
            onClick={runSync}
            disabled={loading}
            className="inline-flex min-w-[230px] items-center justify-center gap-2 rounded-2xl bg-[#18E58F] px-5 py-3 text-sm font-black text-black transition hover:bg-[#4ef2aa] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={19} className="animate-spin" /> : <RefreshCcw size={19} />}
            {loading ? 'جاري التحديث...' : 'تحديث الأدوار الآن'}
          </button>
        </div>
      </section>

      {response ? (
        <section className={`rounded-3xl border p-5 ${succeeded ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-red-400/25 bg-red-400/10'}`}>
          <div className="mb-4 flex items-center gap-3">
            {succeeded ? <CheckCircle2 className="text-emerald-300" size={22} /> : <TriangleAlert className="text-red-300" size={22} />}
            <div>
              <h2 className="font-black text-white">{succeeded ? 'اكتملت عملية المزامنة' : 'تعذرت عملية المزامنة'}</h2>
              <p className="mt-1 text-xs font-bold text-gray-300">
                {httpStatus ? `HTTP ${httpStatus}` : 'خطأ اتصال'}
                {response.durationMs ? ` · ${nf.format(response.durationMs)} ms` : ''}
              </p>
            </div>
          </div>

          {response.error ? <p className="rounded-2xl border border-red-300/20 bg-black/25 p-4 text-sm font-bold text-red-100">{response.error}</p> : null}

          {coverage.length ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {coverage.map((stage) => (
                <article key={stage.stage} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center">
                  <p className="text-xs font-black text-gray-400">{stageLabels[stage.stage] || stage.stage}</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {nf.format(stage.persisted)} <span className="text-sm text-gray-500">/ {nf.format(stage.expected)}</span>
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${stage.complete ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-300/15 text-amber-200'}`}>
                    {stage.complete ? 'مكتمل' : 'غير مكتمل'}
                  </span>
                </article>
              ))}
            </div>
          ) : null}

          {succeeded && !complete ? (
            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold leading-7 text-amber-100">
              انتهى التشغيل، لكن أحد الأدوار ما زال ناقصًا. راجع تفاصيل JSON لمعرفة هل ينتظر فائزًا رسميًا أو موعدًا من المصدر.
            </p>
          ) : null}

          <details className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/35">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-white">عرض تفاصيل التشغيل</summary>
            <pre className="max-h-[520px] overflow-auto border-t border-white/10 p-4 text-left text-xs leading-6 text-[#0FF0FC]" dir="ltr">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-gray-400">
          <Database className="mx-auto mb-3 text-gray-500" size={28} />
          <p className="text-sm font-bold">اضغط زر التحديث لعرض تغطية كل دور من قاعدة الإنتاج.</p>
        </section>
      )}
    </div>
  );
}
