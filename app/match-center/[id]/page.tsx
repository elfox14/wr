import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, Clock, Newspaper, Radio, Shield, TrendingUp, Users } from 'lucide-react';
import prisma from '@/lib/prisma';
import { renderMarketNews } from '@/lib/market-news/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مركز المباراة | MC PRIME Exchange',
  description: 'مركز المباراة: نتيجة، بث أنيميشن، أخبار مرتبطة، مؤشرات السوق، وأسماء بارزة.',
};

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusInfo(status: string) {
  const value = String(status || '').toUpperCase();
  if (value === 'FINISHED') return { label: 'انتهت', className: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]', icon: CheckCircle2 };
  if (['IN_PLAY', 'LIVE', 'HT'].includes(value)) return { label: value === 'HT' ? 'استراحة' : 'مباشرة', className: 'border-red-400/25 bg-red-400/10 text-red-300', icon: Activity };
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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PressNews" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
      "sourceName" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceType" TEXT NOT NULL DEFAULT 'newsletter',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "status" TEXT NOT NULL DEFAULT 'published',
      "importance" INTEGER NOT NULL DEFAULT 50,
      "tags" JSONB,
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: true, marketNews: { orderBy: { publishedAt: 'desc' }, take: 5 } } },
      awayTeam: { include: { players: true, marketNews: { orderBy: { publishedAt: 'desc' }, take: 5 } } },
    },
  });
}

async function getRelatedPressNews(homeName: string, awayName: string) {
  try {
    await ensurePressNewsTable();
    const home = `%${homeName}%`;
    const away = `%${awayName}%`;
    return prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "PressNews"
      WHERE "status" = 'published'
        AND (
          "title" ILIKE ${quoteSql(home)} OR "body" ILIKE ${quoteSql(home)} OR
          "title" ILIKE ${quoteSql(away)} OR "body" ILIKE ${quoteSql(away)}
        )
      ORDER BY "publishedAt" DESC, "importance" DESC
      LIMIT 6
    `);
  } catch (error) {
    console.error('match center press news error:', error);
    return [];
  }
}

function price(asset: any) {
  return Math.round(Number(asset?.marketPrice ?? asset?.current_price ?? 0));
}

function fair(asset: any) {
  return Math.round(Number(asset?.fairValue ?? asset?.current_price ?? 0));
}

function premium(asset: any) {
  const fairValue = fair(asset);
  if (!fairValue) return 0;
  return ((price(asset) - fairValue) / fairValue) * 100;
}

function marketNewsFrom(match: any) {
  const combined = [...(match.homeTeam?.marketNews || []), ...(match.awayTeam?.marketNews || [])];
  return combined
    .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 8)
    .map((item: any) => {
      try {
        const rendered = renderMarketNews(item, 'ar');
        return { ...item, title: rendered.title, body: rendered.body };
      } catch {
        return { ...item, title: item.titleAr || item.titleEn || 'خبر سوق', body: item.bodyAr || item.bodyEn || '' };
      }
    });
}

function topPlayers(match: any) {
  return [...(match.homeTeam?.players || []), ...(match.awayTeam?.players || [])]
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 8);
}

export default async function MatchCenterPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  if (!match) notFound();

  const home = match.homeTeam;
  const away = match.awayTeam;
  const status = statusInfo(match.status);
  const StatusIcon = status.icon;
  const pressNews = await getRelatedPressNews(home.name, away.name);
  const marketNews = marketNewsFrom(match);
  const players = topPlayers(match);
  const showScore = String(match.status).toUpperCase() !== 'SCHEDULED';
  const homePremium = premium(home);
  const awayPremium = premium(away);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <Link href="/matches" className="inline-flex items-center gap-2 text-sm font-black text-gray-400 transition hover:text-white">
          <ArrowLeft size={16} /> العودة إلى المباريات
        </Link>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-anti-gravity md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-gray-300">{match.groupPhase || match.stage || 'دور المجموعات'}</span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black ${status.className}`}><StatusIcon size={14} /> {status.label}</span>
          </div>

          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
            <TeamHeader asset={home} />
            <div className="text-center">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/35 px-7 py-5 shadow-2xl">
                {showScore ? <div className="font-mono text-5xl font-black text-white">{match.homeScore} - {match.awayScore}</div> : <div className="text-5xl font-black tracking-widest text-gray-600">VS</div>}
                <p className="mt-3 text-xs font-bold text-gray-500">{formatDate(match.matchDate)}</p>
              </div>
              {match.animationMatchId && <Link href={`/animation-live/player?matchId=${match.animationMatchId}&lang=en&statsPanel=simple&teamPanel=1`} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-xs font-black text-[#FFD700] transition hover:bg-[#FFD700] hover:text-black"><Radio size={14} /> فتح البث الأنيميشن</Link>}
            </div>
            <TeamHeader asset={away} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label={`سعر ${home.name}`} value={`${price(home)} ¢`} />
          <MetricCard label={`سعر ${away.name}`} value={`${price(away)} ¢`} />
          <MetricCard label="علاوة/خصم المضيف" value={`${homePremium > 0 ? '+' : ''}${homePremium.toFixed(1)}%`} tone={homePremium > 10 ? 'red' : homePremium < -10 ? 'green' : 'cyan'} />
          <MetricCard label="علاوة/خصم الضيف" value={`${awayPremium > 0 ? '+' : ''}${awayPremium.toFixed(1)}%`} tone={awayPremium > 10 ? 'red' : awayPremium < -10 ? 'green' : 'cyan'} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Panel title="الرصد الصحفي المرتبط" icon={<Newspaper className="text-[#FFD700]" />} action={<Link href="/news" className="text-xs font-black text-[#0FF0FC]">غرفة الأخبار</Link>}>
            {pressNews.length ? <div className="space-y-3">{pressNews.map((item) => <PressNewsCard key={item.id} item={item} />)}</div> : <EmptyText text="لا توجد أخبار صحفية مرتبطة مباشرة باسم المنتخبين. أضف خبرًا من /admin/news وسيظهر هنا إذا احتوى على اسم أحد المنتخبين." />}
          </Panel>

          <Panel title="أثر السوق الافتراضي" icon={<TrendingUp className="text-[#0FF0FC]" />}>
            <div className="space-y-3">
              <ComparisonRow label="القيمة العادلة" left={`${fair(home)} ¢`} right={`${fair(away)} ¢`} />
              <ComparisonRow label="الزخم" left={home.momentum || 50} right={away.momentum || 50} />
              <ComparisonRow label="طلب السوق" left={home.marketDemand || 50} right={away.marketDemand || 50} />
              <ComparisonRow label="تصنيف الفيفا" left={home.fifaRank || 'غير متوفر'} right={away.fifaRank || 'غير متوفر'} />
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-xs font-bold leading-6 text-emerald-100">
              هذا القسم يوضح مؤشرات افتراضية فقط، وليس توصية شراء أو بيع.
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1fr]">
          <Panel title="أسماء بارزة في المباراة" icon={<Users className="text-[#FFD700]" />}>
            {players.length ? <div className="grid gap-3 sm:grid-cols-2">{players.map((player: any) => <PlayerCard key={player.id} player={player} homeId={home.id} homeName={home.name} awayName={away.name} />)}</div> : <EmptyText text="لا توجد قائمة لاعبين مرتبطة بهذه المباراة حاليًا." />}
          </Panel>

          <Panel title="أخبار السوق المرتبطة" icon={<BarChart3 className="text-[#0FF0FC]" />}>
            {marketNews.length ? <div className="space-y-3">{marketNews.map((item: any) => <MarketNewsCard key={item.id} item={item} />)}</div> : <EmptyText text="لا توجد أخبار سوق مرتبطة بالمنتخبين حاليًا." />}
          </Panel>
        </section>
      </section>
    </main>
  );
}

function TeamHeader({ asset }: { asset: any }) {
  return (
    <Link href={`/asset/${asset.id}`} className="group flex flex-col items-center text-center">
      <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/35 shadow-2xl transition group-hover:scale-105">
        {safeImage(asset)}
      </div>
      <h2 className="text-2xl font-black text-white group-hover:text-[#0FF0FC] md:text-3xl">{asset.name}</h2>
      <p className="mt-1 font-mono text-sm text-gray-500">{asset.code}</p>
    </Link>
  );
}

function MetricCard({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: 'cyan' | 'red' | 'green' }) {
  const colors: any = { cyan: 'text-[#0FF0FC]', red: 'text-red-300', green: 'text-emerald-300' };
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center"><p className="text-xs font-black text-gray-500">{label}</p><p className={`mt-2 font-mono text-2xl font-black ${colors[tone]}`}>{value}</p></div>;
}

function Panel({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-card md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/8 pb-4">
        <h3 className="flex items-center gap-2 text-xl font-black text-white">{icon}{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ComparisonRow({ label, left, right }: { label: string; left: any; right: any }) {
  return <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 text-center"><span className="font-mono font-black text-white">{left}</span><span className="text-xs font-black text-gray-500">{label}</span><span className="font-mono font-black text-white">{right}</span></div>;
}

function PressNewsCard({ item }: { item: any }) {
  const href = item.sourceUrl || `/news#${item.id}`;
  const external = String(href).startsWith('http');
  return <article className="rounded-2xl border border-white/8 bg-black/25 p-4"><div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black text-gray-500"><span>{item.category}</span><span>{item.sourceName}</span></div><h4 className="font-black leading-6 text-white">{item.title}</h4><p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-500">{item.body}</p><Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#FFD700]">تفاصيل <ArrowLeft size={12} /></Link></article>;
}

function MarketNewsCard({ item }: { item: any }) {
  return <article className="rounded-2xl border border-white/8 bg-black/25 p-4"><div className="mb-2 flex items-center gap-2 text-[11px] font-black text-[#0FF0FC]"><Activity size={12} /> خبر سوق</div><h4 className="font-black leading-6 text-white">{item.title}</h4>{item.body && <p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-500">{item.body}</p>}</article>;
}

function PlayerCard({ player, homeId, homeName, awayName }: { player: any; homeId: string; homeName: string; awayName: string }) {
  const teamName = player.teamId === homeId ? homeName : awayName;
  return <Link href={`/asset/${player.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-[#0FF0FC]/25"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"><Shield size={16} className="text-gray-500" /></div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{player.name}</p><p className="truncate text-[11px] font-bold text-gray-500">{teamName}</p></div></div><span className="font-mono text-xs font-black text-[#0FF0FC]">{price(player)} ¢</span></Link>;
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold leading-7 text-gray-500">{text}</div>;
}
