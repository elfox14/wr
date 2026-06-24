import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 86400;

type Props = { params: Promise<{ id: string }> };

function xml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function objectValue(value: any) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
  }
  return {};
}

function metricValue(input: unknown, suffix = '') {
  if (input === null || input === undefined || Number.isNaN(Number(input))) return '—';
  return `${input}${suffix}`;
}

async function loadInfographic(id: string) {
  await ensurePostMatchContentTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT i."data", h."name" AS "homeTeamName", a."name" AS "awayTeamName", m."homeScore", m."awayScore"
    FROM "MatchInfographic" i
    JOIN "Match" m ON m."id" = i."matchId"
    JOIN "Asset" h ON h."id" = m."homeTeamId"
    JOIN "Asset" a ON a."id" = m."awayTeamId"
    WHERE i."id" = $1
    LIMIT 1
  `, id);
  return rows[0] || null;
}

function rowsSvg(metrics: any[]) {
  return metrics.slice(0, 6).map((metric, index) => {
    const y = 250 + index * 56;
    return `<rect x="115" y="${y - 30}" width="970" height="44" rx="18" fill="black" fill-opacity="0.26" stroke="white" stroke-opacity="0.08"/><text x="225" y="${y}" text-anchor="middle" fill="#F8C846" font-family="Arial, Tahoma, sans-serif" font-size="25" font-weight="900">${xml(metricValue(metric.home, metric.suffix))}</text><text x="600" y="${y}" text-anchor="middle" fill="white" font-family="Arial, Tahoma, sans-serif" font-size="24" font-weight="900" direction="rtl">${xml(metric.label)}</text><text x="975" y="${y}" text-anchor="middle" fill="#18E58F" font-family="Arial, Tahoma, sans-serif" font-size="25" font-weight="900">${xml(metricValue(metric.away, metric.suffix))}</text>`;
  }).join('');
}

function buildSvg(row: any) {
  const data = objectValue(row?.data);
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const home = row?.homeTeamName || data.homeTeam?.name || 'الفريق الأول';
  const away = row?.awayTeamName || data.awayTeam?.name || 'الفريق الثاني';
  const score = data.scoreLine || `${home} ${row?.homeScore ?? 0} - ${row?.awayScore ?? 0} ${away}`;
  const statsRows = metrics.length ? rowsSvg(metrics) : `<text x="600" y="340" text-anchor="middle" fill="#B6C7BE" font-family="Arial, Tahoma, sans-serif" font-size="34" font-weight="900" direction="rtl">لا توجد إحصائيات نهائية كافية</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?><svg width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="675" fill="#04110D"/><circle cx="1050" cy="90" r="420" fill="#18E58F" fill-opacity="0.14"/><circle cx="120" cy="610" r="390" fill="#F8C846" fill-opacity="0.12"/><rect x="55" y="42" width="1090" height="591" rx="52" fill="white" fill-opacity="0.055" stroke="white" stroke-opacity="0.14"/><text x="600" y="104" text-anchor="middle" fill="#18E58F" font-family="Arial, Tahoma, sans-serif" font-size="28" font-weight="900" direction="rtl">إنفوجرافيك المباراة</text><text x="600" y="154" text-anchor="middle" fill="white" font-family="Arial, Tahoma, sans-serif" font-size="36" font-weight="900" direction="rtl">${xml(home)} ضد ${xml(away)}</text><rect x="415" y="178" width="370" height="54" rx="20" fill="black" fill-opacity="0.42" stroke="#F8C846" stroke-opacity="0.26"/><text x="600" y="214" text-anchor="middle" fill="#F8C846" font-family="Arial, Tahoma, sans-serif" font-size="26" font-weight="900" direction="rtl">${xml(score)}</text>${statsRows}<text x="600" y="610" text-anchor="middle" fill="#B6C7BE" font-family="Arial, Tahoma, sans-serif" font-size="20" font-weight="800" direction="rtl">الأرقام من Snapshot محفوظة في قاعدة البيانات</text></svg>`;
}

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  const row = await loadInfographic(id);
  return new NextResponse(buildSvg(row), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
