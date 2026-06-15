type PlayerLike = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
  position?: string | null;
  age?: number | null;
  club?: string | null;
  teamId?: string | null;
  performances?: any[] | null;
  [key: string]: any;
};

const NICKNAME_ALIASES: Record<string, string> = {
  'zizo': 'ahmed zizo',
  'ahmed zizo': 'ahmed zizo',
  'trezeguet': 'trezeguet',
  'oufa shobeir': 'mostafa shobeir',
  'mostafa shobeir': 'mostafa shobeir',
};

const POSITION_PRIORITY: Record<string, number> = {
  Goalkeeper: 5,
  Defender: 5,
  Midfielder: 5,
  Attacker: 5,
  Forward: 5,
  GK: 3,
  DEF: 3,
  MID: 3,
  FWD: 3,
  FW: 3,
};

const FLAG_OR_TEAM_IMAGE_HOSTS = [
  'flagcdn.com',
  'flagsapi.com',
  'countryflagsapi.com',
  'hatscripts.github.io',
];

const FLAG_OR_TEAM_IMAGE_PATH_MARKERS = [
  '/flags/',
  '/flag/',
  '/country/',
  '/countries/',
  '/football/teams/',
  '/football/team/',
  '/teams/',
  '/team/',
  '/logos/',
  '/logo/',
  '/badges/',
  '/badge/',
  '/crests/',
  '/crest/',
];

const PLAYER_IMAGE_PATH_MARKERS = [
  '/players/',
  '/player/',
  '/athletes/',
  '/athlete/',
  '/people/',
  '/person/',
  '/profile/',
  '/avatar/',
];

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isLikelyEmoji(value?: string | null) {
  const text = String(value || '').trim();
  return Boolean(text && text.length <= 8 && /[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(text));
}

function parsedImageUrl(value: string) {
  try {
    return new URL(value.startsWith('//') ? `https:${value}` : value, 'https://worldcup.mcprim.com');
  } catch {
    return null;
  }
}

export function isLikelyFlagOrTeamImage(value?: string | null) {
  const image = String(value || '').trim().toLowerCase();
  if (!image || isLikelyEmoji(image)) return true;

  const parsed = parsedImageUrl(image);
  const host = parsed?.hostname || '';
  const path = parsed?.pathname || image;

  if (FLAG_OR_TEAM_IMAGE_HOSTS.some((marker) => host.includes(marker))) return true;
  if (FLAG_OR_TEAM_IMAGE_PATH_MARKERS.some((marker) => path.includes(marker))) return true;
  if (/\b(flag|country|national-team|team-logo|badge|crest)\b/.test(image)) return true;

  return false;
}

export function hasUsablePlayerImage(value?: string | null) {
  const image = String(value || '').trim();
  if (!image || image === '👤' || image === '🏳️' || isLikelyEmoji(image)) return false;
  if (!(image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/'))) return false;
  if (isLikelyFlagOrTeamImage(image)) return false;

  const lower = image.toLowerCase();
  if (PLAYER_IMAGE_PATH_MARKERS.some((marker) => lower.includes(marker))) return true;

  // Keep generic CDN photos only after excluding known flag/team-logo patterns.
  return true;
}

function normalizePlayerName(value?: string | null) {
  const normalized = stripAccents(String(value || ''))
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(el|al)\b/g, ' ')
    .replace(/[^a-z0-9.\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\by\b/g, 'i');

  return NICKNAME_ALIASES[normalized] || normalized;
}

function nameTokens(name?: string | null) {
  return normalizePlayerName(name)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function looksAbbreviatedName(name?: string | null) {
  return /(^|\s)[a-z]\.(\s|$)/i.test(String(name || '')) || nameTokens(name).length <= 1;
}

function positionScore(position?: string | null) {
  return POSITION_PRIORITY[String(position || '').trim()] || 1;
}

function playerCompletenessScore(player: PlayerLike) {
  const name = String(player.name || '');
  return (
    (hasUsablePlayerImage(player.image) ? 1000 : 0) +
    (!looksAbbreviatedName(name) ? 180 : 0) +
    Math.min(name.length, 80) * 2 +
    (player.club ? 80 : 0) +
    (player.age ? 40 : 0) +
    positionScore(player.position) * 15 +
    (Array.isArray(player.performances) ? player.performances.length : 0)
  );
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function tokenClose(a?: string, b?: string) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length === 1 || right.length === 1) return left[0] === right[0];
  const distance = editDistance(left, right);
  return distance <= (Math.max(left.length, right.length) <= 6 ? 1 : 2);
}

function sameTeam(a: PlayerLike, b: PlayerLike) {
  if (!a.teamId || !b.teamId) return true;
  return a.teamId === b.teamId;
}

function isLikelySamePlayer(a: PlayerLike, b: PlayerLike) {
  if (!sameTeam(a, b)) return false;

  const aName = normalizePlayerName(a.name);
  const bName = normalizePlayerName(b.name);
  if (!aName || !bName) return false;
  if (aName === bName) return true;

  const aAlias = NICKNAME_ALIASES[aName];
  const bAlias = NICKNAME_ALIASES[bName];
  if (aAlias && bAlias && aAlias === bAlias) return true;
  if (aAlias && aAlias === bName) return true;
  if (bAlias && bAlias === aName) return true;

  const aTokens = nameTokens(a.name);
  const bTokens = nameTokens(b.name);
  if (!aTokens.length || !bTokens.length) return false;

  const aFirst = aTokens[0];
  const bFirst = bTokens[0];
  const aLast = aTokens[aTokens.length - 1];
  const bLast = bTokens[bTokens.length - 1];

  if (tokenClose(aFirst, bFirst) && tokenClose(aLast, bLast)) return true;

  const aInitialLast = `${aFirst[0] || ''}:${aLast}`;
  const bInitialLast = `${bFirst[0] || ''}:${bLast}`;
  if (aInitialLast === bInitialLast && tokenClose(aLast, bLast)) return true;

  if (aTokens.length >= 2 && bTokens.length >= 2) {
    const aFirstLast = `${aFirst}:${aLast}`;
    const bFirstLast = `${bFirst}:${bLast}`;
    if (aFirstLast === bFirstLast) return true;
  }

  return false;
}

function betterValue<T>(primary: T | null | undefined, fallback: T | null | undefined) {
  return primary === null || primary === undefined || primary === '' ? fallback : primary;
}

function mergePerformances(a?: any[] | null, b?: any[] | null) {
  const items = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const seen = new Set<string>();
  const result: any[] = [];

  for (const item of items) {
    const key = String(item?.id || `${item?.matchId || ''}-${item?.matchDate || ''}-${item?.updatedAt || ''}` || JSON.stringify(item));
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function mergePlayers(a: PlayerLike, b: PlayerLike) {
  const primary = playerCompletenessScore(a) >= playerCompletenessScore(b) ? a : b;
  const secondary = primary === a ? b : a;
  const primaryHasImage = hasUsablePlayerImage(primary.image);
  const secondaryHasImage = hasUsablePlayerImage(secondary.image);

  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    name: looksAbbreviatedName(primary.name) && !looksAbbreviatedName(secondary.name) ? secondary.name : primary.name,
    code: betterValue(primary.code, secondary.code),
    image: primaryHasImage ? primary.image : secondaryHasImage ? secondary.image : null,
    position: positionScore(primary.position) >= positionScore(secondary.position) ? betterValue(primary.position, secondary.position) : betterValue(secondary.position, primary.position),
    age: betterValue(primary.age, secondary.age),
    club: betterValue(primary.club, secondary.club),
    teamId: betterValue(primary.teamId, secondary.teamId),
    team: primary.team || secondary.team || null,
    performances: mergePerformances(primary.performances, secondary.performances),
    duplicateIds: Array.from(new Set([...(secondary.duplicateIds || []), ...(primary.duplicateIds || []), secondary.id, primary.id].filter(Boolean))),
  };
}

export function dedupePlayers<T extends PlayerLike>(players: T[] = []) {
  const result: PlayerLike[] = [];

  for (const player of players) {
    const existingIndex = result.findIndex((item) => isLikelySamePlayer(item, player));
    if (existingIndex === -1) {
      result.push({ ...player, image: hasUsablePlayerImage(player.image) ? player.image : null });
      continue;
    }

    result[existingIndex] = mergePlayers(result[existingIndex], player);
  }

  return result as T[];
}
