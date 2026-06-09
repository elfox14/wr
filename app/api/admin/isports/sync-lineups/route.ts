import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { getFootballLineups } from '@/lib/isportsApi';
import { bestNameMatch, flattenLineupPlayers, mapISportsPosition, normalizeISportsName } from '@/lib/isportsMapping';

async function findAssetForPlayer(player: any, candidates: any[]) {
  const playerId = Number(player.playerId);
  if (playerId) {
    const byId = candidates.find((asset) => asset.isportsId === playerId);
    if (byId) return byId;
  }

  return bestNameMatch(player.name, candidates.map((asset) => ({ ...asset, name: asset.name }))) || null;
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.authorized) return admin.error;

  const body = await req.json().catch(() => ({}));
  const matchId = Number(body.matchId);
  const dryRun = body.dryRun === true;
  const force = body.force === true;
  const markUnavailableBackups = body.markUnavailableBackups === true;

  if (!matchId || Number.isNaN(matchId)) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
  }

  try {
    const payload: any = await getFootballLineups({ matchId });
    if (payload?.code !== 0) {
      return NextResponse.json({
        success: false,
        code: payload?.code,
        message: payload?.message || 'iSportsAPI returned an error',
        payload,
      }, { status: 200 });
    }

    const players = flattenLineupPlayers(payload);
    const candidates = await prisma.asset.findMany({ where: { type: 'PLAYER' }, take: 5000 });
    const results: any[] = [];

    for (const player of players) {
      const asset = await findAssetForPlayer(player, candidates);
      const providerPlayerId = Number(player.playerId) || null;
      const started = player.squadRole === 'lineup';
      const position = mapISportsPosition(player.position);

      if (!asset) {
        results.push({
          providerPlayerId,
          providerName: player.name,
          status: 'not_matched',
          side: player.side,
          squadRole: player.squadRole,
          normalizedName: normalizeISportsName(player.name),
        });
        continue;
      }

      const shouldUpdateProvider = force || !asset.isportsId;
      const updateData: any = {};
      if (shouldUpdateProvider && providerPlayerId) updateData.isportsId = providerPlayerId;
      if (position && !asset.position) updateData.position = position;
      if (started && Number(asset.playerTier || 0) < 0.8) updateData.playerTier = player.isCaptain ? 1 : 0.85;
      if (player.isCaptain && Number(asset.roleImportance || 0) < 0.9) updateData.roleImportance = 1;
      if (markUnavailableBackups && !started && asset.isAvailable) updateData.isAvailable = true;

      if (!dryRun && Object.keys(updateData).length > 0) {
        await prisma.asset.update({ where: { id: asset.id }, data: updateData });
      }

      results.push({
        assetId: asset.id,
        assetName: asset.name,
        providerPlayerId,
        providerName: player.name,
        status: dryRun ? 'matched_dry_run' : Object.keys(updateData).length ? 'updated' : 'matched_no_change',
        side: player.side,
        squadRole: player.squadRole,
        number: player.number,
        position,
        isCaptain: player.isCaptain,
        updateData,
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      matchId,
      total: players.length,
      matched: results.filter((item) => item.status !== 'not_matched').length,
      updated: results.filter((item) => item.status === 'updated').length,
      notMatched: results.filter((item) => item.status === 'not_matched').length,
      lineups: payload.data || [],
      results,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to sync iSports lineups',
      primary: error.primary || null,
      fallback: error.fallback || null,
    }, { status: 500 });
  }
}
