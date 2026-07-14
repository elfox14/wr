'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Loader2, RefreshCcw, ShieldCheck, CircleAlert } from 'lucide-react';

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

type CoverageMetric = {
  covered: number;
  total: number;
  percent: number;
};

type HealthResponse = {
  ok?: boolean;
  complete?: { allVerifiedData?: boolean };
  tournament?: {
    expectedMatches?: number;
    confirmedCanonicalMatches?: number;
    finishedMatches?: number;
    duplicateRowsExcluded?: number;
  };
  coverage?: {
    confirmedFixtures?: CoverageMetric;
    finishedTeamStatistics?: CoverageMetric;
    finishedPlayerStatistics?: CoverageMetric;
    finishedEvents?: CoverageMetric;
  };
  missingMatches?: Array<{
    matchId: string;
    teams: string;
    missing: string[];
  }>;
  freshness?: {
    latestDataAt?: string | null;
    stalenessMinutes?: number | null;
  };
};

async function fetchStatisticsHealth() {
  const response = await fetch('/api/statistics-health', { cache: 'no-store', credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({ ok: false })) as HealthResponse;
  if (!response.ok) throw new Error('تعذر قراءة تقرير اكتمال الإحصاءات.');
  return payload;
}

const stageLabels: Record<string, string> = {
  round_of_32: 'دور الـ32',
  round_of_16: 'دور الـ16',
  quarter_finals: 'ربع النهائي',
  semi_finals: 'نصف النهائي',
  third_place: 'المركز الثالث',
  final: 'النهائي',
};

const nf = new Intl.NumberFormat('ar-EG');

export default function KnockoutSyncDashboard() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SyncResponse | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchStatisticsHealth()
      .then((payload) => { if (active) setHealth(payload); })
      .catch(() => { if (active) setHealth({ ok: false }); })
      .finally(() => { if (active) setHealthLoading(false); });
    return () => { active = false; };
  }, []);

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
      const freshHealth = await fetchStatisticsHealth().catch(() => null);
      if (freshHealth) setHealth(freshHealth);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">تغطية الإحصاءات الفعلية</h2>
            <p className="mt-1 text-xs font-bold text-gray-400">
              يقارن المباريات الموثقة مع اللقطات وإحصاءات اللاعبين والأحداث، بعد استبعاد سجلات المباريات المكررة.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${health?.complete?.allVerifiedData ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-300/15 text-amber-200'}`}>
            {healthLoading ? 'جاري الفحص...' : health?.complete?.allVerifiedData ? 'البيانات مكتملة' : 'تحتاج استكمالًا'}
          </span>
        </div>

        {health?.ok ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['المباريات المؤكدة', health.coverage?.confirmedFixtures],
                ['إحصاءات الفرق', health.coverage?.finishedTeamStatistics],
                ['إحصاءات اللاعبين', health.coverage?.finishedPlayerStatistics],
                ['الأحداث', health.coverage?.finishedEvents],
              ].map(([label, metric]) => {
                const value = metric as CoverageMetric | undefined;
                return (
                  <article key={String(label)} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
                    <p className="text-[11px] font-black text-gray-400">{String(label)}</p>
                    <p className="mt-2 text-xl font-black text-white">
                      {nf.format(value?.covered || 0)} <span className="text-xs text-gray-500">/ {nf.format(value?.total || 0)}</span>
                    </p>
                    <p className="mt-1 text-[10px] font-black text-[#0FF0FC]">{nf.format(value?.percent || 0)}%</p>
                  </article>
                );
              })}
            </div>
            {health.missingMatches?.length ? (
              <details className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10">
                <summary className="cursor-pointer px-4 py-3 text-sm font-black text-amber-100">
                  عرض المباريات التي ينقصها مصدر إحصائي ({nf.format(health.missingMatches.length)})
                </summary>
                <div className="space-y-2 border-t border-amber-300/15 p-3">
                  {health.missingMatches.slice(0, 8).map((match) => (
                    <a key={match.matchId} href={`/matches/${match.matchId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs font-bold text-white">
                      <span>{match.teams}</span>
                      <span className="text-amber-200">{match.missing.join(' · ')}</span>
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : !healthLoading ? (
          <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm font-bold text-red-100">
            تعذر تحميل تقرير التغطية الآن.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-xl font-black text-white">تحديث جميع الأدوار الإقصائية</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-gray-400">
              العدد المتوقع: 16 مباراة في دور الـ32، و8 في دور الـ16، و4 في ربع النهائي، ومباراتان في نصف النهائي، ثم مباراة المركز الثالث والنهائي.
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
            {succeeded ? <CheckCircle2 className="text-emerald-300" size={22} /> : <CircleAlert className="text-red-300" size={22} />}
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
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
