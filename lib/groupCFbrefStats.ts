import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';
import type { GroupAFbrefTeamStats } from './groupAFbrefStats';

type GroupCFbrefTeamStats = GroupAFbrefTeamStats;
const arabicTeamNames: Record<string, string> = {"SCO":"اسكتلندا","MAR":"المغرب","BRA":"البرازيل","HAI":"هايتي"};

function displayTeam(stats: GroupCFbrefTeamStats) {
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
function completedWorldCupMatch(stats: GroupCFbrefTeamStats) {
  return stats.worldCupMatches.find((match) => match.result);
}
function upcomingMatches(stats: GroupCFbrefTeamStats) {
  return stats.worldCupMatches.filter((match) => !match.result).map((match) => `${match.date} ضد ${opponentName(match.opponent)}`).join('؛ ');
}
function buildStrengths(stats: GroupCFbrefTeamStats) {
  const strengths: string[] = [];
  if (stats.standing.pts > 0) strengths.push(`${n(stats.standing.pts)} نقاط بعد ${n(stats.standing.mp)} مباراة في المجموعة`);
  if (stats.shooting.goals > 0) strengths.push(`${n(stats.shooting.goals)} هدف من ${n(stats.shooting.shots)} تسديدة`);
  if (stats.shooting.shotsOnTarget > 0) strengths.push(`${n(stats.shooting.shotsOnTarget)} تسديدات على المرمى`);
  if (stats.goalkeeping.cleanSheets > 0) strengths.push(`شباك نظيفة مع ${stats.goalkeeping.goalkeeper}`);
  if (stats.goalkeeping.saves > 0) strengths.push(`${stats.goalkeeping.goalkeeper} قام بـ${n(stats.goalkeeping.saves)} تصديات`);
  if (stats.matchContext.averagePossession && stats.matchContext.averagePossession >= 55) strengths.push(`استحواذ مرتفع: ${pct(stats.matchContext.averagePossession)}`);
  return strengths.slice(0, 4);
}
function buildWeaknesses(stats: GroupCFbrefTeamStats) {
  const weaknesses: string[] = [];
  if (stats.standing.ga > 0) weaknesses.push(`استقبل ${n(stats.standing.ga)} هدف في عينة المجموعة الحالية`);
  if (stats.shooting.goals === 0) weaknesses.push('لم يسجل في مباراة كأس العالم المتاحة داخل FBref');
  if (stats.shooting.shots <= 8) weaknesses.push(`حجم تسديد محدود: ${n(stats.shooting.shots)} تسديدات فقط`);
  if (stats.matchContext.averagePossession !== null && stats.matchContext.averagePossession < 45) weaknesses.push(`استحواذ منخفض: ${pct(stats.matchContext.averagePossession)}`);
  if (!weaknesses.length) weaknesses.push('العينة الحالية مباراة واحدة فقط، لذلك لا تصلح لاستخلاص حكم نهائي');
  return weaknesses.slice(0, 4);
}
function buildReportBody(stats: GroupCFbrefTeamStats) {
  const teamName = displayTeam(stats);
  const match = completedWorldCupMatch(stats);
  const matchText = match ? `${match.date}: ${teamName} ${match.gf}-${match.ga} ${opponentName(match.opponent)}، النتيجة ${match.result}، الاستحواذ ${match.possession !== null ? pct(match.possession) : 'غير متوفر في المصادر'}، القائد ${match.captain || 'غير متوفر في المصادر'}، الشكل ${match.formation || 'غير متوفر في المصادر'}.` : 'لا توجد مباراة مكتملة في عينة World Cup داخل مصدر FBref.';
  return `بطاقة المنتخب: ${teamName} — المجموعة C — مصدر البيانات FBref copied source text. الملف يحتوي على Roster، Standard Stats، Scores & Fixtures، Goalkeeping، Shooting، Miscellaneous Stats، وترتيب Group C. العينة الحالية: ${n(stats.standing.mp)} مباراة.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}. أسماء اللاعبين التفصيلية محفوظة في ملف المصدر المرفوع، وهذه اللقطة تعرض الملخص الإحصائي المنظم داخل قاعدة البيانات.

وضع المنتخب في المجموعة: المركز ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}.

تحليل الأداء بالأرقام: ${matchText} المباريات القادمة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}. شارك ${n(stats.standard.usedPlayers)} لاعبًا في المباراة المتاحة.

القوة الهجومية: سجل المنتخب ${n(stats.shooting.goals)} هدف، وسدد ${n(stats.shooting.shots)} مرة، منها ${n(stats.shooting.shotsOnTarget)} على المرمى، بدقة تسديد ${pct(stats.shooting.shotAccuracy)}. الهدافون: ${stats.standard.scorers.join('، ') || 'لا يوجد'}. صانعو الأهداف: ${stats.standard.assisters.join('، ') || 'لا يوجد'}. أكثر اللاعبين دقائق: ${stats.standard.minutesLeaders.join('، ') || 'غير متوفر في المصادر'}. أكثر المسددين: ${stats.activeShooters.slice(0, 6).join('، ') || 'غير متوفر في المصادر'}.

القوة الدفاعية: استقبل المنتخب ${n(stats.goalkeeping.goalsAgainst)} هدف في حراسة ${stats.goalkeeping.goalkeeper || 'غير متوفر في المصادر'}، مع ${n(stats.goalkeeping.saves)} تصديات من ${n(stats.goalkeeping.shotsOnTargetAgainst)} تسديدات على المرمى ضده، ونسبة تصدي ${pct(stats.goalkeeping.savePercentage)}. الشباك النظيفة: ${n(stats.goalkeeping.cleanSheets)}.

وسط الملعب والتحكم: الاستحواذ المتوسط في مباريات كأس العالم المكتملة داخل المصدر ${stats.matchContext.averagePossession !== null ? pct(stats.matchContext.averagePossession) : 'غير متوفر في المصادر'}. التشكيلات المستخدمة: ${stats.matchContext.formations.join('، ') || 'غير متوفر في المصادر'}. لا يتم اختراع دقة تمرير أو xG لأنها غير موجودة في النص المنسوخ.

الانضباط والأدوار بدون كرة: البطاقات الصفراء ${n(stats.misc.yellowCards)}، البطاقات الحمراء ${n(stats.misc.redCards)}، الأخطاء المرتكبة ${n(stats.misc.fouls)}، الأخطاء المكتسبة ${n(stats.misc.fouled)}، الاعتراضات ${n(stats.misc.interceptions)}، التدخلات الناجحة ${n(stats.misc.tacklesWon)}، العرضيات ${n(stats.misc.crosses)}.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}
function buildSummary(stats: GroupCFbrefTeamStats) {
  const teamName = displayTeam(stats);
  return `${teamName} لديه لقطة FBref مقروءة بعد أول مباراة في المجموعة C: ${n(stats.standing.pts)} نقاط، ${n(stats.standing.gf)} له، ${n(stats.standing.ga)} عليه، ${n(stats.shooting.shots)} تسديدة، و${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة.`;
}

export const groupCFbrefStats = [{"team":"Scotland","teamCode":"SCO","teamCodes":["SCO","SCT","SCOTLAND"],"sourceUrl":"https://fbref.com/en/squads/602d3994/2026/c1/Scotland-Men-Stats-World-Cup","standing":{"rank":1,"squad":"sct Scotland","mp":1,"wins":1,"draws":0,"losses":0,"gf":1,"ga":0,"gd":"+1","pts":3,"last5":"L\n L\n W\n W\n W"},"shooting":{"goals":1,"shots":9,"shotsOnTarget":2,"shotAccuracy":22.2,"shotsPer90":9,"shotsOnTargetPer90":2},"activeShooters":["Scott McTominay (2 تسديدات)","Lawrence Shankland (2 تسديدات)","John McGinn (2 تسديدات)","Ben Gannon-Doak (2 تسديدات)","Ché Adams (1 تسديدات)"],"goalkeeping":{"goalkeeper":"Angus Gunn","mp":1,"starts":1,"minutes":90,"goalsAgainst":0,"ga90":0,"shotsOnTargetAgainst":2,"saves":2,"savePercentage":100,"cleanSheets":1,"cleanSheetPercentage":0},"misc":{"yellowCards":3,"redCards":0,"secondYellows":0,"fouls":21,"fouled":22,"offsides":1,"crosses":14,"interceptions":6,"tacklesWon":6,"ownGoals":0},"matchContext":{"completedCount":1,"upcomingCount":2,"formations":["4-2-2-2"],"averagePossession":46.0},"rosterSummary":{"count":27,"averageAge":28.6,"topClubs":["Bournemouth (2)","Napoli (2)","Hearts (2)","Rangers (2)","Celtic (2)"]},"standard":{"usedPlayers":16,"scorers":["John McGinn (1)"],"assisters":[],"minutesLeaders":["Scott McTominay (90 دقيقة)","Lewis Ferguson (90 دقيقة)","Jack Hendry (90 دقيقة)","Grant Hanley (90 دقيقة)","Angus Gunn (90 دقيقة)"]},"worldCupMatches":[{"date":"2026-06-13","time":"21:00 (04:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"W","gf":"1","ga":"0","opponent":"ht Haiti","possession":46,"attendance":64146,"captain":"Andy Robertson","formation":"4-2-2-2","opponentFormation":"4-2-2-2","referee":"Mustapha Ghorbal","notes":""},{"date":"2026-06-19","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"ma Morocco","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""},{"date":"2026-06-24","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"br Brazil","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""}],"roster":[]},{"team":"Morocco","teamCode":"MAR","teamCodes":["MAR","MA","MOROCCO"],"sourceUrl":"https://fbref.com/en/squads/af41ccda/2026/c1/Morocco-Men-Stats-World-Cup","standing":{"rank":2,"squad":"ma Morocco","mp":1,"wins":0,"draws":1,"losses":0,"gf":1,"ga":1,"gd":"0","pts":1,"last5":"D\n W\n W\n D\n D"},"shooting":{"goals":1,"shots":14,"shotsOnTarget":3,"shotAccuracy":21.4,"shotsPer90":14,"shotsOnTargetPer90":3},"activeShooters":["Neil El Aynaoui (3 تسديدات)","Ismael Saibari (3 تسديدات)","Brahim Díaz (3 تسديدات)","Achraf Hakimi (3 تسديدات)","Bilal El Khannouss (1 تسديدات)","Ayoube Amaimouni (1 تسديدات)"],"goalkeeping":{"goalkeeper":"Yassine Bounou","mp":1,"starts":1,"minutes":90,"goalsAgainst":1,"ga90":1,"shotsOnTargetAgainst":5,"saves":4,"savePercentage":80,"cleanSheets":0,"cleanSheetPercentage":1},"misc":{"yellowCards":0,"redCards":0,"secondYellows":0,"fouls":14,"fouled":16,"offsides":1,"crosses":15,"interceptions":4,"tacklesWon":18,"ownGoals":0},"matchContext":{"completedCount":1,"upcomingCount":2,"formations":["4-2-3-1"],"averagePossession":49.0},"rosterSummary":{"count":26,"averageAge":25.9,"topClubs":["Real Betis (2)","Strasbourg (2)","PSV (2)","Marseille (1)","Eintracht Frankfurt (1)"]},"standard":{"usedPlayers":16,"scorers":["Ismael Saibari (1)"],"assisters":["Brahim Díaz (1)"],"minutesLeaders":["Yassine Bounou (90 دقيقة)","Neil El Aynaoui (90 دقيقة)","Issa Diop (90 دقيقة)","Chadi Riad (90 دقيقة)","Ayyoub Bouaddi (90 دقيقة)"]},"worldCupMatches":[{"date":"2026-06-13","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"D","gf":"1","ga":"1","opponent":"br Brazil","possession":49,"attendance":80663,"captain":"Achraf Hakimi","formation":"4-2-3-1","opponentFormation":"4-2-2-2","referee":"Slavko Vinčič","notes":""},{"date":"2026-06-19","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"sct Scotland","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""},{"date":"2026-06-24","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"ht Haiti","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""}],"roster":[]},{"team":"Brazil","teamCode":"BRA","teamCodes":["BRA","BR","BRAZIL"],"sourceUrl":"https://fbref.com/en/squads/304635c3/2026/c1/Brazil-Men-Stats-World-Cup","standing":{"rank":3,"squad":"br Brazil","mp":1,"wins":0,"draws":1,"losses":0,"gf":1,"ga":1,"gd":"0","pts":1,"last5":"L\n W\n W\n W\n D"},"shooting":{"goals":1,"shots":12,"shotsOnTarget":5,"shotAccuracy":41.7,"shotsPer90":12,"shotsOnTargetPer90":5},"activeShooters":["Raphinha (2 تسديدات)","Marquinhos (2 تسديدات)","Lucas Paquetá (2 تسديدات)","Igor Thiago (2 تسديدات)","Danilo Santos (2 تسديدات)","Vinicius Júnior (1 تسديدات)","Bruno Guimarães (1 تسديدات)"],"goalkeeping":{"goalkeeper":"Alisson","mp":1,"starts":1,"minutes":90,"goalsAgainst":1,"ga90":1,"shotsOnTargetAgainst":3,"saves":2,"savePercentage":66.7,"cleanSheets":0,"cleanSheetPercentage":1},"misc":{"yellowCards":2,"redCards":0,"secondYellows":0,"fouls":16,"fouled":14,"offsides":0,"crosses":16,"interceptions":5,"tacklesWon":12,"ownGoals":0},"matchContext":{"completedCount":1,"upcomingCount":2,"formations":["4-2-2-2"],"averagePossession":51.0},"rosterSummary":{"count":27,"averageAge":28.6,"topClubs":["Flamengo (4)","Manchester Utd (2)","Zenit (2)","Arsenal (2)","Liverpool (1)"]},"standard":{"usedPlayers":16,"scorers":["Vinicius Júnior (1)"],"assisters":["Bruno Guimarães (1)"],"minutesLeaders":["Vinicius Júnior (90 دقيقة)","Raphinha (90 دقيقة)","Marquinhos (90 دقيقة)","Gabriel Magalhães (90 دقيقة)","Douglas Santos (90 دقيقة)"]},"worldCupMatches":[{"date":"2026-06-13","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"D","gf":"1","ga":"1","opponent":"ma Morocco","possession":51,"attendance":80663,"captain":"Marquinhos","formation":"4-2-2-2","opponentFormation":"4-2-3-1","referee":"Slavko Vinčič","notes":""},{"date":"2026-06-19","time":"20:30 (03:30)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"ht Haiti","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""},{"date":"2026-06-24","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"sct Scotland","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""}],"roster":[]},{"team":"Haiti","teamCode":"HAI","teamCodes":["HAI","HT","HAITI"],"sourceUrl":"https://fbref.com/en/squads/61828292/2026/c1/Haiti-Men-Stats-World-Cup","standing":{"rank":4,"squad":"ht Haiti","mp":1,"wins":0,"draws":0,"losses":1,"gf":0,"ga":1,"gd":"-1","pts":0,"last5":"L\n D\n W\n L\n L"},"shooting":{"goals":0,"shots":15,"shotsOnTarget":2,"shotAccuracy":13.3,"shotsPer90":15,"shotsOnTargetPer90":2},"activeShooters":["Ruben Providence (3 تسديدات)","Jean-Ricner Bellegarde (3 تسديدات)","Frantzdy Pierrot (3 تسديدات)","Wilson Isidor (2 تسديدات)","Ricardo Adé (1 تسديدات)","Martin Expérience (1 تسديدات)","Louicius Deedson (1 تسديدات)","Josué Casimir (1 تسديدات)"],"goalkeeping":{"goalkeeper":"Johny Placide","mp":1,"starts":1,"minutes":90,"goalsAgainst":1,"ga90":1,"shotsOnTargetAgainst":2,"saves":1,"savePercentage":50,"cleanSheets":0,"cleanSheetPercentage":0},"misc":{"yellowCards":1,"redCards":0,"secondYellows":0,"fouls":23,"fouled":21,"offsides":3,"crosses":23,"interceptions":6,"tacklesWon":7,"ownGoals":0},"matchContext":{"completedCount":1,"upcomingCount":2,"formations":["4-2-2-2"],"averagePossession":54.0},"rosterSummary":{"count":26,"averageAge":27.1,"topClubs":["Vizela (2)","LDU Quito (1)","Angers (1)","Wolves (1)","Auxerre (1)"]},"standard":{"usedPlayers":14,"scorers":[],"assisters":[],"minutesLeaders":["Ricardo Adé (90 دقيقة)","Martin Expérience (90 دقيقة)","Johny Placide (90 دقيقة)","Jean-Ricner Bellegarde (90 دقيقة)","Hannes Delcroix (90 دقيقة)"]},"worldCupMatches":[{"date":"2026-06-13","time":"21:00 (04:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"L","gf":"0","ga":"1","opponent":"sct Scotland","possession":54,"attendance":64146,"captain":"Johny Placide","formation":"4-2-2-2","opponentFormation":"4-2-2-2","referee":"Mustapha Ghorbal","notes":""},{"date":"2026-06-19","time":"20:30 (03:30)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"br Brazil","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""},{"date":"2026-06-24","time":"18:00 (01:00)","competition":"World Cup","round":"Group stage","venue":"Neutral","result":"","gf":"","ga":"","opponent":"ma Morocco","possession":null,"attendance":null,"captain":"","formation":"","opponentFormation":"","referee":"","notes":""}],"roster":[]}] satisfies GroupCFbrefTeamStats[];

export function findGroupCFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;
  return groupCFbrefStats.find((stats) => stats.teamCode.toLowerCase() === normalized || stats.team.toLowerCase() === normalized || stats.teamCodes.some((code) => code.toLowerCase() === normalized)) || null;
}

export function toTeamFBRefStats(stats: GroupCFbrefTeamStats) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: { group: 'C', rank: String(stats.standing.rank), mp: stats.standing.mp, wins: stats.standing.wins, draws: stats.standing.draws, losses: stats.standing.losses, gf: stats.standing.gf, ga: stats.standing.ga, gd: stats.standing.gd, pts: stats.standing.pts },
    shooting: { shots: stats.shooting.shots, shotsOnTarget: stats.shooting.shotsOnTarget, goals: stats.shooting.goals, shotAccuracy: stats.shooting.shotAccuracy, activeShooters: stats.activeShooters },
    goalkeeping: { goalkeeper: stats.goalkeeping.goalkeeper, saves: stats.goalkeeping.saves, shotsOnTargetAgainst: stats.goalkeeping.shotsOnTargetAgainst, goalsAgainst: stats.goalkeeping.goalsAgainst, savePercentage: String(stats.goalkeeping.savePercentage) },
    misc: { yellowCards: stats.misc.yellowCards, redCards: stats.misc.redCards, fouls: stats.misc.fouls, fouled: stats.misc.fouled, interceptions: stats.misc.interceptions, tacklesWon: stats.misc.tacklesWon, crosses: stats.misc.crosses },
    matchContext: stats.matchContext,
    roster: stats.rosterSummary,
    standard: stats.standard,
  };
}

export async function seedGroupCFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];
  const teams = await prisma.asset.findMany({ where: { type: 'TEAM' }, select: { id: true, name: true, code: true } });
  for (const stats of groupCFbrefStats) {
    const team = teams.find((candidate) => stats.teamCodes.some((code) => String(candidate.code || '').toLowerCase() === code.toLowerCase()) || String(candidate.name || '').toLowerCase() === stats.team.toLowerCase());
    if (!team) { skipped++; missingTeams.push(stats.teamCodes.join('/')); continue; }
    const title = `FBref Snapshot — ${displayTeam(stats)} — World Cup 2026`;
    const normalized = normalizeTeamReportBody({ teamName: team.name, title, summary: buildSummary(stats), body: buildReportBody(stats), sourceName: 'FBref copied source text — 2026 World Cup', sourceUrl: stats.sourceUrl });
    const metrics: Prisma.InputJsonValue = { model: 'fbref-copy-source-group-c-v1', source: 'FBref copied source text', exportedAt: '2026-06-15T00:00:00.000Z', teamCode: stats.teamCode, standing: stats.standing, shooting: stats.shooting, goalkeeping: stats.goalkeeping, misc: stats.misc, matchContext: stats.matchContext, rosterSummary: stats.rosterSummary, standard: stats.standard, activeShooters: stats.activeShooters, worldCupMatches: stats.worldCupMatches };
    const report = await prisma.teamIntelligenceReport.findFirst({ where: { teamId: team.id, title, provider: 'FBREF_STATHEAD_SNAPSHOT' }, select: { id: true } });
    if (report) { skipped++; continue; }
    await prisma.teamIntelligenceReport.create({ data: { teamId: team.id, title, summary: buildSummary(stats), body: normalized.body, reportType: 'TEAM_PROFILE', language: 'ar', sourceName: 'FBref copied source text — 2026 World Cup', sourceUrl: stats.sourceUrl, sourceCategory: 'stats', confidence: 'B', provider: 'FBREF_STATHEAD_SNAPSHOT', metrics, tacticalTags: ['FBref', 'World Cup 2026', 'Group C', 'copied-source', 'normalized-card-format'], strengths: buildStrengths(stats), weaknesses: buildWeaknesses(stats), lastCheckedAt: new Date(), publishedAt: new Date() } });
    created++;
  }
  return { created, skipped, missingTeams, total: groupCFbrefStats.length };
}
