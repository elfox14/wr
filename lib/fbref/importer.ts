const UNAVAILABLE = 'غير متوفر في المصادر';

export type FbrefTable = {
  id?: string | null;
  caption?: string | null;
  headers?: string[];
  rows?: string[][];
  rowCount?: number;
  pageUrl?: string;
};

export type FbrefSquadPage = {
  squad?: string;
  url?: string;
  ok?: boolean;
  tableCount?: number;
  tables?: FbrefTable[];
  error?: string;
};

export type FbrefExportPayload = {
  source?: string;
  extractionMethod?: string;
  competitionUrl?: string;
  exportedAt?: string;
  competitionTables?: FbrefTable[];
  squadLinks?: { name?: string; href?: string }[];
  squadPages?: FbrefSquadPage[];
};

export type FbrefTeamReportDraft = {
  teamName: string;
  normalizedTeamName: string;
  teamCode?: string | null;
  sourceUrl?: string | null;
  title: string;
  summary: string;
  body: string;
  confidence: 'A' | 'B' | 'C';
  tacticalTags: string[];
  strengths: string[];
  weaknesses: string[];
  metrics: Record<string, unknown>;
};

type RowObject = Record<string, string>;

type StandingInfo = {
  group?: string | null;
  rank?: string | null;
  mp?: number | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  gf?: number | null;
  ga?: number | null;
  gd?: string | null;
  pts?: number | null;
  last5?: string | null;
};

type LeagueInfo = StandingInfo & {
  topTeamScorer?: string | null;
  goalkeeper?: string | null;
};

const TABLE_NOISE_IDS = new Set(['table_1', 'table_2', 'table_3', 'table_4', 'table_5', 'table_6', 'table_7', 'table_8', 'table_9']);

const COUNTRY_CODE_ALIASES: Record<string, string[]> = {
  ar: ['ARG'],
  at: ['AUT'],
  au: ['AUS'],
  ba: ['BIH'],
  be: ['BEL'],
  br: ['BRA'],
  ca: ['CAN'],
  cd: ['COD', 'DRC'],
  ch: ['SUI'],
  ci: ['CIV'],
  co: ['COL'],
  cv: ['CPV'],
  cw: ['CUW'],
  cz: ['CZE'],
  de: ['GER', 'DEU'],
  dz: ['ALG', 'DZA'],
  ec: ['ECU'],
  eg: ['EGY'],
  eng: ['ENG'],
  es: ['ESP'],
  fr: ['FRA'],
  gh: ['GHA'],
  hr: ['CRO', 'HRV'],
  ht: ['HAI'],
  iq: ['IRQ'],
  ir: ['IRN'],
  jo: ['JOR'],
  jp: ['JPN'],
  kr: ['KOR'],
  ma: ['MAR'],
  mx: ['MEX'],
  nl: ['NED'],
  no: ['NOR'],
  nz: ['NZL'],
  pa: ['PAN'],
  pt: ['POR'],
  py: ['PAR', 'PRY'],
  qa: ['QAT'],
  sa: ['KSA', 'SAU'],
  sct: ['SCO'],
  se: ['SWE'],
  sn: ['SEN'],
  tn: ['TUN'],
  tr: ['TUR'],
  us: ['USA'],
  uy: ['URU'],
  uz: ['UZB'],
  za: ['RSA', 'ZAF'],
};

const NAME_ALIASES: Record<string, string[]> = {
  'bosnia herzegovina': ['bosnia and herzegovina'],
  'cote divoire': ['côte divoire', 'côte d ivoire', 'ivory coast'],
  'congo dr': ['dr congo', 'congo democratic republic', 'democratic republic of congo'],
  'curacao': ['curaçao'],
  'czechia': ['czech republic'],
  'ir iran': ['iran'],
  'korea republic': ['south korea'],
  'saudi arabia': ['ksa'],
  'turkiye': ['türkiye', 'turkey'],
  'united states': ['usa', 'united states of america'],
};

export function normalizeFbrefName(value: string | undefined | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`.]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getNameAliases(name: string) {
  const normalized = normalizeFbrefName(name);
  const aliases = NAME_ALIASES[normalized] || [];
  return [normalized, ...aliases.map(normalizeFbrefName)];
}

export function getCodeAliases(code: string | undefined | null) {
  const cleanCode = String(code || '').trim().toLowerCase();
  if (!cleanCode) return [];
  return [cleanCode, ...(COUNTRY_CODE_ALIASES[cleanCode] || []).map((value) => value.toLowerCase())];
}

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown): number | null {
  const text = clean(value).replace(/,/g, '');
  if (!text) return null;
  const match = text.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function sumNumbers(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + (typeof value === 'number' && Number.isFinite(value) ? value : 0), 0);
}

function cleanTeamName(value: string | undefined | null) {
  return clean(value).replace(/^[a-z]{2,3}\s+/i, '').trim();
}

function extractTeamCode(value: string | undefined | null) {
  const match = clean(value).match(/^([a-z]{2,3})\s+/i);
  return match?.[1]?.toLowerCase() || null;
}

function getUniqueHeaderMap(headers: string[] | undefined) {
  const seen: Record<string, number> = {};
  return (headers || []).map((header, index) => {
    const base = clean(header) || `col_${index}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] === 1 ? base : `${base}_${seen[base]}`;
  });
}

function tableToObjects(table?: FbrefTable | null): RowObject[] {
  if (!table) return [];
  const keys = getUniqueHeaderMap(table.headers);
  return (table.rows || []).map((row) => {
    const object: RowObject = {};
    row.forEach((value, index) => {
      object[keys[index] || `col_${index}`] = clean(value);
    });
    return object;
  });
}

function isUsefulTable(table: FbrefTable) {
  const id = table.id || '';
  const caption = clean(table.caption).toLowerCase();
  if (!id && TABLE_NOISE_IDS.has(caption)) return false;
  if (!table.headers?.length && !id) return false;
  return true;
}

function findTable(tables: FbrefTable[], predicate: (table: FbrefTable) => boolean) {
  return tables.find((table) => isUsefulTable(table) && predicate(table));
}

function tableId(table: FbrefTable) {
  return String(table.id || '').toLowerCase();
}

function tableCaption(table: FbrefTable) {
  return clean(table.caption).toLowerCase();
}

function groupLetterFromCaption(caption?: string | null) {
  const match = clean(caption).match(/group\s+([a-l])/i);
  return match?.[1]?.toUpperCase() || null;
}

function findStandingInfo(competitionTables: FbrefTable[], teamName: string): StandingInfo | null {
  const aliases = new Set(getNameAliases(teamName));

  for (const table of competitionTables) {
    const group = groupLetterFromCaption(table.caption);
    if (!group) continue;

    const row = tableToObjects(table).find((item) => aliases.has(normalizeFbrefName(cleanTeamName(item.Squad))));
    if (!row) continue;

    return {
      group,
      rank: row.Rk || null,
      mp: toNumber(row.MP),
      wins: toNumber(row.W),
      draws: toNumber(row.D),
      losses: toNumber(row.L),
      gf: toNumber(row.GF),
      ga: toNumber(row.GA),
      gd: row.GD || null,
      pts: toNumber(row.Pts),
      last5: row['Last 5'] || null,
    };
  }

  return null;
}

function findLeagueInfo(competitionTables: FbrefTable[], teamName: string): LeagueInfo | null {
  const aliases = new Set(getNameAliases(teamName));
  const leagueTable = findTable(competitionTables, (table) => tableId(table) === 'results202610_overall' || tableCaption(table).includes('league table'));
  const row = tableToObjects(leagueTable).find((item) => aliases.has(normalizeFbrefName(cleanTeamName(item.Squad))));
  if (!row) return null;

  return {
    rank: row.Rk || null,
    mp: toNumber(row.MP),
    wins: toNumber(row.W),
    draws: toNumber(row.D),
    losses: toNumber(row.L),
    gf: toNumber(row.GF),
    ga: toNumber(row.GA),
    gd: row.GD || null,
    pts: toNumber(row.Pts),
    last5: row['Last 5'] || null,
    topTeamScorer: row['Top Team Scorer'] || null,
    goalkeeper: row.Goalkeeper || null,
  };
}

function getWorldCupMatches(matchlog?: FbrefTable | null) {
  return tableToObjects(matchlog).filter((row) => normalizeFbrefName(row.Comp).includes('world cup'));
}

function getCompletedWorldCupMatches(matchlog?: FbrefTable | null) {
  return getWorldCupMatches(matchlog).filter((row) => row.Result && row.GF !== '' && row.GA !== '');
}

function getUpcomingWorldCupMatches(matchlog?: FbrefTable | null) {
  return getWorldCupMatches(matchlog).filter((row) => !row.Result || row.GF === '' || row.GA === '');
}

function summarizeRoster(roster?: FbrefTable | null) {
  const rows = tableToObjects(roster);
  const positionCounts: Record<string, number> = {};
  const clubs: Record<string, number> = {};
  const ages = rows.map((row) => toNumber(row.Age)).filter((age): age is number => typeof age === 'number');

  rows.forEach((row) => {
    const positions = clean(row.Pos).split(',').map((item) => item.trim()).filter(Boolean);
    positions.forEach((position) => { positionCounts[position] = (positionCounts[position] || 0) + 1; });
    const club = clean(row.Club).replace(/^1\.[a-z]{2,3}\s+/i, '');
    if (club) clubs[club] = (clubs[club] || 0) + 1;
  });

  const topClubs = Object.entries(clubs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([club, count]) => `${club} (${count})`);

  return {
    count: rows.length,
    averageAge: ages.length ? Number((sumNumbers(ages) / ages.length).toFixed(1)) : null,
    positionCounts,
    topClubs,
    playerNames: rows.map((row) => row.Player).filter(Boolean),
  };
}

function summarizeStandard(standard?: FbrefTable | null) {
  const rows = tableToObjects(standard);
  const used = rows.filter((row) => (toNumber(row.MP) || 0) > 0);
  const starters = used.filter((row) => (toNumber(row.Starts) || 0) > 0).sort((a, b) => (toNumber(b.Min) || 0) - (toNumber(a.Min) || 0));
  const scorers = used.filter((row) => (toNumber(row.Gls) || 0) > 0).sort((a, b) => (toNumber(b.Gls) || 0) - (toNumber(a.Gls) || 0));
  const assisters = used.filter((row) => (toNumber(row.Ast) || 0) > 0).sort((a, b) => (toNumber(b.Ast) || 0) - (toNumber(a.Ast) || 0));

  return {
    usedPlayers: used.length,
    starters: starters.map((row) => row.Player).filter(Boolean),
    scorers: scorers.map((row) => `${row.Player} (${row.Gls})`),
    assisters: assisters.map((row) => `${row.Player} (${row.Ast})`),
    minutesLeaders: starters.slice(0, 8).map((row) => `${row.Player} (${row.Min} د)`),
  };
}

function summarizeShooting(shooting?: FbrefTable | null) {
  const rows = tableToObjects(shooting);
  const shots = sumNumbers(rows.map((row) => toNumber(row.Sh)));
  const shotsOnTarget = sumNumbers(rows.map((row) => toNumber(row.SoT)));
  const goals = sumNumbers(rows.map((row) => toNumber(row.Gls)));
  const activeShooters = rows
    .filter((row) => (toNumber(row.Sh) || 0) > 0)
    .sort((a, b) => (toNumber(b.Sh) || 0) - (toNumber(a.Sh) || 0))
    .slice(0, 5)
    .map((row) => `${row.Player}: ${row.Sh} تسديدة${row.SoT ? ` / ${row.SoT} على المرمى` : ''}`);

  return {
    shots,
    shotsOnTarget,
    goals,
    shotAccuracy: shots > 0 ? Number(((shotsOnTarget / shots) * 100).toFixed(1)) : null,
    activeShooters,
  };
}

function summarizeGoalkeeping(goalkeeping?: FbrefTable | null) {
  const rows = tableToObjects(goalkeeping);
  const keepers = rows.filter((row) => (toNumber(row.Min) || 0) > 0);
  const saves = sumNumbers(keepers.map((row) => toNumber(row.Saves)));
  const shotsOnTargetAgainst = sumNumbers(keepers.map((row) => toNumber(row.SoTA)));
  const goalsAgainst = sumNumbers(keepers.map((row) => toNumber(row.GA)));
  const goalkeeper = keepers[0];

  return {
    goalkeeper: goalkeeper?.Player || null,
    saves,
    shotsOnTargetAgainst,
    goalsAgainst,
    savePercentage: goalkeeper?.['Save%'] || null,
  };
}

function summarizeMisc(misc?: FbrefTable | null) {
  const rows = tableToObjects(misc);
  return {
    yellowCards: sumNumbers(rows.map((row) => toNumber(row.CrdY))),
    redCards: sumNumbers(rows.map((row) => toNumber(row.CrdR))),
    fouls: sumNumbers(rows.map((row) => toNumber(row.Fls))),
    fouled: sumNumbers(rows.map((row) => toNumber(row.Fld))),
    crosses: sumNumbers(rows.map((row) => toNumber(row.Crs))),
    interceptions: sumNumbers(rows.map((row) => toNumber(row.Int))),
    tacklesWon: sumNumbers(rows.map((row) => toNumber(row.TklW))),
  };
}

function summarizeMatchContext(matchlog?: FbrefTable | null) {
  const completed = getCompletedWorldCupMatches(matchlog);
  const upcoming = getUpcomingWorldCupMatches(matchlog);
  const latest = completed.at(-1) || null;
  const next = upcoming[0] || null;
  const formations = completed.map((row) => row.Formation).filter(Boolean);
  const captains = completed.map((row) => row.Captain).filter(Boolean);
  const possessionValues = completed.map((row) => toNumber(row.Poss)).filter((value): value is number => typeof value === 'number');

  return {
    completedCount: completed.length,
    upcomingCount: upcoming.length,
    latest,
    next,
    formations: Array.from(new Set(formations)),
    captains: Array.from(new Set(captains)),
    averagePossession: possessionValues.length ? Number((sumNumbers(possessionValues) / possessionValues.length).toFixed(1)) : null,
  };
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : UNAVAILABLE;
}

function formatList(items: string[] | undefined, fallback = UNAVAILABLE) {
  return items?.length ? items.join('، ') : fallback;
}

function buildStrengths(standing: StandingInfo | null, shooting: ReturnType<typeof summarizeShooting>, goalkeeping: ReturnType<typeof summarizeGoalkeeping>, matchContext: ReturnType<typeof summarizeMatchContext>) {
  const strengths: string[] = [];
  if ((standing?.wins || 0) > 0) strengths.push('نتيجة إيجابية في المجموعة');
  if (shooting.shotsOnTarget > 0) strengths.push('وجود تسديدات على المرمى في عينة كأس العالم');
  if (goalkeeping.saves > 0) strengths.push('الحارس دخل في عينة تصديات موثقة');
  if (matchContext.formations.length) strengths.push(`وضوح الرسم الخططي المستخدم: ${formatList(matchContext.formations)}`);
  return strengths.length ? strengths.slice(0, 4) : ['القائمة ومواعيد المباريات موثقة من المصدر'];
}

function buildWeaknesses(standing: StandingInfo | null, shooting: ReturnType<typeof summarizeShooting>, goalkeeping: ReturnType<typeof summarizeGoalkeeping>, matchContext: ReturnType<typeof summarizeMatchContext>, missing: string[]) {
  const weaknesses: string[] = [];
  if ((standing?.losses || 0) > 0) weaknesses.push('نتيجة سلبية في المجموعة حتى تاريخ التصدير');
  if ((standing?.ga || 0) > 0) weaknesses.push('استقبال أهداف في عينة البطولة');
  if (shooting.shots > 0 && shooting.shotAccuracy !== null && shooting.shotAccuracy < 35) weaknesses.push('دقة التسديد على المرمى تحتاج متابعة');
  if (matchContext.averagePossession !== null && matchContext.averagePossession < 45) weaknesses.push('نسبة استحواذ منخفضة في آخر مباراة موثقة');
  if (missing.length) weaknesses.push('بعض الجداول المتقدمة غير متوفرة في التصدير الحالي');
  if (goalkeeping.shotsOnTargetAgainst > 5) weaknesses.push('الحارس واجه عددًا مرتفعًا من التسديدات على المرمى');
  return weaknesses.length ? weaknesses.slice(0, 5) : ['العينة الفنية لا تزال محدودة وتحتاج تحديثًا بعد المباريات التالية'];
}

function buildRatingRows(standing: StandingInfo | null, shooting: ReturnType<typeof summarizeShooting>, goalkeeping: ReturnType<typeof summarizeGoalkeeping>, roster: ReturnType<typeof summarizeRoster>, matchContext: ReturnType<typeof summarizeMatchContext>) {
  const attackScore = shooting.shots > 0 ? Math.min(8, Math.max(4, 4 + shooting.goals + shooting.shotsOnTarget * 0.45)) : null;
  const defenseScore = typeof standing?.ga === 'number' ? Math.min(8, Math.max(3, 7 - standing.ga + Math.min(goalkeeping.saves, 3) * 0.25)) : null;
  const momentumScore = typeof standing?.pts === 'number' ? Math.min(8, Math.max(3, 4 + standing.pts + (standing.wins || 0) - (standing.losses || 0) * 0.7)) : null;
  const squadScore = roster.count ? Math.min(8, Math.max(4, 4 + roster.count / 10)) : null;

  return [
    `الهجوم: ${attackScore ? attackScore.toFixed(1) : UNAVAILABLE}/10 — مبني على التسديدات والأهداف المتاحة.`,
    `الدفاع والحراسة: ${defenseScore ? defenseScore.toFixed(1) : UNAVAILABLE}/10 — مبني على الأهداف المستقبلة وتصديات الحارس.`,
    `الزخم الحالي: ${momentumScore ? momentumScore.toFixed(1) : UNAVAILABLE}/10 — مبني على نقاط المجموعة وعينة النتائج.`,
    `عمق القائمة: ${squadScore ? squadScore.toFixed(1) : UNAVAILABLE}/10 — مبني على عدد اللاعبين ودقائق المشاركة.`,
    `حجم العينة: ${matchContext.completedCount ? `${matchContext.completedCount} مباراة كأس عالم موثقة` : 'لم تبدأ عينة كأس العالم بعد'}.`,
  ].join('\n');
}

function buildBody(args: {
  teamName: string;
  standing: StandingInfo | null;
  league: LeagueInfo | null;
  roster: ReturnType<typeof summarizeRoster>;
  standard: ReturnType<typeof summarizeStandard>;
  shooting: ReturnType<typeof summarizeShooting>;
  goalkeeping: ReturnType<typeof summarizeGoalkeeping>;
  misc: ReturnType<typeof summarizeMisc>;
  matchContext: ReturnType<typeof summarizeMatchContext>;
  missing: string[];
  sourceUrl?: string | null;
  exportedAt?: string;
}) {
  const latest = args.matchContext.latest;
  const next = args.matchContext.next;
  const group = args.standing?.group || UNAVAILABLE;
  const standingText = args.standing
    ? `المجموعة ${group}: المركز ${args.standing.rank || UNAVAILABLE}، لعب ${formatNumber(args.standing.mp)}، فاز ${formatNumber(args.standing.wins)}، تعادل ${formatNumber(args.standing.draws)}، خسر ${formatNumber(args.standing.losses)}، له ${formatNumber(args.standing.gf)}، عليه ${formatNumber(args.standing.ga)}، فارق ${args.standing.gd || UNAVAILABLE}، نقاط ${formatNumber(args.standing.pts)}.`
    : UNAVAILABLE;

  const latestText = latest
    ? `${latest.Date || ''}: ${args.teamName} ${latest.GF || ''}-${latest.GA || ''} ${cleanTeamName(latest.Opponent)}، النتيجة ${latest.Result || UNAVAILABLE}، الاستحواذ ${latest.Poss || UNAVAILABLE}%، القائد ${latest.Captain || UNAVAILABLE}، الرسم ${latest.Formation || UNAVAILABLE}.`
    : 'لم توجد مباراة كأس عالم مكتملة في التصدير الحالي.';

  const nextText = next
    ? `${next.Date || ''}: ضد ${cleanTeamName(next.Opponent)} — الدور ${next.Round || UNAVAILABLE}.`
    : UNAVAILABLE;

  const tactical = args.matchContext.formations.length || args.matchContext.averagePossession !== null
    ? `الرسم/الرسوم المستخدمة في مباريات كأس العالم: ${formatList(args.matchContext.formations)}. متوسط الاستحواذ في العينة المتاحة: ${args.matchContext.averagePossession ?? UNAVAILABLE}%.`
    : UNAVAILABLE;

  const setPieces = args.misc.crosses || args.misc.fouls || args.misc.interceptions
    ? `مؤشرات Misc المتاحة: عرضيات ${args.misc.crosses}، أخطاء مرتكبة ${args.misc.fouls}، أخطاء مكتسبة ${args.misc.fouled}، اعتراضات ${args.misc.interceptions}، تدخلات ناجحة ${args.misc.tacklesWon}.`
    : UNAVAILABLE;

  const sourceLine = `FBref / Stathead — ${args.sourceUrl || UNAVAILABLE}${args.exportedAt ? ` — تاريخ التصدير: ${args.exportedAt}` : ''}`;

  return [
    `بطاقة المنتخب: ${args.teamName}. المجموعة: ${group}. عدد لاعبي القائمة في المصدر: ${args.roster.count || UNAVAILABLE}. متوسط العمر: ${args.roster.averageAge ?? UNAVAILABLE}. أكثر الأندية حضورًا في القائمة: ${formatList(args.roster.topClubs)}.`,
    `وضع المنتخب في المجموعة: ${standingText}`,
    `تحليل الأداء بالأرقام: ${latestText} المباراة القادمة: ${nextText}`,
    `القوة الهجومية: الأهداف في جدول التسديد: ${args.shooting.goals}. إجمالي التسديدات: ${args.shooting.shots}. التسديدات على المرمى: ${args.shooting.shotsOnTarget}. دقة التسديد على المرمى: ${args.shooting.shotAccuracy ?? UNAVAILABLE}%. أبرز المسددين: ${formatList(args.shooting.activeShooters)}.`,
    `القوة الدفاعية: الأهداف المستقبلة في جدول المجموعة: ${formatNumber(args.standing?.ga)}. الحارس الأساسي في عينة الحراسة: ${args.goalkeeping.goalkeeper || args.league?.goalkeeper || UNAVAILABLE}. التسديدات على مرماه: ${args.goalkeeping.shotsOnTargetAgainst}. التصديات: ${args.goalkeeping.saves}. نسبة التصديات: ${args.goalkeeping.savePercentage || UNAVAILABLE}.`,
    `وسط الملعب والتحكم: ${tactical}`,
    `الكرات الثابتة: ${setPieces}`,
    `أسماء بارزة في القائمة: الهدافون: ${formatList(args.standard.scorers, args.league?.topTeamScorer || UNAVAILABLE)}. أصحاب التمريرات الحاسمة: ${formatList(args.standard.assisters)}. الأكثر مشاركة: ${formatList(args.standard.minutesLeaders)}.`,
    `التحليل التكتيكي: ${tactical !== UNAVAILABLE ? tactical : 'غير متوفر في المصادر: جداول التمرير والاستحواذ التفصيلية غير موجودة في التصدير الحالي.'}`,
    `نقاط القوة: ${formatList(buildStrengths(args.standing, args.shooting, args.goalkeeping, args.matchContext))}.`,
    `نقاط الضعف / ما يحتاج متابعة: ${formatList(buildWeaknesses(args.standing, args.shooting, args.goalkeeping, args.matchContext, args.missing))}.`,
    `تقييم مبدئي مبني على البيانات المتاحة: ${buildRatingRows(args.standing, args.shooting, args.goalkeeping, args.roster, args.matchContext)}`,
    `معلومات غير متوفرة في المصادر: ${formatList(args.missing)}.`,
    `سجل المصادر: ${sourceLine}.`,
  ].join('\n\n');
}

export function buildFbrefTeamReportDrafts(payload: FbrefExportPayload): FbrefTeamReportDraft[] {
  const competitionTables = (payload.competitionTables || []).filter(isUsefulTable);
  const squadPages = (payload.squadPages || []).filter((page) => page.ok && page.squad && page.tables?.length);

  return squadPages.map((page) => {
    const teamName = clean(page.squad) || cleanTeamName(page.tables?.find((table) => table.pageUrl)?.pageUrl || '');
    const tables = (page.tables || []).filter(isUsefulTable);
    const rosterTable = findTable(tables, (table) => tableId(table) === 'roster');
    const standardTable = findTable(tables, (table) => tableId(table).startsWith('stats_standard'));
    const matchlogTable = findTable(tables, (table) => tableId(table) === 'matchlogs_for');
    const keeperTable = findTable(tables, (table) => tableId(table).startsWith('stats_keeper'));
    const shootingTable = findTable(tables, (table) => tableId(table).startsWith('stats_shooting'));
    const playingTimeTable = findTable(tables, (table) => tableId(table).startsWith('stats_playing_time'));
    const miscTable = findTable(tables, (table) => tableId(table).startsWith('stats_misc'));
    const passingTable = findTable(tables, (table) => tableId(table).startsWith('stats_passing'));
    const possessionTable = findTable(tables, (table) => tableId(table).startsWith('stats_possession'));
    const defenseTable = findTable(tables, (table) => tableId(table).startsWith('stats_defense'));
    const gcaTable = findTable(tables, (table) => tableId(table).startsWith('stats_gca'));

    const standing = findStandingInfo(competitionTables, teamName) || findStandingInfo(tables, teamName);
    const league = findLeagueInfo(competitionTables, teamName);
    const roster = summarizeRoster(rosterTable);
    const standard = summarizeStandard(standardTable);
    const shooting = summarizeShooting(shootingTable);
    const goalkeeping = summarizeGoalkeeping(keeperTable);
    const misc = summarizeMisc(miscTable);
    const matchContext = summarizeMatchContext(matchlogTable);

    const missing = [
      passingTable ? null : 'Passing / التمرير التفصيلي',
      possessionTable ? null : 'Possession / الاستحواذ التفصيلي',
      defenseTable ? null : 'Defensive Actions / الأدوار الدفاعية التفصيلية',
      gcaTable ? null : 'Goal and Shot Creation / صناعة الفرص',
      'xG و xGA غير ظاهرين في الجداول المصدّرة الحالية إذا لم يظهرا لاحقًا من FBref/Stathead',
    ].filter(Boolean) as string[];

    const strengths = buildStrengths(standing, shooting, goalkeeping, matchContext);
    const weaknesses = buildWeaknesses(standing, shooting, goalkeeping, matchContext, missing);

    const body = buildBody({
      teamName,
      standing,
      league,
      roster,
      standard,
      shooting,
      goalkeeping,
      misc,
      matchContext,
      missing,
      sourceUrl: page.url || payload.competitionUrl,
      exportedAt: payload.exportedAt,
    });

    const sourceUrl = page.url || payload.competitionUrl || null;
    const teamCode = extractTeamCode(league?.group || '') || extractTeamCode(tableToObjects(findTable(competitionTables, (table) => tableCaption(table).includes('league table'))).find((row) => normalizeFbrefName(cleanTeamName(row.Squad)) === normalizeFbrefName(teamName))?.Squad) || null;

    return {
      teamName,
      normalizedTeamName: normalizeFbrefName(teamName),
      teamCode,
      sourceUrl,
      title: `FBref / Stathead 2026 — ${teamName} World Cup Source Pack`,
      summary: `${teamName}: تقرير FBref/Stathead لكأس العالم 2026 مبني على ${tables.length} جدولًا من صفحة المنتخب، مع ${matchContext.completedCount} مباراة كأس عالم مكتملة في التصدير الحالي.`,
      body,
      confidence: 'A',
      tacticalTags: ['FBref', 'Stathead', 'World Cup 2026', standing?.group ? `Group ${standing.group}` : 'World Cup'],
      strengths,
      weaknesses,
      metrics: {
        source: payload.source || 'FBref / Stathead',
        extractionMethod: payload.extractionMethod || null,
        competitionUrl: payload.competitionUrl || null,
        exportedAt: payload.exportedAt || null,
        pageUrl: page.url || null,
        tableCount: tables.length,
        tableAvailability: {
          roster: Boolean(rosterTable),
          standard: Boolean(standardTable),
          matchlogs: Boolean(matchlogTable),
          goalkeeping: Boolean(keeperTable),
          shooting: Boolean(shootingTable),
          playingTime: Boolean(playingTimeTable),
          misc: Boolean(miscTable),
          passing: Boolean(passingTable),
          possession: Boolean(possessionTable),
          defense: Boolean(defenseTable),
          gca: Boolean(gcaTable),
        },
        standing,
        league,
        roster,
        standard,
        shooting,
        goalkeeping,
        misc,
        matchContext,
        missing,
      },
    };
  });
}

export function buildImportPreview(payload: FbrefExportPayload) {
  const drafts = buildFbrefTeamReportDrafts(payload);
  return {
    competitionTableCount: payload.competitionTables?.length || 0,
    squadPageCount: payload.squadPages?.length || 0,
    successfulSquadPageCount: (payload.squadPages || []).filter((page) => page.ok).length,
    draftCount: drafts.length,
    teams: drafts.map((draft) => ({
      teamName: draft.teamName,
      sourceUrl: draft.sourceUrl,
      tableCount: draft.metrics.tableCount,
      completedWorldCupMatches: (draft.metrics.matchContext as { completedCount?: number } | undefined)?.completedCount || 0,
      hasShooting: Boolean((draft.metrics.tableAvailability as Record<string, boolean> | undefined)?.shooting),
      hasGoalkeeping: Boolean((draft.metrics.tableAvailability as Record<string, boolean> | undefined)?.goalkeeping),
      hasStandard: Boolean((draft.metrics.tableAvailability as Record<string, boolean> | undefined)?.standard),
    })),
  };
}
