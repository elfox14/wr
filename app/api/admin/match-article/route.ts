import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ensureStatsTable, getLatestSnapshot, getSnapshotHistory, publicSnapshot } from '@/lib/live-match-stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MATCH_CENTER_ANALYSIS_CATEGORY = 'تحليل صفحة المباراة';

const TEAM_AR_NAMES: Record<string, string> = {
  mexico: 'المكسيك',
  'south africa': 'جنوب أفريقيا',
  canada: 'كندا',
  bosnia: 'البوسنة',
  'bosnia and herzegovina': 'البوسنة والهرسك',
  usa: 'الولايات المتحدة',
  'united states': 'الولايات المتحدة',
  paraguay: 'باراغواي',
  qatar: 'قطر',
  switzerland: 'سويسرا',
  brazil: 'البرازيل',
  morocco: 'المغرب',
  scotland: 'اسكتلندا',
  haiti: 'هايتي',
  australia: 'أستراليا',
  turkiye: 'تركيا',
  turkey: 'تركيا',
  germany: 'ألمانيا',
  curacao: 'كوراساو',
  netherlands: 'هولندا',
  japan: 'اليابان',
  'cote divoire': 'كوت ديفوار',
  'côte d’ivoire': 'كوت ديفوار',
  ecuador: 'الإكوادور',
  sweden: 'السويد',
  tunisia: 'تونس',
  spain: 'إسبانيا',
  'cabo verde': 'الرأس الأخضر',
  egypt: 'مصر',
  belgium: 'بلجيكا',
  saudi: 'السعودية',
  'saudi arabia': 'السعودية',
  uruguay: 'أوروغواي',
  iran: 'إيران',
  'new zealand': 'نيوزيلندا',
  france: 'فرنسا',
  senegal: 'السنغال',
  norway: 'النرويج',
  iraq: 'العراق',
  argentina: 'الأرجنتين',
  algeria: 'الجزائر',
  austria: 'النمسا',
  jordan: 'الأردن',
};

type AdminSession = {
  user?: { email?: string | null; role?: string | null };
} | null;

type EventRow = {
  id: string;
  minute?: number | null;
  type: string;
  detail?: string | null;
  playerName?: string | null;
  teamId?: string | null;
  sourceName?: string | null;
  createdAt?: Date | string | null;
};

type ScoreReadout = {
  home: number;
  away: number;
  source: 'match' | 'snapshot' | 'events';
};

type CountPair = {
  home: number;
  away: number;
  total: number;
};

type MatchPhrasing = {
  title: string;
  opening: string;
  winner: string;
  loser: string;
};

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

async function ensurePressNewsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PressNews" (
      "id" TEXT PRIMARY KEY,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'رصد صحفي',
      "sourceName" TEXT NOT NULL,
      "sourceUrl" TEXT,
      "sourceType" TEXT NOT NULL DEFAULT 'newsletter',
      "language" TEXT NOT NULL DEFAULT 'ar',
      "status" TEXT NOT NULL DEFAULT 'published',
      "importance" INTEGER NOT NULL DEFAULT 50,
      "tags" JSONB,
      "relatedTeamId" TEXT,
      "relatedPlayerId" TEXT,
      "relatedMatchId" TEXT,
      "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedTeamId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedPlayerId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "PressNews" ADD COLUMN IF NOT EXISTS "relatedMatchId" TEXT');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_status_publishedAt_idx" ON "PressNews" ("status", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_category_publishedAt_idx" ON "PressNews" ("category", "publishedAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "PressNews_relatedMatchId_idx" ON "PressNews" ("relatedMatchId")');
}

function slugifyArabicSafe(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'match-analysis';
}

function normalizeKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayTeamName(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return 'الفريق';
  return TEAM_AR_NAMES[normalizeKey(raw)] || raw;
}

function teamLabel(value: unknown) {
  const name = displayTeamName(value);
  if (name.startsWith('منتخب ')) return name;
  return `منتخب ${name}`;
}

function n(snapshot: any, key: string) {
  const value = Number(snapshot?.[key]);
  return Number.isFinite(value) ? value : null;
}

function ar(value: unknown) {
  if (value === null || value === undefined || value === '') return 'غير متوفر';
  const num = Number(value);
  if (Number.isFinite(num)) return new Intl.NumberFormat('ar-EG').format(num);
  return String(value);
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function eventTypeLabel(type: string) {
  const value = String(type || '').toLowerCase();
  if (value.includes('goal')) return 'هدف';
  if (value.includes('red')) return 'بطاقة حمراء';
  if (value.includes('yellow')) return 'بطاقة صفراء';
  if (value.includes('penalty')) return 'ركلة جزاء';
  if (value.includes('var')) return 'مراجعة VAR';
  if (value.includes('corner')) return 'ركنية';
  if (value.includes('shot')) return 'تسديدة';
  if (value.includes('danger')) return 'هجمة خطيرة';
  if (value.includes('substitution')) return 'تبديل';
  return type || 'حدث';
}

function sideName(teamId: string | null | undefined, homeTeam: any, awayTeam: any) {
  if (teamId && homeTeam?.id && teamId === homeTeam.id) return teamLabel(homeTeam.name);
  if (teamId && awayTeam?.id && teamId === awayTeam.id) return teamLabel(awayTeam.name);
  return 'أحد الفريقين';
}

function isHomeEvent(event: EventRow, match: any) {
  return Boolean(event.teamId && match.homeTeam?.id && event.teamId === match.homeTeam.id);
}

function isAwayEvent(event: EventRow, match: any) {
  return Boolean(event.teamId && match.awayTeam?.id && event.teamId === match.awayTeam.id);
}

function eventMatches(event: EventRow, includes: string[]) {
  const value = String(event.type || '').toLowerCase();
  return includes.some((item) => value.includes(item));
}

function isArticleEvent(event: EventRow) {
  return eventMatches(event, ['goal', 'red', 'yellow', 'penalty', 'var', 'corner', 'shot_on_target', 'dangerous_attack']);
}

function countEvents(events: EventRow[], match: any, includes: string[]): CountPair {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (!eventMatches(event, includes)) continue;
    if (isHomeEvent(event, match)) home += 1;
    else if (isAwayEvent(event, match)) away += 1;
  }
  return { home, away, total: home + away };
}

function comparisonLine(home: number | null, away: number | null, label: string, homeName: string, awayName: string) {
  if (home === null || away === null) return null;
  if (home === 0 && away === 0) return null;
  if (home === away) return `${label} متقاربة بين الطرفين عند ${ar(home)} لكل فريق.`;
  const homeLeading = home > away;
  const leader = homeLeading ? homeName : awayName;
  const leaderValue = homeLeading ? home : away;
  const otherValue = homeLeading ? away : home;
  return `${leader} يتفوق في ${label} بواقع ${ar(leaderValue)} مقابل ${ar(otherValue)}.`;
}

function disciplineLine(home: number, away: number, label: string, homeName: string, awayName: string) {
  if (home === 0 && away === 0) return null;
  if (home === away) return `${label} متساوية بين الطرفين عند ${ar(home)} لكل فريق.`;
  const homeMore = home > away;
  const team = homeMore ? homeName : awayName;
  const value = homeMore ? home : away;
  const other = homeMore ? away : home;
  return `${team} حصل على عدد أكبر من ${label} بواقع ${ar(value)} مقابل ${ar(other)}.`;
}

function statLine(snapshot: any, homeKey: string, awayKey: string, label: string, homeName: string, awayName: string) {
  return comparisonLine(n(snapshot, homeKey), n(snapshot, awayKey), label, homeName, awayName);
}

function pairLine(home: number, away: number, label: string, homeName: string, awayName: string) {
  return comparisonLine(home, away, label, homeName, awayName);
}

function pickSnapshot(latest: any, history: any[]) {
  const rows = [latest, ...(history || [])].filter(Boolean).map(publicSnapshot).filter(Boolean);
  return rows.find((row) => [
    'homePossession', 'awayPossession', 'homeAttacks', 'awayAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks',
    'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeCorners', 'awayCorners',
  ].some((key) => row?.[key] !== null && row?.[key] !== undefined)) || rows[0] || null;
}

function importantEvents(events: EventRow[]) {
  const withMinute = [...events]
    .filter((event) => event.minute !== null && event.minute !== undefined)
    .sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0));
  const filtered = withMinute.filter(isArticleEvent);
  return (filtered.length ? filtered : withMinute).slice(0, 12);
}

function goals(events: EventRow[]) {
  return importantEvents(events).filter((event) => eventMatches(event, ['goal']));
}

function scoreFromEvents(events: EventRow[], match: any) {
  return countEvents(events, match, ['goal']);
}

function resolveScore(match: any, snapshot: any, events: EventRow[]): ScoreReadout {
  const eventScore = scoreFromEvents(events, match);
  const snapshotHome = n(snapshot, 'homeScore');
  const snapshotAway = n(snapshot, 'awayScore');
  const matchHome = Number(match.homeScore ?? 0);
  const matchAway = Number(match.awayScore ?? 0);

  const snapshotTotal = (snapshotHome ?? 0) + (snapshotAway ?? 0);
  const matchTotal = matchHome + matchAway;

  if (eventScore.total > Math.max(snapshotTotal, matchTotal)) {
    return { home: eventScore.home, away: eventScore.away, source: 'events' };
  }

  if (snapshotHome !== null && snapshotAway !== null && snapshotTotal >= matchTotal) {
    return { home: snapshotHome, away: snapshotAway, source: 'snapshot' };
  }

  return { home: matchHome, away: matchAway, source: 'match' };
}

function bestPlayer(events: EventRow[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const player = cleanText(event.playerName);
    if (!player) continue;
    const type = String(event.type || '').toLowerCase();
    const weight = type.includes('goal') ? 4 : type.includes('shot') ? 2 : type.includes('danger') ? 2 : type.includes('card') ? -1 : 1;
    counts.set(player, (counts.get(player) || 0) + weight);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function usefulDetail(event: EventRow, displayedTeam: string, rawTeam?: string | null) {
  const detail = cleanText(event.detail);
  if (!detail) return '';
  const label = eventTypeLabel(event.type);
  const reduced = detail
    .replace(displayedTeam, '')
    .replace(String(rawTeam || ''), '')
    .replace(label, '')
    .replace(/د\s*\d+\s*'?/g, '')
    .replace(/[\-–—:|.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!reduced || reduced.length < 4) return '';
  if (detail.includes(label) && reduced.length < 12) return '';
  return detail;
}

function winnerPhrase(homeName: string, awayName: string, homeScore: number, awayScore: number, score: string): MatchPhrasing {
  if (homeScore === awayScore) {
    return {
      title: `${homeName} و${awayName} يتعادلان ${score} في مباراة مثيرة بكأس العالم 2026`,
      opening: `انتهت مباراة ${homeName} و${awayName} بالتعادل ${score}، في مواجهة حملت الكثير من التفاصيل بين النتيجة، الإحصائيات، وتسلسل الأحداث داخل صفحة المباراة.`,
      winner: '',
      loser: '',
    };
  }

  const homeWon = homeScore > awayScore;
  const winner = homeWon ? homeName : awayName;
  const loser = homeWon ? awayName : homeName;
  return {
    title: `${winner} يهزم ${loser} بنتيجة ${score} في كأس العالم 2026`,
    opening: `حقق ${winner} فوزًا مهمًا على ${loser} بنتيجة ${score}، في مباراة منحت الفائز دفعة قوية وفتحت باب التحليل حول طريقة الوصول إلى هذه النتيجة.`,
    winner,
    loser,
  };
}

function fallbackStarLine(player: string, firstGoal: EventRow | undefined, phrasing: MatchPhrasing, match: any) {
  if (player) {
    return `نجم المباراة بحسب الأحداث المحفوظة هو ${player}، لأن اسمه ظهر في اللقطات المؤثرة وكان حاضرًا في صناعة الفارق داخل سياق المباراة.`;
  }

  if (firstGoal) {
    return `لقطة المباراة الأهم كانت هدف الدقيقة ${ar(firstGoal.minute)} لصالح ${sideName(firstGoal.teamId, match.homeTeam, match.awayTeam)}، لأنه منح المباراة اتجاهًا واضحًا مبكرًا وغيّر طريقة تعامل المنافس مع بقية اللقاء.`;
  }

  if (phrasing.winner) {
    return `العامل الحاسم في المباراة كان قدرة ${phrasing.winner} على إدارة النتيجة واللحظات المؤثرة، بينما احتاج ${phrasing.loser} إلى فاعلية أكبر في الثلث الأخير.`;
  }

  return 'العامل الحاسم في المباراة كان توازن الطرفين وعدم قدرة أي منتخب على تحويل فترات الضغط إلى فارق واضح في النتيجة.';
}

function buildScoreContext(phrasing: MatchPhrasing, homeName: string, awayName: string, score: string, scoreReadout: ScoreReadout) {
  const sourceNote = scoreReadout.source === 'events'
    ? ' وتعتمد هذه القراءة على أحداث الأهداف المحفوظة في صفحة المباراة.'
    : '';
  if (phrasing.winner) {
    return `${phrasing.opening}${sourceNote} الفوز لا يعكس النتيجة فقط، بل يعكس أيضًا قدرة الفائز على استثمار اللحظات الحاسمة وعدم ترك المباراة تنزلق إلى حالة من الفوضى رغم كثرة البطاقات والاحتكاكات.`;
  }
  return `${phrasing.opening}${sourceNote} التعادل هنا لا يعني غياب التفاصيل، بل يفتح الباب لقراءة أعمق لكيفية توزع السيطرة والضغط بين ${homeName} و${awayName}.`;
}

function buildFlowParagraph(firstGoal: EventRow | undefined, lastEvent: EventRow | undefined, match: any) {
  if (firstGoal) {
    return `نقطة التحول الأولى جاءت عند الدقيقة ${ar(firstGoal.minute)} مع ${eventTypeLabel(firstGoal.type)} لصالح ${sideName(firstGoal.teamId, match.homeTeam, match.awayTeam)}${firstGoal.playerName ? ` عن طريق ${firstGoal.playerName}` : ''}. هذه اللقطة غيّرت إحساس المباراة وفرضت على الطرف الآخر التعامل مع ضغط النتيجة بدل اللعب بأريحية.`;
  }
  if (lastEvent) {
    return `أبرز نقطة تحول متاحة في بيانات المباراة جاءت عند الدقيقة ${ar(lastEvent.minute)} مع ${eventTypeLabel(lastEvent.type)} لصالح ${sideName(lastEvent.teamId, match.homeTeam, match.awayTeam)}، وهي لقطة تساعد في فهم اتجاه الزخم خلال اللقاء.`;
  }
  return 'لم تظهر في البيانات أحداث كافية لتحديد نقطة تحول دقيقة، لكن قراءة النتيجة والإحصائيات تمنح صورة مبدئية عن اتجاه المباراة.';
}

function buildTeamNeedsParagraph(phrasing: MatchPhrasing, homeName: string, awayName: string) {
  if (phrasing.winner) {
    return `${phrasing.winner} يستطيع البناء على هذه المباراة من زاويتين: الفاعلية أمام المرمى، والقدرة على الحفاظ على الأفضلية بعد التقدم. أما ${phrasing.loser}، فيحتاج إلى مراجعة الانضباط الدفاعي وتقليل الأخطاء التي تمنح المنافس فرصة التحكم في إيقاع اللقاء.`;
  }
  return `${homeName} و${awayName} سيخرجان من هذه المواجهة بدروس مختلفة. كل طرف يحتاج إلى تحويل فترات السيطرة إلى فرص أوضح، لأن مباريات كأس العالم غالبًا لا تمنح الكثير من الفرص للتعويض.`;
}

function buildMatchArticle(match: any, snapshot: any, events: EventRow[]) {
  const homeName = teamLabel(match.homeTeam?.name || 'الفريق الأول');
  const awayName = teamLabel(match.awayTeam?.name || 'الفريق الثاني');
  const homePlain = displayTeamName(match.homeTeam?.name || 'الفريق الأول');
  const awayPlain = displayTeamName(match.awayTeam?.name || 'الفريق الثاني');
  const scoreReadout = resolveScore(match, snapshot, events);
  const homeScore = scoreReadout.home;
  const awayScore = scoreReadout.away;
  const score = `${ar(homeScore)}-${ar(awayScore)}`;
  const phrasing = winnerPhrase(homeName, awayName, homeScore, awayScore, score);
  const title = phrasing.title;

  const sortedImportant = importantEvents(events);
  const goalEvents = goals(events);
  const player = bestPlayer(events);
  const firstGoal = goalEvents[0];
  const lastEvent = sortedImportant[sortedImportant.length - 1];
  const corners = countEvents(events, match, ['corner']);
  const yellowCards = countEvents(events, match, ['yellow']);
  const redCards = countEvents(events, match, ['red']);

  const cornerLine = corners.total > 0
    ? pairLine(corners.home, corners.away, 'الركنيات', homeName, awayName)
    : statLine(snapshot, 'homeCorners', 'awayCorners', 'الركنيات', homeName, awayName);

  const cardLines = [
    yellowCards.total > 0 ? disciplineLine(yellowCards.home, yellowCards.away, 'البطاقات الصفراء', homeName, awayName) : null,
    redCards.total > 0 ? disciplineLine(redCards.home, redCards.away, 'البطاقات الحمراء', homeName, awayName) : null,
  ].filter(Boolean);

  const statsLines = [
    statLine(snapshot, 'homePossession', 'awayPossession', 'الاستحواذ', homeName, awayName),
    statLine(snapshot, 'homeAttacks', 'awayAttacks', 'الهجمات', homeName, awayName),
    statLine(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks', 'الهجمات الخطيرة', homeName, awayName),
    statLine(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget', 'التسديدات على المرمى', homeName, awayName) || statLine(snapshot, 'homeShots', 'awayShots', 'إجمالي التسديدات', homeName, awayName),
    cornerLine,
    ...cardLines,
  ].filter(Boolean);

  const eventLines = sortedImportant.length
    ? sortedImportant.map((event) => {
        const team = sideName(event.teamId, match.homeTeam, match.awayTeam);
        const rawTeam = event.teamId === match.homeTeam?.id ? match.homeTeam?.name : event.teamId === match.awayTeam?.id ? match.awayTeam?.name : null;
        const playerText = event.playerName ? ` عن طريق ${event.playerName}` : '';
        const detail = usefulDetail(event, team, rawTeam);
        return `د${ar(event.minute)}: ${eventTypeLabel(event.type)} لصالح ${team}${playerText}${detail ? ` — ${detail}` : ''}.`;
      })
    : ['الأحداث التفصيلية غير كافية حاليًا، لذلك يعتمد التحليل على النتيجة والإحصائيات المتاحة من صفحة المباراة.'];

  const opening = buildScoreContext(phrasing, homeName, awayName, score, scoreReadout);
  const flowParagraph = buildFlowParagraph(firstGoal, lastEvent, match);
  const starLine = fallbackStarLine(player, firstGoal, phrasing, match);
  const teamNeeds = buildTeamNeedsParagraph(phrasing, homeName, awayName);

  const body = [
    opening,
    `بدأت المواجهة بين ${homeName} و${awayName} وسط أهمية واضحة في حسابات كأس العالم 2026. ومع مرور الدقائق، أصبحت النتيجة ${score} عنوانًا رئيسيًا، لكن التفاصيل داخل صفحة المباراة تكشف أن القصة لا تتوقف عند الرقم فقط.`,
    flowParagraph,
    `على مستوى الأحداث، جاءت أبرز اللقطات كالتالي:\n${eventLines.map((line) => `- ${line}`).join('\n')}`,
    statsLines.length
      ? `قراءة الإحصائيات تمنح المقال زاوية حصرية من بيانات المباراة نفسها. ${statsLines.join(' ')}`
      : 'الإحصائيات الرقمية التفصيلية غير مكتملة حاليًا، لذلك تظل القراءة معتمدة على النتيجة وتسلسل الأحداث المتاح.',
    `فنيًا، أظهرت المباراة أن إدارة اللحظات الحاسمة كانت العامل الأهم. الفريق الذي تعامل بشكل أفضل مع التحولات والضغط بعد الأحداث المؤثرة استطاع أن يفرض إيقاعه أو يحافظ على توازنه حتى النهاية.`,
    starLine,
    teamNeeds,
    `تأثير هذه النتيجة لا يقتصر على جدول المباراة فقط، بل يمتد إلى الحالة المعنوية قبل الجولة التالية. مثل هذه المباريات تمنح الجهاز الفني مادة واضحة للمراجعة، سواء في بناء الهجمة أو التعامل مع الكرات الثابتة أو ضبط الانضباط عند ارتفاع التوتر.`,
    `سؤال تفاعلي: من وجهة نظرك، هل كانت النتيجة عادلة بناءً على أحداث المباراة وإحصائياتها؟`,
  ].join('\n\n');

  const keywords = [
    `${homePlain} ${awayPlain}`,
    `${homePlain} ضد ${awayPlain}`,
    `تحليل مباراة ${homePlain} و${awayPlain}`,
    `${homeName} ${awayName}`,
    'كأس العالم 2026',
    'تحليل صفحة المباراة',
    player,
  ].filter(Boolean);

  return { title, body, keywords, score, player };
}

function makeMeta(matchId: string, title: string, keywords: string[], homeTeam: any, awayTeam: any, score: string) {
  return {
    keywords,
    image: `/news-image/match-center-${matchId}`,
    imageAlt: title,
    flagA: homeTeam?.code || '⚽',
    flagB: awayTeam?.code || '⚽',
    score,
    label: 'تحليل صفحة المباراة',
  };
}

async function getMatchAndData(matchId: string) {
  await ensureStatsTable();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!match) return null;

  const latest = await getLatestSnapshot(match.id);
  const history = await getSnapshotHistory(match.id, 80);
  const snapshot = pickSnapshot(latest, history) || { homeScore: match.homeScore || 0, awayScore: match.awayScore || 0 };
  const events = await prisma.matchEvent.findMany({
    where: { matchId: match.id },
    orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
    take: 120,
  });

  return { match, snapshot, events };
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;

  await ensurePressNewsTable();
  const body = await req.json().catch(() => ({}));
  const matchId = String(body.matchId || body.dbMatchId || '').trim();
  const status = String(body.status || 'published').trim();
  const mode = String(body.mode || 'upsert').trim();

  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });

  const data = await getMatchAndData(matchId);
  if (!data) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });

  const { match, snapshot, events } = data;
  const generated = buildMatchArticle(match, snapshot, events as EventRow[]);
  const slug = slugifyArabicSafe(`${match.homeTeam?.name || 'home'}-${match.awayTeam?.name || 'away'}-${match.id}`);
  const id = `match-center-${match.id}-${slug}`.slice(0, 150);
  const sourceUrl = `/match-center/${match.id}`;
  const tags = makeMeta(match.id, generated.title, generated.keywords, match.homeTeam, match.awayTeam, generated.score);
  const publishedAt = new Date();

  if (mode === 'preview') {
    return NextResponse.json({
      ok: true,
      preview: true,
      item: {
        id,
        title: generated.title,
        body: generated.body,
        category: MATCH_CENTER_ANALYSIS_CATEGORY,
        sourceName: 'تحليل صفحة المباراة',
        sourceUrl,
        sourceType: 'match_center',
        language: 'ar',
        status,
        importance: 92,
        tags,
        relatedMatchId: match.id,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PressNews" (
      "id", "title", "body", "category", "sourceName", "sourceUrl", "sourceType", "language", "status", "importance", "tags", "relatedMatchId", "publishedAt", "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "title" = EXCLUDED."title",
      "body" = EXCLUDED."body",
      "category" = EXCLUDED."category",
      "sourceName" = EXCLUDED."sourceName",
      "sourceUrl" = EXCLUDED."sourceUrl",
      "sourceType" = EXCLUDED."sourceType",
      "language" = EXCLUDED."language",
      "status" = EXCLUDED."status",
      "importance" = EXCLUDED."importance",
      "tags" = EXCLUDED."tags",
      "relatedMatchId" = EXCLUDED."relatedMatchId",
      "updatedAt" = CURRENT_TIMESTAMP`,
    id,
    generated.title,
    generated.body,
    MATCH_CENTER_ANALYSIS_CATEGORY,
    'تحليل صفحة المباراة',
    sourceUrl,
    'match_center',
    'ar',
    status,
    92,
    JSON.stringify(tags),
    match.id,
    publishedAt
  );

  const rows = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "PressNews" WHERE "id" = $1 LIMIT 1', id);
  return NextResponse.json({ ok: true, item: rows[0], url: `/news/${id}`, categoryUrl: `/news?category=${encodeURIComponent(MATCH_CENTER_ANALYSIS_CATEGORY)}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
