'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database, ExternalLink, FileText, KeyRound, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

type TeamOption = {
  id: string;
  name: string;
  code: string;
};

type SeedResponse = {
  success?: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  count?: number;
  deletedCuratedReports?: number;
  error?: string;
  message?: string;
};

type GroupAStatusResponse = {
  ok?: boolean;
  ready?: boolean;
  error?: string;
  missingTeamCodes?: string[];
  teams?: {
    id: string;
    name: string;
    code: string;
    group?: string | null;
    reportCount: number;
    curatedReportCount: number;
    hasGroupAReport: boolean;
    latestReport?: {
      title?: string | null;
      provider?: string | null;
      confidence?: string | null;
      publishedAt?: string | null;
    } | null;
  }[];
};

type ManualReportResponse = {
  success?: boolean;
  error?: string;
  report?: {
    id: string;
    title: string;
    team?: { name?: string | null; code?: string | null } | null;
  };
};

type ManualForm = {
  teamId: string;
  title: string;
  summary: string;
  body: string;
  confidence: string;
  tacticalTags: string;
  strengths: string;
  weaknesses: string;
};

function buildInitialManualForm(teamId = ''): ManualForm {
  return {
    teamId,
    title: '',
    summary: '',
    body: '',
    confidence: 'B',
    tacticalTags: '',
    strengths: '',
    weaknesses: '',
  };
}

function getResponseMessage(data: SeedResponse) {
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (data.success) {
    const parts = [
      typeof data.deletedCuratedReports === 'number' ? `deleted=${data.deletedCuratedReports}` : null,
      typeof data.created === 'number' ? `created=${data.created}` : null,
      typeof data.updated === 'number' ? `updated=${data.updated}` : null,
      typeof data.skipped === 'number' ? `skipped=${data.skipped}` : null,
      typeof data.count === 'number' ? `count=${data.count}` : null,
    ].filter(Boolean);

    return parts.length ? `تم التشغيل بنجاح: ${parts.join(' · ')}` : 'تم التشغيل بنجاح.';
  }

  return 'تم استلام رد غير متوقع من الخادم.';
}

function getStatusMessage(data: GroupAStatusResponse) {
  if (data.error) return data.error;
  if (data.ready) return 'تقارير المجموعة الأولى جاهزة للعرض لكل المنتخبات الأربعة.';
  const missing = data.missingTeamCodes?.length ? ` منتخبات غير موجودة: ${data.missingTeamCodes.join(', ')}.` : '';
  return `الفحص اكتمل، لكن بعض التقارير غير جاهزة بعد.${missing}`;
}

export default function TeamIntelligenceAdminDashboard({ teams, initialTeamId = '' }: { teams: TeamOption[]; initialTeamId?: string }) {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [reseedLoading, setReseedLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [manualError, setManualError] = useState('');
  const [lastResult, setLastResult] = useState<SeedResponse | null>(null);
  const [groupAStatus, setGroupAStatus] = useState<GroupAStatusResponse | null>(null);
  const [manualForm, setManualForm] = useState<ManualForm>(() => buildInitialManualForm(initialTeamId));

  const isBusy = loading || reseedLoading || statusLoading;

  const getOptionalAuthHeaders = () => {
    const trimmedSecret = secret.trim();
    return trimmedSecret ? { Authorization: `Bearer ${trimmedSecret}` } : undefined;
  };

  const runSeed = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    setLastResult(null);

    try {
      const res = await fetch('/api/admin/seed-team-intelligence', {
        method: 'POST',
        headers: getOptionalAuthHeaders(),
      });
      const data = await res.json() as SeedResponse;
      setLastResult(data);

      if (!res.ok) {
        setError(getResponseMessage(data));
        return;
      }

      setMessage(getResponseMessage(data));
    } catch (caughtError) {
      const fallbackMessage = caughtError instanceof Error ? caughtError.message : 'فشل تشغيل seed تقارير المنتخبات.';
      setError(fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  const reseedGroupA = async () => {
    const confirmed = window.confirm('سيتم حذف تقارير المجموعة الأولى المزروعة فقط ثم إعادة زراعتها. هل تريد المتابعة؟');
    if (!confirmed) return;

    setReseedLoading(true);
    setMessage('');
    setError('');
    setStatusMessage('');
    setStatusError('');
    setLastResult(null);
    setGroupAStatus(null);

    try {
      const res = await fetch('/api/admin/reseed-group-a-intelligence', {
        method: 'POST',
        headers: getOptionalAuthHeaders(),
      });
      const data = await res.json() as SeedResponse;
      setLastResult(data);

      if (!res.ok) {
        setError(getResponseMessage(data));
        return;
      }

      setMessage(`تمت إعادة زراعة المجموعة الأولى بنجاح. ${getResponseMessage(data)}`);
    } catch (caughtError) {
      const fallbackMessage = caughtError instanceof Error ? caughtError.message : 'فشل إعادة زراعة تقارير المجموعة الأولى.';
      setError(fallbackMessage);
    } finally {
      setReseedLoading(false);
    }
  };

  const checkGroupAStatus = async () => {
    setStatusLoading(true);
    setStatusMessage('');
    setStatusError('');
    setGroupAStatus(null);

    try {
      const res = await fetch('/api/admin/team-intelligence-status', {
        method: 'GET',
        headers: getOptionalAuthHeaders(),
      });
      const data = await res.json() as GroupAStatusResponse;
      setGroupAStatus(data);

      if (!res.ok) {
        setStatusError(getStatusMessage(data));
        return;
      }

      if (data.ready) setStatusMessage(getStatusMessage(data));
      else setStatusError(getStatusMessage(data));
    } catch (caughtError) {
      const fallbackMessage = caughtError instanceof Error ? caughtError.message : 'فشل فحص حالة تقارير المجموعة الأولى.';
      setStatusError(fallbackMessage);
    } finally {
      setStatusLoading(false);
    }
  };

  const updateManualForm = (field: keyof ManualForm, value: string) => {
    setManualForm((current) => ({ ...current, [field]: value }));
  };

  const createManualReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualLoading(true);
    setManualMessage('');
    setManualError('');

    try {
      const res = await fetch('/api/admin/team-intelligence-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(manualForm),
      });
      const data = await res.json() as ManualReportResponse;

      if (!res.ok || !data.success) {
        setManualError(data.error || 'فشل حفظ التقرير اليدوي.');
        return;
      }

      const teamName = data.report?.team?.name || 'المنتخب';
      setManualMessage(`تم حفظ تقرير يدوي جديد لـ ${teamName}.`);
      setManualForm(buildInitialManualForm(initialTeamId));
    } catch (caughtError) {
      const fallbackMessage = caughtError instanceof Error ? caughtError.message : 'فشل حفظ التقرير اليدوي.';
      setManualError(fallbackMessage);
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary">
                <Database size={16} /> TEAM INTELLIGENCE ADMIN
              </div>
              <h1 className="text-2xl font-black text-white md:text-3xl">إدارة تقارير المنتخبات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">
                شغّل seed تقارير TeamIntelligenceReport يدويًا، أو أضف تقريرًا تحليليًا يدويًا من لوحة الإدارة.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">
                مركز التحليل <ArrowRight size={15} />
              </Link>
              <Link href="/intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">
                Intelligence Hub <Sparkles size={15} />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">
            صفحة محمية للأدمن. يمكنك تشغيل seed بجلسة الأدمن الحالية، أو بإدخال <code className="rounded bg-black/25 px-1 text-yellow-200">ADMIN_CRON_SECRET</code> عند التشغيل من خارج لوحة الإدارة.
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
              <KeyRound size={20} className="text-primary" /> تشغيل Seed يدوي
            </h2>

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-500">ADMIN_CRON_SECRET اختياري</span>
                <input
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="اتركه فارغًا إذا كنت مسجل دخول كأدمن"
                  className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                />
              </label>
              <div className="grid gap-3 xl:grid-cols-3">
                <button
                  type="button"
                  onClick={runSeed}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'جاري التشغيل...' : 'تشغيل seed'} <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={reseedGroupA}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-5 py-3 font-black text-yellow-100 hover:border-yellow-300/40 hover:bg-yellow-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reseedLoading ? 'جاري إعادة الزراعة...' : 'إعادة زراعة المجموعة الأولى'} <RefreshCw size={17} className={reseedLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={checkGroupAStatus}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {statusLoading ? 'جاري الفحص...' : 'فحص حالة المجموعة الأولى'} <Database size={17} className={statusLoading ? 'animate-pulse' : ''} />
                </button>
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success">
                <CheckCircle2 className="ml-2 inline" size={16} />{message}
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger">
                <ShieldAlert className="ml-2 inline" size={16} />{error}
              </div>
            )}

            {statusMessage && (
              <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success">
                <CheckCircle2 className="ml-2 inline" size={16} />{statusMessage}
              </div>
            )}

            {statusError && (
              <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger">
                <ShieldAlert className="ml-2 inline" size={16} />{statusError}
              </div>
            )}

            {groupAStatus?.teams?.length ? (
              <div className="mt-5 grid gap-3">
                {groupAStatus.teams.map((team) => (
                  <div key={team.id} className={`rounded-2xl border p-4 ${team.hasGroupAReport ? 'border-success/20 bg-success/10' : 'border-danger/20 bg-danger/10'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{team.name} — {team.code}</div>
                        <div className="mt-1 text-xs text-gray-400">كل التقارير: {team.reportCount} · تقارير المجموعة الأولى: {team.curatedReportCount}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/asset/${team.id}`} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white hover:border-primary/40 hover:text-primary">
                          فتح صفحة المنتخب <ExternalLink size={12} />
                        </Link>
                        <span className={`rounded-xl px-3 py-1 text-xs font-black ${team.hasGroupAReport ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                          {team.hasGroupAReport ? 'جاهز' : 'غير جاهز'}
                        </span>
                      </div>
                    </div>
                    {team.latestReport?.title && <div className="mt-3 text-xs leading-6 text-gray-300">آخر تقرير: {team.latestReport.title}</div>}
                  </div>
                ))}
              </div>
            ) : null}

            {lastResult && (
              <pre className="mt-5 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-6 text-gray-300">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            )}
          </section>

          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
              <FileText size={20} className="text-primary" /> إضافة تقرير يدوي
            </h2>

            <form className="space-y-4" onSubmit={createManualReport}>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-500">المنتخب</span>
                <select
                  value={manualForm.teamId}
                  onChange={(event) => updateManualForm('teamId', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  required
                >
                  <option value="">اختر المنتخب</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name} — {team.code}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-500">عنوان التقرير</span>
                <input
                  value={manualForm.title}
                  onChange={(event) => updateManualForm('title', event.target.value)}
                  placeholder="مثال: قراءة تكتيكية محدثة قبل البطولة"
                  className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-500">الملخص</span>
                <textarea
                  value={manualForm.summary}
                  onChange={(event) => updateManualForm('summary', event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-gray-500">المحتوى التفصيلي</span>
                <textarea
                  value={manualForm.body}
                  onChange={(event) => updateManualForm('body', event.target.value)}
                  placeholder="تحليل أعمق: نقاط قوة، نقاط ضعف، أسلوب لعب، مخاطر السوق..."
                  className="min-h-32 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-500">درجة الثقة</span>
                  <select
                    value={manualForm.confidence}
                    onChange={(event) => updateManualForm('confidence', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-500">وسوم تكتيكية</span>
                  <input
                    value={manualForm.tacticalTags}
                    onChange={(event) => updateManualForm('tacticalTags', event.target.value)}
                    placeholder="pressing, transition, set-pieces"
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-500">نقاط القوة</span>
                  <input
                    value={manualForm.strengths}
                    onChange={(event) => updateManualForm('strengths', event.target.value)}
                    placeholder="الهجمات المرتدة, الخبرة"
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-gray-500">نقاط الضعف</span>
                  <input
                    value={manualForm.weaknesses}
                    onChange={(event) => updateManualForm('weaknesses', event.target.value)}
                    placeholder="بطء التحول الدفاعي, قلة العمق"
                    className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={manualLoading || !manualForm.teamId || !manualForm.title.trim() || !manualForm.summary.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {manualLoading ? 'جاري الحفظ...' : 'حفظ التقرير اليدوي'}
              </button>
            </form>

            {manualMessage && (
              <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success">
                <CheckCircle2 className="ml-2 inline" size={16} />{manualMessage}
              </div>
            )}

            {manualError && (
              <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger">
                <ShieldAlert className="ml-2 inline" size={16} />{manualError}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
