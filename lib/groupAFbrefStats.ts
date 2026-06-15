import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeTeamReportBody } from './teamReportFormat';

export type GroupAFbrefRosterPlayer = {
  number: string | null;
  player: string;
  pos: string;
  club: string;
  clubRaw: string;
  clubCountry: string | null;
  clubCountryCode: string | null;
  birthPlace: string;
  birthDate: string;
  age: string;
  ageYears: number | null;
  mp: number | null;
  minutes: number | null;
  goals: number | null;
};

export type GroupAFbrefTeamStats = {
  team: string;
  teamCode: string;
  teamCodes: string[];
  sourceUrl: string;
  roster: GroupAFbrefRosterPlayer[];
  standing: {
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
  shooting: {
    goals: number;
    shots: number;
    shotsOnTarget: number;
    shotAccuracy: number;
    shotsPer90: number;
    shotsOnTargetPer90: number;
  };
  activeShooters: string[];
  goalkeeping: {
    goalkeeper: string;
    mp: number;
    starts: number;
    minutes: number;
    goalsAgainst: number;
    ga90: number;
    shotsOnTargetAgainst: number;
    saves: number;
    savePercentage: number;
    cleanSheets: number;
    cleanSheetPercentage: number;
  };
  misc: {
    yellowCards: number;
    redCards: number;
    secondYellows: number;
    fouls: number;
    fouled: number;
    offsides: number;
    crosses: number;
    interceptions: number;
    tacklesWon: number;
    ownGoals: number;
  };
  matchContext: {
    completedCount: number;
    upcomingCount: number;
    formations: string[];
    averagePossession: number | null;
  };
  rosterSummary: {
    count: number;
    averageAge: number;
    topClubs: string[];
  };
  standard: {
    usedPlayers: number;
    scorers: string[];
    assisters: string[];
    minutesLeaders: string[];
  };
  worldCupMatches: Array<{
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
  }>;
};

const arabicTeamNames: Record<string, string> = {
  MEX: 'المكسيك',
  RSA: 'جنوب أفريقيا',
  KOR: 'كوريا الجنوبية',
  CZE: 'التشيك',
};

function displayTeam(stats: GroupAFbrefTeamStats) {
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

function rosterLine(player: GroupAFbrefRosterPlayer) {
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

function completedWorldCupMatch(stats: GroupAFbrefTeamStats) {
  return stats.worldCupMatches.find((match) => match.result);
}

function upcomingMatches(stats: GroupAFbrefTeamStats) {
  return stats.worldCupMatches
    .filter((match) => !match.result)
    .map((match) => `${match.date} ضد ${opponentName(match.opponent)}`)
    .join('؛ ');
}

function buildStrengths(stats: GroupAFbrefTeamStats) {
  const strengths: string[] = [];
  if (stats.standing.pts > 0) strengths.push(`${n(stats.standing.pts)} نقاط بعد ${n(stats.standing.mp)} مباراة في المجموعة`);
  if (stats.shooting.goals > 0) strengths.push(`${n(stats.shooting.goals)} أهداف من ${n(stats.shooting.shots)} تسديدة في عينة كأس العالم الحالية`);
  if (stats.shooting.shotsOnTarget > 0) strengths.push(`${n(stats.shooting.shotsOnTarget)} تسديدات على المرمى`);
  if (stats.goalkeeping.cleanSheets > 0) strengths.push(`شباك نظيفة مع ${stats.goalkeeping.goalkeeper}`);
  if (stats.matchContext.averagePossession && stats.matchContext.averagePossession >= 55) strengths.push(`استحواذ مرتفع في المباراة المتاحة: ${pct(stats.matchContext.averagePossession)}`);
  if (!strengths.length) strengths.push('وجود ملف FBref تفصيلي قابل للتحديث بعد كل مباراة');
  return strengths.slice(0, 4);
}

function buildWeaknesses(stats: GroupAFbrefTeamStats) {
  const weaknesses: string[] = [];
  if (stats.standing.ga > 0) weaknesses.push(`استقبل ${n(stats.standing.ga)} هدف في عينة المجموعة الحالية`);
  if (stats.shooting.goals === 0) weaknesses.push('لم يسجل في مباراة كأس العالم المتاحة داخل FBref');
  if (stats.shooting.shots <= 7) weaknesses.push(`حجم تسديد محدود: ${n(stats.shooting.shots)} تسديدة فقط`);
  if (stats.misc.redCards > 0) weaknesses.push(`انضباط يحتاج متابعة: ${n(stats.misc.redCards)} بطاقة حمراء`);
  if (stats.matchContext.averagePossession !== null && stats.matchContext.averagePossession < 45) weaknesses.push(`استحواذ منخفض في المباراة المتاحة: ${pct(stats.matchContext.averagePossession)}`);
  if (!weaknesses.length) weaknesses.push('العينة الحالية مباراة واحدة فقط، لذلك لا تصلح لاستخلاص حكم نهائي');
  return weaknesses.slice(0, 4);
}

function buildReportBody(stats: GroupAFbrefTeamStats) {
  const teamName = displayTeam(stats);
  const match = completedWorldCupMatch(stats);
  const matchText = match
    ? `${match.date}: ${teamName} ${match.gf}-${match.ga} ${opponentName(match.opponent)}، النتيجة ${match.result}، الاستحواذ ${match.possession !== null ? pct(match.possession) : 'غير متوفر في المصادر'}، القائد ${match.captain || 'غير متوفر في المصادر'}، الشكل ${match.formation || 'غير متوفر في المصادر'}.`
    : 'لا توجد مباراة مكتملة في عينة World Cup داخل مصدر FBref.';

  const rosterPreview = stats.roster.map(rosterLine).join('\n');

  return `بطاقة المنتخب: ${teamName} — المجموعة الأولى — مصدر البيانات FBref copied source text. الملف يحتوي على Roster، Standard Stats، Scores & Fixtures، Goalkeeping، Shooting، Playing Time، Miscellaneous Stats، وترتيب Group A. العينة الحالية في كأس العالم: ${n(stats.standing.mp)} مباراة.

القائمة الحالية وبنية الفريق: تضم القائمة المتاحة في FBref ${n(stats.rosterSummary.count)} لاعبًا، بمتوسط عمر تقريبي ${n(stats.rosterSummary.averageAge)} سنة. أكثر الأندية حضورًا في القائمة: ${stats.rosterSummary.topClubs.join('، ') || 'غير متوفر في المصادر'}.
${rosterPreview}

وضع المنتخب في المجموعة: المركز ${n(stats.standing.rank)}، لعب ${n(stats.standing.mp)}، فاز ${n(stats.standing.wins)}، تعادل ${n(stats.standing.draws)}، خسر ${n(stats.standing.losses)}، له ${n(stats.standing.gf)}، عليه ${n(stats.standing.ga)}، فارق ${stats.standing.gd}، نقاط ${n(stats.standing.pts)}.

تحليل الأداء بالأرقام: ${matchText} المباريات القادمة في المصدر: ${upcomingMatches(stats) || 'غير متوفر في المصادر'}. شارك ${n(stats.standard.usedPlayers)} لاعبًا في المباراة/المباريات المتاحة.

القوة الهجومية: سجل المنتخب ${n(stats.shooting.goals)} أهداف، وسدد ${n(stats.shooting.shots)} مرة، منها ${n(stats.shooting.shotsOnTarget)} على المرمى، بدقة تسديد ${pct(stats.shooting.shotAccuracy)}. الهدافون في العينة: ${stats.standard.scorers.join('، ') || 'لا يوجد'}. صانعو الأهداف: ${stats.standard.assisters.join('، ') || 'لا يوجد'}. أكثر اللاعبين دقائق: ${stats.standard.minutesLeaders.join('، ') || 'غير متوفر في المصادر'}.

القوة الدفاعية: استقبل المنتخب ${n(stats.goalkeeping.goalsAgainst)} أهداف في حراسة ${stats.goalkeeping.goalkeeper || 'غير متوفر في المصادر'}، مع ${n(stats.goalkeeping.saves)} تصديات من ${n(stats.goalkeeping.shotsOnTargetAgainst)} تسديدات على المرمى ضده، ونسبة تصدي ${pct(stats.goalkeeping.savePercentage)}. الشباك النظيفة: ${n(stats.goalkeeping.cleanSheets)}.

وسط الملعب والتحكم: الاستحواذ المتوسط في مباريات كأس العالم المكتملة داخل المصدر ${stats.matchContext.averagePossession !== null ? pct(stats.matchContext.averagePossession) : 'غير متوفر في المصادر'}. التشكيلات المستخدمة في العينة: ${stats.matchContext.formations.join('، ') || 'غير متوفر في المصادر'}. لا يحتوي هذا النص المنسوخ على جداول تمرير متقدمة أو xG؛ لذلك لا يتم اختراع دقة تمرير أو فرص متوقعة.

الانضباط والأدوار بدون كرة: البطاقات الصفراء ${n(stats.misc.yellowCards)}، البطاقات الحمراء ${n(stats.misc.redCards)}، الأخطاء المرتكبة ${n(stats.misc.fouls)}، الأخطاء المكتسبة ${n(stats.misc.fouled)}، الاعتراضات ${n(stats.misc.interceptions)}، التدخلات الناجحة ${n(stats.misc.tacklesWon)}، العرضيات ${n(stats.misc.crosses)}.

سجل المصادر: هذه لقطة إحصائية من FBref copy/paste source text أرسلها مالك المنصة، وليست مصدرًا رسميًا للقائمة. عند اختلافها مع FIFA Squad Lists يتم اعتماد FIFA للقائمة الرسمية، واستخدام FBref للإحصاءات والمطابقة.`;
}

function buildSummary(stats: GroupAFbrefTeamStats) {
  const teamName = displayTeam(stats);
  return `${teamName} لديه لقطة FBref مقروءة بعد أول مباراة في المجموعة: ${n(stats.standing.pts)} نقاط، ${n(stats.standing.gf)} له، ${n(stats.standing.ga)} عليه، ${n(stats.shooting.shots)} تسديدة، و${n(stats.rosterSummary.count)} لاعبًا في القائمة المتاحة.`;
}

export const groupAFbrefStats = [
  {
    "team": "Mexico",
    "teamCode": "MEX",
    "teamCodes": [
      "MEX",
      "MX",
      "MEXICO"
    ],
    "sourceUrl": "https://fbref.com/en/squads/b009a548/2026/c1/Mexico-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "12",
        "player": "Carlos Acevedo",
        "pos": "GK",
        "club": "Santos Laguna",
        "clubRaw": "1.mx Santos Laguna",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Torreón, Estado de Coahuila de Zaragoza, Mexico",
        "birthDate": "1996-04-19",
        "age": "30-053",
        "ageYears": 30,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "25",
        "player": "Roberto Alvarado",
        "pos": "MF",
        "club": "Guadalajara",
        "clubRaw": "1.mx Guadalajara",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Salamanca, Estado de Guanajuato, Mexico",
        "birthDate": "1998-09-07",
        "age": "27-277",
        "ageYears": 27,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "4",
        "player": "Edson Álvarez",
        "pos": "DF,MF",
        "club": "West Ham United",
        "clubRaw": "1.eng West Ham United",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Tlalnepantla de Baz, Estado de México, Mexico",
        "birthDate": "1997-10-24",
        "age": "28-230",
        "ageYears": 28,
        "mp": 1,
        "minutes": 15,
        "goals": 0
      },
      {
        "number": "24",
        "player": "Luis Chávez",
        "pos": "MF",
        "club": "Dynamo Moscow",
        "clubRaw": "1.ru Dynamo Moscow",
        "clubCountry": "Russia",
        "clubCountryCode": "ru",
        "birthPlace": "Cihuatlán, Estado de Jalisco, Mexico",
        "birthDate": "1996-01-15",
        "age": "30-147",
        "ageYears": 30,
        "mp": 1,
        "minutes": 25,
        "goals": 0
      },
      {
        "number": "20",
        "player": "Mateo Chávez",
        "pos": "DF",
        "club": "AZ Alkmaar",
        "clubRaw": "1.nl AZ Alkmaar",
        "clubCountry": "Netherlands",
        "clubCountryCode": "nl",
        "birthPlace": "México, Estado de México, Mexico",
        "birthDate": "2004-05-12",
        "age": "22-030",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "8",
        "player": "Álvaro Fidalgo",
        "pos": "MF",
        "club": "Real Betis",
        "clubRaw": "1.es Real Betis",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Pola de Siero, Spain",
        "birthDate": "1997-04-09",
        "age": "29-063",
        "ageYears": 29,
        "mp": 1,
        "minutes": 65,
        "goals": 0
      },
      {
        "number": "23",
        "player": "Jesús Gallardo",
        "pos": "DF",
        "club": "Toluca",
        "clubRaw": "1.mx Toluca",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Cárdenas, Estado de Tabasco, Mexico",
        "birthDate": "1994-08-15",
        "age": "31-300",
        "ageYears": 31,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "11",
        "player": "Santiago Giménez",
        "pos": "FW",
        "club": "Milan",
        "clubRaw": "1.it Milan",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Argentina, Argentina",
        "birthDate": "2001-04-18",
        "age": "25-054",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "14",
        "player": "Armando González",
        "pos": "FW",
        "club": "Guadalajara",
        "clubRaw": "1.mx Guadalajara",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "México, Estado de México, Mexico",
        "birthDate": "2003-04-20",
        "age": "23-052",
        "ageYears": 23,
        "mp": 1,
        "minutes": 15,
        "goals": 0
      },
      {
        "number": "26",
        "player": "Brian Gutiérrez",
        "pos": "MF",
        "club": "Guadalajara",
        "clubRaw": "1.mx Guadalajara",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Berwyn, IL, United States",
        "birthDate": "2003-06-17",
        "age": "22-359",
        "ageYears": 22,
        "mp": 1,
        "minutes": 65,
        "goals": 0
      },
      {
        "number": "21",
        "player": "César Huerta",
        "pos": "FW,MF",
        "club": "Anderlecht",
        "clubRaw": "1.be Anderlecht",
        "clubCountry": "Belgium",
        "clubCountryCode": "be",
        "birthPlace": "Guadalajara, Estado de Jalisco, Mexico",
        "birthDate": "2000-12-03",
        "age": "25-190",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "9",
        "player": "Raúl Jiménez",
        "pos": "FW",
        "club": "Fulham",
        "clubRaw": "1.eng Fulham",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Tepeji del Río de Ocampo, Estado de Hidalgo, Mexico",
        "birthDate": "1991-05-05",
        "age": "35-037",
        "ageYears": 35,
        "mp": 1,
        "minutes": 75,
        "goals": 1
      },
      {
        "number": "6",
        "player": "Erik Lira",
        "pos": "MF",
        "club": "Cruz Azul",
        "clubRaw": "1.mx Cruz Azul",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "México, Estado de México, Mexico",
        "birthDate": "2000-05-08",
        "age": "26-034",
        "ageYears": 26,
        "mp": 1,
        "minutes": 75,
        "goals": 0
      },
      {
        "number": "22",
        "player": "Guillermo Martínez Ayala",
        "pos": "FW",
        "club": "UNAM",
        "clubRaw": "1.mx UNAM",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Celaya, Estado de Guanajuato, Mexico",
        "birthDate": "1995-03-15",
        "age": "31-088",
        "ageYears": 31,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "3",
        "player": "César Montes",
        "pos": "DF",
        "club": "Loko Moscow",
        "clubRaw": "1.ru Loko Moscow",
        "clubCountry": "Russia",
        "clubCountryCode": "ru",
        "birthPlace": "Hermosillo, Estado de Sonora, Mexico",
        "birthDate": "1997-02-24",
        "age": "29-107",
        "ageYears": 29,
        "mp": 1,
        "minutes": 89,
        "goals": 0
      },
      {
        "number": "19",
        "player": "Gilberto Mora",
        "pos": "MF",
        "club": "Tijuana",
        "clubRaw": "1.mx Tijuana",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "México, Estado de México, Mexico",
        "birthDate": "2008-10-14",
        "age": "17-240",
        "ageYears": 17,
        "mp": 1,
        "minutes": 25,
        "goals": 0
      },
      {
        "number": "13",
        "player": "Guillermo Ochoa",
        "pos": "GK",
        "club": "AEL Limassol",
        "clubRaw": "1.cy AEL Limassol",
        "clubCountry": "Cyprus",
        "clubCountryCode": "cy",
        "birthPlace": "Guadalajara, Estado de Jalisco, Mexico",
        "birthDate": "1985-07-13",
        "age": "40-333",
        "ageYears": 40,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "17",
        "player": "Orbelín Pineda",
        "pos": "FW,MF",
        "club": "AEK Athens",
        "clubRaw": "1.gr AEK Athens",
        "clubCountry": "Greece",
        "clubCountryCode": "gr",
        "birthPlace": "Coyuca de Catalán, Estado de Guerrero, Mexico",
        "birthDate": "1996-03-24",
        "age": "30-079",
        "ageYears": 30,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "16",
        "player": "Julián Quiñones",
        "pos": "MF",
        "club": "Al-Qadsiah",
        "clubRaw": "1.sa Al-Qadsiah",
        "clubCountry": "Saudi Arabia",
        "clubCountryCode": "sa",
        "birthPlace": "Payán, Colombia",
        "birthDate": "1997-03-24",
        "age": "29-079",
        "ageYears": 29,
        "mp": 1,
        "minutes": 78,
        "goals": 1
      },
      {
        "number": "1",
        "player": "Raúl Rangel",
        "pos": "GK",
        "club": "Guadalajara",
        "clubRaw": "1.mx Guadalajara",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Estado de México, Mexico",
        "birthDate": "2000-02-25",
        "age": "26-106",
        "ageYears": 26,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "15",
        "player": "Israel Reyes",
        "pos": "DF",
        "club": "América",
        "clubRaw": "1.mx América",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Autlán de Navarro, Estado de Jalisco, Mexico",
        "birthDate": "2000-05-23",
        "age": "26-019",
        "ageYears": 26,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Luis Romo",
        "pos": "DF,MF",
        "club": "Guadalajara",
        "clubRaw": "1.mx Guadalajara",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Ahome, Estado de Sinaloa, Mexico",
        "birthDate": "1995-06-05",
        "age": "31-006",
        "ageYears": 31,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "2",
        "player": "Jorge Sánchez",
        "pos": "DF,MF",
        "club": "PAOK",
        "clubRaw": "1.gr PAOK",
        "clubCountry": "Greece",
        "clubCountryCode": "gr",
        "birthPlace": "Torreón, Estado de Coahuila de Zaragoza, Mexico",
        "birthDate": "1997-12-10",
        "age": "28-183",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "18",
        "player": "Obed Vargas",
        "pos": "MF",
        "club": "Atlético Madrid",
        "clubRaw": "1.es Atlético Madrid",
        "clubCountry": "Spain",
        "clubCountryCode": "es",
        "birthPlace": "Anchorage, AK, United States",
        "birthDate": "2005-08-05",
        "age": "20-310",
        "ageYears": 20,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "5",
        "player": "Johan Vásquez",
        "pos": "DF",
        "club": "Genoa",
        "clubRaw": "1.it Genoa",
        "clubCountry": "Italy",
        "clubCountryCode": "it",
        "birthPlace": "Navojoa, Estado de Sonora, Mexico",
        "birthDate": "1998-10-22",
        "age": "27-232",
        "ageYears": 27,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "10",
        "player": "Alexis Vega",
        "pos": "FW,MF",
        "club": "Toluca",
        "clubRaw": "1.mx Toluca",
        "clubCountry": "Mexico",
        "clubCountryCode": "mx",
        "birthPlace": "Cuauhtémoc, Ciudad de México, Mexico",
        "birthDate": "1997-11-25",
        "age": "28-198",
        "ageYears": 28,
        "mp": 1,
        "minutes": 12,
        "goals": 0
      }
    ],
    "standing": {
      "rank": 1,
      "squad": "mx Mexico",
      "mp": 1,
      "wins": 1,
      "draws": 0,
      "losses": 0,
      "gf": 2,
      "ga": 0,
      "gd": "+2",
      "pts": 3,
      "last5": "D W W W W"
    },
    "shooting": {
      "goals": 2,
      "shots": 16,
      "shotsOnTarget": 4,
      "shotAccuracy": 25,
      "shotsPer90": 16,
      "shotsOnTargetPer90": 4
    },
    "activeShooters": [
      "Jesús Gallardo (2 تسديدات)",
      "Israel Reyes (1 تسديدات)",
      "Julián Quiñones (5 تسديدات)",
      "Raúl Jiménez (4 تسديدات)",
      "Brian Gutiérrez (4 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Raúl Rangel",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 0,
      "ga90": 0,
      "shotsOnTargetAgainst": 2,
      "saves": 2,
      "savePercentage": 100,
      "cleanSheets": 1,
      "cleanSheetPercentage": 100
    },
    "misc": {
      "yellowCards": 1,
      "redCards": 1,
      "secondYellows": 0,
      "fouls": 12,
      "fouled": 11,
      "offsides": 1,
      "crosses": 12,
      "interceptions": 8,
      "tacklesWon": 6,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "4-1-4-1"
      ],
      "averagePossession": 61
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 27.5,
      "topClubs": [
        "Guadalajara (5)",
        "Toluca (2)",
        "AEK Athens (1)",
        "AEL Limassol (1)",
        "AZ Alkmaar (1)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Julián Quiñones (1)",
        "Raúl Jiménez (1)"
      ],
      "assisters": [
        "Roberto Alvarado (1)",
        "Erik Lira (1)"
      ],
      "minutesLeaders": [
        "Roberto Alvarado (90 دقيقة)",
        "Jesús Gallardo (90 دقيقة)",
        "Raúl Rangel (90 دقيقة)",
        "Israel Reyes (90 دقيقة)",
        "Johan Vásquez (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-11",
        "time": "13:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "W",
        "gf": "2",
        "ga": "0",
        "opponent": "za South Africa",
        "possession": 61,
        "attendance": 80824,
        "captain": "César Montes",
        "formation": "4-1-4-1",
        "opponentFormation": "5-3-2",
        "referee": "Wilton Sampaio",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "19:00 (04:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "kr Korea Republic",
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
        "time": "19:00 (04:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "cz Czechia",
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
    "team": "Korea Republic",
    "teamCode": "KOR",
    "teamCodes": [
      "KOR",
      "KR",
      "KOREA REPUBLIC",
      "SOUTH KOREA"
    ],
    "sourceUrl": "https://fbref.com/en/squads/473f0fbf/2026/c1/Korea-Republic-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "12",
        "player": "Song Bum-keun",
        "pos": "GK",
        "club": "Jeonbuk Hyundai",
        "clubRaw": "1.kr Jeonbuk Hyundai",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Seongnam-si, Korea Republic",
        "birthDate": "1997-10-15",
        "age": "28-239",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "23",
        "player": "Jens Castrop",
        "pos": "MF",
        "club": "Gladbach",
        "clubRaw": "1.de Gladbach",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Düsseldorf, Germany",
        "birthDate": "2003-07-29",
        "age": "22-317",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "26",
        "player": "Lee Dong-gyeong",
        "pos": "FW,MF",
        "club": "Ulsan HD",
        "clubRaw": "1.kr Ulsan HD",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Korea Republic",
        "birthDate": "1997-09-20",
        "age": "28-264",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "3",
        "player": "Lee Gi-hyuk",
        "pos": "DF",
        "club": "Gangwon FC",
        "clubRaw": "1.kr Gangwon FC",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Seoul, Korea Republic",
        "birthDate": "2000-07-07",
        "age": "25-339",
        "ageYears": 25,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "9",
        "player": "Cho Gue-sung",
        "pos": "FW",
        "club": "Midtjylland",
        "clubRaw": "1.dk Midtjylland",
        "clubCountry": "Denmark",
        "clubCountryCode": "dk",
        "birthPlace": "Ansan-si, Korea Republic",
        "birthDate": "1998-01-25",
        "age": "28-137",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "2",
        "player": "Lee Han-beom",
        "pos": "DF",
        "club": "Midtjylland",
        "clubRaw": "1.dk Midtjylland",
        "clubCountry": "Denmark",
        "clubCountryCode": "dk",
        "birthPlace": "Korea Republic",
        "birthDate": "2002-06-17",
        "age": "23-359",
        "ageYears": 23,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "11",
        "player": "Hwang Hee-chan",
        "pos": "FW,MF",
        "club": "Wolves",
        "clubRaw": "1.eng Wolves",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Chuncheon, Korea Republic",
        "birthDate": "1996-01-26",
        "age": "30-136",
        "ageYears": 30,
        "mp": 1,
        "minutes": 29,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Son Heung-min",
        "pos": "FW",
        "club": "LAFC",
        "clubRaw": "1.us LAFC",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "Chuncheon, Korea Republic",
        "birthDate": "1992-07-08",
        "age": "33-338",
        "ageYears": 33,
        "mp": 1,
        "minutes": 68,
        "goals": 0
      },
      {
        "number": "18",
        "player": "Oh Hyeon-gyu",
        "pos": "FW",
        "club": "Beşiktaş",
        "clubRaw": "1.tr Beşiktaş",
        "clubCountry": "Turkey",
        "clubCountryCode": "tr",
        "birthPlace": "Namyangju-si, Korea Republic",
        "birthDate": "2001-04-12",
        "age": "25-060",
        "ageYears": 25,
        "mp": 1,
        "minutes": 22,
        "goals": 1
      },
      {
        "number": "21",
        "player": "Jo Hyeon-woo",
        "pos": "GK",
        "club": "Ulsan HD",
        "clubRaw": "1.kr Ulsan HD",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Seoul, Korea Republic",
        "birthDate": "1991-09-25",
        "age": "34-259",
        "ageYears": 34,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "20",
        "player": "Yang Hyun-jun",
        "pos": "FW,MF",
        "club": "Celtic",
        "clubRaw": "1.sct Celtic",
        "clubCountry": "Scotland",
        "clubCountryCode": "sct",
        "birthPlace": "Korea Republic",
        "birthDate": "2002-05-25",
        "age": "24-017",
        "ageYears": 24,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "6",
        "player": "Hwang In-beom",
        "pos": "MF",
        "club": "Feyenoord",
        "clubRaw": "1.nl Feyenoord",
        "clubCountry": "Netherlands",
        "clubCountryCode": "nl",
        "birthPlace": "Korea Republic",
        "birthDate": "1996-09-20",
        "age": "29-264",
        "ageYears": 29,
        "mp": 1,
        "minutes": 83,
        "goals": 1
      },
      {
        "number": "10",
        "player": "Lee Jae-sung",
        "pos": "FW",
        "club": "Mainz 05",
        "clubRaw": "1.de Mainz 05",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Korea Republic",
        "birthDate": "1992-08-10",
        "age": "33-305",
        "ageYears": 33,
        "mp": 1,
        "minutes": 61,
        "goals": 0
      },
      {
        "number": "25",
        "player": "Eom Ji-sung",
        "pos": "MF",
        "club": "Swansea City",
        "clubRaw": "2.eng Swansea City",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Kimje, Korea Republic",
        "birthDate": "2002-05-09",
        "age": "24-033",
        "ageYears": 24,
        "mp": 1,
        "minutes": 22,
        "goals": 0
      },
      {
        "number": "24",
        "player": "Kim Jin-gyu",
        "pos": "MF",
        "club": "Jeonbuk Hyundai",
        "clubRaw": "1.kr Jeonbuk Hyundai",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Korea Republic",
        "birthDate": "1997-02-24",
        "age": "29-107",
        "ageYears": 29,
        "mp": 1,
        "minutes": 7,
        "goals": 0
      },
      {
        "number": "16",
        "player": "Park Jinseob",
        "pos": "DF,MF",
        "club": "Zhejiang",
        "clubRaw": "1.cn Zhejiang",
        "clubCountry": "China",
        "clubCountryCode": "cn",
        "birthPlace": "Jeonju, Korea Republic",
        "birthDate": "1995-10-23",
        "age": "30-231",
        "ageYears": 30,
        "mp": 1,
        "minutes": 7,
        "goals": 0
      },
      {
        "number": "17",
        "player": "Bae Jun-ho",
        "pos": "FW,MF",
        "club": "Stoke City",
        "clubRaw": "2.eng Stoke City",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Korea Republic",
        "birthDate": "2003-08-21",
        "age": "22-294",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "19",
        "player": "Lee Kang-in",
        "pos": "FW",
        "club": "Paris Saint-Germain",
        "clubRaw": "1.fr Paris Saint-Germain",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Korea Republic",
        "birthDate": "2001-02-19",
        "age": "25-112",
        "ageYears": 25,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "4",
        "player": "Kim Min-jae",
        "pos": "DF",
        "club": "Bayern Munich",
        "clubRaw": "1.de Bayern Munich",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Tongyeong, Korea Republic",
        "birthDate": "1996-11-15",
        "age": "29-208",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "15",
        "player": "Kim Moon-hwan",
        "pos": "DF,MF",
        "club": "Daejeon Hana",
        "clubRaw": "1.kr Daejeon Hana",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Hwaseong-si, Korea Republic",
        "birthDate": "1995-08-01",
        "age": "30-314",
        "ageYears": 30,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "1",
        "player": "Kim Seung-gyu",
        "pos": "GK",
        "club": "FC Tokyo",
        "clubRaw": "1.jp FC Tokyo",
        "clubCountry": "Japan",
        "clubCountryCode": "jp",
        "birthPlace": "Korea Republic",
        "birthDate": "1990-09-30",
        "age": "35-254",
        "ageYears": 35,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "8",
        "player": "Paik Seung-ho",
        "pos": "MF",
        "club": "Birmingham City",
        "clubRaw": "2.eng Birmingham City",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Seoul, Korea Republic",
        "birthDate": "1997-03-17",
        "age": "29-086",
        "ageYears": 29,
        "mp": 1,
        "minutes": 83,
        "goals": 0
      },
      {
        "number": "5",
        "player": "Kim Tae-hyeon",
        "pos": "DF",
        "club": "Kashima Antlers",
        "clubRaw": "1.jp Kashima Antlers",
        "clubCountry": "Japan",
        "clubCountryCode": "jp",
        "birthPlace": "Gimpo-si, Korea Republic",
        "birthDate": "2000-09-17",
        "age": "25-267",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "13",
        "player": "Lee Tae-seok",
        "pos": "MF",
        "club": "Austria Wien",
        "clubRaw": "1.at Austria Wien",
        "clubCountry": "Austria",
        "clubCountryCode": "at",
        "birthPlace": "Korea Republic",
        "birthDate": "2002-07-28",
        "age": "23-318",
        "ageYears": 23,
        "mp": 1,
        "minutes": 68,
        "goals": 0
      },
      {
        "number": "14",
        "player": "Cho Wi-je",
        "pos": "DF",
        "club": "Jeonbuk Hyundai",
        "clubRaw": "1.kr Jeonbuk Hyundai",
        "clubCountry": "Korea Republic",
        "clubCountryCode": "kr",
        "birthPlace": "Korea Republic",
        "birthDate": "2001-08-25",
        "age": "24-290",
        "ageYears": 24,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "22",
        "player": "Seol Young-woo",
        "pos": "MF",
        "club": "Red Star",
        "clubRaw": "1.rs Red Star",
        "clubCountry": "Serbia",
        "clubCountryCode": "rs",
        "birthPlace": "Korea Republic",
        "birthDate": "1998-12-05",
        "age": "27-188",
        "ageYears": 27,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": null,
        "player": "Cho Yumin",
        "pos": "DF",
        "club": "Al-Sharjah SCC",
        "clubRaw": "1.ae Al-Sharjah SCC",
        "clubCountry": "United Arab Emirates",
        "clubCountryCode": "ae",
        "birthPlace": "Korea Republic",
        "birthDate": "1996-11-17",
        "age": "29-206",
        "ageYears": 29,
        "mp": null,
        "minutes": null,
        "goals": null
      }
    ],
    "standing": {
      "rank": 2,
      "squad": "kr Korea Republic",
      "mp": 1,
      "wins": 1,
      "draws": 0,
      "losses": 0,
      "gf": 2,
      "ga": 1,
      "gd": "+1",
      "pts": 3,
      "last5": "L L W W W"
    },
    "shooting": {
      "goals": 2,
      "shots": 15,
      "shotsOnTarget": 6,
      "shotAccuracy": 40,
      "shotsPer90": 15,
      "shotsOnTargetPer90": 6
    },
    "activeShooters": [
      "Lee Han-beom (1 تسديدات)",
      "Lee Kang-in (4 تسديدات)",
      "Hwang In-beom (1 تسديدات)",
      "Son Heung-min (3 تسديدات)",
      "Lee Tae-seok (1 تسديدات)",
      "Lee Jae-sung (1 تسديدات)",
      "Oh Hyeon-gyu (3 تسديدات)",
      "Eom Ji-sung (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Kim Seung-gyu",
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
      "fouls": 9,
      "fouled": 16,
      "offsides": 2,
      "crosses": 12,
      "interceptions": 11,
      "tacklesWon": 4,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "3-4-3"
      ],
      "averagePossession": 62
    },
    "rosterSummary": {
      "count": 27,
      "averageAge": 27.5,
      "topClubs": [
        "Jeonbuk Hyundai (3)",
        "Midtjylland (2)",
        "Ulsan HD (2)",
        "Al-Sharjah SCC (1)",
        "Austria Wien (1)"
      ]
    },
    "standard": {
      "usedPlayers": 16,
      "scorers": [
        "Hwang In-beom (1)",
        "Oh Hyeon-gyu (1)"
      ],
      "assisters": [
        "Lee Kang-in (1)",
        "Hwang In-beom (1)"
      ],
      "minutesLeaders": [
        "Lee Gi-hyuk (90 دقيقة)",
        "Lee Han-beom (90 دقيقة)",
        "Lee Kang-in (90 دقيقة)",
        "Kim Min-jae (90 دقيقة)",
        "Kim Seung-gyu (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-11",
        "time": "20:00 (05:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "W",
        "gf": "2",
        "ga": "1",
        "opponent": "cz Czechia",
        "possession": 62,
        "attendance": 44985,
        "captain": "Son Heung-min",
        "formation": "3-4-3",
        "opponentFormation": "3-4-3",
        "referee": "Amin Omar",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "19:00 (04:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "mx Mexico",
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
        "time": "19:00 (04:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "za South Africa",
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
    "team": "Czechia",
    "teamCode": "CZE",
    "teamCodes": [
      "CZE",
      "CZ",
      "CZECHIA",
      "CZECH REPUBLIC"
    ],
    "sourceUrl": "https://fbref.com/en/squads/2740937c/2026/c1/Czechia-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "12",
        "player": "Lukáš Červ",
        "pos": "MF",
        "club": "Viktoria Plzeň",
        "clubRaw": "1.cz Viktoria Plzeň",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Czech Republic",
        "birthDate": "2001-04-10",
        "age": "25-062",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "6",
        "player": "Štěpán Chaloupek",
        "pos": "DF",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Meziboři, Czech Republic",
        "birthDate": "2003-03-08",
        "age": "23-095",
        "ageYears": 23,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "19",
        "player": "Tomáš Chorý",
        "pos": "FW",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Olomouc, Czech Republic",
        "birthDate": "1995-01-26",
        "age": "31-136",
        "ageYears": 31,
        "mp": 1,
        "minutes": 27,
        "goals": 0
      },
      {
        "number": "13",
        "player": "Mojmír Chytil",
        "pos": "FW",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Czech Republic",
        "birthDate": "1999-04-29",
        "age": "27-043",
        "ageYears": 27,
        "mp": 1,
        "minutes": 7,
        "goals": 0
      },
      {
        "number": "5",
        "player": "Vladimír Coufal",
        "pos": "MF",
        "club": "Hoffenheim",
        "clubRaw": "1.de Hoffenheim",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Liberec, Czech Republic",
        "birthDate": "1992-08-22",
        "age": "33-293",
        "ageYears": 33,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "8",
        "player": "Vladimír Darida",
        "pos": "MF",
        "club": "Hradec Králové",
        "clubRaw": "1.cz Hradec Králové",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Sokolov, Czech Republic",
        "birthDate": "1990-08-08",
        "age": "35-307",
        "ageYears": 35,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "21",
        "player": "David Doudera",
        "pos": "DF,MF",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Czech Republic",
        "birthDate": "1998-05-31",
        "age": "28-011",
        "ageYears": 28,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "9",
        "player": "Adam Hložek",
        "pos": "FW,MF",
        "club": "Hoffenheim",
        "clubRaw": "1.de Hoffenheim",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Ivančice, Czech Republic",
        "birthDate": "2002-07-25",
        "age": "23-321",
        "ageYears": 23,
        "mp": 1,
        "minutes": 27,
        "goals": 0
      },
      {
        "number": "3",
        "player": "Tomáš Holeš",
        "pos": "DF,MF",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Polička, Czech Republic",
        "birthDate": "1993-03-31",
        "age": "33-072",
        "ageYears": 33,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "23",
        "player": "Lukáš Horníček",
        "pos": "GK",
        "club": "Braga",
        "clubRaw": "1.pt Braga",
        "clubCountry": "Portugal",
        "clubCountryCode": "pt",
        "birthPlace": "Vysoké Mýto, Czech Republic",
        "birthDate": "2002-07-13",
        "age": "23-333",
        "ageYears": 23,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "4",
        "player": "Robin Hranáč",
        "pos": "DF",
        "club": "Hoffenheim",
        "clubRaw": "1.de Hoffenheim",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Czech Republic",
        "birthDate": "2000-01-29",
        "age": "26-133",
        "ageYears": 26,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "14",
        "player": "David Jurásek",
        "pos": "DF,MF",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Czech Republic",
        "birthDate": "2000-08-07",
        "age": "25-308",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "1",
        "player": "Matej Kovar",
        "pos": "GK",
        "club": "PSV",
        "clubRaw": "1.nl PSV",
        "clubCountry": "Netherlands",
        "clubCountryCode": "nl",
        "birthPlace": "Uherské Hradiště, Czech Republic",
        "birthDate": "2000-05-17",
        "age": "26-025",
        "ageYears": 26,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Ladislav Krejčí",
        "pos": "DF",
        "club": "Wolves",
        "clubRaw": "1.eng Wolves",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Praha, Czech Republic",
        "birthDate": "1999-04-20",
        "age": "27-052",
        "ageYears": 27,
        "mp": 1,
        "minutes": 90,
        "goals": 1
      },
      {
        "number": "11",
        "player": "Jan Kuchta",
        "pos": "FW",
        "club": "Sparta Prague",
        "clubRaw": "1.cz Sparta Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Liberec, Czech Republic",
        "birthDate": "1997-01-08",
        "age": "29-154",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "17",
        "player": "Lukáš Provod",
        "pos": "FW",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Pilsen, Czech Republic",
        "birthDate": "1996-10-23",
        "age": "29-231",
        "ageYears": 29,
        "mp": 1,
        "minutes": 63,
        "goals": 0
      },
      {
        "number": "18",
        "player": "Michal Sadílek",
        "pos": "DF,FW",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Uherské Hradiště, Czech Republic",
        "birthDate": "1999-05-31",
        "age": "27-011",
        "ageYears": 27,
        "mp": 1,
        "minutes": 27,
        "goals": 0
      },
      {
        "number": "10",
        "player": "Patrik Schick",
        "pos": "FW",
        "club": "Leverkusen",
        "clubRaw": "1.de Leverkusen",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "Prague, Czech Republic",
        "birthDate": "1996-01-24",
        "age": "30-138",
        "ageYears": 30,
        "mp": 1,
        "minutes": 63,
        "goals": 0
      },
      {
        "number": "25",
        "player": "Hugo Sochůrek",
        "pos": "MF",
        "club": "Sparta Prague",
        "clubRaw": "1.cz Sparta Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Czech Republic",
        "birthDate": "2008-06-07",
        "age": "18-004",
        "ageYears": 18,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "24",
        "player": "Alexandr Sojka",
        "pos": "MF",
        "club": "Viktoria Plzeň",
        "clubRaw": "1.cz Viktoria Plzeň",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Pilsen, Czech Republic",
        "birthDate": "2003-04-02",
        "age": "23-070",
        "ageYears": 23,
        "mp": 1,
        "minutes": 83,
        "goals": 0
      },
      {
        "number": "22",
        "player": "Tomáš Souček",
        "pos": "MF",
        "club": "West Ham United",
        "clubRaw": "1.eng West Ham United",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Havlíčkův Brod, Czech Republic",
        "birthDate": "1995-02-27",
        "age": "31-104",
        "ageYears": 31,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "16",
        "player": "Jindřich Staněk",
        "pos": "GK",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Strakonice, Czech Republic",
        "birthDate": "1996-04-27",
        "age": "30-045",
        "ageYears": 30,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "15",
        "player": "Pavel Šulc",
        "pos": "FW",
        "club": "Lyon",
        "clubRaw": "1.fr Lyon",
        "clubCountry": "France",
        "clubCountryCode": "fr",
        "birthPlace": "Czech Republic",
        "birthDate": "2000-12-29",
        "age": "25-164",
        "ageYears": 25,
        "mp": 1,
        "minutes": 63,
        "goals": 0
      },
      {
        "number": "26",
        "player": "Denis Višinský",
        "pos": "FW,MF",
        "club": "Viktoria Plzeň",
        "clubRaw": "1.cz Viktoria Plzeň",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Czech Republic",
        "birthDate": "2003-03-21",
        "age": "23-082",
        "ageYears": 23,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "20",
        "player": "Jaroslav Zelený",
        "pos": "MF",
        "club": "Sparta Prague",
        "clubRaw": "1.cz Sparta Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Hradec Králové, Czech Republic",
        "birthDate": "1992-08-20",
        "age": "33-295",
        "ageYears": 33,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "2",
        "player": "David Zima",
        "pos": "DF",
        "club": "Slavia Prague",
        "clubRaw": "1.cz Slavia Prague",
        "clubCountry": "Czech Republic",
        "clubCountryCode": "cz",
        "birthPlace": "Olomouc, Czech Republic",
        "birthDate": "2000-11-08",
        "age": "25-215",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      }
    ],
    "standing": {
      "rank": 3,
      "squad": "cz Czechia",
      "mp": 1,
      "wins": 0,
      "draws": 0,
      "losses": 1,
      "gf": 1,
      "ga": 2,
      "gd": "-1",
      "pts": 0,
      "last5": "D D W W L"
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
      "Ladislav Krejčí (1 تسديدات)",
      "Tomáš Souček (1 تسديدات)",
      "Alexandr Sojka (1 تسديدات)",
      "Lukáš Provod (2 تسديدات)",
      "Tomáš Chorý (1 تسديدات)",
      "Michal Sadílek (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Matej Kovar",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 2,
      "ga90": 2,
      "shotsOnTargetAgainst": 6,
      "saves": 4,
      "savePercentage": 66.7,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0
    },
    "misc": {
      "yellowCards": 0,
      "redCards": 0,
      "secondYellows": 0,
      "fouls": 16,
      "fouled": 9,
      "offsides": 2,
      "crosses": 15,
      "interceptions": 7,
      "tacklesWon": 7,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "3-4-3"
      ],
      "averagePossession": 38
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 27.2,
      "topClubs": [
        "Slavia Prague (10)",
        "Hoffenheim (3)",
        "Sparta Prague (3)",
        "Viktoria Plzeň (3)",
        "Braga (1)"
      ]
    },
    "standard": {
      "usedPlayers": 15,
      "scorers": [
        "Ladislav Krejčí (1)"
      ],
      "assisters": [
        "Vladimír Coufal (1)"
      ],
      "minutesLeaders": [
        "Štěpán Chaloupek (90 دقيقة)",
        "Vladimír Coufal (90 دقيقة)",
        "Robin Hranáč (90 دقيقة)",
        "Matej Kovar (90 دقيقة)",
        "Ladislav Krejčí (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-11",
        "time": "20:00 (05:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "L",
        "gf": "1",
        "ga": "2",
        "opponent": "kr Korea Republic",
        "possession": 38,
        "attendance": 44985,
        "captain": "Ladislav Krejčí",
        "formation": "3-4-3",
        "opponentFormation": "3-4-3",
        "referee": "Amin Omar",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "12:00 (19:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "za South Africa",
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
        "time": "19:00 (04:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "mx Mexico",
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
    "team": "South Africa",
    "teamCode": "RSA",
    "teamCodes": [
      "RSA",
      "ZAF",
      "SOUTH AFRICA"
    ],
    "sourceUrl": "https://fbref.com/en/squads/506f1741/2026/c1/South-Africa-Men-Stats-World-Cup",
    "roster": [
      {
        "number": "23",
        "player": "Jayden Adams",
        "pos": "MF",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Cape Town, South Africa",
        "birthDate": "2001-05-05",
        "age": "25-037",
        "ageYears": 25,
        "mp": 1,
        "minutes": 60,
        "goals": 0
      },
      {
        "number": "7",
        "player": "Oswin Appollis",
        "pos": "MF",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Bishop Lavis, South Africa",
        "birthDate": "2001-08-25",
        "age": "24-290",
        "ageYears": 24,
        "mp": 1,
        "minutes": 14,
        "goals": 0
      },
      {
        "number": "16",
        "player": "Sipho Chaine",
        "pos": "GK",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "1996-12-14",
        "age": "29-179",
        "ageYears": 29,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "26",
        "player": "Bradley Cross",
        "pos": "DF",
        "club": "Kaizer Chiefs",
        "clubRaw": "1.za Kaizer Chiefs",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Kempton Park, South Africa",
        "birthDate": "2001-01-30",
        "age": "25-132",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "9",
        "player": "Lyle Foster",
        "pos": "FW",
        "club": "Burnley",
        "clubRaw": "1.eng Burnley",
        "clubCountry": "England",
        "clubCountryCode": "eng",
        "birthPlace": "Carletonville, South Africa",
        "birthDate": "2000-09-03",
        "age": "25-281",
        "ageYears": 25,
        "mp": 1,
        "minutes": 55,
        "goals": 0
      },
      {
        "number": "22",
        "player": "Ricardo Goss",
        "pos": "GK",
        "club": "Siwelele",
        "clubRaw": "1.za Siwelele",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Durban, South Africa",
        "birthDate": "1994-04-02",
        "age": "32-070",
        "ageYears": 32,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "18",
        "player": "Samukele Kabini",
        "pos": "DF",
        "club": "Molde",
        "clubRaw": "1.no Molde",
        "clubCountry": "Norway",
        "clubCountryCode": "no",
        "birthPlace": "South Africa",
        "birthDate": "2004-03-15",
        "age": "22-088",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "17",
        "player": "Evidence Makgopa",
        "pos": "FW",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "2000-06-05",
        "age": "26-006",
        "ageYears": 26,
        "mp": 1,
        "minutes": 15,
        "goals": 0
      },
      {
        "number": "24",
        "player": "Olwethu Makhanya",
        "pos": "DF",
        "club": "Philadelphia Union",
        "clubRaw": "1.us Philadelphia Union",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "2004-04-30",
        "age": "22-042",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "12",
        "player": "Thapelo Maseko",
        "pos": "MF",
        "club": "AEL Limassol",
        "clubRaw": "1.cy AEL Limassol",
        "clubCountry": "Cyprus",
        "clubCountryCode": "cy",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "2003-11-11",
        "age": "22-212",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "2",
        "player": "Thabang Matuludi",
        "pos": "DF",
        "club": "Polokwane City",
        "clubRaw": "1.za Polokwane City",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa",
        "birthDate": "1999-01-14",
        "age": "27-148",
        "ageYears": 27,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "5",
        "player": "Thalente Mbatha",
        "pos": "MF",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "2000-03-16",
        "age": "26-087",
        "ageYears": 26,
        "mp": 1,
        "minutes": 35,
        "goals": 0
      },
      {
        "number": "14",
        "player": "Mbekezeli Mbokazi",
        "pos": "DF",
        "club": "Chicago Fire",
        "clubRaw": "1.us Chicago Fire",
        "clubCountry": "United States",
        "clubCountryCode": "us",
        "birthPlace": "South Africa",
        "birthDate": "2005-09-19",
        "age": "20-265",
        "ageYears": 20,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "6",
        "player": "Aubrey Modiba",
        "pos": "DF",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Polokwane, South Africa",
        "birthDate": "1995-07-22",
        "age": "30-324",
        "ageYears": 30,
        "mp": 1,
        "minutes": 76,
        "goals": 0
      },
      {
        "number": "10",
        "player": "Relebohile Mofokeng",
        "pos": "MF",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa",
        "birthDate": "2004-10-23",
        "age": "21-231",
        "ageYears": 21,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "4",
        "player": "Teboho Mokoena",
        "pos": "MF",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Bethlehem, South Africa",
        "birthDate": "1997-01-24",
        "age": "29-138",
        "ageYears": 29,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "8",
        "player": "Tshepang Moremi",
        "pos": "MF",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "2000-10-02",
        "age": "25-252",
        "ageYears": 25,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "20",
        "player": "Khuliso Mudau",
        "pos": "DF",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "1995-04-26",
        "age": "31-046",
        "ageYears": 31,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "3",
        "player": "Khulumani Ndamane",
        "pos": "DF",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa",
        "birthDate": "2004-02-05",
        "age": "22-126",
        "ageYears": 22,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "21",
        "player": "Ime Okon",
        "pos": "DF",
        "club": "Hannover 96",
        "clubRaw": "2.de Hannover 96",
        "clubCountry": "Germany",
        "clubCountryCode": "de",
        "birthPlace": "South Africa",
        "birthDate": "2004-02-20",
        "age": "22-111",
        "ageYears": 22,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "15",
        "player": "Iqraam Rayners",
        "pos": "FW",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "1995-12-19",
        "age": "30-174",
        "ageYears": 30,
        "mp": 1,
        "minutes": 75,
        "goals": 0
      },
      {
        "number": "25",
        "player": "Kamogelo Sebelebele",
        "pos": "DF,MF",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "2002-07-21",
        "age": "23-325",
        "ageYears": 23,
        "mp": 0,
        "minutes": null,
        "goals": null
      },
      {
        "number": "19",
        "player": "Nkosinathi Sibisi",
        "pos": "DF",
        "club": "Orlando Pirates",
        "clubRaw": "1.za Orlando Pirates",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "1995-09-22",
        "age": "30-262",
        "ageYears": 30,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "13",
        "player": "Sphephelo Sithole",
        "pos": "MF",
        "club": "Tondela",
        "clubRaw": "1.pt Tondela",
        "clubCountry": "Portugal",
        "clubCountryCode": "pt",
        "birthPlace": "South Africa, South Africa",
        "birthDate": "1999-03-03",
        "age": "27-100",
        "ageYears": 27,
        "mp": 1,
        "minutes": 49,
        "goals": 0
      },
      {
        "number": "1",
        "player": "Ronwen Williams",
        "pos": "GK",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Gqeberha, South Africa",
        "birthDate": "1992-01-21",
        "age": "34-141",
        "ageYears": 34,
        "mp": 1,
        "minutes": 90,
        "goals": 0
      },
      {
        "number": "11",
        "player": "Themba Zwane",
        "pos": "FW,MF",
        "club": "Mamelodi Sundowns",
        "clubRaw": "1.za Mamelodi Sundowns",
        "clubCountry": "South Africa",
        "clubCountryCode": "za",
        "birthPlace": "Tembisa, South Africa",
        "birthDate": "1989-08-03",
        "age": "36-312",
        "ageYears": 36,
        "mp": 1,
        "minutes": 23,
        "goals": 0
      }
    ],
    "standing": {
      "rank": 4,
      "squad": "za South Africa",
      "mp": 1,
      "wins": 0,
      "draws": 0,
      "losses": 1,
      "gf": 0,
      "ga": 2,
      "gd": "-2",
      "pts": 0,
      "last5": "L D L D L"
    },
    "shooting": {
      "goals": 0,
      "shots": 3,
      "shotsOnTarget": 2,
      "shotAccuracy": 66.7,
      "shotsPer90": 3,
      "shotsOnTargetPer90": 2
    },
    "activeShooters": [
      "Mbekezeli Mbokazi (1 تسديدات)",
      "Aubrey Modiba (1 تسديدات)",
      "Iqraam Rayners (1 تسديدات)"
    ],
    "goalkeeping": {
      "goalkeeper": "Ronwen Williams",
      "mp": 1,
      "starts": 1,
      "minutes": 90,
      "goalsAgainst": 2,
      "ga90": 2,
      "shotsOnTargetAgainst": 4,
      "saves": 2,
      "savePercentage": 50,
      "cleanSheets": 0,
      "cleanSheetPercentage": 0
    },
    "misc": {
      "yellowCards": 2,
      "redCards": 2,
      "secondYellows": 0,
      "fouls": 11,
      "fouled": 11,
      "offsides": 1,
      "crosses": 8,
      "interceptions": 7,
      "tacklesWon": 7,
      "ownGoals": 0
    },
    "matchContext": {
      "completedCount": 1,
      "upcomingCount": 2,
      "formations": [
        "5-3-2"
      ],
      "averagePossession": 40
    },
    "rosterSummary": {
      "count": 26,
      "averageAge": 26.3,
      "topClubs": [
        "Mamelodi Sundowns (8)",
        "Orlando Pirates (8)",
        "AEL Limassol (1)",
        "Burnley (1)",
        "Chicago Fire (1)"
      ]
    },
    "standard": {
      "usedPlayers": 15,
      "scorers": [],
      "assisters": [],
      "minutesLeaders": [
        "Mbekezeli Mbokazi (90 دقيقة)",
        "Teboho Mokoena (90 دقيقة)",
        "Khuliso Mudau (90 دقيقة)",
        "Ime Okon (90 دقيقة)",
        "Nkosinathi Sibisi (90 دقيقة)"
      ]
    },
    "worldCupMatches": [
      {
        "date": "2026-06-11",
        "time": "13:00 (22:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "L",
        "gf": "0",
        "ga": "2",
        "opponent": "mx Mexico",
        "possession": 40,
        "attendance": 80824,
        "captain": "Ronwen Williams",
        "formation": "5-3-2",
        "opponentFormation": "4-1-4-1",
        "referee": "Wilton Sampaio",
        "notes": ""
      },
      {
        "date": "2026-06-18",
        "time": "12:00 (19:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "cz Czechia",
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
        "time": "19:00 (04:00)",
        "competition": "World Cup",
        "round": "Group stage",
        "venue": "Neutral",
        "result": "",
        "gf": "",
        "ga": "",
        "opponent": "kr Korea Republic",
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
] satisfies GroupAFbrefTeamStats[];

export function findGroupAFbrefStats(identifier?: string | null) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (!normalized) return null;

  return groupAFbrefStats.find((stats) => (
    stats.teamCode.toLowerCase() === normalized ||
    stats.team.toLowerCase() === normalized ||
    stats.teamCodes.some((code) => code.toLowerCase() === normalized)
  )) || null;
}

export function toTeamFBRefStats(stats: GroupAFbrefTeamStats) {
  return {
    available: true,
    exportedAt: '2026-06-15T00:00:00.000Z',
    sourceUrl: stats.sourceUrl,
    standing: {
      group: 'A',
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

export async function seedGroupAFbrefReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
  });

  for (const stats of groupAFbrefStats) {
    const team = teams.find((candidate) => (
      stats.teamCodes.some((code) => String(candidate.code || '').toLowerCase() === code.toLowerCase()) ||
      String(candidate.name || '').toLowerCase() === stats.team.toLowerCase()
    ));

    if (!team) {
      skipped++;
      missingTeams.push(stats.teamCodes.join('/'));
      continue;
    }

    const normalized = normalizeTeamReportBody({
      teamName: team.name,
      title: `FBref Snapshot — ${displayTeam(stats)} — World Cup 2026`,
      summary: buildSummary(stats),
      body: buildReportBody(stats),
      sourceName: 'FBref copied source text — 2026 World Cup',
      sourceUrl: stats.sourceUrl,
    });

    const metrics: Prisma.InputJsonValue = {
      model: 'fbref-copy-source-group-a-v1',
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
        title: `FBref Snapshot — ${displayTeam(stats)} — World Cup 2026`,
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
        title: `FBref Snapshot — ${displayTeam(stats)} — World Cup 2026`,
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
        tacticalTags: ['FBref', 'World Cup 2026', 'Group A', 'copied-source', 'normalized-card-format'],
        strengths: buildStrengths(stats),
        weaknesses: buildWeaknesses(stats),
        lastCheckedAt: new Date(),
        publishedAt: new Date(),
      },
    });

    created++;
  }

  return { created, skipped, missingTeams, total: groupAFbrefStats.length };
}
