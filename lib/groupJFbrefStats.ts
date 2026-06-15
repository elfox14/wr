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
  group: 'J';
  sourceUrl: string;
  manager: string;
  rosterSummary: RosterSummary;
  standing: Standing;
  worldCupMatches: Match[];
};

const arabicTeamNames: Record<string, string> = {
  ALG: 'الجزائر',
  ARG: 'الأرجنتين',
  AUT: 'النمسا',
  JOR: 'الأردن',
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
  return `${displayTeam(stats)} لديه لقطة FBref قبل أول مباراة في المجموعة J: ${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة، متوسط عمر ${n(stats.rosterSummary.averageAge)} سنة، والمدرب المذكور في المصدر: ${stats.manager}.`;
}

function buildReportBody(stats: TeamSnapshot) {
  const teamName = displayTeam(stats);
  return `بطاقة المنتخب: ${teamName} — المجموعة J — مصدر البيانات FBref copied source text. هذه لقطة قبل لعب مباريات المجموعة في المصدر، لذلك لا توجد أرقام تسديد أو حراسة أو استحواذ فعلية لكأس العالم بعد.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. المدرب المذكور في المصدر: ${stats.manager}. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}.

وضع المنتخب في المجموعة قبل البداية: المركز الترتيبي داخل جدول FBref ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}. آخر 5 كما تظهر في جدول FBref: ${stats.standing.last5 || 'غير متوفر في المصادر'}.

المباريات المسجلة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}.

مؤشرات غير متوفرة بعد: التسديدات، التسديدات على المرمى، الأهداف في البطولة، الحراسة، التصديات، الاستحواذ، التشكيلات المستخدمة في كأس العالم، والبطاقات. السبب: لا توجد مباراة مكتملة داخل لقطة FBref لهذه المجموعة وقت النسخ.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

export const groupJFbrefStats: TeamSnapshot[] = [
  {
    team: 'Algeria',
    teamCode: 'ALG',
    teamCodes: ['ALG', 'DZ', 'ALGERIA'],
    group: 'J',
    sourceUrl: 'https://fbref.com/en/squads/1e2dba57/2026/c1/Algeria-Men-Stats-World-Cup',
    manager: 'Vladimir Petković',
    rosterSummary: {
      count: 26,
      averageAge: 26.5,
      topClubs: ['USM Alger (2)', 'Lille (2)', 'Manchester City (1)', 'Dortmund (1)', 'Al-Ahli (1)'],
    },
    standing: { rank: 1, squad: 'dz Algeria', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L W D W W' },
    worldCupMatches: [
      { date: '2026-06-16', time: '20:00 (04:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'ar Argentina', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-22', time: '20:00 (06:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'jo Jordan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '21:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'at Austria', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Argentina',
    teamCode: 'ARG',
    teamCodes: ['ARG', 'AR', 'ARGENTINA'],
    group: 'J',
    sourceUrl: 'https://fbref.com/en/squads/f9fddd6e/2026/c1/Argentina-Men-Stats-World-Cup',
    manager: 'Lionel Scaloni',
    rosterSummary: {
      count: 26,
      averageAge: 28.6,
      topClubs: ['Atlético Madrid (6)', 'Marseille (3)', 'Inter Miami (2)', 'Chelsea (1)', 'Liverpool (1)'],
    },
    standing: { rank: 2, squad: 'ar Argentina', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W W W W' },
    worldCupMatches: [
      { date: '2026-06-16', time: '20:00 (04:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'dz Algeria', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-22', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'at Austria', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '21:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'jo Jordan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Austria',
    teamCode: 'AUT',
    teamCodes: ['AUT', 'AT', 'AUSTRIA'],
    group: 'J',
    sourceUrl: 'https://fbref.com/en/squads/d5121f10/2026/c1/Austria-Men-Stats-World-Cup',
    manager: 'Ralf Rangnick',
    rosterSummary: {
      count: 26,
      averageAge: 28.1,
      topClubs: ['RB Leipzig (3)', 'Dortmund (2)', 'Werder Bremen (2)', 'Mainz 05 (2)', 'Real Madrid (1)'],
    },
    standing: { rank: 3, squad: 'at Austria', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D W W W' },
    worldCupMatches: [
      { date: '2026-06-16', time: '21:00 (07:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'jo Jordan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-22', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'ar Argentina', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '21:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'dz Algeria', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Jordan',
    teamCode: 'JOR',
    teamCodes: ['JOR', 'JO', 'JORDAN'],
    group: 'J',
    sourceUrl: 'https://fbref.com/en/squads/3e22f0fa/2026/c1/Jordan-Men-Stats-World-Cup',
    manager: 'Jamal Sellami',
    rosterSummary: {
      count: 26,
      averageAge: 28.1,
      topClubs: ['Al-Hussein SC (6)', 'Al-Faisaly (2)', 'Al-Wehdat SC (2)', 'Al-Karma (2)', "Al-Zawra'a SC (2)"],
    },
    standing: { rank: 4, squad: 'jo Jordan', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L L D L L' },
    worldCupMatches: [
      { date: '2026-06-16', time: '21:00 (07:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'at Austria', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-22', time: '20:00 (06:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'dz Algeria', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '21:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'ar Argentina', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
];

export function findGroupJFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupJFbrefStats.find((stats) => (
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

export async function seedGroupJFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupJFbrefStats) {
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
      model: 'fbref-copy-source-group-j-prematch-v1',
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
        tacticalTags: ['FBref', 'World Cup 2026', 'Group J', 'prematch', 'copied-source'],
        strengths: [`قائمة FBref متاحة: ${n(stats.rosterSummary.count)} لاعبًا`, `متوسط عمر تقريبي: ${n(stats.rosterSummary.averageAge)} سنة`],
        weaknesses: ['لا توجد مباراة مكتملة في هذه اللقطة، لذلك لا تتوفر أرقام تسديد أو حراسة أو استحواذ فعلية'],
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupJFbrefStats.length };
}
