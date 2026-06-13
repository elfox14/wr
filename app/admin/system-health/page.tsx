import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import AdminShell from '@/components/admin/AdminShell';
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, Server, ShieldCheck, Trophy } from 'lucide-react';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

type CronRunRow = {
  jobName: string;
  status: string;
  message: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
};

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return 'لم يعمل بعد';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function minutesSince(value?: Date | string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / 60_000));
}

function Card({ title, value, icon, tone = 'cyan', subtitle }: { title: string; value: string | number; icon: ReactNode; tone?: 'cyan' | 'green' | 'yellow' | 'red'; subtitle?: string }) {
  const tones = {
    cyan: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]',
    green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    yellow: 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]',
    red: 'border-red-400/20 bg-red-400/10 text-red-300',
  };
  return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl"><div className={`mb-4 inline-flex rounded-2xl border p-3 ${tones[tone]}`}>{icon}</div><p className="text-xs font-black text-gray-500">{title}</p><div className="mt-1 text-2xl font-black text-white">{value}</div>{subtitle ? <p className="mt-2 text-xs font-bold leading-6 text-gray-400">{subtitle}</p> : null}</div>;
}

async function ensureCronRunLogTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CronRunLog" (
      "id" TEXT PRIMARY KEY,
      "jobName" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "message" TEXT,
      "details" JSONB,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" TIMESTAMP(3),
      "durationMs" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CronRunLog_jobName_startedAt_idx" ON "CronRunLog" ("jobName", "startedAt" DESC)');
}

async function getLatestCronRun() {
  try {
    await ensureCronRunLogTable();
    const rows = await prisma.$queryRawUnsafe<CronRunRow[]>(`
      SELECT "jobName", "status", "message", "startedAt", "finishedAt", "durationMs"
      FROM "CronRunLog"
      WHERE "jobName" = 'expire-stale-matches'
      ORDER BY "startedAt" DESC
      LIMIT 1
    `);
    return rows[0] || null;
  } catch (error) {
    console.error('system health cron log lookup failed:', error);
    return null;
  }
}

export const metadata = {
  title: 'حالة النظام | MC PRIME Exchange',
};

export default async function SystemHealthPage() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  const startedAt = Date.now();
  let databaseOk = false;
  let databaseError = '';

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch (error: any) {
    databaseError = error?.message || 'Database check failed';
  }

  const staleBefore = new Date(Date.now() - 180 * 60 * 1000);
  const [assetCount, teamCount, playerCount, matchCount, liveCount, upcomingCount, finishedCount, staleLiveCount, latestCronRun] = await Promise.all([
    prisma.asset.count().catch(() => 0),
    prisma.asset.count({ where: { type: 'TEAM' } }).catch(() => 0),
    prisma.asset.count({ where: { type: 'PLAYER' } }).catch(() => 0),
    prisma.match.count().catch(() => 0),
    prisma.match.count({ where: { status: { in: ['IN_PLAY', 'LIVE', 'HT'] } } }).catch(() => 0),
    prisma.match.count({ where: { status: 'SCHEDULED' } }).catch(() => 0),
    prisma.match.count({ where: { status: 'FINISHED' } }).catch(() => 0),
    prisma.match.count({ where: { status: { in: ['IN_PLAY', 'LIVE', 'HT'] }, matchDate: { lt: staleBefore } } }).catch(() => 0),
    getLatestCronRun(),
  ]);

  const responseTime = Date.now() - startedAt;
  const cronMinutesAgo = minutesSince(latestCronRun?.finishedAt || latestCronRun?.startedAt);
  const cronIsFresh = cronMinutesAgo !== null && cronMinutesAgo <= 60;
  const cronStatusLabel = latestCronRun ? (latestCronRun.status === 'success' ? 'يعمل' : 'خطأ') : 'لم يعمل بعد';
  const cronTone = latestCronRun?.status === 'error' ? 'red' : cronIsFresh ? 'green' : 'yellow';

  return (
    <AdminShell title="حالة النظام" subtitle="فحص سريع لحالة قاعدة البيانات، السيرفر، الكرون، وعدد بيانات البطولة الحالية." badge={databaseOk && staleLiveCount === 0 ? 'النظام يعمل' : 'يوجد تنبيه'}>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="قاعدة البيانات" value={databaseOk ? 'متصلة' : 'خطأ'} icon={databaseOk ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />} tone={databaseOk ? 'green' : 'red'} subtitle={databaseOk ? 'تم تنفيذ SELECT 1 بنجاح.' : databaseError} />
        <Card title="زمن الفحص" value={`${responseTime}ms`} icon={<Clock size={24} />} tone="cyan" subtitle="وقت تنفيذ فحص الصفحة الحالي." />
        <Card title="بيئة التشغيل" value={process.env.NODE_ENV || 'unknown'} icon={<Server size={24} />} tone="yellow" subtitle="يجب أن تكون production بعد الديبلوي." />
        <Card title="Cron حماية المباريات" value={cronStatusLabel} icon={<ShieldCheck size={24} />} tone={cronTone} subtitle={`آخر تشغيل: ${formatDateTime(latestCronRun?.finishedAt || latestCronRun?.startedAt)}${cronMinutesAgo !== null ? ` — منذ ${cronMinutesAgo} دقيقة` : ''}`} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="كل الأصول" value={assetCount} icon={<Database size={24} />} />
        <Card title="المنتخبات" value={teamCount} icon={<Trophy size={24} />} tone="green" />
        <Card title="اللاعبون" value={playerCount} icon={<Activity size={24} />} tone="yellow" />
        <Card title="كل المباريات" value={matchCount} icon={<Clock size={24} />} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-4">
        <Card title="مباشرة الآن" value={liveCount} icon={<Activity size={24} />} tone={liveCount ? 'green' : 'cyan'} />
        <Card title="قادمة" value={upcomingCount} icon={<Clock size={24} />} tone="yellow" />
        <Card title="منتهية" value={finishedCount} icon={<CheckCircle2 size={24} />} tone="green" />
        <Card title="Live قديمة" value={staleLiveCount} icon={<AlertTriangle size={24} />} tone={staleLiveCount ? 'red' : 'green'} subtitle="مباريات مباشرة أقدم من 180 دقيقة." />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-sm font-bold leading-7 text-gray-300">
        <p className="font-black text-white">ملاحظة تشغيلية</p>
        <p className="mt-2">لـ Render Cron Job استخدم الأمر: <span dir="ltr" className="font-mono text-[#0FF0FC]">npm run cron:expire-stale-matches</span> بجدولة كل 15 دقيقة. أمر البناء الحالي الآمن يمكن أن يبقى: <span dir="ltr" className="font-mono text-[#FFD700]">npm ci && npx prisma generate && npx prisma db push && npm run build</span> بدون <span dir="ltr" className="font-mono text-red-300">--accept-data-loss</span>.</p>
      </div>
    </AdminShell>
  );
}
