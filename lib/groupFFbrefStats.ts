import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';
import type { GroupAFbrefTeamStats } from './groupAFbrefStats';

type GroupFFbrefTeamStats = GroupAFbrefTeamStats;

const arabicTeamNames: Record<string, string> = {
  SWE: 'السويد',
  JPN: 'اليابان',
  NED: 'هولندا',
  TUN: 'تونس',
};

function displayTeam(stats: GroupFFbrefTeamStats) {
  return arabicTeamNames[stats.teamCode] || stats.team;
}

function n(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'غير متوفر في المصادر';
  return value.toLocaleString('ar-EG');
}

function pct(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'غير متوفر في المصادر';
  return `${value.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%`;
}

function opponentName(raw: string) {
  return raw.replace(/^[a-z]{2}\s+/i, '').trim();
}

function completedWorldCupMatch(stats: GroupFFbrefTeamStats) {
  return stats.worldCupMatches.find((match) => match.result);
}

function upcomingMatches(stats: GroupFFbrefTeamStats) {
  return stats.worldCupMatches
    .filter((match) => !match.result)
    .map((match) => `${match.date} ضد ${opponentName(match.opponent)}`)
    .join('؛ ');
}

function buildStrengths(stats: GroupFFbrefTeamStats) {
  const strengths: string[] = [];
  if (stats.standing.pts > 0) strengths.push(`${n(stats.standing.pts)} نقاط بعد ${n(stats.standing.mp)} مباراة في المجموعة`);
  if (stats.shooting.goals > 0) strengths.push(`${n(stats.shooting.goals)} هدف من ${n(stats.shooting.shots)} تسديدة`);
  if (stats.shooting.shotsOnTarget > 0) strengths.push(`${n(stats.shooting.shotsOnTarget)} تسديدات على المرمى`);
  if (stats.goalkeeping.cleanSheets > 0) strengths.push(`شباك نظيفة مع ${stats.goalkeeping.goalkeeper}`);
  if (stats.goalkeeping.saves > 0) strengths.push(`${stats.goalkeeping.goalkeeper} قام بـ${n(stats.goalkeeping.saves)} تصديات`);
  if (stats.matchContext.averagePossession && stats.matchContext.averagePossession >= 55) strengths.push(`استحواذ مرتفع: ${pct(stats.matchContext.averagePossession)}`);
  if (!strengths.length) strengths.push('وجود ملف FBref تفصيلي قابل للتحديث بعد كل مباراة');
  return strengths.slice(0, 4);
}

function buildWeaknesses(stats: GroupFFbrefTeamStats) {
  const weaknesses: string[] = [];
  if (stats.standing.ga > 0) weaknesses.push(`استقبل ${n(stats.standing.ga)} هدف في عينة المجموعة الحالية`);
  if (stats.shooting.goals === 0) weaknesses.push('لم يسجل في مباراة كأس العالم المتاحة داخل FBref');
  if (stats.shooting.shots <= 8) weaknesses.push(`حجم تسديد محدود: ${n(stats.shooting.shots)} تسديدات فقط`);
  if (stats.goalkeeping.goalsAgainst >= 4) weaknesses.push(`ضغط دفاعي واضح: ${n(stats.goalkeeping.goalsAgainst)} أهداف مستقبلة`);
  if (stats.matchContext.averagePossession !== null && stats.matchContext.averagePossession < 45) weaknesses.push(`استحواذ منخفض: ${pct(stats.matchContext.averagePossession)}`);
  if (!weaknesses.length) weaknesses.push('العينة الحالية مباراة واحدة فقط، لذلك لا تصلح لاستخلاص حكم نهائي');
  return weaknesses.slice(0, 4);
}

function buildReportBody(stats: GroupFFbrefTeamStats) {
  const teamName = displayTeam(stats);
  const match = completedWorldCupMatch(stats);
  const matchText = match
    ? `${match.date}: ${teamName} ${match.gf}-${match.ga} ${opponentName(match.opponent)}، النتيجة ${match.result}، الاستحواذ ${match.possession !== null ? pct(match.possession) : 'غير متوفر في المصادر'}، القائد ${match.captain || 'غير متوفر في المصادر'}، الشكل ${match.formation || 'غير متوفر في المصادر'}.`
    : 'لا توجد مباراة مكتملة في عينة World Cup داخل مصدر FBref.';

  return `بطاقة المنتخب: ${teamName} — المجموعة F — مصدر البيانات FBref copied source text. الملف يحتوي على Roster، Standard Stats، Scores & Fixtures، Goalkeeping، Shooting، Miscellaneous Stats، وترتيب Group F. العينة الحالية: ${n(stats.standing.mp)} مباراة.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}. هذه لقطة إحصائية منظمة، وليست القائمة الرسمية النهائية إذا اختلفت مع FIFA.

وضع المنتخب في المجموعة: المركز ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}.

تحليل الأداء بالأرقام: ${matchText} المباريات القادمة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}. شارك ${n(stats.standard.usedPlayers)} لاعبًا في المباراة المتاحة.

القوة الهجومية: سجل المنتخب ${n(stats.shooting.goals)} هدف، وسدد ${n(stats.shooting.shots)} مرة، منها ${n(stats.shooting.shotsOnTarget)} على المرمى، بدقة تسديد ${pct(stats.shooting.shotAccuracy)}. الهدافون: ${stats.standard.scorers.join('، ') || 'لا يوجد'}. صانعو الأهداف: ${stats.standard.assisters.join('، ') || 'لا يوجد'}. أكثر اللاعبين دقائق: ${stats.standard.minutesLeaders.join('، ') || 'غير متوفر في المصادر'}. أكثر المسددين: ${stats.activeShooters.slice(0, 6).join('، ') || 'غير متوفر في المصادر'}.

القوة الدفاعية: استقبل المنتخب ${n(stats.goalkeeping.goalsAgainst)} هدف في حراسة ${stats.goalkeeping.goalkeeper || 'غير متوفر في المصادر'}، مع ${n(stats.goalkeeping.saves)} تصديات من ${n(stats.goalkeeping.shotsOnTargetAgainst)} تسديدات على المرمى ضده، ونسبة تصدي ${pct(stats.goalkeeping.savePercentage)}. الشباك النظيفة: ${n(stats.goalkeeping.cleanSheets)}.

وسط الملعب والتحكم: الاستحواذ المتوسط في مباريات كأس العالم المكتملة داخل المصدر ${stats.matchContext.averagePossession !== null ? pct(stats.matchContext.averagePossession) : 'غير متوفر في المصادر'}. التشكيلات المستخدمة: ${stats.matchContext.formations.join('، ') || 'غير متوفر في المصادر'}. لا يتم اختراع دقة تمرير أو xG لأنها غير موجودة في النص المنسوخ.

الانضباط والأدوار بدون كرة: البطاقات الصفراء ${n(stats.misc.yellowCards)}، البطاقات الحمراء ${n(stats.misc.redCards)}، الأخطاء المرتكبة ${n(stats.misc.fouls)}، الأخطاء المكتسبة ${n(stats.misc.fouled)}، الاعتراضات ${n(stats.misc.interceptions)}، التدخلات الناجحة ${n(stats.misc.tacklesWon)}، العرضيات ${n(stats.misc.crosses)}.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

function buildSummary(stats: GroupFFbrefTeamStats) {
  const teamName = displayTeam(stats);
  return `${teamName} لديه لقطة FBref مقروءة بعد أول مباراة في المجموعة F: ${n(stats.standing.pts)} نقاط، ${n(stats.standing.gf)} له، ${n(stats.standing.ga)} عليه، ${n(stats.shooting.shots)} تسديدة، و${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة.`;
}

export const groupFFbrefStats: GroupFFbrefTeamStats[] = [
  {
    team: 'Sweden',
    teamCode: 'SWE',
    teamCodes: ['SWE', 'SE', 'SWEDEN'],
    sourceUrl: 'https://fbref.com/en/squads/296f69e7/2026/c1/Sweden-Men-Stats-World-Cup',
    roster: [],
    standing: { rank: 1, squad: 'se Sweden', mp: 1, wins: 1, draws: 0, losses: 0, gf: 5, ga: 1, gd: '+4', pts: 3, last5: 'W W L D W' },
    shooting: { goals: 5, shots: 13, shotsOnTarget: 7, shotAccuracy: 53.8, shotsPer90: 13.0, shotsOnTargetPer90: 7.0 },
    activeShooters: ['Viktor Gyökeres (5 تسديدات)', 'Alexander Isak (3 تسديدات)', 'Yasin Ayari (2 تسديدات)', 'Victor Lindelöf (1 تسديدة)', 'Lucas Bergvall (1 تسديدة)', 'Mattias Svanberg (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Kristoffer Nordfeldt', mp: 1, starts: 1, minutes: 90, goalsAgainst: 1, ga90: 1.0, shotsOnTargetAgainst: 2, saves: 1, savePercentage: 50.0, cleanSheets: 0, cleanSheetPercentage: 0.0 },
    misc: { yellowCards: 0, redCards: 0, secondYellows: 0, fouls: 10, fouled: 8, offsides: 3, crosses: 12, interceptions: 8, tacklesWon: 10, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['3-4-1-2'], averagePossession: 49.0 },
    rosterSummary: { count: 27, averageAge: 28.0, topClubs: ['Malmö (1)', 'Arsenal (1)', 'Liverpool (1)', 'Tottenham Hotspur (1)', 'Newcastle United (1)'] },
    standard: {
      usedPlayers: 16,
      scorers: ['Yasin Ayari (2)', 'Viktor Gyökeres', 'Alexander Isak', 'Mattias Svanberg'],
      assisters: ['Alexander Isak (2)', 'Viktor Gyökeres', 'Lucas Bergvall'],
      minutesLeaders: ['Yasin Ayari (90)', 'Viktor Gyökeres (90)', 'Isak Hien (90)', 'Gustaf Lagerbielke (90)', 'Victor Lindelöf (90)', 'Kristoffer Nordfeldt (90)'],
    },
    worldCupMatches: [
      { date: '2026-06-14', time: '20:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'W', gf: '5', ga: '1', opponent: 'tn Tunisia', possession: 49, attendance: 50987, captain: 'Victor Lindelöf', formation: '3-4-1-2', opponentFormation: '5-3-2', referee: 'Yael Falcón', notes: '' },
      { date: '2026-06-20', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'nl Netherlands', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-25', time: '18:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'jp Japan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Japan',
    teamCode: 'JPN',
    teamCodes: ['JPN', 'JP', 'JAPAN'],
    sourceUrl: 'https://fbref.com/en/squads/ffcf1690/2026/c1/Japan-Men-Stats-World-Cup',
    roster: [],
    standing: { rank: 2, squad: 'jp Japan', mp: 1, wins: 0, draws: 1, losses: 0, gf: 2, ga: 2, gd: '0', pts: 1, last5: 'W W W W D' },
    shooting: { goals: 2, shots: 10, shotsOnTarget: 3, shotAccuracy: 30.0, shotsPer90: 10.0, shotsOnTargetPer90: 3.0 },
    activeShooters: ['Keito Nakamura (3 تسديدات)', 'Kōki Ogawa (2 تسديدات)', 'Hiroki Ito (1 تسديدة)', 'Daichi Kamada (1 تسديدة)', 'Ayase Ueda (1 تسديدة)', 'Takefusa Kubo (1 تسديدة)', 'Yukinari Sugawara (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Zion Suzuki', mp: 1, starts: 1, minutes: 90, goalsAgainst: 2, ga90: 2.0, shotsOnTargetAgainst: 6, saves: 4, savePercentage: 66.7, cleanSheets: 0, cleanSheetPercentage: 0.0 },
    misc: { yellowCards: 0, redCards: 0, secondYellows: 0, fouls: 7, fouled: 7, offsides: 0, crosses: 23, interceptions: 4, tacklesWon: 10, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['3-4-3'], averagePossession: 40.0 },
    rosterSummary: { count: 26, averageAge: 27.9, topClubs: ['Ajax (2)', 'Feyenoord (2)', 'Sint-Truiden (2)', 'Liverpool (1)', 'Bayern Munich (1)'] },
    standard: {
      usedPlayers: 16,
      scorers: ['Daichi Kamada', 'Keito Nakamura'],
      assisters: ['Takefusa Kubo', 'Kōki Ogawa'],
      minutesLeaders: ['Hiroki Ito (90)', 'Daichi Kamada (90)', 'Keito Nakamura (90)', 'Kaishū Sano (90)', 'Zion Suzuki (90)', 'Shogo Taniguchi (90)'],
    },
    worldCupMatches: [
      { date: '2026-06-14', time: '15:00 (23:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'D', gf: '2', ga: '2', opponent: 'nl Netherlands', possession: 40, attendance: 69285, captain: 'Ritsu Doan', formation: '3-4-3', opponentFormation: '4-1-4-1', referee: 'Ismail Elfath', notes: '' },
      { date: '2026-06-20', time: '22:00 (07:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'tn Tunisia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-25', time: '18:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'se Sweden', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Netherlands',
    teamCode: 'NED',
    teamCodes: ['NED', 'NL', 'NETHERLANDS'],
    sourceUrl: 'https://fbref.com/en/squads/5bb5024a/2026/c1/Netherlands-Men-Stats-World-Cup',
    roster: [],
    standing: { rank: 3, squad: 'nl Netherlands', mp: 1, wins: 0, draws: 1, losses: 0, gf: 2, ga: 2, gd: '0', pts: 1, last5: 'W D L W D' },
    shooting: { goals: 2, shots: 10, shotsOnTarget: 6, shotAccuracy: 60.0, shotsPer90: 10.0, shotsOnTargetPer90: 6.0 },
    activeShooters: ['Cody Gakpo (2 تسديدات)', 'Donyell Malen (2 تسديدات)', 'Teun Koopmeiners (2 تسديدات)', 'Jan Paul van Hecke (1 تسديدة)', 'Virgil van Dijk (1 تسديدة)', 'Micky van de Ven (1 تسديدة)', 'Crysencio Summerville (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Bart Verbruggen', mp: 1, starts: 1, minutes: 90, goalsAgainst: 2, ga90: 2.0, shotsOnTargetAgainst: 3, saves: 1, savePercentage: 33.3, cleanSheets: 0, cleanSheetPercentage: 0.0 },
    misc: { yellowCards: 3, redCards: 0, secondYellows: 0, fouls: 7, fouled: 6, offsides: 1, crosses: 21, interceptions: 7, tacklesWon: 5, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['4-1-4-1'], averagePossession: 60.0 },
    rosterSummary: { count: 26, averageAge: 27.5, topClubs: ['Liverpool (3)', 'Brighton (3)', 'Manchester City (2)', 'Sunderland (2)', 'Inter (1)'] },
    standard: {
      usedPlayers: 16,
      scorers: ['Virgil van Dijk', 'Crysencio Summerville'],
      assisters: ['Ryan Gravenberch (2)'],
      minutesLeaders: ['Denzel Dumfries (90)', 'Jan Paul van Hecke (90)', 'Frenkie de Jong (90)', 'Virgil van Dijk (90)', 'Micky van de Ven (90)', 'Bart Verbruggen (90)'],
    },
    worldCupMatches: [
      { date: '2026-06-14', time: '15:00 (23:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'D', gf: '2', ga: '2', opponent: 'jp Japan', possession: 60, attendance: 69285, captain: 'Virgil van Dijk', formation: '4-1-4-1', opponentFormation: '3-4-3', referee: 'Ismail Elfath', notes: '' },
      { date: '2026-06-20', time: '12:00 (20:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'se Sweden', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-25', time: '18:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'tn Tunisia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
  {
    team: 'Tunisia',
    teamCode: 'TUN',
    teamCodes: ['TUN', 'TN', 'TUNISIA'],
    sourceUrl: 'https://fbref.com/en/squads/a7c7562a/2026/c1/Tunisia-Men-Stats-World-Cup',
    roster: [],
    standing: { rank: 4, squad: 'tn Tunisia', mp: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 5, gd: '-4', pts: 0, last5: 'W D L L L' },
    shooting: { goals: 1, shots: 6, shotsOnTarget: 2, shotAccuracy: 33.3, shotsPer90: 6.0, shotsOnTargetPer90: 2.0 },
    activeShooters: ['Hannibal Mejbri (1 تسديدة)', 'Omar Rekik (1 تسديدة)', 'Montassar Talbi (1 تسديدة)', 'Rani Khedira (1 تسديدة)', 'Elias Saad (1 تسديدة)', 'Elias Achouri (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Mouhib Chamakh', mp: 1, starts: 1, minutes: 90, goalsAgainst: 5, ga90: 5.0, shotsOnTargetAgainst: 6, saves: 1, savePercentage: 16.7, cleanSheets: 0, cleanSheetPercentage: 0.0 },
    misc: { yellowCards: 1, redCards: 0, secondYellows: 0, fouls: 8, fouled: 8, offsides: 6, crosses: 13, interceptions: 5, tacklesWon: 11, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['5-3-2'], averagePossession: 51.0 },
    rosterSummary: { count: 26, averageAge: 27.6, topClubs: ['Kasımpaşa (2)', 'Club Africain (2)', 'Nice (1)', 'Paris Saint-Germain (1)', 'Burnley (1)'] },
    standard: {
      usedPlayers: 16,
      scorers: ['Omar Rekik'],
      assisters: ['Hannibal Mejbri'],
      minutesLeaders: ['Ali Abdi (90)', 'Mouhib Chamakh (90)', 'Mohamed Amine Ben Hamida (90)', 'Hannibal Mejbri (90)', 'Omar Rekik (90)', 'Montassar Talbi (90)'],
    },
    worldCupMatches: [
      { date: '2026-06-14', time: '20:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'L', gf: '1', ga: '5', opponent: 'se Sweden', possession: 51, attendance: 50987, captain: 'Ellyes Skhiri', formation: '5-3-2', opponentFormation: '3-4-1-2', referee: 'Yael Falcón', notes: '' },
      { date: '2026-06-20', time: '22:00 (07:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'jp Japan', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
      { date: '2026-06-25', time: '18:00 (02:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'nl Netherlands', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' },
    ],
  },
];

export function findGroupFFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupFFbrefStats.find((stats) => (
    stats.teamCode.toLowerCase() === normalized ||
    stats.team.toLowerCase() === normalized ||
    stats.teamCodes.some((code) => code.toLowerCase() === normalized)
  )) || null;
}

export function toTeamFBRefStats(stats: GroupFFbrefTeamStats) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: stats.standing,
    shooting: stats.shooting,
    goalkeeping: stats.goalkeeping,
    misc: stats.misc,
    matchContext: stats.matchContext,
    roster: stats.rosterSummary,
    standard: stats.standard,
  };
}

export async function seedGroupFFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupFFbrefStats) {
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
      model: 'fbref-copy-source-group-f-v1',
      source: 'FBref copied source text',
      exportedAt: '2026-06-15T00:00:00.000Z',
      teamCode: stats.teamCode,
      group: 'F',
      standing: stats.standing,
      shooting: stats.shooting,
      goalkeeping: stats.goalkeeping,
      misc: stats.misc,
      matchContext: stats.matchContext,
      rosterSummary: stats.rosterSummary,
      standard: stats.standard,
      worldCupMatches: stats.worldCupMatches,
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
        tacticalTags: ['FBref', 'World Cup 2026', 'Group F', 'copied-source'],
        strengths: buildStrengths(stats),
        weaknesses: buildWeaknesses(stats),
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupFFbrefStats.length };
}
