import { Metadata, ResolvingMetadata } from 'next';
import AssetClient from '@/components/AssetClient';
import { PlayerAnalysisPanel } from '@/components/PlayerAnalysisPanel';
import TeamPitchLineup from '@/components/TeamPitchLineup';
import TeamOverviewPanel from '@/components/TeamOverviewPanel';
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

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;

  const asset = await prisma.asset.findUnique({ where: { id } });

  if (!asset) return { title: 'أصل غير موجود | MC PRIME Exchange' };

  const isValidOgImage =
    typeof asset.image === 'string' &&
    (asset.image.startsWith('http://') || asset.image.startsWith('https://') || asset.image.startsWith('/'));

  const ogImage = isValidOgImage ? asset.image : '/og-image.jpg';

  return {
    title: `${asset.name} (${asset.code}) | MC PRIME Exchange`,
    description: `تداول أسهم ${asset.name} في منصة MC PRIME Exchange. تابع السعر المباشر: ${asset.current_price}¢ وأداء الأصل في البطولة.`,
    openGraph: {
      title: `${asset.name} | MC PRIME Exchange`,
      description: `تداول أسهم ${asset.name} في بورصة المونديال الافتراضية.`,
      images: [ogImage],
    },
  };
}

function normalizeProviderPlayerId(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getOfficialLineupForTeam(team: any, matches: any[]): Promise<OfficialLineup | null> {
  if (!team?.apiFootballId || !Array.isArray(matches) || matches.length === 0) return null;

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
      const payload = await apiFootballFetch<{ response?: any[] }>('/lineups', { fixture: Number(match.externalId) });
      const lineups = payload.response || [];
      const teamLineup = lineups.find((item: any) => Number(item?.team?.id) === Number(team.apiFootballId));
      if (!teamLineup) continue;

      const starters = (teamLineup.startXI || [])
        .map((item: any) => normalizeProviderPlayerId(item?.player?.id))
        .filter(Boolean) as number[];
      const substitutes = (teamLineup.substitutes || [])
        .map((item: any) => normalizeProviderPlayerId(item?.player?.id))
        .filter(Boolean) as number[];

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
    players: asset.players?.map((player: any) => ({
      ...player,
      lastPerformanceRating: player.lastPerformanceRating ?? player.performances?.[0]?.internalRating ?? null,
    })) || [],
  } : null;

  const jsonLd = asset ? {
    "@context": "https://schema.org",
    "@type": isTeam ? "SportsTeam" : "Person",
    "name": asset.name,
    "description": `تداول أسهم ${asset.name} في منصة MC PRIME Exchange. السعر المباشر: ${asset.current_price}¢.`,
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
      {isTeam && normalizedAsset && <TeamPitchLineup team={normalizedAsset} />}
      {isTeam && normalizedAsset && <TeamOverviewPanel team={normalizedAsset} />}
      {!isTeam && normalizedAsset && <PlayerAnalysisPanel asset={normalizedAsset} />}
      {!isTeam && <AssetClient />}
    </>
  );
}
