import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AlertTriangle, ArrowRight, CheckCircle2, Database, ExternalLink, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getSportsReferenceSourceStatus } from '@/lib/sportsReferenceSource';
import { getLatestSourceAutomationLogs } from '@/lib/sourceAutomationLog';

export const dynamic = 'force-dynamic';

const EXPORT_DIR = path.join(process.cwd(), 'data', 'sports-reference');

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function getCsvFiles() {
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    const files = await fs.readdir(EXPORT_DIR);
    return files.filter((file) => file.toLowerCase().endsWith('.csv')).sort();
  } catch {
    return [];
  }
}

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-black ${ready ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
      {ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
      {ready ? 'جاهز' : 'يحتاج ضبط'}
    </span>
  );
}

export const metadata = {
  title: 'أتمتة المصادر | MC PRIME Exchange',
};

export default async function SourceAutomationAdminPage() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  const csvFiles = await getCsvFiles();
  const sportsReferenceStatus = getSportsReferenceSourceStatus();
  const hasSecret = Boolean(process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || process.env.SOURCE_INBOX_SECRET);

  const latestAutoReports = await prisma.teamIntelligenceReport.findMany({
    where: {
      provider: { in: ['SPORTS_REFERENCE_AUTO_IMPORT', 'SPORTS_REFERENCE_INBOX', 'THE_ATHLETIC_INBOX', 'REUTERS_INBOX', 'FIFA_INBOX', 'SOURCE_INBOX'] },
    },
    orderBy: { lastCheckedAt: 'desc' },
    take: 12,
    select: {
      id: true,
      title: true,
      provider: true,
      sourceName: true,
      sourceCategory: true,
      lastCheckedAt: true,
      team: { select: { id: true, name: true, code: true } },
    },
  });

  const latestAutomationLogs = await getLatestSourceAutomationLogs(12);
  const needsReviewCount = await prisma.teamIntelligenceReport.count({
    where: {
      OR: [
        { reportType: 'TEAM_PROFILE_REVIEW' },
        { tacticalTags: { has: 'NEEDS_REVIEW' } },
      ],
    },
  });

  const checks = [
    {
      title: 'Secret للأتمتة',
      ready: hasSecret,
      note: hasSecret ? 'ADMIN_CRON_SECRET / CRON_SECRET / SOURCE_INBOX_SECRET مضبوط.' : 'أضف أحد الأسرار في Vercel Environment Variables.',
    },
    {
      title: 'مجلد CSV',
      ready: true,
      note: `المجلد المستخدم: data/sports-reference — عدد ملفات CSV المكتشفة: ${csvFiles.length}.`,
    },
    {
      title: 'Sports Reference',
      ready: sportsReferenceStatus.ready,
      note: sportsReferenceStatus.nextAction,
    },
    {
      title: 'تقارير تلقائية محفوظة',
      ready: latestAutoReports.length > 0,
      note: latestAutoReports.length ? `تم العثور على ${latestAutoReports.length} تقرير تلقائي حديث.` : 'لم يتم حفظ تقارير تلقائية بعد.',
    },
    {
      title: 'مصادر تحتاج مراجعة',
      ready: needsReviewCount === 0,
      note: needsReviewCount ? `${needsReviewCount} مصدر يحتاج مراجعة تحريرية.` : 'لا توجد مصادر معلقة للمراجعة.',
    },
    {
      title: 'سجل التشغيل',
      ready: latestAutomationLogs.length > 0,
      note: latestAutomationLogs.length ? `آخر ${latestAutomationLogs.length} عمليات تشغيل مسجلة.` : 'لا توجد عمليات تشغيل مسجلة بعد.',
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary"><Sparkles size={16} /> SOURCE AUTOMATION</div>
              <h1 className="text-2xl font-black text-white md:text-3xl">أتمتة مصادر التحليل</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">لوحة فحص تشغيل Sports Reference CSV، استقبال رسائل المصادر، وCron اليومي بدون تدخل يدوي.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">إدارة التقارير <ArrowRight size={15} /></Link>
              <Link href="/admin/source-review" className="inline-flex items-center gap-2 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm font-black text-yellow-100 hover:border-yellow-300/40">مصادر تحتاج مراجعة <AlertTriangle size={15} /></Link>
              <a href="/api/admin/source-automation-status" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">JSON Status <ExternalLink size={15} /></a>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">هذه الصفحة لا تعرض قيم الأسرار نفسها، فقط تتحقق من وجودها. أي نقص في البيانات يظهر كـ “غير متوفر في المصادر” داخل التقارير.</div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div key={check.title} className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-black text-white">{check.title}</h2>
                <StatusBadge ready={check.ready} />
              </div>
              <p className="text-sm leading-7 text-gray-400">{check.note}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Database size={20} className="text-primary" /> ملفات Sports Reference CSV</h2>
            <p className="mb-4 text-sm leading-7 text-gray-400">ضع ملفات CSV بأسماء مثل MEX.csv أو Mexico.csv داخل data/sports-reference ليتم استيرادها تلقائيًا.</p>
            {csvFiles.length ? (
              <div className="max-h-80 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 text-sm leading-7 text-gray-300">
                {csvFiles.map((file) => <div key={file} className="border-b border-white/5 py-2 last:border-0">{file}</div>)}
              </div>
            ) : (
              <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger">لا توجد ملفات CSV مكتشفة حتى الآن.</div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a href="/api/admin/auto-import-sports-reference?info=1" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-black text-white hover:border-primary/40 hover:text-primary">معلومات الاستيراد <ExternalLink size={13} /></a>
              <a href="/api/admin/auto-import-sports-reference" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-xs font-black text-yellow-100 hover:border-yellow-300/40">تشغيل الاستيراد الآن <RefreshCw size={13} /></a>
            </div>
          </section>

          <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><ShieldCheck size={20} className="text-primary" /> آخر التقارير التلقائية</h2>
            {latestAutoReports.length ? (
              <div className="grid gap-3">
                {latestAutoReports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-white">{report.title}</div>
                        <div className="mt-1 text-xs text-gray-500">{report.team?.name || '—'} · {report.provider} · {report.sourceName} · {report.sourceCategory}</div>
                      </div>
                      {report.team?.id && <Link href={`/asset/${report.team.id}`} className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white hover:border-primary/40 hover:text-primary">فتح المنتخب <ExternalLink size={12} /></Link>}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">آخر فحص: {report.lastCheckedAt ? new Date(report.lastCheckedAt).toLocaleString('ar-EG') : 'غير متوفر'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-bold leading-7 text-yellow-100">لا توجد تقارير تلقائية محفوظة حتى الآن.</div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><RefreshCw size={20} className="text-primary" /> سجل تشغيل الأتمتة</h2>
          {latestAutomationLogs.length ? (
            <div className="grid gap-3">
              {latestAutomationLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{log.title}</div>
                      <div className="mt-1 text-xs leading-6 text-gray-500">{log.summary}</div>
                    </div>
                    <span className="rounded-xl bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{log.lastCheckedAt ? new Date(log.lastCheckedAt).toLocaleString('ar-EG') : 'غير متوفر'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-bold leading-7 text-yellow-100">لا توجد عمليات تشغيل مسجلة بعد.</div>
          )}
        </section>
      </main>
    </div>
  );
}
