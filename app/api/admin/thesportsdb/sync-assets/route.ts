import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  extractPlayerProfile,
  extractTeamProfile,
  normalizeSportsDbName,
  pickPlayerImage,
  pickTeamImage,
  searchPlayers,
  searchTeams,
} from '@/lib/theSportsDb';

type AdminSession = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  };
} | null;

function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('adminSecret') || '';

  return [bearer, headerSecret, querySecret].some((value) => value && value === expectedSecret);
}

async function requireAdmin(req: Request) {
  if (hasValidAdminSecret(req)) return { secret: true };

  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (session.user.role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function bestTeamMatch(assetName: string, teams: any[]) {
  const normalizedAssetName = normalizeSportsDbName(assetName);
  return teams.find((team) => normalizeSportsDbName(team.strTeam) === normalizedAssetName) ||
    teams.find((team) => normalizeSportsDbName(team.strTeam).includes(normalizedAssetName) || normalizedAssetName.includes(normalizeSportsDbName(team.strTeam))) ||
    teams[0] || null;
}

function bestPlayerMatch(assetName: string, players: any[]) {
  const normalizedAssetName = normalizeSportsDbName(assetName);
  return players.find((player) => normalizeSportsDbName(player.strPlayer) === normalizedAssetName) ||
    players.find((player) => normalizeSportsDbName(player.strPlayer).includes(normalizedAssetName) || normalizedAssetName.includes(normalizeSportsDbName(player.strPlayer))) ||
    players[0] || null;
}

function shouldReplaceImage(currentImage?: string | null) {
  if (!currentImage) return true;
  if (currentImage.startsWith('http://') || currentImage.startsWith('https://')) return false;
  return true;
}

function isRealImage(image?: string | null) {
  return !!image && (image.startsWith('http://') || image.startsWith('https://'));
}

function getTeamFallbackImage(asset: any) {
  return isRealImage(asset.team?.image) ? asset.team.image : null;
}

async function updatePlayerImageFromFallback(asset: any, dryRun: boolean, overwriteImages: boolean) {
  const teamImage = getTeamFallbackImage(asset);
  const shouldUpdateImage = overwriteImages || shouldReplaceImage(asset.image);

  if (!teamImage) {
    return {
      updated: false,
      imageAfter: asset.image,
      imageSource: 'unchanged',
    };
  }

  if (!dryRun && shouldUpdateImage) {
    await prisma.asset.update({
      where: { id: asset.id },
      data: { image: teamImage },
    });
  }

  return {
    updated: true,
    imageAfter: shouldUpdateImage ? teamImage : asset.image,
    imageSource: 'team_fallback',
  };
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin.error) return admin.error;

  const body = await req.json().catch(() => ({}));
  const type = body.type === 'PLAYER' ? 'PLAYER' : body.type === 'TEAM' ? 'TEAM' : undefined;
  const assetId = body.assetId ? String(body.assetId) : undefined;
  const syncAll = body.all === true || body.limit === 'all';
  const limit = syncAll ? 5000 : Math.min(1000, Math.max(1, Number(body.limit || 50)));
  const dryRun = body.dryRun === true;
  const overwriteImages = body.overwriteImages === true;
  const fallbackToTeamImage = body.fallbackToTeamImage !== false;

  const assets = await prisma.asset.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(assetId ? { id: assetId } : {}),
    },
    include: {
      team: true,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    take: assetId ? 1 : limit,
  });

  const results: any[] = [];

  for (const asset of assets) {
    try {
      if (asset.type === 'TEAM') {
        const teams = await searchTeams(asset.name);
        const match = bestTeamMatch(asset.name, teams);
        const image = match ? pickTeamImage(match) : null;
        const profile = match ? extractTeamProfile(match) : null;
        const shouldUpdateImage = overwriteImages || shouldReplaceImage(asset.image);

        if (!match) {
          results.push({ assetId: asset.id, name: asset.name, type: asset.type, status: 'not_found' });
          continue;
        }

        if (!dryRun) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: {
              image: shouldUpdateImage && image ? image : asset.image,
              marketNews: {
                create: {
                  eventType: 'data_enrichment',
                  severity: 'low',
                  localeGroupKey: `${asset.id}:thesportsdb_enrichment`,
                  titleAr: `تحديث بيانات ${asset.name}`,
                  bodyAr: 'تم تحديث بيانات وصورة الأصل من TheSportsDB.',
                  titleEn: `${asset.name} data updated`,
                  bodyEn: 'Asset image and profile were enriched from TheSportsDB.',
                  context: profile as any,
                },
              },
            },
          }).catch(async () => {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { image: shouldUpdateImage && image ? image : asset.image },
            });
          });
        }

        results.push({
          assetId: asset.id,
          name: asset.name,
          type: asset.type,
          status: dryRun ? 'matched_dry_run' : 'updated',
          providerName: match.strTeam,
          providerId: match.idTeam,
          imageBefore: asset.image,
          imageAfter: shouldUpdateImage && image ? image : asset.image,
          imageSource: image ? 'thesportsdb_team' : 'unchanged',
          profile,
        });
      } else {
        let players: any[] = [];
        let playerLookupError: any = null;

        try {
          players = await searchPlayers(asset.name);
        } catch (error: any) {
          playerLookupError = error;
          players = [];
        }

        const match = bestPlayerMatch(asset.name, players);
        const playerImage = match ? pickPlayerImage(match) : null;
        const profile = match ? extractPlayerProfile(match) : null;
        const teamImage = fallbackToTeamImage ? getTeamFallbackImage(asset) : null;
        const finalImage = playerImage || teamImage || null;
        const imageSource = playerImage ? 'thesportsdb_player' : teamImage ? 'team_fallback' : 'unchanged';
        const shouldUpdateImage = overwriteImages || shouldReplaceImage(asset.image);

        if (!match && !finalImage) {
          results.push({
            assetId: asset.id,
            name: asset.name,
            type: asset.type,
            status: 'not_found',
            lookupError: playerLookupError?.message || null,
          });
          continue;
        }

        if (!dryRun) {
          const updateData: any = {
            image: shouldUpdateImage && finalImage ? finalImage : asset.image,
          };

          if (profile?.position && !asset.position) updateData.position = profile.position;
          if (profile?.team && !asset.club) updateData.club = profile.team;

          await prisma.asset.update({
            where: { id: asset.id },
            data: updateData,
          });
        }

        results.push({
          assetId: asset.id,
          name: asset.name,
          type: asset.type,
          status: dryRun ? 'matched_dry_run' : 'updated',
          providerName: match?.strPlayer || asset.team?.name || null,
          providerId: match?.idPlayer || null,
          imageBefore: asset.image,
          imageAfter: shouldUpdateImage && finalImage ? finalImage : asset.image,
          imageSource,
          lookupError: playerLookupError?.message || null,
          profile,
        });
      }
    } catch (error: any) {
      if (asset.type === 'PLAYER' && fallbackToTeamImage) {
        const fallback = await updatePlayerImageFromFallback(asset, dryRun, overwriteImages).catch(() => null);
        if (fallback?.updated) {
          results.push({
            assetId: asset.id,
            name: asset.name,
            type: asset.type,
            status: dryRun ? 'matched_dry_run' : 'updated',
            providerName: asset.team?.name || null,
            providerId: null,
            imageBefore: asset.image,
            imageAfter: fallback.imageAfter,
            imageSource: fallback.imageSource,
            lookupError: error.message,
          });
          continue;
        }
      }

      results.push({
        assetId: asset.id,
        name: asset.name,
        type: asset.type,
        status: 'error',
        error: error.message,
        details: error.payload || null,
      });
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    total: assets.length,
    matched: results.filter((r) => r.status === 'updated' || r.status === 'matched_dry_run').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    errors: results.filter((r) => r.status === 'error').length,
    teamFallbackImages: results.filter((r) => r.imageSource === 'team_fallback').length,
    realPlayerImages: results.filter((r) => r.imageSource === 'thesportsdb_player').length,
    lookupErrorsRecovered: results.filter((r) => r.lookupError && r.status !== 'error').length,
    results,
  });
}
