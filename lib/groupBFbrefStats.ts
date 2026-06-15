import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';
import type { GroupAFbrefTeamStats, GroupAFbrefRosterPlayer } from './groupAFbrefStats';

export type GroupBFbrefRosterPlayer = GroupAFbrefRosterPlayer;
export type GroupBFbrefTeamStats = GroupAFbrefTeamStats;

const arabicTeamNames: Record<string, string> = {
  SUI: 'سويسرا',
  CAN: 'كندا',
  QAT: 'قطر',
  BIH: 'البوسنة والهرسك',
};

function displayTeam(stats: GroupBFbrefTeamStats) {
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

function nullableNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function opponentName(raw: string) {
  return raw.replace(/^[a-z]{2}\s+/i, '').trim();
}

function rosterLine(player: GroupBFbrefRosterPlayer) {
  const number = player.number ? `#${player.number}` : 'بدون رقم';
  const minutes = nullableNumber(player.minutes);
  const goals = nullableNumber(player.goals);
  const played = nullableNumber(player.mp);
  const participation = played && played > 0
    ? `${n(played)} مباراة، ${minutes !== null ? n(minutes) : 'غير متوفر في المصادر'} دقيقة، ${goals !== null ? n(goals) : '0'} هدف`
    : 'لم يشارك حتى تاريخ مصدر FBref';
  const clubCountry = player.clubCountry ? ` — ${player.clubCountry}` : '';
  return `${number} ${player.player} — ${player.pos || 'غير متوفر في المصادر'} — ${player.club || 'غير متوفر في المصادر'}${clubCountry} — ${participation}`;
}

function completedWorldCupMatch(stats: GroupBFbrefTeamStats) {
  return stats.worldCupMatches.find((match) => match.result);
}

function upcomingMatches(stats: GroupBFbrefTeamStats) {
  return stats.worldCupMatches
    .filter((match) => !match.result)
    .map((match) => `${match.date} ضد ${opponentName(match.opponent)}`)
    .join('؛ ');
}

function buildStrengths(stats: GroupBFbrefTeamStats) {
  const strengths: string[] = [];
  if (stats.standing.pts > 0) strengths.push(`${n(stats.standing.pts)} نقاط بعد ${n(stats.standing.mp)} مباراة في المجموعة`);
  if (stats.shooting.goals > 0) strengths.push(`${n(stats.shooting.goals)} هدف من ${n(stats.shooting.shots)} تسديدة في عينة كأس العالم الحالية`);
  if (stats.shooting.shotsOnTarget > 0) strengths.push(`${n(stats.shooting.shotsOnTarget)} تسديدات على المرمى`);
  if (stats.goalkeeping.saves > 0) strengths.push(`${stats.goalkeeping.goalkeeper} قام بـ${n(stats.goalkeeping.saves)} تصديات`);
  if (stats.matchContext.averagePossession && stats.matchContext.averagePossession >= 55) strengths.push(`استحواذ مرتفع في المباراة المتاحة: ${pct(stats.matchContext.averagePossession)}`);
  if (!strengths.length) strengths.push('وجود ملف FBref تفصيلي قابل للتحديث بعد كل مباراة');
  return strengths.slice(0, 4);
}

function buildWeaknesses(stats: GroupBFbrefTeamStats) {
  const weaknesses: string[] = [];
  if (stats.standing.ga > 0) weaknesses.push(`استقبل ${n(stats.standing.ga)} هدف في عينة المجموعة الحالية`);
  if (stats.shooting.goals === 0) weaknesses.push('لم يسجل في مباراة كأس العالم المتاحة داخل FBref');
  if (stats.shooting.shots <= 8) weaknesses.push(`حجم تسديد محدود: ${n(stats.shooting.shots)} تسديدات فقط`);
  if (stats.misc.redCards > 0) weaknesses.push(`انضباط يحتاج متابعة: ${n(stats.misc.redCards)} بطاقة حمراء`);
  if (stats.matchContext.averagePossession !== null && stats.matchContext.averagePossession < 45) weaknesses.push(`استحواذ منخفض في المباراة المتاحة: ${pct(stats.matchContext.averagePossession)}`);
  if (!weaknesses.length) weaknesses.push('العينة الحالية مباراة واحدة فقط، لذلك لا تصلح لاستخلاص حكم نهائي');
  return weaknesses.slice(0, 4);
}

function buildReportBody(stats: GroupBFbrefTeamStats) {
  const teamName = displayTeam(stats);
  const match = completedWorldCupMatch(stats);
  const matchText = match
    ? `${match.date}: ${teamName} ${match.gf}-${match.ga} ${opponentName(match.opponent)}، النتيجة ${match.result}، الاستحواذ ${match.possession !== null ? pct(match.possession) : 'غير متوفر في المصادر'}، القائد ${match.captain || 'غير متوفر في المصادر'}، الشكل ${match.formation || 'غير متوفر في المصادر'}.`
    : 'لا توجد مباراة مكتملة في عينة World Cup داخل مصدر FBref.';

  const rosterPreview = stats.roster.map(rosterLine).join('\n');

  return `بطاقة المنتخب: ${teamName} — المجموعة الثانية — مصدر البيانات FBref copied source text. الملف يحتوي على Roster، Standard Stats، Scores & Fixtures، Goalkeeping، Shooting، Playing Time، Miscellaneous Stats، وترتيب Group B. العينة الحالية في كأس العالم: ${n(stats.standing.mp)} مباراة.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. أكثر الأندية حضورًا في القائمة: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}.
${rosterPreview}

وضع المنتخب في المجموعة: المركز ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}.

تحليل الأداء بالأرقام: ${matchText} المباريات القادمة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}. شارك ${n(stats.standard.usedPlayers)} لاعبًا في المباراة/المباريات المتاحة.

القوة الهجومية: سجل المنتخب ${n(stats.shooting.goals)} هدف، وسدد ${n(stats.shooting.shots)} مرة، منها ${n(stats.shooting.shotsOnTarget)} على المرمى، بدقة تسديد ${pct(stats.shooting.shotAccuracy)}. الهدافون في العينة: ${stats.standard.scorers.join('، ') || 'لا يوجد'}. صانعو الأهداف: ${stats.standard.assisters.join('، ') || 'لا يوجد'}. أكثر اللاعبين دقائق: ${stats.standard.minutesLeaders.join('، ') || 'غير متوفر في المصادر'}.

القوة الدفاعية: استقبل المنتخب ${n(stats.goalkeeping.goalsAgainst)} هدف في حراسة ${stats.goalkeeping.goalkeeper || 'غير متوفر في المصادر'}، مع ${n(stats.goalkeeping.saves)} تصديات من ${n(stats.goalkeeping.shotsOnTargetAgainst)} تسديدات على المرمى ضده، ونسبة تصدي ${pct(stats.goalkeeping.savePercentage)}. الشباك النظيفة: ${n(stats.goalkeeping.cleanSheets)}.

وسط الملعب والتحكم: الاستحواذ المتوسط في مباريات كأس العالم المكتملة داخل المصدر ${stats.matchContext.averagePossession !== null ? pct(stats.matchContext.averagePossession) : 'غير متوفر في المصادر'}. التشكيلات المستخدمة في العينة: ${stats.matchContext.formations.join('، ') || 'غير متوفر في المصادر'}. لا يحتوي هذا النص المنسوخ على جداول تمرير متقدمة أو xG؛ لذلك لا يتم اختراع دقة تمرير أو فرص متوقعة.

الانضباط والأدوار بدون كرة: البطاقات الصفراء ${n(stats.misc.yellowCards)}، البطاقات الحمراء ${n(stats.misc.redCards)}، الأخطاء المرتكبة ${n(stats.misc.fouls)}، الأخطاء المكتسبة ${n(stats.misc.fouled)}، الاعتراضات ${n(stats.misc.interceptions)}، التدخلات الناجحة ${n(stats.misc.tacklesWon)}، العرضيات ${n(stats.misc.crosses)}.

سجل المصادر: هذه لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

function buildSummary(stats: GroupBFbrefTeamStats) {
  const teamName = displayTeam(stats);
  return `${teamName} لديه لقطة FBref مقروءة بعد أول مباراة في المجموعة الثانية: ${n(stats.standing.pts)} نقاط، ${n(stats.standing.gf)} له، ${n(stats.standing.ga)} عليه، ${n(stats.shooting.shots)} تسديدة، و${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة.`;
}

export const groupBFbrefStats = [
  {
    "team": "Switzerland",
    "teamCode": "SUI",
    "teamCodes": [
      "SUI",
      "CH",
      "SWITZERLAND"
    ],
    "sourceUrl": "https://fbref.com/en/squads/81021a70/2026/c1/Switzerland-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "20",
        "player": "Michel Aebischer",
        "pos": "MF",
        "club": "Pisa",
        "clubRaw": "1.it Pisa",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Genève, Switzerland",
        "birthDate": "1997-01-07",
        "age": "29-156",
        "ageYears": 29,
        "mp": 1,
        "minutes": 65,
        "goals": 0
      },
      {
        "number": "5",
        "player": "Manuel Akanji",
        "pos": "DF",
        "club": "Inter",
        "clubRaw": "1.it Inter",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Wiesendangen / Wiesendangen (Dorf), Switzerland",
        "birthDate": "1995-07-19",
        "age": "30-327",
        "ageYears": 30,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "23",
        "player": "Zeki Amdouni",
        "pos": "FW,MF",
        "club": "Burnley",
        "clubRaw": "1.eng Burnley",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Genève, Switzerland",
        "birthDate": "2000-12-04",
        "age": "25-189",
        "ageYears": 25,
        "mp": 1,
        "minutes": 12,
        "goals": 0
      },
      {
        "number": "24",
        "player": "Aurèle Amenda",
        "pos": "DF",
        "club": "Eintracht Frankfurt",
        "clubRaw": "1.de Eintracht Frankfurt",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Biel/Bienne, Switzerland",
        "birthDate": "2003-07-03",
        "age": "22-315",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "18",
        "player": "Eray Cömert",
        "pos": "DF",
        "club": "Valencia",
        "clubRaw": "1.es Valencia",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Basel, Switzerland",
        "birthDate": "1998-01-04",
        "age": "28-127",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "4",
        "player": "Nico Elvedi",
        "pos": "DF",
        "club": "Gladbach",
        "clubRaw": "1.de Gladbach",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Zürich, Switzerland",
        "birthDate": "1996-09-30",
        "age": "29-254",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Breel Embolo",
        "pos": "FW",
        "club": "Rennes",
        "clubRaw": "1.fr Rennes",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Yaoundé, Cameroon",
        "birthDate": "1997-02-15",
        "age": "29-117",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 1
      },
      {
        "number": "16",
        "player": "Christian Fassnacht",
        "pos": "FW,MF",
        "club": "Young Boys",
        "clubRaw": "1.ch Young Boys",
        "clubCountry": "Switzerland",
        "clubCountryCode": "ch",
        "birthPlace": "Zürich, Switzerland",
        "birthDate": "1993-11-12",
        "age": "32-212",
        "ageYears": 32,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "8",
        "player": "Remo Freuler",
        "pos": "MF",
        "club": "Bologna",
        "clubRaw": "1.it Bologna",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Ennenda, Switzerland",
        "birthDate": "1992-04-16",
        "age": "34-057",
        "ageYears": 34,
        "mp": 1,
        "minutes": 88,
        "goals": 0
      },
      {
        "number": "26",
        "player": "Cedric Itten",
        "pos": "FW,MF",
        "club": "Düsseldorf",
        "clubRaw": "2.de Düsseldorf",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Basel, Switzerland",
        "birthDate": "1996-12-28",
        "age": "29-166",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "25",
        "player": "Luca Jaquez",
        "pos": "DF",
        "club": "Stuttgart",
        "clubRaw": "1.de Stuttgart",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Luzern, Switzerland",
        "birthDate": "2003-05-05",
        "age": "23-009",
        "ageYears": 23,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "14",
        "player": "Ardon Jashari",
        "pos": "MF",
        "club": "Milan",
        "clubRaw": "1.it Milan",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Cham, Switzerland",
        "birthDate": "2002-07-02",
        "age": "23-316",
        "ageYears": 23,
        "mp": 1,
        "minutes": 2,
        "goals": 0
      },
      {
        "number": "21",
        "player": "Marvin Keller",
        "pos": "GK",
        "club": "Young Boys",
        "clubRaw": "1.ch Young Boys",
        "clubCountry": "Switzerland",
        "clubCountryCode": "ch",
        "birthPlace": "London, England, United Kingdom",
        "birthDate": "2002-06-05",
        "age": "23-343",
        "ageYears": 23,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "1",
        "player": "Gregor Kobel",
        "pos": "GK",
        "club": "Dortmund",
        "clubRaw": "1.de Dortmund",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Zürich, Switzerland",
        "birthDate": "1997-12-06",
        "age": "28-187",
        "ageYears": 28,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "9",
        "player": "Johan Manzambi",
        "pos": "MF",
        "club": "Freiburg",
        "clubRaw": "1.de Freiburg",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Switzerland",
        "birthDate": "2005-10-23",
        "age": "20-240",
        "ageYears": 20,
        "mp": 1,
        "minutes": 25,
        "goals": 0
      },
      {
        "number": "2",
        "player": "Miro Muheim",
        "pos": "DF,MF",
        "club": "Hamburger SV",
        "clubRaw": "1.de Hamburger SV",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Zürich, Switzerland",
        "birthDate": "1998-02-21",
        "age": "28-079",
        "ageYears": 28,
        "mp": 1,
        "minutes": 2,
        "goals": 0
      },
      {
        "number": "12",
        "player": "Yvon Mvogo",
        "pos": "GK",
        "club": "Lorient",
        "clubRaw": "1.fr Lorient",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Marly, Switzerland",
        "birthDate": "1994-06-06",
        "age": "32-005",
        "ageYears": 32,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "11",
        "player": "Dan Ndoye",
        "pos": "MF",
        "club": "Nottingham Forest",
        "clubRaw": "1.eng Nottingham Forest",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Nyon, Switzerland",
        "birthDate": "2000-11-19",
        "age": "25-204",
        "ageYears": 25,
        "mp": 1,
        "minutes": 65,
        "goals": 0
      },
      {
        "number": "19",
        "player": "Noah Okafor",
        "pos": "FW,MF",
        "club": "Leeds United",
        "clubRaw": "1.eng Leeds United",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Binningen, Switzerland",
        "birthDate": "2000-05-24",
        "age": "26-018",
        "ageYears": 26,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "10",
        "player": "Fabian Rieder",
        "pos": "FW,MF",
        "club": "Augsburg",
        "clubRaw": "1.de Augsburg",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Bern, Switzerland",
        "birthDate": "2002-02-16",
        "age": "24-115",
        "ageYears": 24,
        "mp": 1,
        "minutes": 25,
        "goals": 0
      },
      {
        "number": "13",
        "player": "Ricardo Rodríguez",
        "pos": "DF",
        "club": "Real Betis",
        "clubRaw": "1.es Real Betis",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Zürich, Switzerland",
        "birthDate": "1992-08-25",
        "age": "33-290",
        "ageYears": 33,
        "mp": 1,
        "minutes": 88,
        "goals": 0
      },
      {
        "number": "6",
        "player": "Djibril Sow",
        "pos": "MF",
        "club": "Sevilla",
        "clubRaw": "1.es Sevilla",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Zürich, Switzerland",
        "birthDate": "1997-02-06",
        "age": "29-126",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "15",
        "player": "Ruben Vargas",
        "pos": "MF",
        "club": "Sevilla",
        "clubRaw": "1.es Sevilla",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Adligenswil, Switzerland",
        "birthDate": "1998-08-05",
        "age": "27-310",
        "ageYears": 27,
        "mp": 1,
        "minutes": 78,
        "goals": 0
      },
      {
        "number": "3",
        "player": "Silvan Widmer",
        "pos": "DF,MF",
        "club": "Mainz 05",
        "clubRaw": "1.de Mainz 05",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Aarau, Switzerland",
        "birthDate": "1993-03-05",
        "age": "33-098",
        "ageYears": 33,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "17",
        "player": "Granit Xhaka",
        "pos": "MF",
        "club": "Sunderland",
        "clubRaw": "1.eng Sunderland",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Basel, Switzerland",
        "birthDate": "1992-09-27",
        "age": "33-257",
        "ageYears": 33,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "22",
        "player": "Denis Zakaria",
        "pos": "DF",
        "club": "Monaco",
        "clubRaw": "1.fr Monaco",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Genève, Switzerland",
        "birthDate": "1996-11-20",
        "age": "29-203",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      }
    ],
    "standing": {
      "rank": 1,
      "squad": "ch Switzerland",
      "mp": 1,
      "wins": 0,
      "draws": 1,
      "losses": 0,
      "gf": 1,
      "ga": 1,
      "gd": "0",
      "pts": 1,
      "last5": "L  D  W  D  D"
    },
    "shooting": {
      "goals": 1,
      "shots": 26,
      "shotsOnTarget": 7,
      "shotAccuracy": 26.9,
      "shotsPer90": 26,
      "shotsOnTargetPer90": 7
    },
    "activeShooters": [
      "Manuel Akanji (1 تسديدات)",
      "Nico Elvedi (2 تسديدات)",
      "Breel Embolo (4 تسديدات)",
      "Granit Xhaka (2 تسديدات)",
      "Denis Zakaria (2 تسديدات)",
      "Ruben Vargas (3 تسديدات)",
      "Michel Aebischer (1 تسديدات)",
      "Dan Ndoye (6 تسديدات)",
      "Johan Manzambi (2 تسديدات)",
      "Fabian Rieder (1 تسديدات)",
      "Zeki Amdouni (1 تسديدات)",
      "Ardon Jashari (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Gregor Kobel",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 1,
      "ga90": 1,
      "shotsOnTargetAgainst": 4,
      "saves": 3,
      "savePercentage": 75,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0
    },
    "misc": {
      "yellowCards": 1,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 11,
      "fouled": 12,
      "offsides": 1,
      "crosses": 35,
      "interceptions": 7,
      "tacklesWon": 6,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-2-3-1"
      ],
      "averagePossession": 68.0
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 27.8,
      "topClubs": [
        "Sevilla (2)",
        "Young Boys (2)",
        "Augsburg (1)",
        "Bologna (1)",
        "Burnley (1)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Breel Embolo (1)"
      ],
      "assisters": [],
      "minutesLeaders": [
        "Nico Elvedi (90 دقيقة)",
        "Manuel Akanji (90 دقيقة)",
        "Gregor Kobel (90 دقيقة)",
        "Granit Xhaka (90 دقيقة)",
        "Denis Zakaria (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-13",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "D",
        "gf": "1",
        "ga": "1",
        "opponent": "qa Qatar",
        "possession": 68,
        "attendance": 67966,
        "captain": "Granit Xhaka",
        "formation": "4-2-3-1",
        "opponentFormation": "4-1-4-1",
        "referee": "Said Martínez",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ba Bosnia-Herzegovina",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-24",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ca Canada",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      }
    ]
  },
  {
    "team": "Canada",
    "teamCode": "CAN",
    "teamCodes": [
      "CAN",
      "CA",
      "CANADA"
    ],
    "sourceUrl": "https://fbref.com/en/squads/9c6d90a0/2026/c1/Canada-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "20",
        "player": "Ali Ahmed",
        "pos": "MF",
        "club": "Norwich City",
        "clubRaw": "2.eng Norwich City",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Canada",
        "birthDate": "2000-09-10",
        "age": "25-244",
        "ageYears": 25,
        "mp": 1,
        "minutes": 30,
        "goals": 0
      },
      {
        "number": "15",
        "player": "Moïse Bombito",
        "pos": "DF",
        "club": "Nice",
        "clubRaw": "1.fr Nice",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Canada",
        "birthDate": "2000-03-01",
        "age": "26-073",
        "ageYears": 26,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "17",
        "player": "Tajon Buchanan",
        "pos": "MF",
        "club": "Villarreal",
        "clubRaw": "1.es Villarreal",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Brampton, ON, Canada",
        "birthDate": "1999-01-09",
        "age": "27-123",
        "ageYears": 27,
        "mp": 1,
        "minutes": 60,
        "goals": 0
      },
      {
        "number": "6",
        "player": "Mathieu Choinière",
        "pos": "MF",
        "club": "LAFC",
        "clubRaw": "1.us LAFC",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Canada",
        "birthDate": "1999-01-08",
        "age": "27-124",
        "ageYears": 27,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "13",
        "player": "Derek Cornelius",
        "pos": "DF",
        "club": "Marseille",
        "clubRaw": "1.fr Marseille",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Ajax, ON, Canada",
        "birthDate": "1997-11-30",
        "age": "28-198",
        "ageYears": 28,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "16",
        "player": "Maxime Crépeau",
        "pos": "GK",
        "club": "Orlando City",
        "clubRaw": "1.us Orlando City",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Greenfield Park, QC, Canada",
        "birthDate": "1994-05-11",
        "age": "32-031",
        "ageYears": 32,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "10",
        "player": "Jonathan David",
        "pos": "FW",
        "club": "Juventus",
        "clubRaw": "1.it Juventus",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Brooklyn, NY, United States",
        "birthDate": "2000-05-27",
        "age": "26-148",
        "ageYears": 26,
        "mp": 1,
        "minutes": 60,
        "goals": 0
      },
      {
        "number": "24",
        "player": "Promise David",
        "pos": "FW",
        "club": "Union SG",
        "clubRaw": "1.be Union SG",
        "clubCountry": "Belgium",
        "clubCountryCode": "be",
        "birthPlace": "Canada",
        "birthDate": "2001-06-03",
        "age": "24-343",
        "ageYears": 24,
        "mp": 1,
        "minutes": 30,
        "goals": 0
      },
      {
        "number": "19",
        "player": "Alphonso Davies",
        "pos": "DF,FW",
        "club": "Bayern Munich",
        "clubRaw": "1.de Bayern Munich",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Monrovia, Liberia",
        "birthDate": "2000-11-02",
        "age": "25-221",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "4",
        "player": "Luc De Fougerolles",
        "pos": "DF",
        "club": "Fulham",
        "clubRaw": "1.eng Fulham",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Canada",
        "birthDate": "2005-10-21",
        "age": "20-242",
        "ageYears": 20,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Stephen Eustáquio",
        "pos": "MF",
        "club": "Porto",
        "clubRaw": "1.pt Porto",
        "clubCountry": "Portugal",
        "clubCountryCode": "pt",
        "birthPlace": "Leamington, ON, Canada",
        "birthDate": "1996-12-22",
        "age": "29-172",
        "ageYears": 29,
        "mp": 1,
        "minutes": 89,
        "goals": 0
      },
      {
        "number": null,
        "player": "Marcelo Flores",
        "pos": "MF",
        "club": "UANL",
        "clubRaw": "1.mx UANL",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Estado de México, Mexico",
        "birthDate": "2003-10-03",
        "age": "22-253",
        "ageYears": 22,
        "mp": null,
        "minutes": null,
        "goals": null
      },
      {
        "number": "18",
        "player": "Owen Goodman",
        "pos": "GK",
        "club": "Barnsley",
        "clubRaw": "3.eng Barnsley",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "England, United Kingdom",
        "birthDate": "2003-11-29",
        "age": "22-196",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "2",
        "player": "Alistair Johnston",
        "pos": "DF",
        "club": "Celtic",
        "clubRaw": "1.sct Celtic",
        "clubCountry": "Scotland",
        "clubCountryCode": "sct",
        "birthPlace": "Vancouver, BC, Canada",
        "birthDate": "1998-10-08",
        "age": "27-246",
        "ageYears": 27,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "3",
        "player": "Alfie Jones",
        "pos": "DF,MF",
        "club": "Middlesbrough",
        "clubRaw": "2.eng Middlesbrough",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "England, United Kingdom",
        "birthDate": "1997-10-12",
        "age": "28-247",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "8",
        "player": "Ismaël Koné",
        "pos": "MF",
        "club": "Sassuolo",
        "clubRaw": "1.it Sassuolo",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Abidjan, Côte d'Ivoire",
        "birthDate": "2002-05-19",
        "age": "23-360",
        "ageYears": 23,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "9",
        "player": "Cyle Larin",
        "pos": "FW,MF",
        "club": "Mallorca",
        "clubRaw": "1.es Mallorca",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Brampton, ON, Canada",
        "birthDate": "1995-04-17",
        "age": "31-055",
        "ageYears": 31,
        "mp": 1,
        "minutes": 15,
        "goals": 1
      },
      {
        "number": "22",
        "player": "Richie Laryea",
        "pos": "DF",
        "club": "Toronto FC",
        "clubRaw": "1.us Toronto FC",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Toronto, ON, Canada",
        "birthDate": "1995-01-07",
        "age": "31-156",
        "ageYears": 31,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "21",
        "player": "Kamal Miller",
        "pos": "DF",
        "club": "Toronto FC",
        "clubRaw": "1.us Toronto FC",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Pickering, ON, Canada",
        "birthDate": "1997-05-16",
        "age": "29-026",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "11",
        "player": "Theo Corbeanu",
        "pos": "FW,MF",
        "club": "Villarreal",
        "clubRaw": "1.es Villarreal",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Hamilton, ON, Canada",
        "birthDate": "2002-05-17",
        "age": "24-026",
        "ageYears": 24,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "26",
        "player": "Mathias Laborda",
        "pos": "DF",
        "club": "Vancouver W'caps",
        "clubRaw": "1.us Vancouver W'caps",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Fray Bentos, Uruguay",
        "birthDate": "1999-09-15",
        "age": "26-269",
        "ageYears": 26,
        "mp": 1,
        "minutes": 1,
        "goals": 0
      },
      {
        "number": "14",
        "player": "Jacob Shaffelburg",
        "pos": "DF,FW",
        "club": "Nashville",
        "clubRaw": "1.us Nashville",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Port Williams, NS, Canada",
        "birthDate": "1999-11-26",
        "age": "26-197",
        "ageYears": 26,
        "mp": 1,
        "minutes": 60,
        "goals": 0
      },
      {
        "number": "25",
        "player": "Nathan Saliba",
        "pos": "DF,MF",
        "club": "Anderlecht",
        "clubRaw": "1.be Anderlecht",
        "clubCountry": "Belgium",
        "clubCountryCode": "be",
        "birthPlace": "Longueuil, QC, Canada",
        "birthDate": "2004-02-07",
        "age": "22-124",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "1",
        "player": "Dayne St. Clair",
        "pos": "GK",
        "club": "Minnesota Utd",
        "clubRaw": "1.us Minnesota Utd",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Pickering, ON, Canada",
        "birthDate": "1997-05-09",
        "age": "29-033",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "5",
        "player": "Joel Waterman",
        "pos": "DF",
        "club": "LAFC",
        "clubRaw": "1.us LAFC",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Aldergrove, BC, Canada",
        "birthDate": "1996-01-24",
        "age": "30-138",
        "ageYears": 30,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      }
    ],
    "standing": {
      "rank": 2,
      "squad": "ca Canada",
      "mp": 1,
      "wins": 0,
      "draws": 1,
      "losses": 0,
      "gf": 1,
      "ga": 1,
      "gd": "0",
      "pts": 1,
      "last5": "D  D  W  D  D"
    },
    "shooting": {
      "goals": 1,
      "shots": 13,
      "shotsOnTarget": 4,
      "shotAccuracy": 30.8,
      "shotsPer90": 13,
      "shotsOnTargetPer90": 4
    },
    "activeShooters": [
      "Derek Cornelius (1 تسديدات)",
      "Jonathan David (1 تسديدات)",
      "Promise David (2 تسديدات)",
      "Stephen Eustáquio (2 تسديدات)",
      "Cyle Larin (2 تسديدات)",
      "Richie Laryea (1 تسديدات)",
      "Jacob Shaffelburg (2 تسديدات)",
      "Joel Waterman (2 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Maxime Crépeau",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 1,
      "ga90": 1,
      "shotsOnTargetAgainst": 3,
      "saves": 2,
      "savePercentage": 66.7,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0
    },
    "misc": {
      "yellowCards": 3,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 9,
      "fouled": 17,
      "offsides": 3,
      "crosses": 24,
      "interceptions": 12,
      "tacklesWon": 7,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-2-2-2"
      ],
      "averagePossession": 61.0
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 26.4,
      "topClubs": [
        "LAFC (2)",
        "Toronto FC (2)",
        "Villarreal (2)",
        "Anderlecht (1)",
        "Barnsley (1)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Cyle Larin (1)"
      ],
      "assisters": [
        "Promise David (1)"
      ],
      "minutesLeaders": [
        "Richie Laryea (90 دقيقة)",
        "Maxime Crépeau (90 دقيقة)",
        "Luc De Fougerolles (90 دقيقة)",
        "Ismaël Koné (90 دقيقة)",
        "Derek Cornelius (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-12",
        "time": "15:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "D",
        "gf": "1",
        "ga": "1",
        "opponent": "ba Bosnia-Herzegovina",
        "possession": 61,
        "attendance": 43002,
        "captain": "Stephen Eustáquio",
        "formation": "4-2-2-2",
        "opponentFormation": "4-2-2-2",
        "referee": "Facundo Tello",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "15:00 (01:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "qa Qatar",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-24",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ch Switzerland",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      }
    ]
  },
  {
    "team": "Qatar",
    "teamCode": "QAT",
    "teamCodes": [
      "QAT",
      "QA",
      "QATAR"
    ],
    "sourceUrl": "https://fbref.com/en/squads/9b696ed1/2026/c1/Qatar-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "15",
        "player": "Yusuf Abdurisag",
        "pos": "FW",
        "club": "Al-Wakrah",
        "clubRaw": "1.qa Al-Wakrah",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Mogadishu, Somalia",
        "birthDate": "1999-08-02",
        "age": "26-309",
        "ageYears": 26,
        "mp": 1,
        "minutes": 59,
        "goals": 0
      },
      {
        "number": "1",
        "player": "Mahmoud Abunada",
        "pos": "GK",
        "club": "Al Rayyan SC",
        "clubRaw": "1.qa Al Rayyan SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "2000-02-01",
        "age": "26-126",
        "ageYears": 26,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "11",
        "player": "Akram Afif",
        "pos": "FW",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1996-11-18",
        "age": "29-205",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "14",
        "player": "Homam Ahmed",
        "pos": "DF",
        "club": "Cultural Leonesa",
        "clubRaw": "2.es Cultural Leonesa",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1999-08-21",
        "age": "26-290",
        "ageYears": 26,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Ahmed Alaaeldin",
        "pos": "FW",
        "club": "Al Rayyan SC",
        "clubRaw": "1.qa Al Rayyan SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Ismailia, Egypt",
        "birthDate": "1993-01-01",
        "age": "33-131",
        "ageYears": 33,
        "mp": 1,
        "minutes": 31,
        "goals": 0
      },
      {
        "number": "19",
        "player": "Almoez Ali",
        "pos": "FW",
        "club": "Al Duhail SC",
        "clubRaw": "1.qa Al Duhail SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Khartoum, Sudan",
        "birthDate": "1996-08-19",
        "age": "29-296",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "22",
        "player": "Meshaal Barsham",
        "pos": "GK",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1998-02-14",
        "age": "28-117",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "12",
        "player": "Karim Boudiaf",
        "pos": "DF,MF",
        "club": "Al Duhail SC",
        "clubRaw": "1.qa Al Duhail SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Rouen, France",
        "birthDate": "1990-09-20",
        "age": "35-268",
        "ageYears": 35,
        "mp": 1,
        "minutes": 31,
        "goals": 0
      },
      {
        "number": "18",
        "player": "Sultan Al-Brake",
        "pos": "DF",
        "club": "Al Duhail SC",
        "clubRaw": "1.qa Al Duhail SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1996-04-07",
        "age": "30-065",
        "ageYears": 30,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "20",
        "player": "Ahmed Fathy",
        "pos": "MF",
        "club": "Al-Arabi",
        "clubRaw": "1.qa Al-Arabi",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Aswan, Egypt",
        "birthDate": "1992-12-26",
        "age": "33-137",
        "ageYears": 33,
        "mp": 1,
        "minutes": 31,
        "goals": 0
      },
      {
        "number": "5",
        "player": "Jassem Gaber",
        "pos": "MF",
        "club": "Al Rayyan SC",
        "clubRaw": "1.qa Al Rayyan SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "2002-02-28",
        "age": "24-111",
        "ageYears": 24,
        "mp": 1,
        "minutes": 59,
        "goals": 0
      },
      {
        "number": "17",
        "player": "Ahmed Al-Ganehi",
        "pos": "FW",
        "club": "Al-Gharafa Sports Club",
        "clubRaw": "1.qa Al-Gharafa Sports Club",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "2000-09-23",
        "age": "25-262",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "6",
        "player": "Abdulaziz Hatem",
        "pos": "MF",
        "club": "Al Rayyan SC",
        "clubRaw": "1.qa Al Rayyan SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1990-02-05",
        "age": "36-161",
        "ageYears": 36,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "10",
        "player": "Hassan Al-Haydos",
        "pos": "FW,MF",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1991-01-15",
        "age": "35-182",
        "ageYears": 35,
        "mp": 1,
        "minutes": 3,
        "goals": 0
      },
      {
        "number": "25",
        "player": "Al-Hashmi Al-Hussain",
        "pos": "MF",
        "club": "Al-Arabi",
        "clubRaw": "1.qa Al-Arabi",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Qaţar, Qatar",
        "birthDate": "2003-07-18",
        "age": "22-300",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "24",
        "player": "Tahsin Jamshid",
        "pos": "FW",
        "club": "Al Duhail SC",
        "clubRaw": "1.qa Al Duhail SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Qaţar, Qatar",
        "birthDate": "2006-06-19",
        "age": "19-360",
        "ageYears": 19,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "8",
        "player": "Edmilson Junior",
        "pos": "FW",
        "club": "Al Duhail SC",
        "clubRaw": "1.qa Al Duhail SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Liège, Belgium",
        "birthDate": "1994-08-19",
        "age": "31-296",
        "ageYears": 31,
        "mp": 1,
        "minutes": 87,
        "goals": 0
      },
      {
        "number": "4",
        "player": "Boualem Khoukhi",
        "pos": "DF,MF",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Bouïra, Algeria",
        "birthDate": "1990-07-09",
        "age": "35-339",
        "ageYears": 35,
        "mp": 1,
        "minutes": 90,
        "goals": 1
      },
      {
        "number": "21",
        "player": "Issa Laye",
        "pos": "DF",
        "club": "Al-Gharafa Sports Club",
        "clubRaw": "1.qa Al-Gharafa Sports Club",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Qatar",
        "birthDate": "1999-01-24",
        "age": "27-141",
        "ageYears": 27,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "26",
        "player": "Kamal Darwish",
        "pos": "MF",
        "club": "Al-Arabi",
        "clubRaw": "1.qa Al-Arabi",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Qatar",
        "birthDate": "2005-12-24",
        "age": "20-172",
        "ageYears": 20,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "9",
        "player": "Mohammed Muntari",
        "pos": "FW",
        "club": "Al-Gharafa Sports Club",
        "clubRaw": "1.qa Al-Gharafa Sports Club",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Kumasi, Ghana",
        "birthDate": "1993-12-20",
        "age": "32-178",
        "ageYears": 32,
        "mp": 1,
        "minutes": 31,
        "goals": 0
      },
      {
        "number": "3",
        "player": "Lucas Mendes",
        "pos": "DF",
        "club": "Al-Wakrah",
        "clubRaw": "1.qa Al-Wakrah",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Curitiba, Brazil",
        "birthDate": "1990-07-03",
        "age": "35-345",
        "ageYears": 35,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "23",
        "player": "Mohammed Waad",
        "pos": "MF",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Iraq",
        "birthDate": "1999-09-18",
        "age": "26-269",
        "ageYears": 26,
        "mp": 1,
        "minutes": 3,
        "goals": 0
      },
      {
        "number": "16",
        "player": "Ró-Ró",
        "pos": "DF",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Algarve, Portugal",
        "birthDate": "1990-08-06",
        "age": "35-312",
        "ageYears": 35,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "13",
        "player": "Assim Madibo",
        "pos": "MF",
        "club": "Al Duhail SC",
        "clubRaw": "1.qa Al Duhail SC",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Doha, Qatar",
        "birthDate": "1996-10-22",
        "age": "29-236",
        "ageYears": 29,
        "mp": 1,
        "minutes": 87,
        "goals": 0
      },
      {
        "number": "2",
        "player": "Pedro Miguel",
        "pos": "DF",
        "club": "Al Sadd",
        "clubRaw": "1.qa Al Sadd",
        "clubCountry": "Qatar",
        "clubCountryCode": "qa",
        "birthPlace": "Alcácer do Sal, Portugal",
        "birthDate": "1990-08-06",
        "age": "35-312",
        "ageYears": 35,
        "mp": 0,
        "minutes": null,
        "goals": null
      }
    ],
    "standing": {
      "rank": 3,
      "squad": "qa Qatar",
      "mp": 1,
      "wins": 0,
      "draws": 1,
      "losses": 0,
      "gf": 1,
      "ga": 1,
      "gd": "0",
      "pts": 1,
      "last5": "D  W  L  D  D"
    },
    "shooting": {
      "goals": 1,
      "shots": 7,
      "shotsOnTarget": 4,
      "shotAccuracy": 57.1,
      "shotsPer90": 7,
      "shotsOnTargetPer90": 4
    },
    "activeShooters": [
      "Yusuf Abdurisag (1 تسديدات)",
      "Akram Afif (2 تسديدات)",
      "Boualem Khoukhi (1 تسديدات)",
      "Issa Laye (1 تسديدات)",
      "Ró-Ró (1 تسديدات)",
      "Assim Madibo (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Mahmoud Abunada",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 1,
      "ga90": 1,
      "shotsOnTargetAgainst": 5,
      "saves": 5,
      "savePercentage": 100,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0
    },
    "misc": {
      "yellowCards": 1,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 12,
      "fouled": 11,
      "offsides": 0,
      "crosses": 10,
      "interceptions": 8,
      "tacklesWon": 9,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-1-4-1"
      ],
      "averagePossession": 32.0
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 28.9,
      "topClubs": [
        "Al Duhail SC (6)",
        "Al Sadd (5)",
        "Al Rayyan SC (4)",
        "Al-Arabi (3)",
        "Al-Gharafa Sports Club (3)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Boualem Khoukhi (1)"
      ],
      "assisters": [
        "Homam Ahmed (1)"
      ],
      "minutesLeaders": [
        "Ró-Ró (90 دقيقة)",
        "Mahmoud Abunada (90 دقيقة)",
        "Issa Laye (90 دقيقة)",
        "Homam Ahmed (90 دقيقة)",
        "Boualem Khoukhi (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-13",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "D",
        "gf": "1",
        "ga": "1",
        "opponent": "ch Switzerland",
        "possession": 32,
        "attendance": 67966,
        "captain": "Boualem Khoukhi",
        "formation": "4-1-4-1",
        "opponentFormation": "4-2-3-1",
        "referee": "Said Martínez",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "15:00 (01:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ca Canada",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-24",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ba Bosnia-Herzegovina",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      }
    ]
  },
  {
    "team": "Bosnia and Herzegovina",
    "teamCode": "BIH",
    "teamCodes": [
      "BIH",
      "BA",
      "BOSNIA AND HERZEGOVINA",
      "BOSNIA-HERZEGOVINA"
    ],
    "sourceUrl": "https://fbref.com/en/squads/6c5ef1c3/2026/c1/Bosnia-and-Herzegovina-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "19",
        "player": "Kerim Alajbegović",
        "pos": "MF",
        "club": "RB Salzburg",
        "clubRaw": "1.at RB Salzburg",
        "clubCountry": "Austria",
        "clubCountryCode": "at",
        "birthPlace": "Köln, Germany",
        "birthDate": "2007-09-21",
        "age": "18-263",
        "ageYears": 18,
        "mp": 1,
        "minutes": 17,
        "goals": 0
      },
      {
        "number": "20",
        "player": "Esmir Bajraktarevic",
        "pos": "MF",
        "club": "PSV",
        "clubRaw": "1.nl PSV",
        "clubCountry": "Netherlands",
        "clubCountryCode": "nl",
        "birthPlace": "Appleton, WI, United States",
        "birthDate": "2005-03-10",
        "age": "21-093",
        "ageYears": 21,
        "mp": 1,
        "minutes": 73,
        "goals": 0
      },
      {
        "number": "13",
        "player": "Ivan Bašić",
        "pos": "MF",
        "club": "FC Astana",
        "clubRaw": "1.kz FC Astana",
        "clubCountry": "Kazakhstan",
        "clubCountryCode": "kz",
        "birthPlace": "Bosnia and Herzegovina",
        "birthDate": "2002-05-25",
        "age": "24-042",
        "ageYears": 24,
        "mp": 1,
        "minutes": 61,
        "goals": 0
      },
      {
        "number": "9",
        "player": "Samed Baždar",
        "pos": "FW",
        "club": "Gladbach",
        "clubRaw": "1.de Gladbach",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Novi Pazar, Serbia",
        "birthDate": "2004-02-25",
        "age": "22-131",
        "ageYears": 22,
        "mp": 1,
        "minutes": 29,
        "goals": 0
      },
      {
        "number": "17",
        "player": "Dženis Burnić",
        "pos": "MF",
        "club": "Karlsruher",
        "clubRaw": "2.de Karlsruher",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Hamm, Germany",
        "birthDate": "1998-05-22",
        "age": "28-020",
        "ageYears": 28,
        "mp": 1,
        "minutes": 7,
        "goals": 0
      },
      {
        "number": "24",
        "player": "Nidal Čelik",
        "pos": "DF",
        "club": "Lens",
        "clubRaw": "1.fr Lens",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Sarajevo, Bosnia and Herzegovina",
        "birthDate": "2006-07-20",
        "age": "19-329",
        "ageYears": 19,
        "mp": null,
        "minutes": null,
        "goals": null
      },
      {
        "number": "7",
        "player": "Amar Dedić",
        "pos": "DF",
        "club": "Benfica",
        "clubRaw": "1.pt Benfica",
        "clubCountry": "Portugal",
        "clubCountryCode": "pt",
        "birthPlace": "Zell am See, Austria",
        "birthDate": "2002-08-18",
        "age": "23-297",
        "ageYears": 23,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "10",
        "player": "Ermedin Demirović",
        "pos": "FW",
        "club": "Stuttgart",
        "clubRaw": "1.de Stuttgart",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Hamburg, Germany",
        "birthDate": "1998-03-25",
        "age": "28-078",
        "ageYears": 28,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "11",
        "player": "Edin Džeko",
        "pos": "FW",
        "club": "Schalke 04",
        "clubRaw": "2.de Schalke 04",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Sarajevo, Bosnia and Herzegovina",
        "birthDate": "1986-03-17",
        "age": "40-086",
        "ageYears": 40,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "8",
        "player": "Armin Gigovic",
        "pos": "MF",
        "club": "Young Boys",
        "clubRaw": "1.ch Young Boys",
        "clubCountry": "Switzerland",
        "clubCountryCode": "ch",
        "birthPlace": "Lund, Sweden",
        "birthDate": "2002-05-01",
        "age": "24-066",
        "ageYears": 24,
        "mp": 1,
        "minutes": 29,
        "goals": 0
      },
      {
        "number": "16",
        "player": "Amir Hadžiahmetović",
        "pos": "MF",
        "club": "Hull City",
        "clubRaw": "2.eng Hull City",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Nexø, Denmark",
        "birthDate": "1997-03-09",
        "age": "29-095",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "3",
        "player": "Dennis Hadžikadunić",
        "pos": "DF",
        "club": "Sampdoria",
        "clubRaw": "2.it Sampdoria",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Malmö, Sweden",
        "birthDate": "1998-07-09",
        "age": "27-337",
        "ageYears": 27,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": null,
        "player": "Osman Hadžikić",
        "pos": "GK",
        "club": "Slaven Belupo",
        "clubRaw": "1.hr Slaven Belupo",
        "clubCountry": "Croatia",
        "clubCountryCode": "hr",
        "birthPlace": "Klosterneuburg, Austria",
        "birthDate": "1996-03-12",
        "age": "30-091",
        "ageYears": 30,
        "mp": null,
        "minutes": null,
        "goals": null
      },
      {
        "number": "12",
        "player": "Mladen Jurkas",
        "pos": "GK",
        "club": "Borac Banja Luka",
        "clubRaw": "1.ba Borac Banja Luka",
        "clubCountry": "Bosnia and Herzegovina",
        "clubCountryCode": "ba",
        "birthPlace": "Bosnia and Herzegovina",
        "birthDate": "2007-10-07",
        "age": "18-247",
        "ageYears": 18,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "18",
        "player": "Nikola Katić",
        "pos": "DF",
        "club": "Schalke 04",
        "clubRaw": "2.de Schalke 04",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Ljubuški, Bosnia and Herzegovina",
        "birthDate": "1996-10-10",
        "age": "29-244",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "5",
        "player": "Sead Kolašinac",
        "pos": "DF",
        "club": "Atalanta",
        "clubRaw": "1.it Atalanta",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Karlsruhe, Germany",
        "birthDate": "1993-06-20",
        "age": "32-356",
        "ageYears": 32,
        "mp": 1,
        "minutes": 83,
        "goals": 0
      },
      {
        "number": "25",
        "player": "Jovo Lukić",
        "pos": "FW",
        "club": "Universitatea Cluj",
        "clubRaw": "1.ro Universitatea Cluj",
        "clubCountry": "Romania",
        "clubCountryCode": "ro",
        "birthPlace": "Banja Luka, Bosnia and Herzegovina",
        "birthDate": "1998-11-15",
        "age": "27-195",
        "ageYears": 27,
        "mp": 1,
        "minutes": 61,
        "goals": 1
      },
      {
        "number": "6",
        "player": "Enes Mahmić",
        "pos": "DF",
        "club": "Rijeka",
        "clubRaw": "1.hr Rijeka",
        "clubCountry": "Croatia",
        "clubCountryCode": "hr",
        "birthPlace": "Wels, Austria",
        "birthDate": "1997-05-22",
        "age": "29-020",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "2",
        "player": "Nail Omerović",
        "pos": "DF",
        "club": "Qarabağ FK",
        "clubRaw": "1.az Qarabağ FK",
        "clubCountry": "AZ",
        "clubCountryCode": "az",
        "birthPlace": "Tuzla, Bosnia and Herzegovina",
        "birthDate": "2002-10-20",
        "age": "23-234",
        "ageYears": 23,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "4",
        "player": "Tarik Muharemovic",
        "pos": "DF",
        "club": "Sassuolo",
        "clubRaw": "1.it Sassuolo",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Ljubljana, Slovenia",
        "birthDate": "2003-02-28",
        "age": "23-103",
        "ageYears": 23,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "1",
        "player": "Nikola Vasilj",
        "pos": "GK",
        "club": "Schalke 04",
        "clubRaw": "2.de Schalke 04",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Mostar, Bosnia and Herzegovina",
        "birthDate": "1995-12-02",
        "age": "30-191",
        "ageYears": 30,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "23",
        "player": "Adrian Leon Barišić",
        "pos": "DF",
        "club": "Basel",
        "clubRaw": "1.ch Basel",
        "clubCountry": "Switzerland",
        "clubCountryCode": "ch",
        "birthPlace": "Stuttgart, Germany",
        "birthDate": "2001-07-19",
        "age": "24-327",
        "ageYears": 24,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "14",
        "player": "Becir Omeragić",
        "pos": "DF",
        "club": "Montpellier",
        "clubRaw": "2.fr Montpellier",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Genève, Switzerland",
        "birthDate": "2002-01-20",
        "age": "24-143",
        "ageYears": 24,
        "mp": 1,
        "minutes": 7,
        "goals": 0
      },
      {
        "number": "26",
        "player": "Samed Baždar",
        "pos": "MF",
        "club": "Rijeka",
        "clubRaw": "1.hr Rijeka",
        "clubCountry": "Croatia",
        "clubCountryCode": "hr",
        "birthPlace": "Belgrade, Serbia",
        "birthDate": "2007-07-15",
        "age": "18-331",
        "ageYears": 18,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "15",
        "player": "Benjamin Tahirovic",
        "pos": "MF",
        "club": "Utrecht",
        "clubRaw": "1.nl Utrecht",
        "clubCountry": "Netherlands",
        "clubCountryCode": "nl",
        "birthPlace": "Sweden",
        "birthDate": "2003-03-03",
        "age": "23-100",
        "ageYears": 23,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "21",
        "player": "Petar Sučić",
        "pos": "MF",
        "club": "İstanbul Başakşehir",
        "clubRaw": "1.tr İstanbul Başakşehir",
        "clubCountry": "Turkey",
        "clubCountryCode": "tr",
        "birthPlace": "Bosnia and Herzegovina",
        "birthDate": "2003-10-25",
        "age": "22-229",
        "ageYears": 22,
        "mp": 1,
        "minutes": 83,
        "goals": 0
      },
      {
        "number": "22",
        "player": "Amar Memić",
        "pos": "MF",
        "club": "Olimpija",
        "clubRaw": "1.si Olimpija",
        "clubCountry": "SI",
        "clubCountryCode": "si",
        "birthPlace": "Bosnia and Herzegovina",
        "birthDate": "2001-01-20",
        "age": "25-142",
        "ageYears": 25,
        "mp": 1,
        "minutes": 73,
        "goals": 0
      }
    ],
    "standing": {
      "rank": 4,
      "squad": "ba Bosnia-Herzegovina",
      "mp": 1,
      "wins": 0,
      "draws": 1,
      "losses": 0,
      "gf": 1,
      "ga": 1,
      "gd": "0",
      "pts": 1,
      "last5": "D  D  D  D  D"
    },
    "shooting": {
      "goals": 1,
      "shots": 8,
      "shotsOnTarget": 3,
      "shotAccuracy": 37.5,
      "shotsPer90": 8,
      "shotsOnTargetPer90": 3
    },
    "activeShooters": [
      "Samed Baždar (1 تسديدات)",
      "Ermedin Demirović (1 تسديدات)",
      "Jovo Lukić (2 تسديدات)",
      "Tarik Muharemovic (1 تسديدات)",
      "Benjamin Tahirovic (2 تسديدات)",
      "Petar Sučić (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Nikola Vasilj",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 1,
      "ga90": 1,
      "shotsOnTargetAgainst": 2,
      "saves": 1,
      "savePercentage": 50,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0
    },
    "misc": {
      "yellowCards": 2,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 17,
      "fouled": 9,
      "offsides": 1,
      "crosses": 20,
      "interceptions": 11,
      "tacklesWon": 3,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-2-2-2"
      ],
      "averagePossession": 39.0
    },
    "rosterSummary": {
      "count": 27,
      "averageAge": 26.1,
      "topClubs": [
        "Schalke 04 (3)",
        "Rijeka (2)",
        "Atalanta (1)",
        "Benfica (1)",
        "Borac Banja Luka (1)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Jovo Lukić (1)"
      ],
      "assisters": [
        "Sead Kolašinac (1)"
      ],
      "minutesLeaders": [
        "Tarik Muharemovic (90 دقيقة)",
        "Nikola Vasilj (90 دقيقة)",
        "Nikola Katić (90 دقيقة)",
        "Ermedin Demirović (90 دقيقة)",
        "Benjamin Tahirovic (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-12",
        "time": "15:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "D",
        "gf": "1",
        "ga": "1",
        "opponent": "ca Canada",
        "possession": 39,
        "attendance": 43002,
        "captain": "Sead Kolašinac",
        "formation": "4-2-2-2",
        "opponentFormation": "4-2-2-2",
        "referee": "Facundo Tello",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ch Switzerland",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-24",
        "time": "12:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "qa Qatar",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      }
    ]
  }
] satisfies GroupBFbrefTeamStats[];

export function findGroupBFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupBFbrefStats.find((stats) => (
    stats.teamCode.toLowerCase() === normalized ||
    stats.team.toLowerCase() === normalized ||
    stats.teamCodes.some((code) => code.toLowerCase() === normalized)
  )) || null;
}

export function toTeamFBRefStats(stats: GroupBFbrefTeamStats) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: {
      group: 'B',
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
    shooting: {
      shots: stats.shooting.shots,
      shotsOnTarget: stats.shooting.shotsOnTarget,
      goals: stats.shooting.goals,
      shotAccuracy: stats.shooting.shotAccuracy,
      activeShooters: stats.activeShooters,
    },
    goalkeeping: {
      goalkeeper: stats.goalkeeping.goalkeeper,
      saves: stats.goalkeeping.saves,
      shotsOnTargetAgainst: stats.goalkeeping.shotsOnTargetAgainst,
      goalsAgainst: stats.goalkeeping.goalsAgainst,
      savePercentage: String(stats.goalkeeping.savePercentage),
    },
    misc: {
      yellowCards: stats.misc.yellowCards,
      redCards: stats.misc.redCards,
      fouls: stats.misc.fouls,
      fouled: stats.misc.fouled,
      interceptions: stats.misc.interceptions,
      tacklesWon: stats.misc.tacklesWon,
      crosses: stats.misc.crosses,
    },
    matchContext: stats.matchContext,
    roster: stats.rosterSummary,
    standard: stats.standard,
  };
}

export async function seedGroupBFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupBFbrefStats) {
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
      model: 'fbref-copy-source-group-b-v1',
      source: 'FBref copied source text',
      exportedAt: '2026-06-15T00:00:00.000Z',
      teamCode: stats.teamCode,
      roster: stats.roster,
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
      where: {
        teamId: team.id,
        title,
        provider: 'FBREF_STATHEAD_SNAPSHOT',
      },
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
        tacticalTags: ['FBref', 'World Cup 2026', 'Group B', 'copied-source', 'normalized-card-format'],
        strengths: buildStrengths(stats),
        weaknesses: buildWeaknesses(stats),
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupBFbrefStats.length };
}
