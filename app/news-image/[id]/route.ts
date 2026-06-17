import { NextResponse } from 'next/server';
import { WORLD_CUP_2026_OPENING_NEWS, getPressNewsMeta } from '@/lib/press-news/world-cup-2026-opening-news';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

function escapeXml(value: string) {
  return String(value)
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
    if (next.length > 34 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function buildSvg(title: string, meta: ReturnType<typeof getPressNewsMeta>) {
  const flagA = meta.flagA || '⚽';
  const flagB = meta.flagB || '🏆';
  const score = meta.score || 'كأس العالم 2026';
  const label = meta.label || 'تحليل مباراة';
  const safeTitleLines = splitTitle(title).map((line, index) =>
    `<tspan x="600" dy="${index === 0 ? 0 : 58}">${escapeXml(line)}</tspan>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="675" fill="#050505"/>
  <defs>
    <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1010 90) rotate(136) scale(520)">
      <stop stop-color="#0FF0FC" stop-opacity="0.44"/>
      <stop offset="1" stop-color="#0FF0FC" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(180 620) rotate(-37) scale(520)">
      <stop stop-color="#FFD700" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#FFD700" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="card" x1="70" y1="50" x2="1130" y2="625" gradientUnits="userSpaceOnUse">
      <stop stop-color="white" stop-opacity="0.12"/>
      <stop offset="1" stop-color="white" stop-opacity="0.025"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#glowA)"/>
  <rect width="1200" height="675" fill="url(#glowB)"/>
  <rect x="55" y="44" width="1090" height="587" rx="54" fill="url(#card)" stroke="white" stroke-opacity="0.13"/>
  <circle cx="1050" cy="140" r="155" fill="#0FF0FC" fill-opacity="0.08"/>
  <circle cx="155" cy="540" r="180" fill="#FFD700" fill-opacity="0.07"/>

  <text x="600" y="108" text-anchor="middle" fill="#0FF0FC" font-family="Arial, 'Segoe UI Emoji', sans-serif" font-size="28" font-weight="900" direction="rtl">بورصة المونديال</text>
  <text x="600" y="152" text-anchor="middle" fill="#FFD700" font-family="Arial, 'Segoe UI Emoji', sans-serif" font-size="24" font-weight="900" direction="rtl">${escapeXml(label)}</text>

  <text x="405" y="286" text-anchor="middle" font-family="Arial, 'Segoe UI Emoji', sans-serif" font-size="112">${escapeXml(flagA)}</text>
  <text x="795" y="286" text-anchor="middle" font-family="Arial, 'Segoe UI Emoji', sans-serif" font-size="112">${escapeXml(flagB)}</text>
  <rect x="470" y="215" width="260" height="95" rx="28" fill="black" fill-opacity="0.42" stroke="#FFD700" stroke-opacity="0.35"/>
  <text x="600" y="278" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="46" font-weight="900">${escapeXml(score)}</text>

  <text x="600" y="395" text-anchor="middle" fill="white" font-family="Arial, 'Tahoma', sans-serif" font-size="43" font-weight="900" direction="rtl">${safeTitleLines}</text>
  <text x="600" y="575" text-anchor="middle" fill="#A5B4FC" font-family="Arial, 'Tahoma', sans-serif" font-size="23" font-weight="800" direction="rtl">صورة تحريرية آمنة للسيو — أعلام ونتيجة بدون شعارات رسمية</text>
</svg>`;
}

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const item = WORLD_CUP_2026_OPENING_NEWS.find((entry) => entry.id === id);
  const title = item?.title || 'كأس العالم 2026';
  const meta = getPressNewsMeta(item?.tags, title);
  const svg = buildSvg(title, meta);

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
