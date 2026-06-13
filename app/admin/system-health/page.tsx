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

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

function Card({ title, value, icon, tone = 'cyan', subtitle }: { title: string; value: string | number; icon: React.ReactNode; tone?: 'cyan' | 'green' | 'yellow' | 'red'; subtitle?: string }) {
  const tones = {
    cyan: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-[#0FF0FC]',
    green: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    yellow: 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]',
    red: 'border-red-400/20 bg-red-400/10 text-red-300',
  };
  return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl"><div className={`mb-4 inline-flex rounded-2xl border p-3 ${tones[tone]}`}>{icon}</div><p className="text-xs font-black text-gray-500">{title}</p><div className="mt-1 text-2xl font-black text-white">{value}</div>{subtitle ? <p className="mt-2 text-xs font-bold leading-6 text-gray-400">{subtitle}</p> : null}</div>;
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

  const [assetCount, teamCount, playerCount, matchCount, liveCount, upcomingCount, finishedCount] = await Promise.all([
    prisma.asset.count().catch(() => 0),
    prisma.asset.count({ where: { type: 'TEAM' } }).catch(() => 0),
    prisma.asset.count({ where: { type: 'PLAYER' } }).catch(() => 0),
    prisma.match.count().catch(() => 0),
    prisma.match.count({ where: { status: { in: ['IN_PLAY', 'LIVE', 'HT'] } } }).catch(() => 0),
    prisma.match.count({ where: { status: 'SCHEDULED' } }).catch(() => 0),
    prisma.match.count({ where: { status: 'FINISHED' } }).catch(() => 0),
  ]);

  const responseTime = Date.now() - startedAt;

  return (
    <AdminShell title="حالة النظام" subtitle="فحص سريع لحالة قاعدة البيانات، السيرفر، الكرون، وعدد بيانات البطولة الحالية." badge={databaseOk ? 'النظام يعمل' : 'يوجد تنبيه'}>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="قاعدة البيانات" value={databaseOk ? 'متصلة' : 'خطأ'} icon={databaseOk ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />} tone={databaseOk ? 'green' : 'red'} subtitle={databaseOk ? 'تم تنفيذ SELECT 1 بنجاح.' : databaseError} />
        <Card title="زمن الفحص" value={`${responseTime}ms`} icon={<Clock size={24} />} tone="cyan" subtitle="وقت تنفيذ فحص الصفحة الحالي." />
        <Card title="بيئة التشغيل" value={process.env.NODE_ENV || 'unknown'} icon={<Server size={24} />} tone="yellow" subtitle="يجب أن تكون production بعد الديبلوي." />
        <Card title="Cron حماية المباريات" value="مجدول" icon={<ShieldCheck size={24} />} tone="green" subtitle="expire-stale-matches يعمل من vercel.json كل 15 دقيقة عند دعم الاستضافة للكرون." />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="كل الأصول" value={assetCount} icon={<Database size={24} />} />
        <Card title="المنتخبات" value={teamCount} icon={<Trophy size={24} />} tone="green" />
        <Card title="اللاعبون" value={playerCount} icon={<Activity size={24} />} tone="yellow" />
        <Card title="كل المباريات" value={matchCount} icon={<Clock size={24} />} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <Card title="مباشرة الآن" value={liveCount} icon={<Activity size={24} />} tone={liveCount ? 'green' : 'cyan'} />
        <Card title="قادمة" value={upcomingCount} icon={<Clock size={24} />} tone="yellow" />
        <Card title="منتهية" value={finishedCount} icon={<CheckCircle2 size={24} />} tone="green" />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-sm font-bold leading-7 text-gray-300">
        <p className="font-black text-white">ملاحظة تشغيلية</p>
        <p className="mt-2">استخدم أمر البناء الآمن في Render: <span dir="ltr" className="font-mono text-[#0FF0FC]">npm run build:render</span>. لو لم توجد migrations جاهزة بعد، استخدم مؤقتًا <span dir="ltr" className="font-mono text-[#FFD700]">npm run build:render:dbpush</span> بدون <span dir="ltr" className="font-mono text-red-300">--accept-data-loss</span>.</p>
      </div>
    </AdminShell>
  );
}
