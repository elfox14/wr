import { NextResponse } from 'next/server';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';
import { egyptTimePayload } from '@/lib/match-page/egyptTime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await params;
    const matchId = resolved.id;
    const data = await getMatchPageDataFast(matchId);

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Match not found', matchId }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const statsAvailable = data.stats.some((metric) => metric.available);
    const readyChecklist = data.sourceChecklist.filter((item) => item.status === 'ready').length;
    const missingChecklist = data.sourceChecklist.filter((item) => item.status === 'missing');
    const hasRequiredBaseData = Boolean(data.homeTeam?.id && data.awayTeam?.id && data.matchDate && data.status?.raw);

    return NextResponse.json({
      ok: true,
      mode: 'db_only_match_page_data_check',
      matchId: data.id,
      title: data.title,
      pageUrl: `/match-center/${data.id}`,
      kickoff: egyptTimePayload(data.matchDate),
      lastUpdated: egyptTimePayload(data.lastUpdatedAt),
      dataCheck: {
        ready: hasRequiredBaseData,
        readyChecklist,
        totalChecklist: data.sourceChecklist.length,
        missing: missingChecklist.map((item) => item.label),
        statsAvailable,
        eventsCount: data.events.length,
        sourcesCount: data.sources.length,
        sourceKeys: data.sources.map((source) => source.key),
      },
      checklist: data.sourceChecklist,
      sources: data.sources,
      note: 'This endpoint verifies the saved database data used by the match page. It never fetches external providers.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
