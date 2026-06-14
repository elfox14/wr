'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database, FileText, ShieldAlert, Sparkles } from 'lucide-react';

type TeamOption = { id: string; name: string; code: string };

type ManualReportResponse = {
  success?: boolean;
  error?: string;
  report?: { id: string; title: string; team?: { name?: string | null; code?: string | null } | null };
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
    sourceName: 'Sports Reference / Stathead subscription',
    sourceUrl: '',
    sourceCategory: 'stats',
    tacticalTags: '',
    strengths: '',
    weaknesses: '',
    sections: CARD_SECTION_TITLES.reduce((acc, title) => ({ ...acc, [title]: '' }), {} as Record<CardSectionTitle, string>),
  };
}

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function TeamIntelligenceAdminDashboard({ teams, initialTeamId = '' }: { teams: TeamOption[]; initialTeamId?: string }) {
  const [manualForm, setManualForm] = useState<ManualForm>(() => buildInitialManualForm(initialTeamId));
  const [cardForm, setCardForm] = useState<CardSourceForm>(() => buildInitialCardSourceForm(initialTeamId));
  const [manualLoading, setManualLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [manualError, setManualError] = useState('');
  const [cardMessage, setCardMessage] = useState('');
  const [cardError, setCardError] = useState('');

  const renderTeamSelect = (value: string, onChange: (value: string) => void) => (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-gray-500">المنتخب</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required>
        <option value="">اختر المنتخب</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name} — {team.code}</option>)}
      </select>
    </label>
  );

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
      setManualMessage(`تم حفظ تقرير يدوي جديد لـ ${data.report?.team?.name || 'المنتخب'}.`);
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
      const payload = {
        ...cardForm,
        tacticalTags: splitCsv(cardForm.tacticalTags),
        strengths: splitCsv(cardForm.strengths),
        weaknesses: splitCsv(cardForm.weaknesses),
      };
      const res = await fetch('/api/admin/team-card-source-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as ManualReportResponse;
      if (!res.ok || !data.success) {
        setCardError(data.error || 'فشل حفظ تقرير الكروت من المصدر.');
        return;
      }
      setCardMessage(`تم حفظ تقرير كروت موثق لـ ${data.report?.team?.name || 'المنتخب'}.`);
      setCardForm(buildInitialCardSourceForm(initialTeamId));
    } catch (caughtError) {
      setCardError(caughtError instanceof Error ? caughtError.message : 'فشل حفظ تقرير الكروت من المصدر.');
    } finally {
      setCardLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary"><Database size={16} /> TEAM INTELLIGENCE ADMIN</div>
              <h1 className="text-2xl font-black text-white md:text-3xl">إدارة تقارير المنتخبات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">أضف تقارير يدوية أو تقارير كروت من مصادر موثقة. أي معلومة غير متوفرة اتركها فارغة لتظهر كـ “غير متوفر في المصادر”.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/source-automation" className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:border-primary/50">أتمتة المصادر <Database size={15} /></Link>
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">مركز التحليل <ArrowRight size={15} /></Link>
              <Link href="/intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">Intelligence Hub <Sparkles size={15} /></Link>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">تم حذف مسارات جلب واستيراد FBref. استخدم فقط الاستيراد اليدوي أو المصادر المصرح بها.</div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-primary/10 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Sparkles size={20} className="text-primary" /> إضافة تقرير كروت من مصدر</h2>
            <p className="mb-4 text-xs leading-6 text-gray-500">استخدم هذا النموذج مع Sports Reference / Stathead / The Athletic / Reuters / FIFA أو أي مصدر مصرح به.</p>
            <form className="space-y-4" onSubmit={createCardSourceReport}>
              {renderTeamSelect(cardForm.teamId, (value) => setCardForm((current) => ({ ...current, teamId: value })))}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">عنوان التقرير</span><input value={cardForm.title} onChange={(event) => setCardForm((current) => ({ ...current, title: event.target.value }))} placeholder="مثال: تحديث Sports Reference — المكسيك" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">درجة الثقة</span><select value={cardForm.confidence} onChange={(event) => setCardForm((current) => ({ ...current, confidence: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label>
              </div>
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">الملخص</span><textarea value={cardForm.summary} onChange={(event) => setCardForm((current) => ({ ...current, summary: event.target.value }))} className="min-h-20 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">اسم المصدر</span><input value={cardForm.sourceName} onChange={(event) => setCardForm((current) => ({ ...current, sourceName: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">رابط المصدر</span><input value={cardForm.sourceUrl} onChange={(event) => setCardForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://..." className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نوع المصدر</span><select value={cardForm.sourceCategory} onChange={(event) => setCardForm((current) => ({ ...current, sourceCategory: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="stats">stats</option><option value="editorial">editorial</option><option value="official">official</option><option value="analysis">analysis</option><option value="manual">manual</option></select></label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">وسوم تكتيكية</span><input value={cardForm.tacticalTags} onChange={(event) => setCardForm((current) => ({ ...current, tacticalTags: event.target.value }))} placeholder="هجوم, دفاع, كرات ثابتة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط القوة</span><input value={cardForm.strengths} onChange={(event) => setCardForm((current) => ({ ...current, strengths: event.target.value }))} placeholder="افصل بينها بفاصلة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط تحتاج متابعة</span><input value={cardForm.weaknesses} onChange={(event) => setCardForm((current) => ({ ...current, weaknesses: event.target.value }))} placeholder="افصل بينها بفاصلة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              </div>
              <div className="grid gap-3">
                {CARD_SECTION_TITLES.map((section) => (
                  <label key={section} className="block rounded-2xl border border-white/5 bg-black/20 p-3">
                    <span className="mb-2 block text-xs font-black text-primary">{section}</span>
                    <textarea value={cardForm.sections[section]} onChange={(event) => setCardForm((current) => ({ ...current, sections: { ...current.sections, [section]: event.target.value } }))} placeholder="اتركه فارغًا إذا لم تتوفر المعلومة في المصدر" className="min-h-20 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none focus:border-primary" />
                  </label>
                ))}
              </div>
              <button type="submit" disabled={cardLoading || !cardForm.teamId || !cardForm.title.trim() || !cardForm.summary.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{cardLoading ? 'جاري حفظ تقرير الكروت...' : 'حفظ تقرير الكروت من المصدر'}</button>
            </form>
            {cardMessage && <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{cardMessage}</div>}
            {cardError && <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><ShieldAlert className="ml-2 inline" size={16} />{cardError}</div>}
          </section>

          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><FileText size={20} className="text-primary" /> إضافة تقرير يدوي عام</h2>
            <form className="space-y-4" onSubmit={createManualReport}>
              {renderTeamSelect(manualForm.teamId, (value) => setManualForm((current) => ({ ...current, teamId: value })))}
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">عنوان التقرير</span><input value={manualForm.title} onChange={(event) => setManualForm((current) => ({ ...current, title: event.target.value }))} placeholder="مثال: قراءة تكتيكية محدثة قبل البطولة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">الملخص</span><textarea value={manualForm.summary} onChange={(event) => setManualForm((current) => ({ ...current, summary: event.target.value }))} className="min-h-24 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" required /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">المحتوى التفصيلي</span><textarea value={manualForm.body} onChange={(event) => setManualForm((current) => ({ ...current, body: event.target.value }))} className="min-h-32 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">درجة الثقة</span><select value={manualForm.confidence} onChange={(event) => setManualForm((current) => ({ ...current, confidence: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">وسوم تكتيكية</span><input value={manualForm.tacticalTags} onChange={(event) => setManualForm((current) => ({ ...current, tacticalTags: event.target.value }))} placeholder="هجوم, دفاع, تحولات" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط القوة</span><input value={manualForm.strengths} onChange={(event) => setManualForm((current) => ({ ...current, strengths: event.target.value }))} placeholder="افصل بينها بفاصلة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نقاط تحتاج متابعة</span><input value={manualForm.weaknesses} onChange={(event) => setManualForm((current) => ({ ...current, weaknesses: event.target.value }))} placeholder="افصل بينها بفاصلة" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
              </div>
              <button type="submit" disabled={manualLoading || !manualForm.teamId || !manualForm.title.trim() || !manualForm.summary.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">{manualLoading ? 'جاري الحفظ...' : 'حفظ التقرير اليدوي'}</button>
            </form>
            {manualMessage && <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{manualMessage}</div>}
            {manualError && <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><ShieldAlert className="ml-2 inline" size={16} />{manualError}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
