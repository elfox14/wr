import { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import AssetClient from '@/components/AssetClient';
import { PlayerAnalysisPanel } from '@/components/PlayerAnalysisPanel';
import TeamPitchLineup from '@/components/TeamPitchLineup';
import TeamOverviewPanel from '@/components/TeamOverviewPanel';
import TeamTradePanel from '@/components/TeamTradePanel';
import { AssetPageTabs } from '@/components/ui/AssetPageTabs';
import { StickyTradeCTA } from '@/components/ui/StickyTradeCTA';
import { FootballTechnicalAnalysis } from '@/features/analysis/components/FootballTechnicalAnalysis';
import prisma from '@/lib/prisma';
import { apiFootballFetch } from '@/lib/apiFootball';

type Props = {
  params: Promise<{ id: string }>
};

type OfficialLineup = {
  source: 'API_FOOTBALL' | 'ISPORTS' | 'PREDICTED' | 'UNAVAILABLE';
  fixtureId?: number | string | null;
  formation?: string | null;
  matchLabel?: string | null;
  starters?: number[];
  substitutes?: number[];
};

type AssetPageAsset = Prisma.AssetGetPayload<{
  include: {
    team: true;
    performances: true;
    intelligenceReports: true;
    players: {
      include: {
        performances: true;
      };
    };
    marketNews: true;
    homeMatches: {
      include: {
        homeTeam: true;
        awayTeam: true;
      };
    };
    awayMatches: {
      include: {
        homeTeam: true;
        awayTeam: true;
      };
    };
  };
}>;

type AssetPageMatch = AssetPageAsset['homeMatches'][number] | AssetPageAsset['awayMatches'][number];
type AssetPagePlayer = AssetPageAsset['players'][number];

type ApiFootballLineupPlayer = {
  player?: {
    id?: number | string | null;
  } | null;
};

type ApiFootballLineupItem = {
  team?: {
    id?: number | string | null;
  } | null;
  formation?: string | null;
  startXI?: ApiFootballLineupPlayer[];
  substitutes?: ApiFootballLineupPlayer[];
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({ where: { id } });

  if (!asset) return { title: 'أصل غير موجود | MC PRIME Exchange' };

  const isValidOgImage =
    typeof asset.image === 'string' &&
    (asset.image.startsWith('http://') || asset.image.startsWith('https://') || asset.image.startsWith('/'));

  const ogImage = isValidOgImage ? asset.image : '/og-image.jpg';
  const isTeam = asset.type === 'TEAM';

  return {
    title: `${asset.name} (${asset.code}) | ${isTeam ? 'تحليل المنتخب' : 'تحليل اللاعب'} | MC PRIME Exchange`,
    description: isTeam
      ? `تحليل فني وإحصائي لمنتخب ${asset.name}: تقارير موثقة، قوة الخطوط، اللاعبين المؤثرين، المباريات، ومؤشرات الجاهزية.`
      : `تحليل فني وسوقي للاعب ${asset.name}. تابع الأداء والسعر الافتراضي داخل منصة MC PRIME Exchange.`,
    openGraph: {
      title: `${asset.name} | ${isTeam ? 'تحليل المنتخب' : 'MC PRIME Exchange'}`,
      description: isTeam
        ? `ملف كروي موثق لمنتخب ${asset.name} يشمل التقارير، الإحصائيات، واللاعبين المؤثرين.`
        : `تداول أسهم ${asset.name} في بورصة المونديال الافتراضية.`,
      images: [ogImage],
    },
  };
}

function normalizeProviderPlayerId(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getOfficialLineupForTeam(team: AssetPageAsset, matches: AssetPageMatch[]): Promise<OfficialLineup | null> {
  if (!team.apiFootballId || !Array.isArray(matches) || matches.length === 0) return null;

  const candidates = [...matches]
    .filter((match) => match.externalId)
    .sort((a, b) => {
      const now = Date.now();
      const da = Math.abs(new Date(a.matchDate).getTime() - now);
      const db = Math.abs(new Date(b.matchDate).getTime() - now);
      return da - db;
    })
    .slice(0, 4);

  for (const match of candidates) {
    try {
      const payload = await apiFootballFetch<{ response?: ApiFootballLineupItem[] }>('/lineups', { fixture: Number(match.externalId) });
      const lineups = payload.response || [];
      const teamLineup = lineups.find((item) => Number(item.team?.id) === Number(team.apiFootballId));
      if (!teamLineup) continue;

      const starters = (teamLineup.startXI || [])
        .map((item) => normalizeProviderPlayerId(item.player?.id))
        .filter((playerId): playerId is number => Boolean(playerId));
      const substitutes = (teamLineup.substitutes || [])
        .map((item) => normalizeProviderPlayerId(item.player?.id))
        .filter((playerId): playerId is number => Boolean(playerId));

      if (starters.length > 0 || substitutes.length > 0) {
        const opponent = match.homeTeamId === team.id || match.homeTeam?.id === team.id ? match.awayTeam : match.homeTeam;
        return {
          source: 'API_FOOTBALL',
          fixtureId: match.externalId,
          formation: teamLineup.formation || null,
          matchLabel: opponent?.name ? `${team.name} × ${opponent.name}` : team.name,
          starters,
          substitutes,
        };
      }
    } catch {
      // Ignore provider errors on public pages and fall back to predicted lineup.
    }
  }

  return null;
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      team: true,
      performances: {
        orderBy: { createdAt: 'desc' },
        take: 8,
      },
      intelligenceReports: {
        orderBy: { publishedAt: 'desc' },
        take: 8,
      },
      players: {
        orderBy: [
          { score: 'desc' },
          { marketPrice: 'desc' },
        ],
        include: {
          performances: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      marketNews: {
        orderBy: { publishedAt: 'desc' },
        take: 8,
      },
      homeMatches: {
        orderBy: { matchDate: 'asc' },
        take: 8,
        include: { homeTeam: true, awayTeam: true },
      },
      awayMatches: {
        orderBy: { matchDate: 'asc' },
        take: 8,
        include: { homeTeam: true, awayTeam: true },
      },
    },
  });

  const isTeam = asset?.type === 'TEAM';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mcprime-exchange.com';
  const teamMatches = asset ? [...(asset.homeMatches || []), ...(asset.awayMatches || [])] : [];
  const officialLineup = isTeam && asset ? await getOfficialLineupForTeam(asset, teamMatches) : null;

  const normalizedAsset = asset ? {
    ...asset,
    officialLineup,
    players: asset.players?.map((player: AssetPagePlayer) => ({
      ...player,
      lastPerformanceRating: player.lastPerformanceRating ?? player.performances?.[0]?.internalRating ?? null,
    })) || [],
  } : null;

  const jsonLd = asset ? {
    "@context": "https://schema.org",
    "@type": isTeam ? "SportsTeam" : "Person",
    "name": asset.name,
    "description": isTeam
      ? `تحليل فني وإحصائي موثق لمنتخب ${asset.name}: التقارير، قوة الخطوط، اللاعبين المؤثرين، والمباريات.`
      : `تداول أسهم ${asset.name} في منصة MC PRIME Exchange. السعر المباشر: ${asset.current_price}¢.`,
    "url": `${baseUrl}/asset/${asset.id}`,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {normalizedAsset && (
        <AssetPageTabs
          isTeam={isTeam}
          lineup={isTeam ? <TeamPitchLineup team={normalizedAsset} /> : undefined}
          trade={isTeam ? <TeamTradePanel assetId={normalizedAsset.id} initialPrice={normalizedAsset.marketPrice ?? normalizedAsset.current_price} fairValue={normalizedAsset.fairValue} change={normalizedAsset.change} /> : undefined}
          technical={<FootballTechnicalAnalysis asset={normalizedAsset} />}
          overview={isTeam ? <TeamOverviewPanel team={normalizedAsset} /> : undefined}
          playerOverview={!isTeam ? <PlayerAnalysisPanel asset={normalizedAsset} /> : undefined}
          market={!isTeam ? <AssetClient /> : undefined}
        />
      )}

      {normalizedAsset && !isTeam && <StickyTradeCTA assetId={normalizedAsset.id} assetName={normalizedAsset.name} price={normalizedAsset.marketPrice ?? normalizedAsset.current_price} isTeam={isTeam} />}
    </>
  );
}
