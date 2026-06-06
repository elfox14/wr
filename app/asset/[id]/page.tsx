import { Metadata, ResolvingMetadata } from 'next';
import AssetClient from '@/components/AssetClient';
import prisma from '@/lib/prisma';

type Props = {
  params: { id: string }
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
      title: 'أصل غير موجود | WorldCup Exchange',
    };
  }

  return {
    title: `${asset.name} (${asset.code}) | تداول في بورصة المونديال`,
    description: `تداول أسهم ${asset.name} في منصة WorldCup Exchange. تابع السعر المباشر: ${asset.current_price}¢ وأداء الأصل في البطولة.`,
    openGraph: {
      images: [asset.image], // Ideally a real URL, but fallback to emoji if that's what image is
    },
  };
}

export default async function AssetPage({ params }: Props) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });

  const isTeam = asset?.type === 'TEAM';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = asset ? {
    "@context": "https://schema.org",
    "@type": isTeam ? "SportsTeam" : "Person",
    "name": asset.name,
    "description": `تداول أسهم ${asset.name} في منصة WorldCup Exchange. السعر المباشر: ${asset.current_price}¢.`,
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
      <AssetClient />
    </>
  );
}
