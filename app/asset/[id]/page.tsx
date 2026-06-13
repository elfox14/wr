import { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import AssetClient from '@/components/AssetClient';
import { AssetCommandHeader } from '@/components/asset/AssetCommandHeader';
import AssetRelatedNewsPanel from '@/components/asset/AssetRelatedNewsPanel';
import { PlayerAnalysisPanel } from '@/components/PlayerAnalysisPanel';
import TeamPitchLineup from '@/components/TeamPitchLineup';
import TeamOverviewPanel from '@/components/TeamOverviewPanel';
import TeamTradePanel from '@/components/TeamTradePanel';
import { AssetPageTabs } from '@/components/ui/AssetPageTabs';
import { StickyTradeCTA } from '@/components/ui/StickyTradeCTA';
import { FootballTechnicalAnalysis } from '@/features/analysis/components/FootballTechnicalAnalysis';
import prisma from '@/lib/prisma';

type Props = { params: Promise<{ id: string }> };
type OfficialLineup = { source: 'ISPORTS' | 'PREDICTED' | 'UNAVAILABLE'; fixtureId?: number | string | null; formation?: string | null; matchLabel?: string | null; starters?: number[]; substitutes?: number[] };
type AssetPageAsset = Prisma.AssetGetPayload<{ include: { team: true; performances: true; intelligenceReports: true; players: { include: { performances: true } }; marketNews: true; homeMatches: { include: { homeTeam: true; awayTeam: true } }; awayMatches: { include: { homeTeam: true; awayTeam: true } } } }>;
type AssetPagePlayer = AssetPageAsset['players'][number];

function quoteSql(value: string) { return `'${String(value).replace(/'/g, "''")}'`; }

async function ensurePressNewsTable() {
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedTeamId" TEXT').catch(() => undefined);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedPlayerId" TEXT').catch(() => undefined);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT').catch(() => undefined);
}
async function ensureMatchEventTable() {
  await prisma.$executeRawUnsafe('ALTER TABLE "MatchEvent" ADD COLUMN IF NOT EXISTS "playerId" TEXT').catch(() => undefined);
}

async function getRelatedPressNews(assetId: string, assetName: string, isTeam: boolean) {
  try {
    await ensurePressNewsTable();
    const name = `%${assetName}%`;
    const relationColumn = isTeam ? 'relatedTeamId' : 'relatedPlayerId';
    return prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "PressNews"
      WHERE "status" = 'published'
        AND ("${relationColumn}" = ${quoteSql(assetId)} OR "title" ILIKE ${quoteSql(name)} OR "body" ILIKE ${quoteSql(name)})
      ORDER BY "publishedAt" DESC, "importance" DESC
      LIMIT 6
    `);
  } catch (error) {
    console.error('asset related press news error:', error);
    return [];
  }
}

async function getRelatedMatchEvents(assetId: string, isTeam: boolean) {
  try {
    await ensureMatchEventTable();
    const column = isTeam ? 'teamId' : 'playerId';
    return prisma.$queryRawUnsafe<any[]>(`
      SELECT e.*, m."matchDate", h."name" AS "homeName", a."name" AS "awayName"
      FROM "MatchEvent" e
      LEFT JOIN "Match" m ON m."id" = e."matchId"
      LEFT JOIN "Asset" h ON h."id" = m."homeTeamId"
      LEFT JOIN "Asset" a ON a."id" = m."awayTeamId"
      WHERE e."${column}" = ${quoteSql(assetId)}
      ORDER BY m."matchDate" DESC, COALESCE(e."minute", 999) ASC
      LIMIT 8
    `).then((rows) => rows.map((row) => ({ ...row, matchLabel: row.homeName && row.awayName ? `${row.homeName} ضد ${row.awayName}` : null })));
  } catch (error) {
    console.error('asset related match events error:', error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return { title: 'أصل غير موجود | MC PRIME Exchange' };
  const isValidOgImage = typeof asset.image === 'string' && (asset.image.startsWith('http://') || asset.image.startsWith('https://') || asset.image.startsWith('/'));
  const ogImage = isValidOgImage ? asset.image : '/og-image.jpg';
  const isTeam = asset.type === 'TEAM';
  return { title: `${asset.name} (${asset.code}) | ${isTeam ? 'تحليل المنتخب' : 'تحليل اللاعب'} | MC PRIME Exchange`, description: isTeam ? `تحليل كروي لمنتخب ${asset.name}: الملف التاريخي، القائمة، مؤشرات الجاهزية، والتداول في تب منفصل.` : `تحليل فني وسوقي للاعب ${asset.name}. تابع الأداء والسعر الافتراضي داخل منصة MC PRIME Exchange.`, openGraph: { title: `${asset.name} | ${isTeam ? 'تحليل المنتخب' : 'MC PRIME Exchange'}`, description: isTeam ? `ملف كروي لمنتخب ${asset.name} يشمل التقارير، الإحصائيات، وقائمة الفريق.` : `تداول أسهم ${asset.name} في بورصة المونديال الافتراضية.`, images: [ogImage] } };
}

async function getOfficialLineupForTeam(): Promise<OfficialLineup | null> {
  return null;
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      team: true,
      performances: { orderBy: { createdAt: 'desc' }, take: 8 },
      intelligenceReports: { orderBy: { publishedAt: 'desc' }, take: 12 },
      players: { orderBy: [{ score: 'desc' }, { marketPrice: 'desc' }], include: { performances: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      marketNews: { orderBy: { publishedAt: 'desc' }, take: 8 },
      homeMatches: { orderBy: { matchDate: 'desc' }, take: 12, include: { homeTeam: true, awayTeam: true } },
      awayMatches: { orderBy: { matchDate: 'desc' }, take: 12, include: { homeTeam: true, awayTeam: true } },
    },
  });
  const isTeam = asset?.type === 'TEAM';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mcprime-exchange.com';
  const officialLineup = isTeam ? await getOfficialLineupForTeam() : null;
  const [relatedPressNews, relatedMatchEvents] = asset ? await Promise.all([getRelatedPressNews(asset.id, asset.name, Boolean(isTeam)), getRelatedMatchEvents(asset.id, Boolean(isTeam))]) : [[], []];
  const normalizedAsset = asset ? { ...asset, officialLineup, players: asset.players?.map((player: AssetPagePlayer) => ({ ...player, lastPerformanceRating: player.lastPerformanceRating ?? player.performances?.[0]?.internalRating ?? null })) || [] } : null;
  const jsonLd = asset ? { '@context': 'https://schema.org', '@type': isTeam ? 'SportsTeam' : 'Person', name: asset.name, description: isTeam ? `تحليل كروي لمنتخب ${asset.name}: التقارير، قائمة الفريق، مؤشرات الجاهزية، والمباريات.` : `تداول أسهم ${asset.name} في منصة MC PRIME Exchange. السعر المباشر: ${asset.current_price}¢.`, url: `${baseUrl}/asset/${asset.id}` } : null;

  return <>{jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}{normalizedAsset && !isTeam && <AssetCommandHeader asset={normalizedAsset} isTeam={isTeam} />}{normalizedAsset && isTeam && <div className="mx-auto mb-4 flex w-full max-w-[1600px] justify-end px-4 pt-4"><Link href={`/admin/team-intelligence?teamId=${normalizedAsset.id}`} className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary transition hover:bg-primary hover:text-black">إضافة / تحديث تقرير هذا المنتخب</Link></div>}{normalizedAsset && <AssetRelatedNewsPanel asset={normalizedAsset} pressNews={relatedPressNews} matchEvents={relatedMatchEvents} />}{normalizedAsset && <AssetPageTabs isTeam={isTeam} lineup={isTeam ? <TeamPitchLineup team={normalizedAsset} /> : undefined} trade={isTeam ? <TeamTradePanel assetId={normalizedAsset.id} initialPrice={normalizedAsset.marketPrice ?? normalizedAsset.current_price} fairValue={normalizedAsset.fairValue} change={normalizedAsset.change} /> : undefined} technical={<div id="technical-analysis"><FootballTechnicalAnalysis asset={normalizedAsset} /></div>} overview={isTeam ? <TeamOverviewPanel team={normalizedAsset} /> : undefined} playerOverview={!isTeam ? <PlayerAnalysisPanel asset={normalizedAsset} /> : undefined} market={!isTeam ? <AssetClient /> : undefined} />}{normalizedAsset && !isTeam && <StickyTradeCTA assetId={normalizedAsset.id} assetName={normalizedAsset.name} price={normalizedAsset.marketPrice ?? normalizedAsset.current_price} isTeam={isTeam} />}</>;
}
