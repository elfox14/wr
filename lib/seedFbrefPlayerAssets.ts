import { PrismaClient } from '@prisma/client';
import { calculateFairValue, calculateMarketPrice, calculatePlayerScore } from './scoring';
import { groupAFbrefStats, type GroupAFbrefRosterPlayer, type GroupAFbrefTeamStats } from './groupAFbrefStats';
import { groupBFbrefStats } from './groupBFbrefStats';
import { groupCFbrefStats } from './groupCFbrefStats';
import { groupDFbrefStats } from './groupDFbrefStats';
import { groupEFbrefStats } from './groupEFbrefStats';
import { groupFFbrefStats } from './groupFFbrefStats';
import { manualFbrefRosterSnapshots } from './fbrefManualRosterSnapshots';

const PLAYER_PROVIDER = 'FBREF_COPIED_ROSTER_PLAYER_ASSET';

type FbrefTeamWithOptionalRoster = Pick<GroupAFbrefTeamStats, 'team' | 'teamCode' | 'teamCodes' | 'sourceUrl'> & {
  roster?: GroupAFbrefRosterPlayer[];
  rosterSummary?: { count?: number | null };
};

type SeedResult = {
  provider: string;
  created: number;
  updated: number;
  skipped: number;
  missingTeams: string[];
  missingRosterTeams: string[];
  processedTeams: Array<{ team: string; code: string; players: number; status: string }>;
};

function allFbrefTeams(): FbrefTeamWithOptionalRoster[] {
  const byCode = new Map<string, FbrefTeamWithOptionalRoster>();
  for (const stats of [
    ...groupAFbrefStats,
    ...groupBFbrefStats,
    ...groupCFbrefStats,
    ...groupDFbrefStats,
    ...groupEFbrefStats,
    ...groupFFbrefStats,
    ...manualFbrefRosterSnapshots,
  ] as FbrefTeamWithOptionalRoster[]) {
    const existing = byCode.get(stats.teamCode);
    const currentRosterCount = Array.isArray(stats.roster) ? stats.roster.length : 0;
    const existingRosterCount = Array.isArray(existing?.roster) ? existing!.roster!.length : 0;
    if (!existing || currentRosterCount > existingRosterCount) byCode.set(stats.teamCode, stats);
  }
  return [...byCode.values()];
}

function toSlug(value: string) {
  return String(value || 'player')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'player';
}

function cleanCode(value: string | null | undefined, fallback: string) {
  const trimmed = String(value || '').trim();
  if (trimmed) return trimmed.slice(0, 8).toUpperCase();
  return fallback.slice(0, 8).toUpperCase();
}

function positionFundamental(pos: string | null | undefined) {
  const value = String(pos || '').toUpperCase();
  if (value.includes('FW')) return 67;
  if (value.includes('MF')) return 64;
  if (value.includes('DF')) return 62;
  if (value.includes('GK')) return 61;
  return 60;
}

function usageMomentum(player: GroupAFbrefRosterPlayer) {
  const minutes = typeof player.minutes === 'number' ? player.minutes : 0;
  const goals = typeof player.goals === 'number' ? player.goals : 0;
  const played = typeof player.mp === 'number' ? player.mp : 0;
  return Math.min(82, 48 + Math.min(minutes, 90) * 0.18 + goals * 7 + played * 3);
}

function roleImportance(player: GroupAFbrefRosterPlayer) {
  const minutes = typeof player.minutes === 'number' ? player.minutes : 0;
  const pos = String(player.pos || '').toUpperCase();
  if (minutes >= 85) return 70;
  if (minutes >= 45) return 64;
  if (minutes > 0) return 58;
  if (pos.includes('GK')) return 56;
  return 52;
}

function playerId(teamCode: string, playerName: string) {
  return `fbref-${toSlug(teamCode)}-${toSlug(playerName)}`;
}

async function findTeamAsset(prisma: PrismaClient, stats: FbrefTeamWithOptionalRoster) {
  const aliases = [...new Set([stats.teamCode, stats.team, ...(stats.teamCodes || [])].map((item) => String(item || '').toUpperCase()))];
  return prisma.asset.findFirst({
    where: {
      type: 'TEAM',
      OR: [
        { code: { in: aliases } },
        { name: { equals: stats.team, mode: 'insensitive' } },
        { name: { contains: stats.team, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, code: true, image: true, group: true },
  });
}

async function upsertPlayer(prisma: PrismaClient, teamAsset: { id: string; name: string; code: string }, stats: FbrefTeamWithOptionalRoster, player: GroupAFbrefRosterPlayer) {
  const fundamental = positionFundamental(player.pos);
  const momentum = usageMomentum(player);
  const importance = roleImportance(player);
  const score = calculatePlayerScore({
    fundamental,
    popularity: 50,
    worldCupLegacy: 45,
    marketDemand: 50,
    momentum,
    age: player.ageYears || undefined,
    roleImportance: importance,
    playerTier: importance,
  });
  const fairValue = calculateFairValue(score, 'PLAYER');
  const marketPrice = calculateMarketPrice({ fairValue, marketDemand: 50, momentum, popularity: 50, volatilityScore: 18, ownersCount: 0 });
  const id = playerId(stats.teamCode, player.player);

  const existing = await prisma.asset.findUnique({ where: { id }, select: { id: true } });

  await prisma.asset.upsert({
    where: { id },
    create: {
      id,
      type: 'PLAYER',
      name: player.player,
      code: cleanCode(player.number, player.player),
      image: '👤',
      current_price: marketPrice,
      high_price: marketPrice,
      low_price: marketPrice,
      market_cap: `${Math.round(marketPrice * 100)}`,
      volume: '0',
      change: 0,
      position: player.pos || null,
      age: player.ageYears || null,
      club: player.club || null,
      teamId: teamAsset.id,
      fundamental,
      popularity: 50,
      worldCupLegacy: 45,
      marketDemand: 50,
      momentum,
      volatilityScore: 18,
      fairValue,
      marketPrice,
      score,
      playerTier: importance,
      roleImportance: importance,
    },
    update: {
      name: player.player,
      code: cleanCode(player.number, player.player),
      position: player.pos || null,
      age: player.ageYears || null,
      club: player.club || null,
      teamId: teamAsset.id,
      current_price: marketPrice,
      high_price: marketPrice,
      low_price: marketPrice,
      market_cap: `${Math.round(marketPrice * 100)}`,
      fundamental,
      popularity: 50,
      worldCupLegacy: 45,
      marketDemand: 50,
      momentum,
      volatilityScore: 18,
      fairValue,
      marketPrice,
      score,
      playerTier: importance,
      roleImportance: importance,
    },
  });

  await prisma.playerPerformance.upsert({
    where: { assetId_providerFixtureId: { assetId: id, providerFixtureId: 2026 } },
    create: {
      assetId: id,
      provider: PLAYER_PROVIDER,
      providerFixtureId: 2026,
      season: 2026,
      competition: 'World Cup',
      teamName: teamAsset.name,
      minutes: player.minutes || 0,
      started: Boolean(player.minutes && player.minutes >= 60),
      goals: player.goals || 0,
      internalRating: score,
      momentumImpact: Math.round((momentum - 50) * 10) / 10,
      marketImpact: Math.round((marketPrice - fairValue) * 10) / 10,
      rawData: {
        provider: PLAYER_PROVIDER,
        sourceUrl: stats.sourceUrl,
        teamCode: stats.teamCode,
        roster: player,
      },
    },
    update: {
      provider: PLAYER_PROVIDER,
      season: 2026,
      competition: 'World Cup',
      teamName: teamAsset.name,
      minutes: player.minutes || 0,
      started: Boolean(player.minutes && player.minutes >= 60),
      goals: player.goals || 0,
      internalRating: score,
      momentumImpact: Math.round((momentum - 50) * 10) / 10,
      marketImpact: Math.round((marketPrice - fairValue) * 10) / 10,
      rawData: {
        provider: PLAYER_PROVIDER,
        sourceUrl: stats.sourceUrl,
        teamCode: stats.teamCode,
        roster: player,
      },
    },
  });

  return existing ? 'updated' : 'created';
}

export async function seedFbrefPlayerAssets(prisma: PrismaClient): Promise<SeedResult> {
  const result: SeedResult = {
    provider: PLAYER_PROVIDER,
    created: 0,
    updated: 0,
    skipped: 0,
    missingTeams: [],
    missingRosterTeams: [],
    processedTeams: [],
  };

  const teams = allFbrefTeams();
  for (const stats of teams) {
    const roster = Array.isArray(stats.roster) ? stats.roster.filter((player) => player?.player) : [];
    if (!roster.length) {
      result.missingRosterTeams.push(`${stats.teamCode}:${stats.team}`);
      result.processedTeams.push({ team: stats.team, code: stats.teamCode, players: 0, status: 'missing_roster' });
      continue;
    }

    const teamAsset = await findTeamAsset(prisma, stats);
    if (!teamAsset) {
      result.missingTeams.push(`${stats.teamCode}:${stats.team}`);
      result.skipped += roster.length;
      result.processedTeams.push({ team: stats.team, code: stats.teamCode, players: roster.length, status: 'missing_team_asset' });
      continue;
    }

    let teamCreated = 0;
    let teamUpdated = 0;
    for (const player of roster) {
      const status = await upsertPlayer(prisma, teamAsset, stats, player);
      if (status === 'created') {
        result.created += 1;
        teamCreated += 1;
      } else {
        result.updated += 1;
        teamUpdated += 1;
      }
    }

    result.processedTeams.push({
      team: stats.team,
      code: stats.teamCode,
      players: roster.length,
      status: `created:${teamCreated},updated:${teamUpdated}`,
    });
  }

  return result;
}
