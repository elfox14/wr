import { NextResponse } from 'next/server';
import { getMatchAdvancedVisualsData } from '@/lib/match-page/advancedVisualsData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await getMatchAdvancedVisualsData(id);

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Match not found', matchId: id }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({
      ok: true,
      mode: 'db_only_match_advanced_visuals',
      matchId: data.matchId,
      title: data.title,
      summary: data.summary,
      shotmapCount: data.shotmap.length,
      topChances: data.topChances,
      source: data.source,
      lastUpdatedAt: data.lastUpdatedAt,
      pageUrl: `/match-center/${data.matchId}/advanced`,
      note: 'This endpoint reads saved database snapshots only. It never fetches external providers.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
