import { Metadata, ResolvingMetadata } from 'next';
import AssetClient from '@/components/AssetClient';
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
  const asset = await prisma.asset.findUnique({ where: { id } });

  const isTeam = asset?.type === 'TEAM';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mcprime-exchange.com';

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
      <AssetClient />
    </>
  );
}
