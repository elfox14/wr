import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitTitle(title: string) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 32 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function findArticle(slug: string) {
  await ensurePostMatchContentTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT article."title", match."homeScore", match."awayScore", home."name" AS "homeTeamName", away."name" AS "awayTeamName", home."code" AS "homeTeamCode", away."code" AS "awayTeamCode"
    FROM "MatchArticle" article
    JOIN "Match" match ON match."id" = article."matchId"
    JOIN "Asset" home ON home."id" = match."homeTeamId"
    JOIN "Asset" away ON away."id" = match."awayTeamId"
    WHERE article."slug" = $1
    LIMIT 1
  `, slug);
  return rows[0] || null;
}

function buildSvg(row: any) {
  const title = row?.title || 'تحليل مباراة كأس العالم 2026';
  const home = row?.homeTeamName || 'الفريق الأول';
  const away = row?.awayTeamName || 'الفريق الثاني';
  const homeCode = row?.homeTeamCode || home.slice(0, 3);
  const awayCode = row?.awayTeamCode || away.slice(0, 3);
  const score = `${row?.homeScore ?? 0} - ${row?.awayScore ?? 0}`;
  const titleLines = splitTitle(title).map((line, index) => `<tspan x="600" dy="${index === 0 ? 0 : 54}">${escapeXml(line)}</tspan>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="675" fill="#04110D"/>
  <defs>
    <radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1020 95) rotate(137) scale(590)"><stop stop-color="#18E58F" stop-opacity="0.42"/><stop offset="1" stop-color="#18E58F" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(140 610) rotate(-38) scale(560)"><stop stop-color="#F8C846" stop-opacity="0.34"/><stop offset="1" stop-color="#F8C846" stop-opacity="0"/></radialGradient>
    <linearGradient id="card" x1="70" y1="48" x2="1135" y2="628" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity="0.13"/><stop offset="1" stop-color="white" stop-opacity="0.025"/></linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g1)"/><rect width="1200" height="675" fill="url(#g2)"/>
  <path d="M0 450 C220 390 360 510 560 455 C770 398 925 492 1200 420 V675 H0 V450Z" fill="white" fill-opacity="0.035"/>
  <rect x="54" y="42" width="1092" height="591" rx="56" fill="url(#card)" stroke="white" stroke-opacity="0.14"/>
  <text x="600" y="108" text-anchor="middle" fill="#18E58F" font-family="Arial, Tahoma, sans-serif" font-size="28" font-weight="900" direction="rtl">MC PRIME WORLD CUP</text>
  <text x="600" y="150" text-anchor="middle" fill="#F8C846" font-family="Arial, Tahoma, sans-serif" font-size="25" font-weight="900" direction="rtl">تحليل بعد المباراة</text>
  <rect x="110" y="215" width="290" height="118" rx="30" fill="black" fill-opacity="0.36" stroke="white" stroke-opacity="0.10"/>
  <rect x="800" y="215" width="290" height="118" rx="30" fill="black" fill-opacity="0.36" stroke="white" stroke-opacity="0.10"/>
  <text x="255" y="263" text-anchor="middle" fill="#F8C846" font-family="Arial, Tahoma, sans-serif" font-size="30" font-weight="900" direction="rtl">${escapeXml(homeCode)}</text>
  <text x="255" y="303" text-anchor="middle" fill="white" font-family="Arial, Tahoma, sans-serif" font-size="28" font-weight="900" direction="rtl">${escapeXml(home)}</text>
  <text x="945" y="263" text-anchor="middle" fill="#18E58F" font-family="Arial, Tahoma, sans-serif" font-size="30" font-weight="900" direction="rtl">${escapeXml(awayCode)}</text>
  <text x="945" y="303" text-anchor="middle" fill="white" font-family="Arial, Tahoma, sans-serif" font-size="28" font-weight="900" direction="rtl">${escapeXml(away)}</text>
  <rect x="445" y="205" width="310" height="140" rx="38" fill="#020807" fill-opacity="0.68" stroke="#F8C846" stroke-opacity="0.34"/>
  <text x="600" y="293" text-anchor="middle" fill="white" font-family="Arial, Tahoma, sans-serif" font-size="72" font-weight="900">${escapeXml(score)}</text>
  <text x="600" y="425" text-anchor="middle" fill="white" font-family="Arial, Tahoma, sans-serif" font-size="42" font-weight="900" direction="rtl">${titleLines}</text>
  <text x="600" y="579" text-anchor="middle" fill="#B6C7BE" font-family="Arial, Tahoma, sans-serif" font-size="23" font-weight="800" direction="rtl">صورة تحريرية مولدة من بيانات المباراة</text>
</svg>`;
}

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const article = await findArticle(slug);
  return new NextResponse(buildSvg(article), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
