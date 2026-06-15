import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';

type Standing = {
  rank: number;
  squad: string;
  mp: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: string;
  pts: number;
  last5: string;
};

type Match = {
  date: string;
  time: string;
  competition: string;
  round: string;
  venue: string;
  result: string;
  gf: string;
  ga: string;
  opponent: string;
  possession: number | null;
  attendance: number | null;
  captain: string;
  formation: string;
  opponentFormation: string;
  referee: string;
  notes: string;
};

type RosterSummary = {
  count: number;
  averageAge: number;
  topClubs: string[];
};

type TeamSnapshot = {
  team: string;
  teamCode: string;
  teamCodes: string[];
  group: 'L';
  sourceUrl: string;
  manager: string;
  rosterSummary: RosterSummary;
  standing: Standing;
  worldCupMatches: Match[];
};

const arabicTeamNames: Record<string, string> = {
  CRO: 'كرواتيا',
  ENG: 'إنجلترا',
  GHA: 'غانا',
  PAN: 'بنما',
};

function displayTeam(stats: TeamSnapshot) {
  return arabicTeamNames[stats.teamCode] || stats.team;
}

function n(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'غير متوفر في المصادر';
  return value.toLocaleString('ar-EG');
}

function opponentName(raw: string) {
  return raw.replace(/^[a-z]{2}\s+/i, '').trim();
}

function upcomingMatches(stats: TeamSnapshot) {
  return stats.worldCupMatches
    .map((match) => `${match.date} ضد ${opponentName(match.opponent)}`)
    .join('؛ ');
}

function buildSummary(stats: TeamSnapshot) {
  return `${displayTeam(stats)} لديه لقطة FBref قبل أول مباراة في المجموعة L: ${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة، متوسط عمر ${n(stats.rosterSummary.averageAge)} سنة، والمدرب المذكور في المصدر: ${stats.manager}.`;
}

function buildReportBody(stats: TeamSnapshot) {
  const teamName = displayTeam(stats);
  return `بطاقة المنتخب: ${teamName} — المجموعة L — مصدر البيانات FBref copied source text. هذه لقطة قبل لعب مباريات المجموعة في المصدر، لذلك لا توجد أرقام تسديد أو حراسة أو استحواذ فعلية لكأس العالم بعد.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. المدرب المذكور في المصدر: ${stats.manager}. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}.

وضع المنتخب في المجموعة قبل البداية: المركز الترتيبي داخل جدول FBref ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}. آخر 5 كما تظهر في جدول FBref: ${stats.standing.last5 || 'غير متوفر في المصادر'}.

المباريات المسجلة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}.

مؤشرات غير متوفرة بعد: التسديدات، التسديدات على المرمى، الأهداف في البطولة، الحراسة، التصديات، الاستحواذ، التشكيلات المستخدمة في كأس العالم، والبطاقات. السبب: لا توجد مباراة مكتملة داخل لقطة FBref لهذه المجموعة وقت النسخ.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

export const groupLFbrefStats: TeamSnapshot[] = [
  {
    team: 'Croatia',
    teamCode: 'CRO',
    teamCodes: ['CRO', 'HR', 'CROATIA'],
    group: 'L',
    sourceUrl: 'https://fbref.com/en/squads/7b08e376/2026/c1/Croatia-Men-Stats-World-Cup',
    manager: 'Zlatko Dalić',
    rosterSummary: {
      count: 26,
      averageAge: 27.9,
      topClubs: ['Manchester City (2)', 'Real Sociedad (2)', 'Milan (1)', 'Inter (1)', 'PSV (1)'],
    },
    standing: { rank: 1, squad: 'hr Croatia', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W L L W' },
    worldCupMatches: [
      { date: '2026-06-17', time: '15:00 (23:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'eng England', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '19:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'pa Panama', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '17:00 (00:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'gh Ghana', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'England',
    teamCode: 'ENG',
    teamCodes: ['ENG', 'ENGLAND'],
    group: 'L',
    sourceUrl: 'https://fbref.com/en/squads/1862c019/2026/c1/England-Men-Stats-World-Cup',
    manager: 'Thomas Tuchel',
    rosterSummary: {
      count: 26,
      averageAge: 26.6,
      topClubs: ['Arsenal (4)', 'Manchester City (4)', 'Aston Villa (3)', 'Newcastle United (2)', 'Barcelona (2)'],
    },
    standing: { rank: 2, squad: 'eng England', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D L W W' },
    worldCupMatches: [
      { date: '2026-06-17', time: '15:00 (23:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'hr Croatia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '16:00 (23:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'gh Ghana', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '17:00 (00:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'pa Panama', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Ghana',
    teamCode: 'GHA',
    teamCodes: ['GHA', 'GH', 'GHANA'],
    group: 'L',
    sourceUrl: 'https://fbref.com/en/squads/9349828d/2026/c1/Ghana-Men-Stats-World-Cup',
    manager: 'Carlos Queiroz',
    rosterSummary: {
      count: 26,
      averageAge: 26.4,
      topClubs: ['Auxerre (3)', 'Leicester City (2)', 'Manchester City (1)', 'Villarreal (1)', 'PAOK (1)'],
    },
    standing: { rank: 3, squad: 'gh Ghana', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L L L L D' },
    worldCupMatches: [
      { date: '2026-06-17', time: '19:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'pa Panama', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '16:00 (23:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'eng England', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '17:00 (00:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'hr Croatia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Panama',
    teamCode: 'PAN',
    teamCodes: ['PAN', 'PA', 'PANAMA'],
    group: 'L',
    sourceUrl: 'https://fbref.com/en/squads/6061a82d/2026/c1/Panama-Men-Stats-World-Cup',
    manager: 'Thomas Christiansen',
    rosterSummary: {
      count: 26,
      averageAge: 30.0,
      topClubs: ['Plaza Amador (2)', 'Univ Católica (2)', 'Saprissa (2)', 'Beşiktaş (1)', 'UNAM (1)'],
    },
    standing: { rank: 4, squad: 'pa Panama', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'D W L W D' },
    worldCupMatches: [
      { date: '2026-06-17', time: '19:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'gh Ghana', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '19:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'hr Croatia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '17:00 (00:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'eng England', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
];

export function findGroupLFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupLFbrefStats.find((stats) => (
    stats.teamCode.toLowerCase() === normalized ||
    stats.team.toLowerCase() === normalized ||
    stats.teamCodes.some((code) => code.toLowerCase() === normalized)
  )) || null;
}

export function toTeamFBRefStats(stats: TeamSnapshot) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: {
      group: stats.group,
      rank: String(stats.standing.rank),
      mp: stats.standing.mp,
      wins: stats.standing.wins,
      draws: stats.standing.draws,
      losses: stats.standing.losses,
      gf: stats.standing.gf,
      ga: stats.standing.ga,
      gd: stats.standing.gd,
      pts: stats.standing.pts,
    },
    shooting: null,
    goalkeeping: null,
    misc: null,
    matchContext: { completedCount: 0, upcomingCount: stats.worldCupMatches.length, formations: [], averagePossession: null },
    roster: stats.rosterSummary,
    standard: { usedPlayers: 0, scorers: [], assisters: [], minutesLeaders: [] },
  };
}

export async function seedGroupLFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupLFbrefStats) {
    const team = teams.find((candidate) => (
      stats.teamCodes.some((code) => String(candidate.code || '').toLowerCase() === code.toLowerCase()) ||
      String(candidate.name || '').toLowerCase() === stats.team.toLowerCase()
    ));

    if (!team) {
      skipped++;
      missingTeams.push(stats.teamCodes.join('/'));
      continue;
    }

    const title = `FBref Snapshot — ${displayTeam(stats)} — World Cup 2026`;
    const normalized = normalizeTeamReportBody({
      teamName: team.name,
      title,
      summary: buildSummary(stats),
      body: buildReportBody(stats),
      sourceName: 'FBref copied source text — 2026 World Cup',
      sourceUrl: stats.sourceUrl,
    });

    const metrics: Prisma.InputJsonValue = {
      model: 'fbref-copy-source-group-l-prematch-v1',
      source: 'FBref copied source text',
      exportedAt: '2026-06-15T00:00:00.000Z',
      teamCode: stats.teamCode,
      group: stats.group,
      manager: stats.manager,
      standing: stats.standing,
      rosterSummary: stats.rosterSummary,
      worldCupMatches: stats.worldCupMatches,
      note: 'Pre-match snapshot: no completed World Cup match in this FBref copy.',
    };

    const report = await prisma.teamIntelligenceReport.findFirst({
      where: { teamId: team.id, title, provider: 'FBREF_STATHEAD_SNAPSHOT' },
      select: { id: true },
    });

    if (report) {
      skipped++;
      continue;
    }

    await prisma.teamIntelligenceReport.create({
      data: {
        teamId: team.id,
        title,
        summary: buildSummary(stats),
        body: normalized.body,
        reportType: 'TEAM_PROFILE',
        language: 'ar',
        sourceName: 'FBref copied source text — 2026 World Cup',
        sourceUrl: stats.sourceUrl,
        sourceCategory: 'stats',
        confidence: 'B',
        provider: 'FBREF_STATHEAD_SNAPSHOT',
        metrics,
        tacticalTags: ['FBref', 'World Cup 2026', 'Group L', 'prematch', 'copied-source'],
        strengths: [`قائمة FBref متاحة: ${n(stats.rosterSummary.count)} لاعبًا`, `متوسط عمر تقريبي: ${n(stats.rosterSummary.averageAge)} سنة`],
        weaknesses: ['لا توجد مباراة مكتملة في هذه اللقطة، لذلك لا تتوفر أرقام تسديد أو حراسة أو استحواذ فعلية'],
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupLFbrefStats.length };
}
