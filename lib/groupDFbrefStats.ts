import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';
import type { GroupAFbrefTeamStats } from './groupAFbrefStats';

type GroupDFbrefTeamStats = GroupAFbrefTeamStats;

const arabicTeamNames: Record<string, string> = {
  USA: 'الولايات المتحدة',
  AUS: 'أستراليا',
  TUR: 'تركيا',
  PAR: 'باراغواي',
};

function displayTeam(stats: GroupDFbrefTeamStats) {
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
function completedWorldCupMatch(stats: GroupDFbrefTeamStats) {
  return stats.worldCupMatches.find((match) => match.result);
}
function upcomingMatches(stats: GroupDFbrefTeamStats) {
  return stats.worldCupMatches.filter((match) => !match.result).map((match) => `${match.date} ضد ${opponentName(match.opponent)}`).join('؛ ');
}
function buildStrengths(stats: GroupDFbrefTeamStats) {
  const strengths: string[] = [];
  if (stats.standing.pts > 0) strengths.push(`${n(stats.standing.pts)} نقاط بعد ${n(stats.standing.mp)} مباراة في المجموعة`);
  if (stats.shooting.goals > 0) strengths.push(`${n(stats.shooting.goals)} هدف من ${n(stats.shooting.shots)} تسديدة`);
  if (stats.shooting.shotsOnTarget > 0) strengths.push(`${n(stats.shooting.shotsOnTarget)} تسديدات على المرمى`);
  if (stats.goalkeeping.cleanSheets > 0) strengths.push(`شباك نظيفة مع ${stats.goalkeeping.goalkeeper}`);
  if (stats.goalkeeping.saves > 0) strengths.push(`${stats.goalkeeping.goalkeeper} قام بـ${n(stats.goalkeeping.saves)} تصديات`);
  if (stats.matchContext.averagePossession && stats.matchContext.averagePossession >= 55) strengths.push(`استحواذ مرتفع: ${pct(stats.matchContext.averagePossession)}`);
  return strengths.slice(0, 4);
}
function buildWeaknesses(stats: GroupDFbrefTeamStats) {
  const weaknesses: string[] = [];
  if (stats.standing.ga > 0) weaknesses.push(`استقبل ${n(stats.standing.ga)} هدف في عينة المجموعة الحالية`);
  if (stats.shooting.goals === 0) weaknesses.push('لم يسجل في مباراة كأس العالم المتاحة داخل FBref');
  if (stats.shooting.shots <= 8) weaknesses.push(`حجم تسديد محدود: ${n(stats.shooting.shots)} تسديدات فقط`);
  if (stats.matchContext.averagePossession !== null && stats.matchContext.averagePossession < 45) weaknesses.push(`استحواذ منخفض: ${pct(stats.matchContext.averagePossession)}`);
  if (!weaknesses.length) weaknesses.push('العينة الحالية مباراة واحدة فقط، لذلك لا تصلح لاستخلاص حكم نهائي');
  return weaknesses.slice(0, 4);
}
function buildReportBody(stats: GroupDFbrefTeamStats) {
  const teamName = displayTeam(stats);
  const match = completedWorldCupMatch(stats);
  const matchText = match ? `${match.date}: ${teamName} ${match.gf}-${match.ga} ${opponentName(match.opponent)}، النتيجة ${match.result}، الاستحواذ ${match.possession !== null ? pct(match.possession) : 'غير متوفر في المصادر'}، القائد ${match.captain || 'غير متوفر في المصادر'}، الشكل ${match.formation || 'غير متوفر في المصادر'}.` : 'لا توجد مباراة مكتملة في عينة World Cup داخل مصدر FBref.';
  return `بطاقة المنتخب: ${teamName} — المجموعة D — مصدر البيانات FBref copied source text. الملف يحتوي على Roster، Standard Stats، Scores & Fixtures، Goalkeeping، Shooting، Miscellaneous Stats، وترتيب Group D. العينة الحالية: ${n(stats.standing.mp)} مباراة.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}. أسماء اللاعبين التفصيلية محفوظة في ملف المصدر المرفوع، وهذه اللقطة تعرض الملخص الإحصائي المنظم داخل قاعدة البيانات.

وضع المنتخب في المجموعة: المركز ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}.

تحليل الأداء بالأرقام: ${matchText} المباريات القادمة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}. شارك ${n(stats.standard.usedPlayers)} لاعبًا في المباراة المتاحة.

القوة الهجومية: سجل المنتخب ${n(stats.shooting.goals)} هدف، وسدد ${n(stats.shooting.shots)} مرة، منها ${n(stats.shooting.shotsOnTarget)} على المرمى، بدقة تسديد ${pct(stats.shooting.shotAccuracy)}. الهدافون: ${stats.standard.scorers.join('، ') || 'لا يوجد'}. صانعو الأهداف: ${stats.standard.assisters.join('، ') || 'لا يوجد'}. أكثر اللاعبين دقائق: ${stats.standard.minutesLeaders.join('، ') || 'غير متوفر في المصادر'}. أكثر المسددين: ${stats.activeShooters.slice(0, 6).join('، ') || 'غير متوفر في المصادر'}.

القوة الدفاعية: استقبل المنتخب ${n(stats.goalkeeping.goalsAgainst)} هدف في حراسة ${stats.goalkeeping.goalkeeper || 'غير متوفر في المصادر'}، مع ${n(stats.goalkeeping.saves)} تصديات من ${n(stats.goalkeeping.shotsOnTargetAgainst)} تسديدات على المرمى ضده، ونسبة تصدي ${pct(stats.goalkeeping.savePercentage)}. الشباك النظيفة: ${n(stats.goalkeeping.cleanSheets)}.

وسط الملعب والتحكم: الاستحواذ المتوسط في مباريات كأس العالم المكتملة داخل المصدر ${stats.matchContext.averagePossession !== null ? pct(stats.matchContext.averagePossession) : 'غير متوفر في المصادر'}. التشكيلات المستخدمة: ${stats.matchContext.formations.join('، ') || 'غير متوفر في المصادر'}. لا يتم اختراع دقة تمرير أو xG لأنها غير موجودة في النص المنسوخ.

الانضباط والأدوار بدون كرة: البطاقات الصفراء ${n(stats.misc.yellowCards)}، البطاقات الحمراء ${n(stats.misc.redCards)}، الأخطاء المرتكبة ${n(stats.misc.fouls)}، الأخطاء المكتسبة ${n(stats.misc.fouled)}، الاعتراضات ${n(stats.misc.interceptions)}، التدخلات الناجحة ${n(stats.misc.tacklesWon)}، العرضيات ${n(stats.misc.crosses)}.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}
function buildSummary(stats: GroupDFbrefTeamStats) {
  const teamName = displayTeam(stats);
  return `${teamName} لديه لقطة FBref مقروءة بعد أول مباراة في المجموعة D: ${n(stats.standing.pts)} نقاط، ${n(stats.standing.gf)} له، ${n(stats.standing.ga)} عليه، ${n(stats.shooting.shots)} تسديدة، و${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة.`;
}

export const groupDFbrefStats = [
  {
    team: 'United States', teamCode: 'USA', teamCodes: ['USA', 'US', 'UNITED STATES', 'UNITED STATES OF AMERICA'],
    sourceUrl: 'https://fbref.com/en/squads/0f66725b/2026/c1/United-States-Men-Stats-World-Cup', roster: [],
    standing: { rank: 1, squad: 'us United States', mp: 1, wins: 1, draws: 0, losses: 0, gf: 4, ga: 1, gd: '+3', pts: 3, last5: 'L L W L W' },
    shooting: { goals: 3, shots: 16, shotsOnTarget: 6, shotAccuracy: 37.5, shotsPer90: 16, shotsOnTargetPer90: 6 },
    activeShooters: ['Malik Tillman (5 تسديدات)', 'Folarin Balogun (5 تسديدات)', 'Timothy Weah (2 تسديدات)', 'Sebastian Berhalter (1 تسديدة)', 'Ricardo Pepi (1 تسديدة)', 'Gio Reyna (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Matt Freese', mp: 1, starts: 1, minutes: 90, goalsAgainst: 1, ga90: 1, shotsOnTargetAgainst: 1, saves: 0, savePercentage: 0, cleanSheets: 1, cleanSheetPercentage: 0 },
    misc: { yellowCards: 1, redCards: 0, secondYellows: 0, fouls: 13, fouled: 16, offsides: 2, crosses: 17, interceptions: 11, tacklesWon: 6, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['4-2-3-1'], averagePossession: 65 },
    rosterSummary: { count: 26, averageAge: 26.4, topClubs: ['PSV (2)', 'Gladbach (2)', 'Leeds United (1)', 'Bournemouth (1)', 'Columbus Crew (1)'] },
    standard: { usedPlayers: 15, scorers: ['Folarin Balogun (2)', 'Gio Reyna (1)'], assisters: ['Alex Freeman (1)', 'Malik Tillman (1)', 'Christian Pulisic (1)'], minutesLeaders: ['Weston McKennie (90 دقيقة)', 'Tyler Adams (90 دقيقة)', 'Tim Ream (90 دقيقة)', 'Matt Freese (90 دقيقة)', 'Chris Richards (90 دقيقة)'] },
    worldCupMatches: [{ date: '2026-06-12', time: '18:00 (04:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'W', gf: '4', ga: '1', opponent: 'py Paraguay', possession: 65, attendance: 70492, captain: 'Tim Ream', formation: '4-2-3-1', opponentFormation: '4-2-2-2', referee: 'Danny Makkelie', notes: '' }, { date: '2026-06-19', time: '12:00 (22:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'au Australia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }, { date: '2026-06-25', time: '19:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'tr Türkiye', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }],
  },
  {
    team: 'Australia', teamCode: 'AUS', teamCodes: ['AUS', 'AU', 'AUSTRALIA'],
    sourceUrl: 'https://fbref.com/en/squads/b90bf4f9/2026/c1/Australia-Men-Stats-World-Cup', roster: [],
    standing: { rank: 2, squad: 'au Australia', mp: 1, wins: 1, draws: 0, losses: 0, gf: 2, ga: 0, gd: '+2', pts: 3, last5: 'L L L D W' },
    shooting: { goals: 2, shots: 9, shotsOnTarget: 4, shotAccuracy: 44.4, shotsPer90: 9, shotsOnTargetPer90: 4 },
    activeShooters: ['Nestory Irankunda (2 تسديدات)', 'Jordy Bos (2 تسديدات)', 'Mo Touré (1 تسديدة)', 'Jacob Italiano (1 تسديدة)', 'Harry Souttar (1 تسديدة)', 'Connor Metcalfe (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Patrick Beach', mp: 1, starts: 1, minutes: 90, goalsAgainst: 0, ga90: 0, shotsOnTargetAgainst: 8, saves: 8, savePercentage: 100, cleanSheets: 1, cleanSheetPercentage: 0 },
    misc: { yellowCards: 1, redCards: 0, secondYellows: 0, fouls: 12, fouled: 4, offsides: 5, crosses: 17, interceptions: 17, tacklesWon: 10, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['3-4-3'], averagePossession: 28 },
    rosterSummary: { count: 26, averageAge: 26.9, topClubs: ['Melb City (3)', 'St Pauli (2)', 'NYCFC (2)', 'Feyenoord (1)', 'Swansea City (1)'] },
    standard: { usedPlayers: 16, scorers: ['Connor Metcalfe (1)', 'Nestory Irankunda (1)'], assisters: ['Paul Okon-Engstler (1)'], minutesLeaders: ['Patrick Beach (90 دقيقة)', 'Harry Souttar (90 دقيقة)', 'Connor Metcalfe (90 دقيقة)', 'Cameron Burgess (90 دقيقة)', 'Alessandro Circati (90 دقيقة)'] },
    worldCupMatches: [{ date: '2026-06-13', time: '21:00 (07:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'W', gf: '2', ga: '0', opponent: 'tr Türkiye', possession: 28, attendance: 52497, captain: 'Harry Souttar', formation: '3-4-3', opponentFormation: '4-2-3-1', referee: 'Jesús Valenzuela', notes: '' }, { date: '2026-06-19', time: '12:00 (22:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'us United States', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }, { date: '2026-06-25', time: '19:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'py Paraguay', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }],
  },
  {
    team: 'Türkiye', teamCode: 'TUR', teamCodes: ['TUR', 'TR', 'TÜRKIYE', 'TURKIYE', 'TURKEY'],
    sourceUrl: 'https://fbref.com/en/squads/ac6bcf92/2026/c1/Turkiye-Men-Stats-World-Cup', roster: [],
    standing: { rank: 3, squad: 'tr Türkiye', mp: 1, wins: 0, draws: 0, losses: 1, gf: 0, ga: 2, gd: '-2', pts: 0, last5: 'W W W W L' },
    shooting: { goals: 0, shots: 30, shotsOnTarget: 8, shotAccuracy: 26.7, shotsPer90: 30, shotsOnTargetPer90: 8 },
    activeShooters: ['Arda Güler (8 تسديدات)', 'Kenan Yıldız (6 تسديدات)', 'Hakan Çalhanoğlu (5 تسديدات)', 'İsmail Yüksek (3 تسديدات)', 'Kerem Aktürkoğlu (3 تسديدات)', 'Zeki Çelik (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Uğurcan Çakır', mp: 1, starts: 1, minutes: 90, goalsAgainst: 2, ga90: 2, shotsOnTargetAgainst: 4, saves: 2, savePercentage: 50, cleanSheets: 0, cleanSheetPercentage: 0 },
    misc: { yellowCards: 1, redCards: 0, secondYellows: 0, fouls: 4, fouled: 12, offsides: 3, crosses: 26, interceptions: 4, tacklesWon: 7, ownGoals: 0 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['4-2-3-1'], averagePossession: 72 },
    rosterSummary: { count: 26, averageAge: 27.2, topClubs: ['Galatasaray (6)', 'Fenerbahçe (6)', 'Rizespor (1)', 'Manchester Utd (1)', 'Inter (1)'] },
    standard: { usedPlayers: 16, scorers: [], assisters: [], minutesLeaders: ['Uğurcan Çakır (90 دقيقة)', 'Merih Demiral (90 دقيقة)', 'Hakan Çalhanoğlu (90 دقيقة)', 'Ferdi Kadioglu (90 دقيقة)', 'Arda Güler (90 دقيقة)'] },
    worldCupMatches: [{ date: '2026-06-13', time: '21:00 (07:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'L', gf: '0', ga: '2', opponent: 'au Australia', possession: 72, attendance: 52497, captain: 'Hakan Çalhanoğlu', formation: '4-2-3-1', opponentFormation: '3-4-3', referee: 'Jesús Valenzuela', notes: '' }, { date: '2026-06-19', time: '20:00 (06:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'py Paraguay', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }, { date: '2026-06-25', time: '19:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'us United States', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }],
  },
  {
    team: 'Paraguay', teamCode: 'PAR', teamCodes: ['PAR', 'PY', 'PARAGUAY'],
    sourceUrl: 'https://fbref.com/en/squads/d2043442/2026/c1/Paraguay-Men-Stats-World-Cup', roster: [],
    standing: { rank: 4, squad: 'py Paraguay', mp: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 4, gd: '-3', pts: 0, last5: 'W W L W L' },
    shooting: { goals: 1, shots: 9, shotsOnTarget: 1, shotAccuracy: 11.1, shotsPer90: 9, shotsOnTargetPer90: 1 },
    activeShooters: ['Diego Gómez (4 تسديدات)', 'Miguel Almirón (2 تسديدات)', 'Julio Enciso (2 تسديدات)', 'Mauricio (1 تسديدة)'],
    goalkeeping: { goalkeeper: 'Orlando Gill', mp: 1, starts: 1, minutes: 90, goalsAgainst: 4, ga90: 4, shotsOnTargetAgainst: 7, saves: 3, savePercentage: 42.9, cleanSheets: 0, cleanSheetPercentage: 0 },
    misc: { yellowCards: 5, redCards: 0, secondYellows: 0, fouls: 17, fouled: 13, offsides: 1, crosses: 5, interceptions: 9, tacklesWon: 16, ownGoals: 1 },
    matchContext: { completedCount: 1, upcomingCount: 2, formations: ['4-2-2-2'], averagePossession: 35 },
    rosterSummary: { count: 26, averageAge: 28.6, topClubs: ['Palmeiras (3)', 'Atlanta Utd (2)', 'Cerro Porteño (2)', 'Sunderland (1)', 'Atlético Mineiro (1)'] },
    standard: { usedPlayers: 16, scorers: ['Mauricio (1)'], assisters: ['Julio Enciso (1)'], minutesLeaders: ['Orlando Gill (90 دقيقة)', 'Omar Alderete (90 دقيقة)', 'Júnior Alonso (90 دقيقة)', 'Julio Enciso (90 دقيقة)', 'Gustavo Gómez (90 دقيقة)'] },
    worldCupMatches: [{ date: '2026-06-12', time: '18:00 (04:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: 'L', gf: '1', ga: '4', opponent: 'us United States', possession: 35, attendance: 70492, captain: 'Gustavo Gómez', formation: '4-2-2-2', opponentFormation: '4-2-3-1', referee: 'Danny Makkelie', notes: '' }, { date: '2026-06-19', time: '20:00 (06:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'tr Türkiye', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }, { date: '2026-06-25', time: '19:00 (05:00)', competition: 'World Cup', round: 'Group stage', venue: 'Neutral', result: '', gf: '', ga: '', opponent: 'au Australia', possession: null, attendance: null, captain: '', formation: '', opponentFormation: '', referee: '', notes: '' }],
  },
] satisfies GroupDFbrefTeamStats[];

export function findGroupDFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;
  return groupDFbrefStats.find((stats) => stats.teamCode.toLowerCase() === normalized || stats.team.toLowerCase() === normalized || stats.teamCodes.some((code) => code.toLowerCase() === normalized)) || null;
}

export function toTeamFBRefStats(stats: GroupDFbrefTeamStats) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: { group: 'D', rank: String(stats.standing.rank), mp: stats.standing.mp, wins: stats.standing.wins, draws: stats.standing.draws, losses: stats.standing.losses, gf: stats.standing.gf, ga: stats.standing.ga, gd: stats.standing.gd, pts: stats.standing.pts },
    shooting: { shots: stats.shooting.shots, shotsOnTarget: stats.shooting.shotsOnTarget, goals: stats.shooting.goals, shotAccuracy: stats.shooting.shotAccuracy, activeShooters: stats.activeShooters },
    goalkeeping: { goalkeeper: stats.goalkeeping.goalkeeper, saves: stats.goalkeeping.saves, shotsOnTargetAgainst: stats.goalkeeping.shotsOnTargetAgainst, goalsAgainst: stats.goalkeeping.goalsAgainst, savePercentage: String(stats.goalkeeping.savePercentage) },
    misc: { yellowCards: stats.misc.yellowCards, redCards: stats.misc.redCards, fouls: stats.misc.fouls, fouled: stats.misc.fouled, interceptions: stats.misc.interceptions, tacklesWon: stats.misc.tacklesWon, crosses: stats.misc.crosses },
    matchContext: stats.matchContext,
    roster: stats.rosterSummary,
    standard: stats.standard,
  };
}

export async function seedGroupDFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: { id: true, name: true, code: true } });
  for (const stats of groupDFbrefStats) {
    const team = teams.find((candidate) => stats.teamCodes.some((code) => String(candidate.code || '').toLowerCase() === code.toLowerCase()) || String(candidate.name || '').toLowerCase() === stats.team.toLowerCase());
    if (!team) { skipped++; missingTeams.push(stats.teamCodes.join('/')); continue; }
    const title = `FBref Snapshot — ${displayTeam(stats)} — World Cup 2026`;
    const normalized = normalizeTeamReportBody({ teamName: team.name, title, summary: buildSummary(stats), body: buildReportBody(stats), sourceName: 'FBref copied source text — 2026 World Cup', sourceUrl: stats.sourceUrl });
    const metrics: Prisma.InputJsonValue = { model: 'fbref-copy-source-group-d-v1', source: 'FBref copied source text', exportedAt: '2026-06-15T00:00:00.000Z', teamCode: stats.teamCode, standing: stats.standing, shooting: stats.shooting, goalkeeping: stats.goalkeeping, misc: stats.misc, matchContext: stats.matchContext, rosterSummary: stats.rosterSummary, standard: stats.standard, activeShooters: stats.activeShooters, worldCupMatches: stats.worldCupMatches };
    const report = await prisma.teamIntelligenceReport.findFirst({ where: { teamId: team.id, title, provider: 'FBREF_STATHEAD_SNAPSHOT' }, select: { id: true } });
    if (report) { skipped++; continue; }
    await prisma.teamIntelligenceReport.create({ data: { teamId: team.id, title, summary: buildSummary(stats), body: normalized.body, reportType: 'TEAM_PROFILE', language: 'ar', sourceName: 'FBref copied source text — 2026 World Cup', sourceUrl: stats.sourceUrl, sourceCategory: 'stats', confidence: 'B', provider: 'FBREF_STATHEAD_SNAPSHOT', metrics, tacticalTags: ['FBref', 'World Cup 2026', 'Group D', 'copied-source', 'normalized-card-format'], strengths: buildStrengths(stats), weaknesses: buildWeaknesses(stats), lastCheckedAt: new Date(), publishedAt: new Date() } });
    created++;
  }
  return { created, skipped, missingTeams, total: groupDFbrefStats.length };
}
