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
  group: 'K';
  sourceUrl: string;
  manager: string;
  rosterSummary: RosterSummary;
  standing: Standing;
  worldCupMatches: Match[];
};

const arabicTeamNames: Record<string, string> = {
  COL: 'كولومبيا',
  POR: 'البرتغال',
  COD: 'الكونغو الديمقراطية',
  UZB: 'أوزبكستان',
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
  return `${displayTeam(stats)} لديه لقطة FBref قبل أول مباراة في المجموعة K: ${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة، متوسط عمر ${n(stats.rosterSummary.averageAge)} سنة، والمدرب المذكور في المصدر: ${stats.manager}.`;
}

function buildReportBody(stats: TeamSnapshot) {
  const teamName = displayTeam(stats);
  return `بطاقة المنتخب: ${teamName} — المجموعة K — مصدر البيانات FBref copied source text. هذه لقطة قبل لعب مباريات المجموعة في المصدر، لذلك لا توجد أرقام تسديد أو حراسة أو استحواذ فعلية لكأس العالم بعد.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. المدرب المذكور في المصدر: ${stats.manager}. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}.

وضع المنتخب في المجموعة قبل البداية: المركز الترتيبي داخل جدول FBref ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}. آخر 5 كما تظهر في جدول FBref: ${stats.standing.last5 || 'غير متوفر في المصادر'}.

المباريات المسجلة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}.

مؤشرات غير متوفرة بعد: التسديدات، التسديدات على المرمى، الأهداف في البطولة، الحراسة، التصديات، الاستحواذ، التشكيلات المستخدمة في كأس العالم، والبطاقات. السبب: لا توجد مباراة مكتملة داخل لقطة FBref لهذه المجموعة وقت النسخ.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

export const groupKFbrefStats: TeamSnapshot[] = [
  {
    team: 'Colombia',
    teamCode: 'COL',
    teamCodes: ['COL', 'CO', 'COLOMBIA'],
    group: 'K',
    sourceUrl: 'https://fbref.com/en/squads/ab73cfe5/2026/c1/Colombia-Men-Stats-World-Cup',
    manager: 'Néstor Lorenzo',
    rosterSummary: {
      count: 26,
      averageAge: 30.1,
      topClubs: ['River Plate (2)', 'Crystal Palace (2)', 'Palmeiras (1)', 'Flamengo (1)', 'Bayern Munich (1)'],
    },
    standing: { rank: 1, squad: 'co Colombia', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W L L W W' },
    worldCupMatches: [
      { date: '2026-06-17', time: '20:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'uz Uzbekistan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '20:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'cd Congo DR', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '19:30 (02:30)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'pt Portugal', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Portugal',
    teamCode: 'POR',
    teamCodes: ['POR', 'PT', 'PORTUGAL'],
    group: 'K',
    sourceUrl: 'https://fbref.com/en/squads/4a1b4ea8/2026/c1/Portugal-Men-Stats-World-Cup',
    manager: 'Roberto Martínez',
    rosterSummary: {
      count: 26,
      averageAge: 28.0,
      topClubs: ['Paris Saint-Germain (4)', 'Manchester City (3)', 'Sporting CP (3)', 'Manchester Utd (2)', 'Al-Nassr (2)'],
    },
    standing: { rank: 2, squad: 'pt Portugal', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D W W W' },
    worldCupMatches: [
      { date: '2026-06-17', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'cd Congo DR', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'uz Uzbekistan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '19:30 (02:30)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'co Colombia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Congo DR',
    teamCode: 'COD',
    teamCodes: ['COD', 'CD', 'CONGO DR', 'DR CONGO', 'DEMOCRATIC REPUBLIC OF THE CONGO'],
    group: 'K',
    sourceUrl: 'https://fbref.com/en/squads/9be9f315/2026/c1/Congo-DR-Men-Stats-World-Cup',
    manager: 'Sébastien Desabre',
    rosterSummary: {
      count: 27,
      averageAge: 29.0,
      topClubs: ['AEL Limassol (2)', 'Lille (2)', 'Real Betis (1)', 'Al Jazira Club (1)', 'Newcastle United (1)'],
    },
    standing: { rank: 3, squad: 'cd Congo DR', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L W W D L' },
    worldCupMatches: [
      { date: '2026-06-17', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'pt Portugal', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '20:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'co Colombia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '19:30 (02:30)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'uz Uzbekistan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Uzbekistan',
    teamCode: 'UZB',
    teamCodes: ['UZB', 'UZ', 'UZBEKISTAN'],
    group: 'K',
    sourceUrl: 'https://fbref.com/en/squads/cd389e75/2026/c1/Uzbekistan-Men-Stats-World-Cup',
    manager: 'Fabio Cannavaro',
    rosterSummary: {
      count: 26,
      averageAge: 28.5,
      topClubs: ['Pakhtakor Tashkent FK (3)', 'Neftchi FK (3)', 'FC Nasaf (2)', 'FK Bukhara Nurafshon (2)', 'Esteghlal (2)'],
    },
    standing: { rank: 4, squad: 'uz Uzbekistan', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W L L L' },
    worldCupMatches: [
      { date: '2026-06-17', time: '20:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'co Colombia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-23', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'pt Portugal', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-27', time: '19:30 (02:30)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'cd Congo DR', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
];

export function findGroupKFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupKFbrefStats.find((stats) => (
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

export async function seedGroupKFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupKFbrefStats) {
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
      model: 'fbref-copy-source-group-k-prematch-v1',
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
        tacticalTags: ['FBref', 'World Cup 2026', 'Group K', 'prematch', 'copied-source'],
        strengths: [`قائمة FBref متاحة: ${n(stats.rosterSummary.count)} لاعبًا`, `متوسط عمر تقريبي: ${n(stats.rosterSummary.averageAge)} سنة`],
        weaknesses: ['لا توجد مباراة مكتملة في هذه اللقطة، لذلك لا تتوفر أرقام تسديد أو حراسة أو استحواذ فعلية'],
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupKFbrefStats.length };
}
