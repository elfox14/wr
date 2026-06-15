import HomeClientSportsNextFixed from '@/components/HomeClientSportsNextFixed';
import { getAssets } from '@/lib/store-server';
import { getAllArticles } from '@/lib/articles';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const assets = await getAssets();
  const academyArticles = getAllArticles().slice(0, 4).map((article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    readingTime: article.readingTime,
    level: article.level,
    imageUrl: article.imageUrl,
    date: article.date,
  }));

  const assetsCount = await prisma.asset.count();
  const playersCount = await prisma.asset.count({ where: { type: 'PLAYER' } });
  const teamsCount = await prisma.asset.count({ where: { type: 'TEAM' } });
  const upcomingMatchesCount = await prisma.match.count({
    where: {
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
      matchDate: { gte: liveWindowStart, lte: upcomingUntil },
    },
  });

  const upcomingMatchesRaw = await prisma.match.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PLAY', 'LIVE', 'HT'] },
      matchDate: { gte: liveWindowStart, lte: upcomingUntil },
    },
    orderBy: { matchDate: 'asc' },
    take: 5,
    include: { homeTeam: true, awayTeam: true },
  });
  const upcomingMatches = JSON.parse(JSON.stringify(upcomingMatchesRaw));

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'World Cup Exchange | MC PRIME',
    url: baseUrl,
    description: 'Live World Cup matches, verified news, football analysis, and a virtual fan exchange layer.',
  };

  const homeClientProps = {
    initialAssets: assets,
    upcomingMatches,
    assetsCount,
    playersCount,
    teamsCount,
    upcomingMatchesCount,
    academyArticles,
  } as any;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            main > section:nth-of-type(3) > div.relative.grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }

            main > section:nth-of-type(3) > div.relative.grid > div:nth-child(2) {
              display: none !important;
            }

            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/players"] {
              display: none !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) .inline-flex.items-center.gap-2.rounded-full {
              font-size: 0 !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) .inline-flex.items-center.gap-2.rounded-full::after {
              content: 'STATISTICS CENTER';
              font-size: 10px !important;
              letter-spacing: 0.16em;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) h1 {
              font-size: 0 !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) h1::after {
              content: 'الإحصائيات';
              font-size: clamp(1.6rem, 4vw, 2.8rem) !important;
              line-height: 1.15;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) p:first-of-type {
              font-size: 0 !important;
            }

            main > div.relative.mx-auto.max-w-7xl > section:nth-of-type(2) p:first-of-type::after {
              content: 'ملخص رقمي مباشر للبطولة: إجمالي المباريات، المنتخبات، الدول المستضيفة، وأقرب مباريات مركز المباريات في بطاقة واحدة بدل الهيرو.';
              font-size: 0.875rem !important;
              line-height: 1.9;
            }

            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div > div.flex > span > span:first-child {
              width: 18px !important;
              height: 13px !important;
              flex: 0 0 18px !important;
              border-radius: 3px !important;
              border: 1px solid rgba(255,255,255,0.18) !important;
              background-size: cover !important;
              background-position: center !important;
              background-repeat: no-repeat !important;
              box-shadow: 0 0 10px rgba(0,0,0,0.18) !important;
              color: transparent !important;
              overflow: hidden !important;
            }

            /* المستضيفون */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(1) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/mx.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(1) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/ca.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(1) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/us.png") !important; }

            /* العرب */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/qa.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/ma.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/tn.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(4) > span:first-child { background-image: url("https://flagcdn.com/w40/eg.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(5) > span:first-child { background-image: url("https://flagcdn.com/w40/sa.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(6) > span:first-child { background-image: url("https://flagcdn.com/w40/iq.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(7) > span:first-child { background-image: url("https://flagcdn.com/w40/dz.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(2) > div.flex > span:nth-child(8) > span:first-child { background-image: url("https://flagcdn.com/w40/jo.png") !important; }

            /* أوروبا */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/cz.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/ba.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/ch.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(4) > span:first-child { background-image: url("https://flagcdn.com/w40/gb.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(5) > span:first-child { background-image: url("https://flagcdn.com/w40/tr.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(6) > span:first-child { background-image: url("https://flagcdn.com/w40/de.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(7) > span:first-child { background-image: url("https://flagcdn.com/w40/nl.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(8) > span:first-child { background-image: url("https://flagcdn.com/w40/se.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(9) > span:first-child { background-image: url("https://flagcdn.com/w40/be.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(10) > span:first-child { background-image: url("https://flagcdn.com/w40/es.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(11) > span:first-child { background-image: url("https://flagcdn.com/w40/fr.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(12) > span:first-child { background-image: url("https://flagcdn.com/w40/no.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(13) > span:first-child { background-image: url("https://flagcdn.com/w40/at.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(14) > span:first-child { background-image: url("https://flagcdn.com/w40/pt.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(15) > span:first-child { background-image: url("https://flagcdn.com/w40/gb.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(3) > div.flex > span:nth-child(16) > span:first-child { background-image: url("https://flagcdn.com/w40/hr.png") !important; }

            /* أمريكا الجنوبية */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(4) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/br.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(4) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/py.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(4) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/ec.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(4) > div.flex > span:nth-child(4) > span:first-child { background-image: url("https://flagcdn.com/w40/uy.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(4) > div.flex > span:nth-child(5) > span:first-child { background-image: url("https://flagcdn.com/w40/ar.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(4) > div.flex > span:nth-child(6) > span:first-child { background-image: url("https://flagcdn.com/w40/co.png") !important; }

            /* أفريقيا */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/za.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/ma.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/ci.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(4) > span:first-child { background-image: url("https://flagcdn.com/w40/tn.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(5) > span:first-child { background-image: url("https://flagcdn.com/w40/eg.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(6) > span:first-child { background-image: url("https://flagcdn.com/w40/sn.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(7) > span:first-child { background-image: url("https://flagcdn.com/w40/dz.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(8) > span:first-child { background-image: url("https://flagcdn.com/w40/cd.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(9) > span:first-child { background-image: url("https://flagcdn.com/w40/gh.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(5) > div.flex > span:nth-child(10) > span:first-child { background-image: url("https://flagcdn.com/w40/cv.png") !important; }

            /* آسيا */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/kr.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/qa.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/jp.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(4) > span:first-child { background-image: url("https://flagcdn.com/w40/ir.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(5) > span:first-child { background-image: url("https://flagcdn.com/w40/sa.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(6) > span:first-child { background-image: url("https://flagcdn.com/w40/iq.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(7) > span:first-child { background-image: url("https://flagcdn.com/w40/jo.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(6) > div.flex > span:nth-child(8) > span:first-child { background-image: url("https://flagcdn.com/w40/uz.png") !important; }

            /* أمريكا الشمالية والكاريبي */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(7) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/mx.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(7) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/ca.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(7) > div.flex > span:nth-child(3) > span:first-child { background-image: url("https://flagcdn.com/w40/us.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(7) > div.flex > span:nth-child(4) > span:first-child { background-image: url("https://flagcdn.com/w40/ht.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(7) > div.flex > span:nth-child(5) > span:first-child { background-image: url("https://flagcdn.com/w40/cw.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(7) > div.flex > span:nth-child(6) > span:first-child { background-image: url("https://flagcdn.com/w40/pa.png") !important; }

            /* أوقيانوسيا */
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(8) > div.flex > span:nth-child(1) > span:first-child { background-image: url("https://flagcdn.com/w40/au.png") !important; }
            main section[aria-label="أقسام كأس العالم 2026 التفاعلية"] a[href="/teams"] > div.grid > div:nth-child(8) > div.flex > span:nth-child(2) > span:first-child { background-image: url("https://flagcdn.com/w40/nz.png") !important; }
          `,
        }}
      />

      <HomeClientSportsNextFixed {...homeClientProps} />
    </>
  );
}
