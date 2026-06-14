const UNAVAILABLE = 'غير متوفر في المصادر';

type AnyRecord = Record<string, any>;

export type FbrefBrowserTeamPayload = {
  teamCode?: string;
  teamName?: string;
  sourceName?: string;
  sourceUrl?: string;
  extractedAt?: string;
  roster?: { count?: number; players?: AnyRecord[]; positions?: Record<string, number>; clubs?: Record<string, number> };
  fixturesAndForm?: {
    completedCount?: number;
    upcomingCount?: number;
    last5?: AnyRecord;
    last10?: AnyRecord;
    allAvailable?: AnyRecord;
    matches?: AnyRecord[];
    upcomingMatches?: AnyRecord[];
  };
  group?: { table?: AnyRecord[] };
  detectedImportantTables?: Record<string, boolean>;
  rawTables?: { caption?: string; tableId?: string | null; rowsCount?: number }[];
};

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = clean(value).replace(/[,،%]/g, '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function list(items: unknown[] | undefined, fallback = UNAVAILABLE) {
  const values = (items || []).map(clean).filter(Boolean);
  return values.length ? values.join('، ') : fallback;
}

function stripFbrefPrefix(value: unknown) {
  return clean(value).replace(/^[a-z]{2,3}\s+/i, '').trim();
}

function resultCounts(matches: AnyRecord[]) {
  return matches.reduce((acc, row) => {
    if (row.result === 'W') acc.wins += 1;
    if (row.result === 'D') acc.draws += 1;
    if (row.result === 'L') acc.losses += 1;
    return acc;
  }, { wins: 0, draws: 0, losses: 0 });
}

function sum(matches: AnyRecord[], key: string) {
  return matches.reduce((total, row) => total + (numberValue(row[key]) || 0), 0);
}

function average(matches: AnyRecord[], key: string) {
  const values = matches.map((row) => numberValue(row[key])).filter((value): value is number => typeof value === 'number');
  if (!values.length) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

function completedMatches(payload: FbrefBrowserTeamPayload) {
  return (payload.fixturesAndForm?.matches || []).filter((match) => ['W', 'D', 'L'].includes(clean(match.result)) && numberValue(match.goals_for) !== null && numberValue(match.goals_against) !== null);
}

function formationCounts(matches: AnyRecord[]) {
  return matches.reduce<Record<string, number>>((acc, row) => {
    const formation = clean(row.formation);
    if (formation) acc[formation] = (acc[formation] || 0) + 1;
    return acc;
  }, {});
}

function normalizeFormations(formations: unknown): Record<string, number> {
  if (Array.isArray(formations)) {
    return formations.reduce<Record<string, number>>((acc, formation) => {
      const key = clean(formation);
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
  if (formations && typeof formations === 'object') return formations as Record<string, number>;
  return {};
}

function topFormationText(formations: Record<string, number> | undefined) {
  const values = Object.entries(formations || {}).sort((a, b) => b[1] - a[1]);
  return values.length ? values.map(([formation, count]) => `${formation} (${count})`).join('، ') : UNAVAILABLE;
}

function averageAge(players: AnyRecord[]) {
  const ages = players.map((player) => numberValue(player.age)).filter((value): value is number => typeof value === 'number');
  return ages.length ? Number((ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)) : null;
}

function topClubs(players: AnyRecord[]) {
  const counts = players.reduce<Record<string, number>>((acc, player) => {
    const club = clean(player.club).replace(/^1\.[a-z]{2,3}\s+/i, '');
    if (club) acc[club] = (acc[club] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([club, count]) => `${club} (${count})`);
}

function extractGroupName(payload: FbrefBrowserTeamPayload) {
  const rawCaption = (payload.rawTables || []).map((table) => table.caption || table.tableId || '').join(' ');
  const match = rawCaption.match(/group\s+([a-l])/i);
  return match?.[1]?.toUpperCase() || null;
}

function findGroupRow(payload: FbrefBrowserTeamPayload) {
  const teamName = clean(payload.teamName).toLowerCase();
  const code = clean(payload.teamCode).toLowerCase();
  return (payload.group?.table || []).find((row) => {
    const team = clean(row.team).toLowerCase();
    return team.includes(teamName) || (code && team.startsWith(code.slice(0, 2)));
  }) || null;
}

export function buildFbrefBrowserTeamDraft(payload: FbrefBrowserTeamPayload) {
  const teamName = clean(payload.teamName) || 'Brazil';
  const sourceName = clean(payload.sourceName) || 'FBref';
  const sourceUrl = clean(payload.sourceUrl) || null;
  const players = payload.roster?.players || [];
  const completed = completedMatches(payload);
  const all = payload.fixturesAndForm?.allAvailable || { ...resultCounts(completed), goalsFor: sum(completed, 'goals_for'), goalsAgainst: sum(completed, 'goals_against'), averagePossession: average(completed, 'possession'), formations: formationCounts(completed) };
  const last5Matches = completed.slice(-5);
  const last10Matches = completed.slice(-10);
  const last5 = payload.fixturesAndForm?.last5 || { ...resultCounts(last5Matches), goalsFor: sum(last5Matches, 'goals_for'), goalsAgainst: sum(last5Matches, 'goals_against'), averagePossession: average(last5Matches, 'possession') };
  const last10 = payload.fixturesAndForm?.last10 || { ...resultCounts(last10Matches), goalsFor: sum(last10Matches, 'goals_for'), goalsAgainst: sum(last10Matches, 'goals_against'), averagePossession: average(last10Matches, 'possession') };
  const formations = normalizeFormations(all.formations || formationCounts(completed));
  const groupName = extractGroupName(payload);
  const groupRow = findGroupRow(payload);
  const groupTeams = (payload.group?.table || []).map((row) => stripFbrefPrefix(row.team)).filter(Boolean);
  const missingTables = Object.entries(payload.detectedImportantTables || {})
    .filter(([key, available]) => !available && !['roster', 'matchlogs'].includes(key))
    .map(([key]) => key);
  const notableNames = players.slice(0, 10).map((player) => clean(player.player)).filter(Boolean);
  const cleanSheets = completed.filter((match) => numberValue(match.goals_against) === 0).length;
  const avgAge = averageAge(players);
  const clubs = topClubs(players);

  const sections = [
    `بطاقة المنتخب: ${teamName}. المجموعة: ${groupTeams.length ? groupTeams.join('، ') : UNAVAILABLE}. عدد لاعبي القائمة في المصدر: ${players.length || payload.roster?.count || UNAVAILABLE}. متوسط العمر: ${avgAge ?? UNAVAILABLE}. أكثر الأندية حضورًا: ${list(clubs)}.`,
    `وضع المنتخب في المجموعة: ${groupRow ? `المجموعة ${groupName || UNAVAILABLE}: المركز ${groupRow.rank || UNAVAILABLE}، لعب ${groupRow.games || UNAVAILABLE}، فاز ${groupRow.wins || UNAVAILABLE}، تعادل ${groupRow.ties || UNAVAILABLE}، خسر ${groupRow.losses || UNAVAILABLE}، له ${groupRow.goals_for || UNAVAILABLE}، عليه ${groupRow.goals_against || UNAVAILABLE}، نقاط ${groupRow.points || UNAVAILABLE}.` : UNAVAILABLE}`,
    `تحليل الأداء بالأرقام: في العينة المستخرجة من ${sourceName}: ${all.wins ?? 0} فوز، ${all.draws ?? 0} تعادل، ${all.losses ?? 0} خسارة، ${all.goalsFor ?? 0} هدفًا له، ${all.goalsAgainst ?? 0} عليه. آخر 5: ${last5.wins ?? 0} فوز / ${last5.draws ?? 0} تعادل / ${last5.losses ?? 0} خسارة. آخر 10: ${last10.wins ?? 0} فوز / ${last10.draws ?? 0} تعادل / ${last10.losses ?? 0} خسارة.`,
    `القوة الهجومية: تتوفر من هذا التصدير أهداف الفريق فقط: ${all.goalsFor ?? UNAVAILABLE} هدفًا في ${completed.length || UNAVAILABLE} مباراة منتهية. التسديدات، التسديدات على المرمى، xG، وصناعة الفرص غير متوفرة في هذا المصدر المستخرج.`,
    `القوة الدفاعية: استقبل المنتخب ${all.goalsAgainst ?? UNAVAILABLE} هدفًا في العينة، وخرج بشباك نظيفة ${cleanSheets} مرة. التصديات، xGA، التدخلات، والاعتراضات غير متوفرة في هذا المصدر المستخرج.`,
    `وسط الملعب والتحكم: متوسط الاستحواذ في المباريات التي ظهر فيها الرقم: ${all.averagePossession ?? UNAVAILABLE}%. آخر 10: ${last10.averagePossession ?? UNAVAILABLE}%.`,
    `الكرات الثابتة: ${UNAVAILABLE}.`,
    `أسماء بارزة في القائمة: ${list(notableNames)}. هذه أسماء ظاهرة في القائمة وليست ترتيبًا نهائيًا للأكثر تأثيرًا.`,
    `التحليل التكتيكي: الرسم/الرسوم الأكثر ظهورًا في العينة: ${topFormationText(formations)}. هذا توصيف شكلي من جدول المباريات وليس تحليلًا تكتيكيًا كاملًا.`,
    `نقاط القوة: القائمة ومواعيد المباريات موثقة من المصدر، ووجود عينة نتائج كافية لحساب الفورمة العامة.`,
    `نقاط الضعف / ما يحتاج متابعة: بعض الجداول المتقدمة غير متوفرة في التصدير الحالي، خصوصًا ${list(missingTables)}.`,
    `تقييم مبدئي مبني على البيانات المتاحة: الهجوم والدفاع والزخم يمكن تقييمهم مبدئيًا من النتائج والأهداف فقط، ولا يتم احتساب التسديدات أو xG لأنها غير متوفرة في هذا التصدير.`,
    `معلومات غير متوفرة في المصادر: ${list(missingTables)}.`,
    `سجل المصادر: ${sourceName}${sourceUrl ? ` — ${sourceUrl}` : ''}${payload.extractedAt ? ` — تاريخ الاستخراج: ${payload.extractedAt}` : ''}.`,
  ];

  const metrics = {
    source: sourceName,
    extractionMethod: 'fbref_browser_team_json',
    exportedAt: payload.extractedAt || null,
    pageUrl: sourceUrl,
    tableAvailability: payload.detectedImportantTables || {},
    standing: groupRow ? {
      group: groupName,
      rank: groupRow.rank || null,
      mp: numberValue(groupRow.games),
      wins: numberValue(groupRow.wins),
      draws: numberValue(groupRow.ties),
      losses: numberValue(groupRow.losses),
      gf: numberValue(groupRow.goals_for),
      ga: numberValue(groupRow.goals_against),
      gd: clean(groupRow.goal_diff) || null,
      pts: numberValue(groupRow.points),
      last5: clean(groupRow.last_5) || null,
    } : null,
    shooting: {
      goals: numberValue(all.goalsFor),
      shots: null,
      shotsOnTarget: null,
      shotAccuracy: null,
      activeShooters: [],
    },
    goalkeeping: {
      goalkeeper: null,
      saves: null,
      shotsOnTargetAgainst: null,
      goalsAgainst: numberValue(all.goalsAgainst),
      savePercentage: null,
    },
    misc: null,
    matchContext: {
      completedCount: completed.length || numberValue(payload.fixturesAndForm?.completedCount),
      upcomingCount: payload.fixturesAndForm?.upcomingMatches?.length || numberValue(payload.fixturesAndForm?.upcomingCount),
      formations: Object.keys(formations),
      averagePossession: numberValue(all.averagePossession),
    },
    roster: {
      count: players.length || payload.roster?.count || null,
      averageAge: avgAge,
      topClubs: clubs,
    },
    standard: {
      usedPlayers: players.length || payload.roster?.count || null,
      scorers: [],
      assisters: [],
      minutesLeaders: notableNames.slice(0, 8),
    },
    missing: missingTables,
    raw: payload,
  };

  return {
    title: `FBref Browser Extract — ${teamName} World Cup 2026`,
    summary: `${teamName}: مسودة موثقة من استخراج FBref للمتصفح تضم القائمة، المباريات/الفورمة، وجدول المجموعة، مع توضيح الجداول المتقدمة غير المتوفرة.`,
    body: sections.join('\n\n'),
    metrics,
    tacticalTags: ['FBref', 'Browser Extract', 'World Cup 2026', 'Source Intake'],
    strengths: ['القائمة ومباريات المنتخب موثقة من المصدر', 'الفورمة العامة محسوبة من جدول النتائج المستخرج'],
    weaknesses: missingTables.length ? ['الجداول المتقدمة غير متوفرة في التصدير الحالي'] : [],
    confidence: 'B' as const,
  };
}
