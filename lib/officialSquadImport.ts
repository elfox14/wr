import prisma from '@/lib/prisma';

export type OfficialSquadPlayerInput = {
  name?: string;
  fullName?: string;
  code?: string;
  position?: string;
  age?: number | string | null;
  club?: string | null;
  image?: string | null;
  photo?: string | null;
  shirtNumber?: number | string | null;
  externalId?: number | string | null;
};

export type OfficialSquadTeamInput = {
  teamId?: string;
  teamCode?: string;
  teamName?: string;
  sourceName?: string;
  sourceUrl?: string;
  replaceExisting?: boolean;
  players?: OfficialSquadPlayerInput[];
};

function asString(value: any) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function asInt(value: any) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeText(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

function slug(value: any, fallback = 'player') {
  const text = String(value || fallback)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return text || Buffer.from(String(value || fallback)).toString('hex').slice(0, 24);
}

function cleanCode(value: any, fallback: string) {
  const raw = String(value || fallback || 'PLAYER')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return raw.slice(0, 10) || 'PLAYER';
}

async function findTeam(input: OfficialSquadTeamInput) {
  const teamId = asString(input.teamId);
  if (teamId) {
    const team = await prisma.asset.findFirst({ where: { id: teamId, type: 'TEAM' } });
    if (team) return team;
  }

  const code = asString(input.teamCode)?.toUpperCase();
  if (code) {
    const team = await prisma.asset.findFirst({ where: { type: 'TEAM', code } });
    if (team) return team;
  }

  const name = normalizeText(input.teamName);
  if (name) {
    const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, take: 500 });
    const team = teams.find((candidate) => normalizeText(candidate.name) === name || normalizeText(candidate.code) === name);
    if (team) return team;
  }

  return null;
}

function normalizePlayer(player: OfficialSquadPlayerInput, index: number) {
  const name = asString(player.name || player.fullName);
  if (!name) return null;

  const shirtNumber = asInt(player.shirtNumber);
  const age = asInt(player.age);
  const position = asString(player.position);
  const club = asString(player.club);
  const image = asString(player.image || player.photo) || '';
  const externalId = asString(player.externalId);
  const code = cleanCode(player.code, `${name.slice(0, 3)}${shirtNumber || index + 1}`);

  return {
    name,
    code,
    position,
    age,
    club,
    image,
    shirtNumber,
    externalId,
  };
}

export async function importOfficialSquad(input: OfficialSquadTeamInput) {
  const team = await findTeam(input);
  if (!team) {
    return {
      ok: false,
      error: 'team_not_found',
      teamId: input.teamId || null,
      teamCode: input.teamCode || null,
      teamName: input.teamName || null,
    };
  }

  const sourceName = asString(input.sourceName) || 'Official World Cup Squad';
  const sourceUrl = asString(input.sourceUrl);
  const players = Array.isArray(input.players) ? input.players : [];
  const normalizedPlayers = players
    .map((player, index) => normalizePlayer(player, index))
    .filter(Boolean) as ReturnType<typeof normalizePlayer>[];

  const imported: any[] = [];
  const skipped = players.length - normalizedPlayers.length;

  for (const player of normalizedPlayers) {
    if (!player) continue;
    const id = `official-player-${team.id}-${slug(player.name)}`;
    const asset = await prisma.asset.upsert({
      where: { id },
      update: {
        type: 'PLAYER',
        name: player.name,
        code: player.code,
        image: player.image,
        position: player.position,
        age: player.age,
        club: player.club,
        teamId: team.id,
        isAvailable: true,
      },
      create: {
        id,
        type: 'PLAYER',
        name: player.name,
        code: player.code,
        image: player.image,
        current_price: 100,
        high_price: 100,
        low_price: 100,
        market_cap: '0',
        volume: '0',
        change: 0,
        position: player.position,
        age: player.age,
        club: player.club,
        teamId: team.id,
        isAvailable: true,
        playerTier: 0.5,
        roleImportance: 0.5,
        score: 50,
        popularity: 50,
        fundamental: 50,
        marketDemand: 50,
        momentum: 50,
        volatilityScore: 10,
        fairValue: 100,
        marketPrice: 100,
      },
    });

    imported.push({
      id: asset.id,
      name: asset.name,
      code: asset.code,
      position: asset.position,
      age: asset.age,
      club: asset.club,
      shirtNumber: player.shirtNumber,
      externalId: player.externalId,
    });
  }

  if (input.replaceExisting) {
    const importedIds = imported.map((player) => player.id);
    await prisma.asset.updateMany({
      where: {
        type: 'PLAYER',
        teamId: team.id,
        id: { notIn: importedIds.length ? importedIds : ['__none__'] },
      },
      data: { isAvailable: false },
    });
  }

  await prisma.teamIntelligenceReport.deleteMany({
    where: {
      teamId: team.id,
      provider: 'MC_PRIME_OFFICIAL_SQUAD',
      reportType: 'OFFICIAL_SQUAD',
    },
  });

  await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title: `Official Squad — ${team.name}`,
      summary: `تم استيراد ${imported.length} لاعبًا من قائمة معتمدة منفصلة عن Data Hub العام.`,
      body: imported.map((player) => `- ${player.name}${player.position ? ` — ${player.position}` : ''}${player.club ? ` — ${player.club}` : ''}`).join('\n'),
      reportType: 'OFFICIAL_SQUAD',
      language: 'ar',
      sourceName,
      sourceUrl,
      sourceCategory: 'official_squad',
      confidence: 'A',
      provider: 'MC_PRIME_OFFICIAL_SQUAD',
      metrics: {
        importedCount: imported.length,
        skippedCount: skipped,
        replaceExisting: Boolean(input.replaceExisting),
        importedAt: new Date().toISOString(),
        players: imported,
        sourcePolicy: 'APPROVED_SQUAD_SOURCES_ONLY',
      },
      tacticalTags: ['Official Squad'],
      strengths: [],
      weaknesses: [],
      lastCheckedAt: new Date(),
    },
  });

  return {
    ok: true,
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
    },
    sourceName,
    sourceUrl,
    imported: imported.length,
    skipped,
    replaceExisting: Boolean(input.replaceExisting),
    players: imported,
  };
}

export async function importOfficialSquads(payload: any) {
  const teams: OfficialSquadTeamInput[] = Array.isArray(payload?.teams)
    ? payload.teams
    : [{
      teamId: payload?.teamId,
      teamCode: payload?.teamCode,
      teamName: payload?.teamName,
      sourceName: payload?.sourceName,
      sourceUrl: payload?.sourceUrl,
      replaceExisting: payload?.replaceExisting,
      players: payload?.players,
    }];

  const results = [];
  for (const teamInput of teams) {
    results.push(await importOfficialSquad(teamInput));
  }

  return {
    ok: results.every((result) => result.ok !== false),
    policy: 'APPROVED_SQUAD_SOURCES_ONLY',
    teamsProcessed: results.length,
    playersImported: results.reduce((sum, result: any) => sum + (result.imported || 0), 0),
    results,
  };
}
