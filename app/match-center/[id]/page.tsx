import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Clock, Newspaper, Radio } from 'lucide-react';
import prisma from '@/lib/prisma';
import LiveMatchStatsPanel from '@/app/animation-live/player/LiveMatchStatsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مركز المباراة | MC PRIME World Cup',
  description: 'مركز المباراة: بطاقة المباراة، البث الأنيميشن، الرصد الصحفي المرتبط، وإحصائيات المباراة عند توفر البيانات الموثقة.',
};

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusInfo(status: string) {
  const value = String(status || '').toUpperCase();
  if (value === 'FINISHED') {
    return { label: 'انتهت', className: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]', icon: CheckCircle2 };
  }
  if (['IN_PLAY', 'LIVE', 'HT'].includes(value)) {
    return { label: value === 'HT' ? 'استراحة' : 'مباشرة', className: 'border-red-400/25 bg-red-400/10 text-red-300', icon: Activity };
  }
  return { label: 'قادمة', className: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]', icon: Clock };
}

function safeImage(asset: any) {
  const image = String(asset?.image || '');
  if (image.startsWith('http')) return <img src={image} alt={asset?.name || ''} className="h-full w-full object-cover" />;
  return <span className="text-5xl">{image || '🏳️'}</span>;
}

function quoteSql(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function ensurePressNewsTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PressNews" ("id" TEXT PRIMARY KEY,"title" TEXT NOT NULL,"body" TEXT NOT NULL,"category" TEXT NOT NULL DEFAULT 'رصد صحفي',"sourceName" TEXT NOT NULL,"sourceUrl" TEXT,"sourceType" TEXT NOT NULL DEFAULT 'newsletter',"language" TEXT NOT NULL DEFAULT 'ar',"status" TEXT NOT NULL DEFAULT 'published',"importance" INTEGER NOT NULL DEFAULT 50,"tags" JSONB,"relatedTeamId" TEXT,"relatedPlayerId" TEXT,"relatedMatchId" TEXT,"publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedTeamId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedPlayerId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT');
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true },
  });
}

async function getRelatedPressNews(matchId: string, homeId: string, awayId: string, homeName: string, awayName: string) {
  try {
    await ensurePressNewsTable();
    const home = `%${homeName}%`;
    const away = `%${awayName}%`;
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "PressNews" WHERE "status" = 'published' AND ("relatedMatchId" = ${quoteSql(matchId)} OR "relatedTeamId" = ${quoteSql(homeId)} OR "relatedTeamId" = ${quoteSql(awayId)} OR "title" ILIKE ${quoteSql(home)} OR "body" ILIKE ${quoteSql(home)} OR "title" ILIKE ${quoteSql(away)} OR "body" ILIKE ${quoteSql(away)}) ORDER BY "publishedAt" DESC, "importance" DESC LIMIT 8`
    );
  } catch (error) {
    console.error('match center press news error:', error);
    return [];
  }
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const home = match.homeTeam;
  const away = match.awayTeam;
  const status = statusInfo(match.status);
  const StatusIcon = status.icon;
  const pressNews = await getRelatedPressNews(match.id, home.id, away.id, home.name, away.name);
  const showScore = String(match.status).toUpperCase() !== 'SCHEDULED';

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <Link href="/matches" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 transition hover:text-white">
          <ArrowLeft size={16} /> العودة إلى المباريات
        </Link>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-gray-300">
              {match.groupPhase || match.stage || 'دور المجموعات'}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black ${status.className}`}>
              <StatusIcon size={14} /> {status.label}
            </span>
          </div>

          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
            <TeamHeader asset={home} />
            <div className="text-center">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/35 px-7 py-5 shadow-2xl">
                {showScore ? (
                  <div className="font-mono text-5xl font-black text-white">{match.homeScore} - {match.awayScore}</div>
                ) : (
                  <div className="text-5xl font-black tracking-widest text-gray-600">VS</div>
                )}
                <p className="mt-3 text-xs font-bold text-gray-500">{formatDate(match.matchDate)}</p>
              </div>

              {match.animationMatchId ? (
                <Link
                  href={`/animation-live/player?matchId=${match.animationMatchId}&lang=en&statsPanel=simple&teamPanel=1`}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"
                >
                  <Radio size={14} /> فتح البث الأنيميشن
                </Link>
              ) : null}
            </div>
            <TeamHeader asset={away} />
          </div>
        </section>

        <Panel title="الرصد الصحفي المرتبط" icon={<Newspaper className="text-[#FFD700]" />} action={<Link href="/news" className="text-xs font-black text-[#0FF0FC]">غرفة الأخبار</Link>}>
          {pressNews.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {pressNews.map((item) => <PressNewsCard key={item.id} item={item} />)}
            </div>
          ) : (
            <EmptyText text="لا توجد أخبار صحفية مرتبطة بهذه المباراة حاليًا." />
          )}
        </Panel>

        {match.animationMatchId ? (
          <LiveMatchStatsPanel matchId={String(match.animationMatchId)} />
        ) : (
          <Panel title="إحصائيات المباراة" icon={<BarChart3 className="text-[#0FF0FC]" />}>
            <EmptyText text="لا توجد إحصائيات موثقة لهذه المباراة بعد. ستظهر عند ربط المباراة بمصدر بيانات حي." />
          </Panel>
        )}
      </section>
    </main>
  );
}

function TeamHeader({ asset }: { asset: any }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/35 shadow-2xl">
        {safeImage(asset)}
      </div>
      <h2 className="text-2xl font-black text-white md:text-3xl">{asset.name}</h2>
      <p className="mt-1 font-mono text-sm text-gray-500">{asset.code}</p>
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-xl font-black text-white">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold leading-7 text-gray-400">{text}</div>;
}

function PressNewsCard({ item }: { item: any }) {
  const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ar-EG') : '';
  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black text-gray-500">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-1 text-[#FFD700]">{item.category || 'رصد صحفي'}</span>
        <span>{item.sourceName || 'مصدر غير محدد'}</span>
        {date ? <span>{date}</span> : null}
      </div>
      <h4 className="text-base font-black leading-7 text-white">{item.title}</h4>
      <p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-400">{item.body}</p>
      {item.sourceUrl ? (
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs font-black text-[#0FF0FC]">
          فتح المصدر
        </a>
      ) : null}
    </article>
  );
}
