import { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import AssetClient from '@/components/AssetClient';
import { AssetCommandHeader } from '@/components/asset/AssetCommandHeader';
import AssetRelatedNewsPanel from '@/components/asset/AssetRelatedNewsPanel';
import FBRefStatsCards from '@/components/FBRefStatsCards';
import GroupStandingsWidget from '@/components/GroupStandingsWidget';
import { PlayerAnalysisPanel } from '@/components/PlayerAnalysisPanel';
import TeamPitchLineup from '@/components/TeamPitchLineup';
import TeamOverviewPanel from '@/components/TeamOverviewPanel';
import TeamRadarChart from '@/components/TeamRadarChart';
import TeamHeroProfile from '@/components/TeamHeroProfile';
import TeamMatchTimeline from '@/components/TeamMatchTimeline';
import TeamInjuryTracker from '@/components/TeamInjuryTracker';
import TeamHeadToHeadModal from '@/components/TeamHeadToHeadModal';
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

async function getGroupTeams(group: string | null | undefined) {
  if (!group) return [];
  try {
    return prisma.asset.findMany({
      where: { type: 'TEAM', group },
      select: { id: true, name: true, code: true, image: true },
    });
  } catch {
    return [];
  }
}

function computeFormScore(asset: any): number {
  const allMatches = [...(asset.homeMatches || []), ...(asset.awayMatches || [])];
  const finished = allMatches.filter((m: any) => m.status === 'FINISHED');
  if (finished.length === 0) return 0.5;
  let points = 0;
  for (const m of finished) {
    const isHome = m.homeTeamId === asset.id;
    const gf = isHome ? m.homeScore : m.awayScore;
    const ga = isHome ? m.awayScore : m.homeScore;
    if (gf > ga) points += 3;
    else if (gf === ga) points += 1;
  }
  return Math.min(1, points / (finished.length * 3));
}

function computeSquadDepth(asset: any): number {
  const count = asset.players?.length || 0;
  return Math.min(1, count / 26);
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
  const groupTeams = isTeam && asset ? await getGroupTeams(asset.group) : [];
  const [relatedPressNews, relatedMatchEvents] = asset ? await Promise.all([getRelatedPressNews(asset.id, asset.name, Boolean(isTeam)), getRelatedMatchEvents(asset.id, Boolean(isTeam))]) : [[], []];
  const normalizedAsset = asset ? { ...asset, officialLineup, players: asset.players?.map((player: AssetPagePlayer) => ({ ...player, lastPerformanceRating: player.lastPerformanceRating ?? player.performances?.[0]?.internalRating ?? null })) || [] } : null;
  const formScore = normalizedAsset && isTeam ? computeFormScore(normalizedAsset) : 0.5;
  const squadDepth = normalizedAsset && isTeam ? computeSquadDepth(normalizedAsset) : 0.5;
  const jsonLd = asset ? { '@context': 'https://schema.org', '@type': isTeam ? 'SportsTeam' : 'Person', name: asset.name, description: isTeam ? `تحليل كروي لمنتخب ${asset.name}: التقارير، قائمة الفريق، مؤشرات الجاهزية، والمباريات.` : `تداول أسهم ${asset.name} في منصة MC PRIME Exchange. السعر المباشر: ${asset.current_price}¢.`, url: `${baseUrl}/asset/${asset.id}` } : null;

  // The new Pure Football layout for Teams (no tabs, no trading noise)
  const allTeamMatches = normalizedAsset ? [...(normalizedAsset.homeMatches || []), ...(normalizedAsset.awayMatches || [])] : [];

  const teamProfileView = normalizedAsset && isTeam ? (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-4 pb-20">
      <TeamHeroProfile asset={normalizedAsset} remainingMatches={3} />
      
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <TeamHeadToHeadModal currentTeam={{ id: normalizedAsset.id, name: normalizedAsset.name, image: normalizedAsset.image, code: normalizedAsset.code }} />
        <Link href={`/admin/team-intelligence?teamId=${normalizedAsset.id}`} className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs font-black text-primary transition hover:bg-primary hover:text-black">
          إضافة / تحديث تقرير هذا المنتخب
        </Link>
      </div>

      <AssetPageTabs 
        isTeam={true}
        overview={
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <TeamOverviewPanel team={normalizedAsset} />
                <AssetRelatedNewsPanel asset={normalizedAsset} pressNews={relatedPressNews} matchEvents={relatedMatchEvents} />
              </div>
              <div className="space-y-6">
                <TeamRadarChart teamId={normalizedAsset.id} teamName={normalizedAsset.name} formScore={formScore} squadDepth={squadDepth} />
                <GroupStandingsWidget team={normalizedAsset} allGroupTeams={groupTeams} />
              </div>
            </div>
          </div>
        }
        lineup={
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
              <TeamPitchLineup team={normalizedAsset} />
              <div className="mt-6">
                <TeamInjuryTracker players={normalizedAsset.players} />
              </div>
            </div>
          </div>
        }
        stats={
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
              <FBRefStatsCards teamId={normalizedAsset.id} />
            </div>
            <TeamMatchTimeline teamId={normalizedAsset.id} matches={allTeamMatches} />
          </div>
        }
        technical={
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <FootballTechnicalAnalysis asset={normalizedAsset} />
          </div>
        }
        trade={
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
            <TeamTradePanel assetId={normalizedAsset.id} initialPrice={normalizedAsset.current_price} fairValue={normalizedAsset.globalMarketValue ?? null} change={normalizedAsset.change} />
          </div>
        }
      />
    </div>
  ) : undefined;

  // The old layout for Players (with tabs)
  const playerProfileView = normalizedAsset && !isTeam ? (
    <>
      <AssetCommandHeader asset={normalizedAsset} isTeam={false} />
      <AssetRelatedNewsPanel asset={normalizedAsset} pressNews={relatedPressNews} matchEvents={relatedMatchEvents} />
      <AssetPageTabs 
        isTeam={false} 
        playerOverview={<PlayerAnalysisPanel asset={normalizedAsset} />} 
        technical={<div id="technical-analysis"><FootballTechnicalAnalysis asset={normalizedAsset} /></div>} 
        market={<AssetClient />} 
      />
      <StickyTradeCTA assetId={normalizedAsset.id} assetName={normalizedAsset.name} price={normalizedAsset.marketPrice ?? normalizedAsset.current_price} isTeam={false} />
    </>
  ) : undefined;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {isTeam ? teamProfileView : playerProfileView}
    </>
  );
}
