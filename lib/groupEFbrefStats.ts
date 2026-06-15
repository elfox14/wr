import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';
import type { GroupAFbrefTeamStats } from './groupAFbrefStats';

type GroupEFbrefTeamStats = GroupAFbrefTeamStats;

const arabicTeamNames: Record<string, string> = {
  GER: 'ألمانيا',
  CIV: 'كوت ديفوار',
  ECU: 'الإكوادور',
  CUW: 'كوراساو',
};

function displayTeam(stats: GroupEFbrefTeamStats) {
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

function completedWorldCupMatch(stats: GroupEFbrefTeamStats) {
  return stats.worldCupMatches.find((match) => match.result);
}

function upcomingMatches(stats: GroupEFbrefTeamStats) {
  return stats.worldCupMatches
    .filter((match) => !match.result)
    .map((match) => `${match.date} ضد ${opponentName(match.opponent)}`)
    .join('؛ ');
}

function buildStrengths(stats: GroupEFbrefTeamStats) {
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

function buildWeaknesses(stats: GroupEFbrefTeamStats) {
  const weaknesses: string[] = [];
  if (stats.standing.ga > 0) weaknesses.push(`استقبل ${n(stats.standing.ga)} هدف في عينة المجموعة الحالية`);
  if (stats.shooting.goals === 0) weaknesses.push('لم يسجل في مباراة كأس العالم المتاحة داخل FBref');
  if (stats.shooting.shots <= 8) weaknesses.push(`حجم تسديد محدود: ${n(stats.shooting.shots)} تسديدات فقط`);
  if (stats.goalkeeping.goalsAgainst >= 4) weaknesses.push(`ضغط دفاعي واضح: ${n(stats.goalkeeping.goalsAgainst)} أهداف مستقبلة`);
  if (stats.matchContext.averagePossession !== null && stats.matchContext.averagePossession < 45) weaknesses.push(`استحواذ منخفض: ${pct(stats.matchContext.averagePossession)}`);
  if (!weaknesses.length) weaknesses.push('العينة الحالية مباراة واحدة فقط، لذلك لا تصلح لاستخلاص حكم نهائي');
  return weaknesses.slice(0, 4);
}

function buildReportBody(stats: GroupEFbrefTeamStats) {
  const teamName = displayTeam(stats);
  const match = completedWorldCupMatch(stats);
  const matchText = match
    ? `${match.date}: ${teamName} ${match.gf}-${match.ga} ${opponentName(match.opponent)}، النتيجة ${match.result}، الاستحواذ ${match.possession !== null ? pct(match.possession) : 'غير متوفر في المصادر'}، القائد ${match.captain || 'غير متوفر في المصادر'}، الشكل ${match.formation || 'غير متوفر في المصادر'}.`
    : 'لا توجد مباراة مكتملة في عينة World Cup داخل مصدر FBref.';

  return `بطاقة المنتخب: ${teamName} — المجموعة E — مصدر البيانات FBref copied source text. الملف يحتوي على Roster، Standard Stats، Scores & Fixtures، Goalkeeping، Shooting، Miscellaneous Stats، وترتيب Group E. العينة الحالية: ${n(stats.standing.mp)} مباراة.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. أكثر الأندية حضورًا: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}. هذه لقطة إحصائية منظمة، وليست القائمة الرسمية النهائية إذا اختلفت مع FIFA.

وضع المنتخب في المجموعة: المركز ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}.

تحليل الأداء بالأرقام: ${matchText} المباريات القادمة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}. شارك ${n(stats.standard.usedPlayers)} لاعبًا في المباراة المتاحة.

القوة الهجومية: سجل المنتخب ${n(stats.shooting.goals)} هدف، وسدد ${n(stats.shooting.shots)} مرة، منها ${n(stats.shooting.shotsOnTarget)} على المرمى، بدقة تسديد ${pct(stats.shooting.shotAccuracy)}. الهدافون: ${stats.standard.scorers.join('، ') || 'لا يوجد'}. صانعو الأهداف: ${stats.standard.assisters.join('، ') || 'لا يوجد'}. أكثر اللاعبين دقائق: ${stats.standard.minutesLeaders.join('، ') || 'غير متوفر في المصادر'}. أكثر المسددين: ${stats.activeShooters.slice(0, 6).join('، ') || 'غير متوفر في المصادر'}.

القوة الدفاعية: استقبل المنتخب ${n(stats.goalkeeping.goalsAgainst)} هدف في حراسة ${stats.goalkeeping.goalkeeper || 'غير متوفر في المصادر'}، مع ${n(stats.goalkeeping.saves)} تصديات من ${n(stats.goalkeeping.shotsOnTargetAgainst)} تسديدات على المرمى ضده، ونسبة تصدي ${pct(stats.goalkeeping.savePercentage)}. الشباك النظيفة: ${n(stats.goalkeeping.cleanSheets)}.

وسط الملعب والتحكم: الاستحواذ المتوسط في مباريات كأس العالم المكتملة داخل المصدر ${stats.matchContext.averagePossession !== null ? pct(stats.matchContext.averagePossession) : 'غير متوفر في المصادر'}. التشكيلات المستخدمة: ${stats.matchContext.formations.join('، ') || 'غير متوفر في المصادر'}. لا يتم اختراع دقة تمرير أو xG لأنها غير موجودة في النص المنسوخ.

الانضباط والأدوار بدون كرة: البطاقات الصفراء ${n(stats.misc.yellowCards)}، البطاقات الحمراء ${n(stats.misc.redCards)}، الأخطاء المرتكبة ${n(stats.misc.fouls)}، الأخطاء المكتسبة ${n(stats.misc.fouled)}، الاعتراضات ${n(stats.misc.interceptions)}، التدخلات الناجحة ${n(stats.misc.tacklesWon)}، العرضيات ${n(stats.misc.crosses)}.

سجل المصادر: لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

function buildSummary(stats: GroupEFbrefTeamStats) {
  const teamName = displayTeam(stats);
  return `${teamName} لديه لقطة FBref مقروءة بعد أول مباراة في المجموعة E: ${n(stats.standing.pts)} نقاط، ${n(stats.standing.gf)} له، ${n(stats.standing.ga)} عليه، ${n(stats.shooting.shots)} تسديدة، و${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة.`;
}

export const groupEFbrefStats = [
  {
    "team": "Germany",
    "teamCode": "GER",
    "teamCodes": [
      "GER",
      "DE",
      "GERMANY",
      "DEUTSCHLAND"
    ],
    "sourceUrl": "https://fbref.com/en/squads/c1e40422/2026/c1/Germany-Men-Stats-World-Cup",
    "roster": [],
    "standing": {
      "rank": 1,
      "squad": "de Germany",
      "mp": 1,
      "wins": 1,
      "draws": 0,
      "losses": 0,
      "gf": 7,
      "ga": 1,
      "gd": "+6",
      "pts": 3,
      "last5": "W W W W W"
    },
    "shooting": {
      "goals": 7,
      "shots": 26,
      "shotsOnTarget": 12,
      "shotAccuracy": 46.2,
      "shotsPer90": 26.0,
      "shotsOnTargetPer90": 12.0
    },
    "activeShooters": [
      "Kai Havertz (4 تسديدات)",
      "Felix Nmecha (4 تسديدات)",
      "Aleksandar Pavlovic (3 تسديدات)",
      "Leroy Sané (3 تسديدات)",
      "Florian Wirtz (3 تسديدات)",
      "Jamal Musiala (3 تسديدات)",
      "Nico Schlotterbeck (2 تسديدات)",
      "Nathaniel Brown (2 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Manuel Neuer",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 1,
      "ga90": 1.0,
      "shotsOnTargetAgainst": 2,
      "saves": 1,
      "savePercentage": 50.0,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0.0
    },
    "misc": {
      "yellowCards": 0,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 18,
      "fouled": 10,
      "offsides": 0,
      "crosses": 12,
      "interceptions": 10,
      "tacklesWon": 13,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-2-3-1"
      ],
      "averagePossession": 65.0
    },
    "rosterSummary": {
      "count": 27,
      "averageAge": 28.0,
      "topClubs": [
        "Bayern Munich (7)",
        "Dortmund (4)",
        "Stuttgart (4)",
        "RB Leipzig (2)",
        "Newcastle United (2)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Kai Havertz (2)",
        "Nico Schlotterbeck (1)",
        "Nathaniel Brown (1)",
        "Felix Nmecha (1)",
        "Jamal Musiala (1)",
        "Deniz Undav (1)"
      ],
      "assisters": [
        "Florian Wirtz (1)",
        "Joshua Kimmich (2)",
        "Nathaniel Brown (1)",
        "Deniz Undav (2)"
      ],
      "minutesLeaders": [
        "Kai Havertz (90 دقيقة)",
        "Manuel Neuer (90 دقيقة)",
        "Aleksandar Pavlovic (90 دقيقة)",
        "Leroy Sané (90 دقيقة)",
        "Nico Schlotterbeck (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-14",
        "time": "12:00 (20:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "W",
        "gf": "7",
        "ga": "1",
        "opponent": "cw Curaçao",
        "possession": 65,
        "attendance": 68021,
        "captain": "Joshua Kimmich",
        "formation": "4-2-3-1",
        "opponentFormation": "4-3-1-2",
        "referee": "Jalal Jiyed",
        "notes": ""
      },
      {
        "date": "2026-06-20",
        "time": "16:00 (23:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ci Côte d'Ivoire",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-25",
        "time": "16:00 (23:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ec Ecuador",
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
    "team": "Côte d'Ivoire",
    "teamCode": "CIV",
    "teamCodes": [
      "CIV",
      "CI",
      "COTE DIVOIRE",
      "COTE D’IVOIRE",
      "COTE D'IVOIRE",
      "IVORY COAST"
    ],
    "sourceUrl": "https://fbref.com/en/squads/24772b12/2026/c1/Cote-dIvoire-Men-Stats-World-Cup",
    "roster": [],
    "standing": {
      "rank": 2,
      "squad": "ci Côte d'Ivoire",
      "mp": 1,
      "wins": 1,
      "draws": 0,
      "losses": 0,
      "gf": 1,
      "ga": 0,
      "gd": "+1",
      "pts": 3,
      "last5": "L W W W W"
    },
    "shooting": {
      "goals": 1,
      "shots": 15,
      "shotsOnTarget": 4,
      "shotAccuracy": 26.7,
      "shotsPer90": 15.0,
      "shotsOnTargetPer90": 4.0
    },
    "activeShooters": [
      "Seko Fofana (4 تسديدات)",
      "Yan Diomandé (2 تسديدات)",
      "Nicolas Pépé (2 تسديدات)",
      "Elye Wahi (2 تسديدات)",
      "Amad Diallo (2 تسديدات)",
      "Ghislain Konan (1 تسديدات)",
      "Wilfried Singo (1 تسديدات)",
      "Christ Inao Oulaï (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Yahia Fofana",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 0,
      "ga90": 0.0,
      "shotsOnTargetAgainst": 1,
      "saves": 1,
      "savePercentage": 100.0,
      "cleanSheets": 1,
      "cleanSheetPercentage": 100.0
    },
    "misc": {
      "yellowCards": 3,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 10,
      "fouled": 13,
      "offsides": 0,
      "crosses": 7,
      "interceptions": 11,
      "tacklesWon": 9,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-2-2-2"
      ],
      "averagePossession": 48.0
    },
    "rosterSummary": {
      "count": 27,
      "averageAge": 26.2,
      "topClubs": [
        "Charleroi (2)",
        "Monaco (1)",
        "Beşiktaş (1)",
        "Auxerre (1)",
        "Inter (1)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Amad Diallo (1)"
      ],
      "assisters": [
        "Wilfried Singo (1)"
      ],
      "minutesLeaders": [
        "Emmanuel Agbadou (90 دقيقة)",
        "Yan Diomandé (90 دقيقة)",
        "Yahia Fofana (90 دقيقة)",
        "Franck Kessié (90 دقيقة)",
        "Ghislain Konan (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-14",
        "time": "19:00 (02:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "W",
        "gf": "1",
        "ga": "0",
        "opponent": "ec Ecuador",
        "possession": 48,
        "attendance": 68274,
        "captain": "Franck Kessié",
        "formation": "4-2-2-2",
        "opponentFormation": "4-2-2-2",
        "referee": "François Letexier",
        "notes": ""
      },
      {
        "date": "2026-06-20",
        "time": "16:00 (23:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "de Germany",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-25",
        "time": "16:00 (23:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "cw Curaçao",
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
    "team": "Ecuador",
    "teamCode": "ECU",
    "teamCodes": [
      "ECU",
      "EC",
      "ECUADOR"
    ],
    "sourceUrl": "https://fbref.com/en/squads/123acaf8/2026/c1/Ecuador-Men-Stats-World-Cup",
    "roster": [],
    "standing": {
      "rank": 3,
      "squad": "ec Ecuador",
      "mp": 1,
      "wins": 0,
      "draws": 0,
      "losses": 1,
      "gf": 0,
      "ga": 1,
      "gd": "-1",
      "pts": 0,
      "last5": "D D W W L"
    },
    "shooting": {
      "goals": 0,
      "shots": 12,
      "shotsOnTarget": 1,
      "shotAccuracy": 8.3,
      "shotsPer90": 12.0,
      "shotsOnTargetPer90": 1.0
    },
    "activeShooters": [
      "John Yeboah (3 تسديدات)",
      "Joel Ordóñez (2 تسديدات)",
      "Alan Minda (2 تسديدات)",
      "Moisés Caicedo (1 تسديدات)",
      "Piero Hincapié (1 تسديدات)",
      "Gonzalo Plata (1 تسديدات)",
      "Pedro Vite (1 تسديدات)",
      "Enner Valencia (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Hernán Galíndez",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 1,
      "ga90": 1.0,
      "shotsOnTargetAgainst": 4,
      "saves": 3,
      "savePercentage": 75.0,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0.0
    },
    "misc": {
      "yellowCards": 1,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 13,
      "fouled": 9,
      "offsides": 0,
      "crosses": 14,
      "interceptions": 13,
      "tacklesWon": 14,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-2-2-2"
      ],
      "averagePossession": 52.0
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 27.0,
      "topClubs": [
        "Atlético Mineiro (3)",
        "Huracán (2)",
        "Independiente (1)",
        "Sunderland (1)",
        "Stuttgart (1)"
      ]
    },
    "standard": {
      "usedPlayers": 15,
      "scorers": [],
      "assisters": [],
      "minutesLeaders": [
        "Moisés Caicedo (90 دقيقة)",
        "Hernán Galíndez (90 دقيقة)",
        "Piero Hincapié (90 دقيقة)",
        "Joel Ordóñez (90 دقيقة)",
        "Willian Pacho (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-14",
        "time": "19:00 (02:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "L",
        "gf": "0",
        "ga": "1",
        "opponent": "ci Côte d'Ivoire",
        "possession": 52,
        "attendance": 68274,
        "captain": "Enner Valencia",
        "formation": "4-2-2-2",
        "opponentFormation": "4-2-2-2",
        "referee": "François Letexier",
        "notes": ""
      },
      {
        "date": "2026-06-20",
        "time": "19:00 (03:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "cw Curaçao",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-25",
        "time": "16:00 (23:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "de Germany",
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
    "team": "Curaçao",
    "teamCode": "CUW",
    "teamCodes": [
      "CUW",
      "CW",
      "CURACAO",
      "CURAÇAO"
    ],
    "sourceUrl": "https://fbref.com/en/squads/e0f5893a/2026/c1/Curacao-Men-Stats-World-Cup",
    "roster": [],
    "standing": {
      "rank": 4,
      "squad": "cw Curaçao",
      "mp": 1,
      "wins": 0,
      "draws": 0,
      "losses": 1,
      "gf": 1,
      "ga": 7,
      "gd": "-6",
      "pts": 0,
      "last5": "W D L W L"
    },
    "shooting": {
      "goals": 1,
      "shots": 8,
      "shotsOnTarget": 2,
      "shotAccuracy": 25.0,
      "shotsPer90": 8.0,
      "shotsOnTargetPer90": 2.0
    },
    "activeShooters": [
      "Leandro Bacuna (2 تسديدات)",
      "Livano Comenencia (2 تسديدات)",
      "Juninho Bacuna (1 تسديدات)",
      "Tahith Chong (1 تسديدات)",
      "Sontje Hansen (1 تسديدات)",
      "Jearl Margaritha (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Eloy Room",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 7,
      "ga90": 7.0,
      "shotsOnTargetAgainst": 10,
      "saves": 4,
      "savePercentage": 40.0,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0.0
    },
    "misc": {
      "yellowCards": 0,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 11,
      "fouled": 18,
      "offsides": 1,
      "crosses": 7,
      "interceptions": 16,
      "tacklesWon": 7,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-3-1-2"
      ],
      "averagePossession": 35.0
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 28.5,
      "topClubs": [
        "Volendam (2)",
        "Telstar (2)",
        "RKC Waalwijk (2)",
        "Miami FC (2)",
        "AE Kifisia (1)"
      ]
    },
    "standard": {
      "usedPlayers": 14,
      "scorers": [
        "Livano Comenencia (1)"
      ],
      "assisters": [],
      "minutesLeaders": [
        "Juninho Bacuna (90 دقيقة)",
        "Leandro Bacuna (90 دقيقة)",
        "Riechedly Bazoer (90 دقيقة)",
        "Livano Comenencia (90 دقيقة)",
        "Sherel Floranus (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-14",
        "time": "12:00 (20:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "L",
        "gf": "1",
        "ga": "7",
        "opponent": "de Germany",
        "possession": 35,
        "attendance": 68021,
        "captain": "Leandro Bacuna",
        "formation": "4-3-1-2",
        "opponentFormation": "4-2-3-1",
        "referee": "Jalal Jiyed",
        "notes": ""
      },
      {
        "date": "2026-06-20",
        "time": "19:00 (03:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ec Ecuador",
        "possession": null,
        "attendance": null,
        "captain": "",
        "formation": "",
        "opponentFormation": "",
        "referee": "",
        "notes": ""
      },
      {
        "date": "2026-06-25",
        "time": "16:00 (23:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "ci Côte d'Ivoire",
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
] satisfies GroupEFbrefTeamStats[];

export function findGroupEFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupEFbrefStats.find((stats) => (
    stats.teamCode.toLowerCase() === normalized ||
    stats.team.toLowerCase() === normalized ||
    stats.teamCodes.some((code) => code.toLowerCase() === normalized)
  )) || null;
}

export function toTeamFBRefStats(stats: GroupEFbrefTeamStats) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: {
      group: 'E',
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

export async function seedGroupEFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupEFbrefStats) {
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
      model: 'fbref-copy-source-group-e-v1',
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
      activeShooters: stats.activeShooters,
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
        tacticalTags: ['FBref', 'World Cup 2026', 'Group E', 'copied-source', 'normalized-card-format'],
        strengths: buildStrengths(stats),
        weaknesses: buildWeaknesses(stats),
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupEFbrefStats.length };
}
