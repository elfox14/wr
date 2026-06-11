'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database, ExternalLink, FileText, KeyRound, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

type TeamOption = { id: string; name: string; code: string };

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

type GroupKey = 'A' | 'B' | 'C' | 'D' | 'E';

type GroupStatusResponse = {
  ok?: boolean;
  group?: GroupKey;
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
    hasCuratedReport: boolean;
    hasGroupAReport?: boolean;
    latestReport?: { title?: string | null; provider?: string | null; confidence?: string | null; publishedAt?: string | null } | null;
  }[];
};

type ManualReportResponse = { success?: boolean; error?: string; report?: { id: string; title: string; team?: { name?: string | null; code?: string | null } | null } };

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

const CARD_SECTION_TITLES = [
  'بطاقة المنتخب',
  'ملخص تنفيذي موثق',
  'القوة الهجومية',
  'القوة الدفاعية',
  'وسط الملعب والتحكم',
  'الكرات الثابتة',
  'أسماء بارزة في القائمة',
  'معلومات غير متوفرة',
  'سجل المصادر',
] as const;

type CardSectionTitle = typeof CARD_SECTION_TITLES[number];

type CardSourceForm = {
  teamId: string;
  title: string;
  summary: string;
  confidence: string;
  sourceName: string;
  sourceUrl: string;
  sourceCategory: string;
  tacticalTags: string;
  strengths: string;
  weaknesses: string;
  sections: Record<CardSectionTitle, string>;
};

function buildInitialManualForm(teamId = ''): ManualForm {
  return { teamId, title: '', summary: '', body: '', confidence: 'B', tacticalTags: '', strengths: '', weaknesses: '' };
}

function buildInitialCardSourceForm(teamId = ''): CardSourceForm {
  return {
    teamId,
    title: '',
    summary: '',
    confidence: 'B',
    sourceName: 'Sports Reference / Stathead / FBref subscription',
    sourceUrl: '',
    sourceCategory: 'stats',
    tacticalTags: '',
    strengths: '',
    weaknesses: '',
    sections: CARD_SECTION_TITLES.reduce((acc, title) => ({ ...acc, [title]: '' }), {} as Record<CardSectionTitle, string>),
  };
}

function getGroupName(group: GroupKey) {
  if (group === 'A') return 'المجموعة الأولى';
  if (group === 'B') return 'المجموعة الثانية';
  if (group === 'C') return 'المجموعة الثالثة';
  if (group === 'D') return 'المجموعة الرابعة';
  return 'المجموعة الخامسة';
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

function getStatusMessage(data: GroupStatusResponse, fallbackGroup: GroupKey) {
  if (data.error) return data.error;
  const groupName = getGroupName(data.group || fallbackGroup);
  if (data.ready) return `تقارير ${groupName} جاهزة للعرض لكل المنتخبات الأربعة.`;
  const missing = data.missingTeamCodes?.length ? ` منتخبات غير موجودة: ${data.missingTeamCodes.join(', ')}.` : '';
  return `الفحص اكتمل، لكن بعض تقارير ${groupName} غير جاهزة بعد.${missing}`;
}

export default function TeamIntelligenceAdminDashboard({ teams, initialTeamId = '' }: { teams: TeamOption[]; initialTeamId?: string }) {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [reseedLoadingGroup, setReseedLoadingGroup] = useState<GroupKey | null>(null);
  const [statusLoadingGroup, setStatusLoadingGroup] = useState<GroupKey | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [manualError, setManualError] = useState('');
  const [cardMessage, setCardMessage] = useState('');
  const [cardError, setCardError] = useState('');
  const [lastResult, setLastResult] = useState<SeedResponse | null>(null);
  const [groupStatus, setGroupStatus] = useState<GroupStatusResponse | null>(null);
  const [manualForm, setManualForm] = useState<ManualForm>(() => buildInitialManualForm(initialTeamId));
  const [cardForm, setCardForm] = useState<CardSourceForm>(() => buildInitialCardSourceForm(initialTeamId));

  const isBusy = loading || Boolean(reseedLoadingGroup) || Boolean(statusLoadingGroup);

  const getOptionalAuthHeaders = () => {
    const trimmedSecret = secret.trim();
    return trimmedSecret ? { Authorization: `Bearer ${trimmedSecret}` } : undefined;
  };

  const resetRunMessages = () => {
    setMessage('');
    setError('');
    setStatusMessage('');
    setStatusError('');
    setLastResult(null);
    setGroupStatus(null);
  };

  const runSeed = async () => {
    setLoading(true);
    resetRunMessages();
    try {
      const res = await fetch('/api/admin/seed-team-intelligence', { method: 'POST', headers: getOptionalAuthHeaders() });
      const data = await res.json() as SeedResponse;
      setLastResult(data);
      if (!res.ok) {
        setError(getResponseMessage(data));
        return;
      }
      setMessage(getResponseMessage(data));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'فشل تشغيل seed تقارير المنتخبات.');
    } finally {
      setLoading(false);
    }
  };

  const reseedGroup = async (group: GroupKey) => {
    const groupName = getGroupName(group);
    const confirmed = window.confirm(`سيتم حذف تقارير ${groupName} المزروعة فقط ثم إعادة زراعتها. هل تريد المتابعة؟`);
    if (!confirmed) return;
    setReseedLoadingGroup(group);
    resetRunMessages();
    try {
      const res = await fetch(`/api/admin/reseed-group-${group.toLowerCase()}-intelligence`, { method: 'POST', headers: getOptionalAuthHeaders() });
      const data = await res.json() as SeedResponse;
      setLastResult(data);
      if (!res.ok) {
        setError(getResponseMessage(data));
        return;
      }
      setMessage(`تمت إعادة زراعة ${groupName} بنجاح. ${getResponseMessage(data)}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `فشل إعادة زراعة تقارير ${groupName}.`);
    } finally {
      setReseedLoadingGroup(null);
    }
  };

  const checkGroupStatus = async (group: GroupKey) => {
    setStatusLoadingGroup(group);
    setStatusMessage('');
    setStatusError('');
    setGroupStatus(null);
    try {
      const res = await fetch(`/api/admin/team-intelligence-status?group=${group}`, { method: 'GET', headers: getOptionalAuthHeaders() });
      const data = await res.json() as GroupStatusResponse;
      setGroupStatus(data);
      if (!res.ok) {
        setStatusError(getStatusMessage(data, group));
        return;
      }
      if (data.ready) setStatusMessage(getStatusMessage(data, group));
      else setStatusError(getStatusMessage(data, group));
    } catch (caughtError) {
      setStatusError(caughtError instanceof Error ? caughtError.message : `فشل فحص حالة تقارير ${getGroupName(group)}.`);
    } finally {
      setStatusLoadingGroup(null);
    }
  };

  const updateManualForm = (field: keyof ManualForm, value: string) => {
    setManualForm((current) => ({ ...current, [field]: value }));
  };

  const updateCardForm = (field: keyof Omit<CardSourceForm, 'sections'>, value: string) => {
    setCardForm((current) => ({ ...current, [field]: value }));
  };

  const updateCardSection = (section: CardSectionTitle, value: string) => {
    setCardForm((current) => ({ ...current, sections: { ...current.sections, [section]: value } }));
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
      setManualError(caughtError instanceof Error ? caughtError.message : 'فشل حفظ التقرير اليدوي.');
    } finally {
      setManualLoading(false);
    }
  };

  const createCardSourceReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCardLoading(true);
    setCardMessage('');
    setCardError('');
    try {
      const res = await fetch('/api/admin/team-card-source-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cardForm),
      });
      const data = await res.json() as ManualReportResponse;
      if (!res.ok || !data.success) {
        setCardError(data.error || 'فشل حفظ تقرير الكروت من المصدر.');
        return;
      }
      const teamName = data.report?.team?.name || 'المنتخب';
      setCardMessage(`تم حفظ تقرير كروت موثق لـ ${teamName}.`);
      setCardForm(buildInitialCardSourceForm(initialTeamId));
    } catch (caughtError) {
      setCardError(caughtError instanceof Error ? caughtError.message : 'فشل حفظ تقرير الكروت من المصدر.');
    } finally {
      setCardLoading(false);
    }
  };

  const renderGroupControls = (group: GroupKey) => {
    const groupName = getGroupName(group);
    return (
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-2">
        <button type="button" onClick={() => reseedGroup(group)} disabled={isBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-5 py-3 font-black text-yellow-100 hover:border-yellow-300/40 hover:bg-yellow-300/15 disabled:cursor-not-allowed disabled:opacity-50">
          {reseedLoadingGroup === group ? 'جاري إعادة الزراعة...' : `إعادة زراعة ${groupName}`} <RefreshCw size={17} className={reseedLoadingGroup === group ? 'animate-spin' : ''} />
        </button>
        <button type="button" onClick={() => checkGroupStatus(group)} disabled={isBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
          {statusLoadingGroup === group ? 'جاري الفحص...' : `فحص حالة ${groupName}`} <Database size={17} className={statusLoadingGroup === group ? 'animate-pulse' : ''} />
        </button>
      </div>
    );
  };

  const renderTeamSelect = (value: string, onChange: (value: string) => void) => (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-gray-500">المنتخب</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required>
        <option value="">اختر المنتخب</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name} — {team.code}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary"><Database size={16} /> TEAM INTELLIGENCE ADMIN</div>
              <h1 className="text-2xl font-black text-white md:text-3xl">إدارة تقارير المنتخبات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">شغّل seed تقارير TeamIntelligenceReport يدويًا، أو أعد زراعة تقارير المجموعات، أو أضف تقريرًا تحليليًا من مصدر موثق إلى كروت صفحة المنتخب.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/source-automation" className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:border-primary/50">أتمتة المصادر <Database size={15} /></Link>
              <Link href="/admin/source-review" className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm font-black text-yellow-100 hover:border-yellow-300/40">مراجعة المصادر <ShieldAlert size={15} /></Link>
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">مركز التحليل <ArrowRight size={15} /></Link>
              <Link href="/intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">Intelligence Hub <Sparkles size={15} /></Link>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">صفحة محمية للأدمن. يمكنك تشغيل seed بجلسة الأدمن الحالية، أو بإدخال <code className="rounded bg-black/25 px-1 text-yellow-200">ADMIN_CRON_SECRET</code> عند التشغيل من خارج لوحة الإدارة.</div>
          <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/[0.04] p-4">
            <div className="mb-3 text-sm font-black text-white">مصادر التحليل والقوالب</div>
            <div className="grid gap-3 md:grid-cols-3">
              <a href="/api/admin/sports-reference-status" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-white hover:border-primary/40 hover:text-primary">حالة Sports Reference <ExternalLink size={13} /></a>
              <a href="/api/admin/sports-reference-templates" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-white hover:border-primary/40 hover:text-primary">قوالب Sports Reference <ExternalLink size={13} /></a>
              <a href="/api/admin/athletic-editorial-templates" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-white hover:border-primary/40 hover:text-primary">قوالب The Athletic <ExternalLink size={13} /></a>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><KeyRound size={20} className="text-primary" /> تشغيل Seed يدوي</h2>
            <div className="grid gap-4">
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">ADMIN_CRON_SECRET اختياري</span><input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="اتركه فارغًا إذا كنت مسجل دخول كأدمن" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              <button type="button" onClick={runSeed} disabled={isBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'جاري التشغيل...' : 'تشغيل seed'} <RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
              {renderGroupControls('A')}
              {renderGroupControls('B')}
              {renderGroupControls('C')}
              {renderGroupControls('D')}
              {renderGroupControls('E')}
            </div>

            {message && <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><ShieldAlert className="ml-2 inline" size={16} />{error}</div>}
            {statusMessage && <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{statusMessage}</div>}
            {statusError && <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><ShieldAlert className="ml-2 inline" size={16} />{statusError}</div>}

            {groupStatus?.teams?.length ? (
              <div className="mt-5 grid gap-3">
                {groupStatus.teams.map((team) => {
                  const isReady = team.hasCuratedReport || team.hasGroupAReport;
                  return (
                    <div key={team.id} className={`rounded-2xl border p-4 ${isReady ? 'border-success/20 bg-success/10' : 'border-danger/20 bg-danger/10'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-black text-white">{team.name} — {team.code}</div><div className="mt-1 text-xs text-gray-400">كل التقارير: {team.reportCount} · تقارير المجموعة {groupStatus.group || team.group || '—'}: {team.curatedReportCount}</div></div><div className="flex flex-wrap items-center gap-2"><Link href={`/asset/${team.id}`} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-1 text-xs font-black text-white hover:border-primary/40 hover:text-primary">فتح صفحة المنتخب <ExternalLink size={12} /></Link><span className={`rounded-xl px-3 py-1 text-xs font-black ${isReady ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{isReady ? 'جاهز' : 'غير جاهز'}</span></div></div>
                      {team.latestReport?.title && <div className="mt-3 text-xs leading-6 text-gray-300">آخر تقرير: {team.latestReport.title}</div>}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {lastResult && <pre className="mt-5 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-6 text-gray-300">{JSON.stringify(lastResult, null, 2)}</pre>}
          </section>

          <section className="rounded-3xl border border-primary/10 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Sparkles size={20} className="text-primary" /> إضافة تقرير كروت من مصدر</h2>
            <p className="mb-4 text-xs leading-6 text-gray-500">استخدم هذا النموذج مع Sports Reference / FBref / Stathead / The Athletic / Reuters. أي كارت تتركه فارغًا سيظهر كـ “غير متوفر في المصادر”.</p>
            <form className="space-y-4" onSubmit={createCardSourceReport}>
              {renderTeamSelect(cardForm.teamId, (value) => updateCardForm('teamId', value))}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">عنوان التقرير</span><input value={cardForm.title} onChange={(event) => updateCardForm('title', event.target.value)} placeholder="مثال: تحديث Sports Reference — المكسيك" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">درجة الثقة</span><select value={cardForm.confidence} onChange={(event) => updateCardForm('confidence', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label>
              </div>
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">الملخص</span><textarea value={cardForm.summary} onChange={(event) => updateCardForm('summary', event.target.value)} className="min-h-20 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">اسم المصدر</span><input value={cardForm.sourceName} onChange={(event) => updateCardForm('sourceName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">رابط المصدر</span><input value={cardForm.sourceUrl} onChange={(event) => updateCardForm('sourceUrl', event.target.value)} placeholder="https://..." className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نوع المصدر</span><select value={cardForm.sourceCategory} onChange={(event) => updateCardForm('sourceCategory', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="stats">stats</option><option value="editorial">editorial</option><option value="official">official</option><option value="analysis">analysis</option><option value="manual">manual</option></select></label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">وسوم تكتيكية</span><input value={cardForm.tacticalTags} onChange={(event) => updateCardForm('tacticalTags', event.target.value)} placeholder="هجوم, دفاع, كرات ثابتة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط القوة</span><input value={cardForm.strengths} onChange={(event) => updateCardForm('strengths', event.target.value)} placeholder="افصل بينها بفاصلة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              </div>
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط تحتاج متابعة</span><input value={cardForm.weaknesses} onChange={(event) => updateCardForm('weaknesses', event.target.value)} placeholder="افصل بينها بفاصلة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              <div className="grid gap-3">
                {CARD_SECTION_TITLES.map((section) => (
                  <label key={section} className="block rounded-2xl border border-white/5 bg-black/20 p-3">
                    <span className="mb-2 block text-xs font-black text-primary">{section}</span>
                    <textarea value={cardForm.sections[section]} onChange={(event) => updateCardSection(section, event.target.value)} placeholder="اتركه فارغًا إذا لم تتوفر المعلومة في المصدر" className="min-h-20 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none focus:border-primary" />
                  </label>
                ))}
              </div>
              <button type="submit" disabled={cardLoading || !cardForm.teamId || !cardForm.title.trim() || !cardForm.summary.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{cardLoading ? 'جاري حفظ تقرير الكروت...' : 'حفظ تقرير الكروت من المصدر'}</button>
            </form>
            {cardMessage && <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{cardMessage}</div>}
            {cardError && <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><ShieldAlert className="ml-2 inline" size={16} />{cardError}</div>}
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><FileText size={20} className="text-primary" /> إضافة تقرير يدوي عام</h2>
          <form className="space-y-4" onSubmit={createManualReport}>
            {renderTeamSelect(manualForm.teamId, (value) => updateManualForm('teamId', value))}
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">عنوان التقرير</span><input value={manualForm.title} onChange={(event) => updateManualForm('title', event.target.value)} placeholder="مثال: قراءة تكتيكية محدثة قبل البطولة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">الملخص</span><textarea value={manualForm.summary} onChange={(event) => updateManualForm('summary', event.target.value)} className="min-h-24 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">المحتوى التفصيلي</span><textarea value={manualForm.body} onChange={(event) => updateManualForm('body', event.target.value)} placeholder="تحليل أعمق: نقاط قوة، نقاط ضعف، أسلوب لعب..." className="min-h-32 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
            <div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">درجة الثقة</span><select value={manualForm.confidence} onChange={(event) => updateManualForm('confidence', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label><label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">وسوم تكتيكية</span><input value={manualForm.tacticalTags} onChange={(event) => updateManualForm('tacticalTags', event.target.value)} placeholder="pressing, transition, set-pieces" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label></div>
            <div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط القوة</span><input value={manualForm.strengths} onChange={(event) => updateManualForm('strengths', event.target.value)} placeholder="الهجمات المرتدة, الخبرة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label><label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط الضعف</span><input value={manualForm.weaknesses} onChange={(event) => updateManualForm('weaknesses', event.target.value)} placeholder="بطء التحول الدفاعي, قلة العمق" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label></div>
            <button type="submit" disabled={manualLoading || !manualForm.teamId || !manualForm.title.trim() || !manualForm.summary.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{manualLoading ? 'جاري الحفظ...' : 'حفظ التقرير اليدوي'}</button>
          </form>
          {manualMessage && <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{manualMessage}</div>}
          {manualError && <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><ShieldAlert className="ml-2 inline" size={16} />{manualError}</div>}
        </section>
      </main>
    </div>
  );
}
