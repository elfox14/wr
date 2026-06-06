import HomeClient from '@/components/HomeClient';
import { getAssets } from '@/lib/store-server';

export default async function Home() {
  const assets = await getAssets();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "WorldCup Exchange",
    "url": baseUrl,
    "description": "أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. حلل الأداء، استثمر في النجوم، ونافس على صدارة السوق العالمي."
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient initialAssets={assets} />
    </>
  );
}
