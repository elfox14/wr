import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

function list(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function verifiedSnapshot(snapshots: any[]) {
  return snapshots.find((snapshot) => {
    const provider = String(snapshot.provider || '').toUpperCase();
    const normalized = snapshot.rawData?.normalized;
    const stats = normalized?.liveStats?.stats || normalized?.stats;
    return provider.includes('THE_STATS') && stats && Object.keys(stats).length >= 3;
  }) || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const { id: matchId } = await params;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 24 },
      },
    });

    if (!match) return NextResponse.json({ success: false, error: 'MATCH_NOT_FOUND' }, { status: 404 });
    if (!FINISHED.includes(String(match.status || '').toUpperCase())) {
      return NextResponse.json({ success: false, error: 'MATCH_NOT_FINAL' }, { status: 409 });
    }

    const snapshot = verifiedSnapshot(match.statsSnapshots || []);
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'VERIFIED_SNAPSHOT_NOT_FOUND' }, { status: 409 });
    }

    const normalized = (snapshot.rawData as any)?.normalized || {};
    const stats = normalized?.liveStats?.stats || normalized?.stats || {};
    const players = list(normalized.playerStats)
      .filter((player) => player?.started === true || player?.played === true || Number(player?.minutes || 0) > 0)
      .map((player) => ({
        playerId: String(player.playerId || player.player_id || ''),
        playerName: String(player.playerName || player.player_name || player.name || '').trim(),
        teamId: String(player.teamId || player.team_id || ''),
        rating: number(player.rating),
        minutes: number(player.minutes),
        goals: number(player.goals),
        assists: number(player.assists),
      }))
      .filter((player) => player.playerName);

    const topRatedPlayers = players
      .filter((player) => player.rating !== null)
      .sort((a, b) => Number(b.rating) - Number(a.rating))
      .slice(0, 3);

    const playerHeatmaps = list(normalized.playerHeatmaps).filter((heatmap) => list(heatmap?.points).length > 0);
    const shotmap = list(normalized.shotmap);

    const infographicData = {
      version: 2,
      status: 'DRAFT_READY',
      source: {
        snapshotId: snapshot.id,
        provider: snapshot.provider,
        capturedAt: new Date(snapshot.capturedAt).toISOString(),
      },
      generatedAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      coverage: {
        metricKeys: Object.keys(stats),
        playerCount: players.length,
        playerHeatmapCount: playerHeatmaps.length,
        shotCount: shotmap.length,
        topRatedPlayers,
      },
    };

    await prisma.match.update({
      where: { id: matchId },
      data: { infographicData: infographicData as any },
    });

    return NextResponse.json({
      success: true,
      status: infographicData.status,
      sourceSnapshotId: snapshot.id,
      coverage: infographicData.coverage,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error generating verified infographic:', error);
    return NextResponse.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
}
