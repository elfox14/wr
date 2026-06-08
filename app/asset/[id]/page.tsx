import { Metadata, ResolvingMetadata } from 'next';
import AssetClient from '@/components/AssetClient';
import { PlayerAnalysisPanel } from '@/components/PlayerAnalysisPanel';
import { TeamAnalysisPanel } from '@/components/TeamAnalysisPanel';
import prisma from '@/lib/prisma';

type Props = {
  params: Promise<{ id: string }>
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { id } = await params;

  // fetch data
  const asset = await prisma.asset.findUnique({
    where: { id },
  });

  if (!asset) {
    return {
      title: 'أصل غير موجود | MC PRIME Exchange',
    };
  }

  const isValidOgImage =
    typeof asset.image === 'string' &&
    (asset.image.startsWith('http://') ||
     asset.image.startsWith('https://') ||
     asset.image.startsWith('/'));

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

  const normalizedAsset = asset ? {
    ...asset,
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
      {isTeam && normalizedAsset && <TeamAnalysisPanel team={normalizedAsset} />}
      {!isTeam && normalizedAsset && <PlayerAnalysisPanel asset={normalizedAsset} />}
      <AssetClient />
    </>
  );
}
