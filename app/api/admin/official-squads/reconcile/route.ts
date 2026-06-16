import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { calculateFairValue, calculatePlayerScore } from '@/lib/scoring';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

type OfficialPlayer = {
  name: string;
  position?: string | null;
  club?: string | null;
  age?: number | string | null;
  shirtNumber?: number | string | null;
  number?: number | string | null;
  image?: string | null;
  photo?: string | null;
  apiFootballId?: number | string | null;
};

type OfficialTeam = {
  teamCode?: string | null;
  teamName?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  players: OfficialPlayer[];
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return '';
  return authorization.slice(7).trim();
}

function hasAdminSecret(request: Request) {
  const url = new URL(request.url);
  const supplied = getBearerToken(request) || request.headers.get('x-admin-secret') || url.searchParams.get('token') || '';
  const expected = process.env.ADMIN_API_SECRET || process.env.ADMIN_CRON_SECRET || process.env.CRON_SECRET || '';
  return Boolean(expected && supplied && supplied === expected);
}

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin(request: Request) {
  if (hasAdminSecret(request)) return { session: null };
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function normalizeName(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value?: string | null) {
  return normalizeName(value).split(' ').filter(Boolean);
}

function parseAbbreviated(value?: string | null) {
  const text = normalizeName(value);
  const match = text.match(/^([a-z])\.\s*(.+)$/);
  if (!match) return null;
  return { initial: match[1], rest: match[2].trim(), last: match[2].trim().split(' ').filter(Boolean).pop() || '' };
}

function officialSignature(value?: string | null) {
  const parts = tokens(value);
  if (!parts.length) return null;
  return {
    firstInitial: parts[0][0] || '',
    rest: parts.slice(1).join(' '),
    last: parts[parts.length - 1] || '',
  };
}

function likelySamePlayer(officialName?: string | null, existingName?: string | null) {
  const official = normalizeName(officialName);
  const existing = normalizeName(existingName);
  if (!official || !existing) return false;
  if (official === existing) return true;

  const officialParts = officialSignature(officialName);
  const existingAbbrev = parseAbbreviated(existingName);
  if (officialParts && existingAbbrev) {
    if (officialParts.firstInitial !== existingAbbrev.initial) return false;
    if (officialParts.rest && officialParts.rest === existingAbbrev.rest) return true;
    if (officialParts.last && officialParts.last === existingAbbrev.last) return true;
  }

  const officialAbbrev = parseAbbreviated(officialName);
  const existingParts = officialSignature(existingName);
  if (officialAbbrev && existingParts) {
    if (officialAbbrev.initial !== existingParts.firstInitial) return false;
    if (existingParts.rest && existingParts.rest === officialAbbrev.rest) return true;
    if (existingParts.last && existingParts.last === officialAbbrev.last) return true;
  }

  return false;
}

function asInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function slug(value: string) {
  const text = normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
  return text || Buffer.from(value).toString('hex').slice(0, 24);
}

function cleanCode(name: string, shirtNumber?: number | null) {
  return String(`${name.slice(0, 3)}${shirtNumber || ''}`)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'PLAYER';
}

function validImage(player: OfficialPlayer, existingImage?: string | null) {
  const image = String(player.image || player.photo || '').trim();
  if (hasUsablePlayerImage(image)) return image;
  return hasUsablePlayerImage(existingImage) ? existingImage || '' : '👤';
}

function valuation(position?: string | null, age?: number | null) {
  const pos = String(position || '').toUpperCase();
  let fundamental = 62;
  if (['G', 'GK', 'GOALKEEPER'].includes(pos)) fundamental = 61;
  if (['D', 'DEF', 'DEFENDER'].includes(pos)) fundamental = 62;
  if (['M', 'MID', 'MIDFIELDER'].includes(pos)) fundamental = 64;
  if (['F', 'FW', 'FWD', 'ATTACKER', 'FORWARD'].includes(pos)) fundamental = 66;
  if (age && age >= 24 && age <= 31) fundamental += 3;
  const score = calculatePlayerScore({ fundamental, popularity: 50, worldCupLegacy: 45, marketDemand: 50, momentum: 50, age: age || undefined });
  const fairValue = calculateFairValue(score, 'PLAYER');
  return { fundamental, score, fairValue };
}

async function findTeam(teamInput: OfficialTeam) {
  const code = String(teamInput.teamCode || '').toUpperCase().trim();
  if (code) {
    const team = await prisma.asset.findFirst({ where: { type: 'TEAM', code } });
    if (team) return team;
  }

  const normalizedName = normalizeName(teamInput.teamName);
  if (!normalizedName) return null;
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
  return teams.find((team) => normalizeName(team.name) === normalizedName || normalizeName(team.code) === normalizedName) || null;
}

async function reconcileTeam(teamInput: OfficialTeam, dryRun: boolean) {
  const team = await findTeam(teamInput);
  if (!team) {
    return { ok: false, error: 'team_not_found', teamCode: teamInput.teamCode || null, teamName: teamInput.teamName || null };
  }

  const officialPlayers = Array.isArray(teamInput.players) ? teamInput.players.filter((player) => String(player?.name || '').trim()) : [];
  const existingPlayers = await prisma.asset.findMany({ where: { type: 'PLAYER', teamId: team.id } });
  const usedExistingIds = new Set<string>();
  const kept: any[] = [];
  const created: any[] = [];

  for (const player of officialPlayers) {
    const apiFootballId = asInt(player.apiFootballId);
    const match = existingPlayers.find((existing) => apiFootballId && existing.apiFootballId === apiFootballId && !usedExistingIds.has(existing.id)) ||
      existingPlayers.find((existing) => !usedExistingIds.has(existing.id) && likelySamePlayer(player.name, existing.name));

    const age = asInt(player.age);
    const shirtNumber = asInt(player.shirtNumber ?? player.number);
    const { fundamental, score, fairValue } = valuation(player.position, age);
    const data = {
      type: 'PLAYER',
      name: player.name,
      code: cleanCode(player.name, shirtNumber),
      image: validImage(player, match?.image),
      position: player.position || match?.position || null,
      age: age || match?.age || null,
      club: player.club || match?.club || null,
      teamId: team.id,
      isAvailable: true,
      ...(apiFootballId ? { apiFootballId } : {}),
      current_price: match?.current_price || fairValue,
      high_price: match?.high_price || fairValue,
      low_price: match?.low_price || fairValue,
      market_cap: match?.market_cap || `${Math.round(fairValue * 100)}`,
      volume: match?.volume || '0',
      change: match?.change || 0,
      playerTier: match?.playerTier || 0.5,
      roleImportance: match?.roleImportance || 0.5,
      score: match?.score || score,
      popularity: match?.popularity || 50,
      fundamental: match?.fundamental || fundamental,
      marketDemand: match?.marketDemand || 50,
      momentum: match?.momentum || 50,
      volatilityScore: match?.volatilityScore || 20,
      fairValue: match?.fairValue || fairValue,
      marketPrice: match?.marketPrice || fairValue,
    };

    if (match) {
      usedExistingIds.add(match.id);
      kept.push({ from: match.name, to: player.name, id: match.id, imageKept: hasUsablePlayerImage(match.image) });
      if (!dryRun) await prisma.asset.update({ where: { id: match.id }, data });
    } else {
      const id = `official-player-${team.id}-${slug(player.name)}`;
      created.push({ id, name: player.name, image: data.image });
      if (!dryRun) await prisma.asset.upsert({ where: { id }, create: { id, ...data }, update: data });
      usedExistingIds.add(id);
    }
  }

  const unavailable = existingPlayers.filter((player) => !usedExistingIds.has(player.id));
  if (!dryRun && unavailable.length) {
    await prisma.asset.updateMany({ where: { id: { in: unavailable.map((player) => player.id) } }, data: { isAvailable: false } });
  }

  if (!dryRun) {
    await prisma.teamIntelligenceReport.deleteMany({ where: { teamId: team.id, provider: 'MC_PRIME_OFFICIAL_RECONCILE', reportType: 'OFFICIAL_SQUAD' } });
    await prisma.teamIntelligenceReport.create({
      data: {
        teamId: team.id,
        title: `Official Squad Reconciled — ${team.name}`,
        summary: `تم تثبيت ${officialPlayers.length} لاعبًا كقائمة رسمية وإخفاء ${unavailable.length} لاعبًا غير مطابق.`,
        body: officialPlayers.map((player) => `- ${player.name}${player.position ? ` — ${player.position}` : ''}${player.club ? ` — ${player.club}` : ''}`).join('\n'),
        reportType: 'OFFICIAL_SQUAD',
        language: 'ar',
        sourceName: teamInput.sourceName || 'Official squad source',
        sourceUrl: teamInput.sourceUrl || null,
        sourceCategory: 'official_squad',
        confidence: 'A',
        provider: 'MC_PRIME_OFFICIAL_RECONCILE',
        metrics: {
          officialCount: officialPlayers.length,
          matchedExisting: kept.length,
          created: created.length,
          hiddenUnavailable: unavailable.length,
          reconciledAt: new Date().toISOString(),
        },
        tacticalTags: ['Official Squad'],
        strengths: [],
        weaknesses: [],
        lastCheckedAt: new Date(),
      },
    });
  }

  return {
    ok: true,
    team: { id: team.id, name: team.name, code: team.code },
    officialCount: officialPlayers.length,
    matchedExisting: kept.length,
    created: created.length,
    hiddenUnavailable: unavailable.length,
    kept,
    createdPlayers: created,
    hiddenPlayers: unavailable.map((player) => ({ id: player.id, name: player.name })),
  };
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin.error) return admin.error;

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });

  const dryRun = payload.dryRun !== false;
  const teams: OfficialTeam[] = Array.isArray(payload.teams)
    ? payload.teams
    : [{
      teamCode: payload.teamCode,
      teamName: payload.teamName,
      sourceName: payload.sourceName,
      sourceUrl: payload.sourceUrl,
      players: payload.players,
    }];

  const results = [];
  for (const teamInput of teams) {
    results.push(await reconcileTeam(teamInput, dryRun));
  }

  return NextResponse.json({
    ok: results.every((result: any) => result.ok !== false),
    dryRun,
    teamsProcessed: results.length,
    officialPlayers: results.reduce((sum: number, result: any) => sum + (result.officialCount || 0), 0),
    matchedExisting: results.reduce((sum: number, result: any) => sum + (result.matchedExisting || 0), 0),
    created: results.reduce((sum: number, result: any) => sum + (result.created || 0), 0),
    hiddenUnavailable: results.reduce((sum: number, result: any) => sum + (result.hiddenUnavailable || 0), 0),
    results,
  }, { status: results.every((result: any) => result.ok !== false) ? 200 : 207 });
}
