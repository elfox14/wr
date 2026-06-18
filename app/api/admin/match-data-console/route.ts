import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ensureStatsTable, getLatestSnapshot, getSnapshotHistory } from '@/lib/live-match-stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;
type ConsoleEvent = { id: string; minute?: number | null; type: string; teamId?: string | null; playerName?: string | null; detail: string; sourceName?: string | null; sourceUrl?: string | null };

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = (await getServerSession(authOptions as any)) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdmin(session)) return { error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function quoteSql(value: string) { return `'${String(value).replace(/'/g, "''")}'`; }
function clean(value: unknown) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function textOrNull(value: unknown) { const text = clean(value); return text ? text : null; }
function numberOrNull(value: unknown, min?: number, max?: number) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace('%', '').trim());
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric * 100) / 100;
  if (typeof min === 'number' && rounded < min) return min;
  if (typeof max === 'number' && rounded > max) return max;
  return rounded;
}
function integerOrNull(value: unknown, min?: number, max?: number) { const numeric = numberOrNull(value, min, max); return numeric === null ? null : Math.round(numeric); }

async function ensureConsoleTables() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchOperatorNote" ("id" TEXT PRIMARY KEY,"matchId" TEXT NOT NULL,"minute" INTEGER,"noteType" TEXT NOT NULL DEFAULT 'operator_note',"teamId" TEXT,"playerName" TEXT,"detail" TEXT NOT NULL,"sourceName" TEXT,"sourceUrl" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchOperatorNote_matchId_minute_idx" ON "MatchOperatorNote" ("matchId", "minute")');
  await ensureStatsTable();
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchDigest" ("id" TEXT PRIMARY KEY,"matchId" TEXT NOT NULL UNIQUE,"matchTitle" TEXT NOT NULL,"scoreLine" TEXT NOT NULL,"statusLabel" TEXT NOT NULL,"summary" TEXT NOT NULL,"turningPoint" TEXT,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchDigest_matchId_idx" ON "MatchDigest" ("matchId")');
}

function teamName(team: any, fallback: string) { return team?.name || team?.code || fallback; }
function matchTitle(match: any) { return `${teamName(match?.homeTeam, 'الفريق الأول')} ضد ${teamName(match?.awayTeam, 'الفريق الثاني')}`; }
function ar(value: unknown) { if (value === null || value === undefined || value === '') return 'غير متوفر'; const n = Number(value); return Number.isFinite(n) ? new Intl.NumberFormat('ar-EG').format(n) : String(value); }
function scoreLine(match: any, snapshot?: any) { return `${ar(snapshot?.homeScore ?? match?.homeScore ?? 0)} - ${ar(snapshot?.awayScore ?? match?.awayScore ?? 0)}`; }

function publicSnapshot(row: any) {
  if (!row) return null;
  const raw = row.rawData && typeof row.rawData === 'object' && !Array.isArray(row.rawData) ? row.rawData : {};
  const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  const xg = raw.xg || rawStats.xg || raw.theStatsApi?.stats?.xg || null;
  return {
    id: row.id, matchId: row.matchId, provider: row.provider, providerMatchId: row.providerMatchId, minute: row.minute,
    homePossession: row.homePossession, awayPossession: row.awayPossession, homeAttacks: row.homeAttacks, awayAttacks: row.awayAttacks,
    homeDangerousAttacks: row.homeDangerousAttacks, awayDangerousAttacks: row.awayDangerousAttacks, homeShots: row.homeShots, awayShots: row.awayShots,
    homeShotsOnTarget: row.homeShotsOnTarget, awayShotsOnTarget: row.awayShotsOnTarget, homeShotsOffTarget: row.homeShotsOffTarget, awayShotsOffTarget: row.awayShotsOffTarget,
    homeCorners: row.homeCorners, awayCorners: row.awayCorners, homeYellowCards: row.homeYellowCards, awayYellowCards: row.awayYellowCards, homeRedCards: row.homeRedCards, awayRedCards: row.awayRedCards,
    homeScore: row.homeScore, awayScore: row.awayScore, capturedAt: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : row.capturedAt,
    sourceName: raw.sourceName || raw.providerName || row.provider, sourceUrl: raw.sourceUrl || raw.url || null, xgHome: xg?.home ?? xg?.local ?? null, xgAway: xg?.away ?? xg?.visitor ?? null,
  };
}

function statLine(snapshot: any, homeKey: string, awayKey: string, label: string, homeName: string, awayName: string) {
  const home = snapshot?.[homeKey]; const away = snapshot?.[awayKey];
  if (home === null || home === undefined || away === null || away === undefined) return null;
  return `${label}: ${homeName} ${ar(home)} / ${awayName} ${ar(away)}`;
}

function eventTypeLabel(type: string) {
  const value = String(type || '').toLowerCase();
  if (value.includes('goal')) return 'هدف';
  if (value.includes('yellow')) return 'بطاقة صفراء';
  if (value.includes('red')) return 'بطاقة حمراء';
  if (value.includes('sub')) return 'تبديل';
  if (value.includes('var')) return 'مراجعة VAR';
  if (value.includes('penalty')) return 'ركلة جزاء';
  if (value.includes('corner')) return 'ركنية';
  if (value.includes('shot')) return 'تسديدة';
  if (value.includes('danger')) return 'هجمة خطيرة';
  return 'حدث';
}

function eventSide(event: ConsoleEvent, match: any) {
  if (event.teamId && event.teamId === match?.homeTeamId) return teamName(match?.homeTeam, 'الفريق الأول');
  if (event.teamId && event.teamId === match?.awayTeamId) return teamName(match?.awayTeam, 'الفريق الثاني');
  return 'حدث عام';
}

function buildBroadcastDigest(match: any, snapshot: any, events: ConsoleEvent[]) {
  const homeName = teamName(match.homeTeam, 'الفريق الأول');
  const awayName = teamName(match.awayTeam, 'الفريق الثاني');
  const title = matchTitle(match);
  const score = scoreLine(match, snapshot);
  const importantEvents = [...events].filter((event) => event.minute !== null && event.minute !== undefined).sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0)).slice(0, 12);
  const stats = [
    statLine(snapshot, 'homePossession', 'awayPossession', 'الاستحواذ', homeName, awayName),
    statLine(snapshot, 'homeShots', 'awayShots', 'التسديدات', homeName, awayName),
    statLine(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget', 'على المرمى', homeName, awayName),
    statLine(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks', 'الهجمات الخطيرة', homeName, awayName),
    statLine(snapshot, 'homeCorners', 'awayCorners', 'الركنيات', homeName, awayName),
  ].filter(Boolean) as string[];
  const eventLines = importantEvents.length ? importantEvents.map((event) => `د${ar(event.minute)}: ${eventTypeLabel(event.type)} - ${eventSide(event, match)}${event.playerName ? ` (${event.playerName})` : ''}. ${event.detail}`) : ['الأحداث التفصيلية غير كافية حتى الآن، لذلك يعتمد النص على النتيجة والإحصائيات المحفوظة من المصادر.'];
  const sourceNames = Array.from(new Set([snapshot?.sourceName || snapshot?.provider, ...events.map((event) => event.sourceName)].filter(Boolean).map(String)));
  const sourceLine = sourceNames.length ? `مصادر المراجعة: ${sourceNames.join('، ')}.` : 'مصادر المراجعة: غير متوفر في المصادر.';
  const latestMinute = snapshot?.minute ? `حتى الدقيقة ${ar(snapshot.minute)}` : 'بعد آخر تحديث محفوظ';
  const summary = [`ملخص ${title}: النتيجة الحالية/النهائية ${score}، والقراءة مبنية على أحداث وإحصائيات المصادر المتصلة بقاعدة البيانات.`, stats.length ? `أبرز الأرقام: ${stats.join(' | ')}.` : 'الأرقام التفصيلية غير مكتملة حاليًا.', importantEvents[0] ? `نقطة البداية المهمة جاءت مع حدث الدقيقة ${ar(importantEvents[0].minute)}: ${importantEvents[0].detail}` : 'لا توجد نقطة تحول مؤكدة في أحداث المصادر حتى الآن.'].join('\n');
  const videoScript = [`أهلًا بكم في تحليل سريع لمباراة ${title}. [BREAK 1s]`, `النتيجة الآن ${score}، وهذه قراءة ${latestMinute} اعتمادًا على بيانات المصادر وواجهات الـAPI المحفوظة في قاعدة البيانات. [BREAK 1s]`, 'أولًا، تسلسل الأحداث المهمة:', ...eventLines.map((line) => `${line} [BREAK 1s]`), stats.length ? `ثانيًا، قراءة الأرقام: ${stats.join('، ')}. [BREAK 1s]` : 'ثانيًا، الإحصائيات التفصيلية غير مكتملة، لذلك لا نخترع أرقامًا غير موجودة. [BREAK 1s]', 'تكتيكيًا، ركّز على لحظتين: من كان أكثر قدرة على تحويل الضغط إلى فرص، ومن تعامل أفضل مع التحولات بعد فقدان الكرة. [BREAK 1s]', sourceLine].join('\n\n');
  const infographicPoints = [`النتيجة: ${score}`, snapshot?.minute ? `آخر دقيقة محفوظة: ${ar(snapshot.minute)}` : 'آخر دقيقة محفوظة: غير متوفر', stats[0] || 'الاستحواذ: غير متوفر', stats[1] || 'التسديدات: غير متوفر', importantEvents[0] ? `أبرز حدث: د${ar(importantEvents[0].minute)} ${importantEvents[0].detail}` : 'أبرز حدث: غير متوفر'];
  const facebookPost = [`⚽ ${title}`, `النتيجة: ${score}`, importantEvents[0] ? `أهم لقطة: د${ar(importantEvents[0].minute)} - ${importantEvents[0].detail}` : 'أهم لقطة: غير متوفر في أحداث المصادر', stats.length ? `رقم سريع: ${stats[0]}` : 'الأرقام التفصيلية غير مكتملة بعد.', 'ما تقييمك للمباراة؟'].join('\n');
  return { matchId: match.id, matchTitle: title, scoreLine: score, statusLabel: match.status || 'غير محدد', summary, turningPoint: importantEvents[0]?.detail || null, videoScript, facebookPost, infographicPoints, status: 'draft' };
}

async function loadMatchBundle(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match) return null;
  const latest = await getLatestSnapshot(match.id);
  const events = await prisma.matchEvent.findMany({ where: { matchId: match.id }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 150 });
  return { match, latest, events };
}

async function loadOperatorNotes(matchId: string) {
  return prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchOperatorNote" WHERE "matchId" = ${quoteSql(matchId)} ORDER BY COALESCE("minute", 999), "createdAt" ASC LIMIT 120`);
}

async function loadConsole(matchId?: string | null) {
  await ensureConsoleTables();
  const matches = await prisma.match.findMany({ include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'desc' }, take: 160 });
  const selectedMatchId = matchId || matches[0]?.id || '';
  const selectedMatch = selectedMatchId ? await prisma.match.findUnique({ where: { id: selectedMatchId }, include: { homeTeam: true, awayTeam: true } }) : null;
  const events = selectedMatchId ? await prisma.matchEvent.findMany({ where: { matchId: selectedMatchId }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 150 }) : [];
  const operatorNotes = selectedMatchId ? await loadOperatorNotes(selectedMatchId) : [];
  const latest = selectedMatchId ? await getLatestSnapshot(selectedMatchId) : null;
  const history = selectedMatchId ? await getSnapshotHistory(selectedMatchId, 40) : [];
  const digests = selectedMatchId ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchDigest" WHERE "matchId" = ${quoteSql(selectedMatchId)} LIMIT 1`) : [];
  return { matches, selectedMatchId, match: selectedMatch, events, operatorNotes, latestSnapshot: publicSnapshot(latest), snapshotHistory: history.map(publicSnapshot), existingDigest: digests[0] || null };
}

async function saveOperatorNote(body: any) {
  const matchId = clean(body.matchId);
  const detail = clean(body.detail);
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  if (detail.length < 4) return NextResponse.json({ ok: false, error: 'الملاحظة قصيرة جدًا' }, { status: 400 });
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
  await prisma.$executeRawUnsafe(`INSERT INTO "MatchOperatorNote" ("id","matchId","minute","noteType","teamId","playerName","detail","sourceName","sourceUrl","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), matchId, integerOrNull(body.minute, 0, 130), clean(body.type || 'operator_note'), textOrNull(body.teamId), textOrNull(body.playerName), detail, textOrNull(body.sourceName) || 'ملاحظة مشغل جانبية', textOrNull(body.sourceUrl));
  const data = await loadConsole(matchId);
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

async function deleteOperatorNote(body: any) {
  const id = clean(body.id);
  const matchId = clean(body.matchId);
  if (!id || !matchId) return NextResponse.json({ ok: false, error: 'id and matchId are required' }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM "MatchOperatorNote" WHERE "id" = ${quoteSql(id)} AND "matchId" = ${quoteSql(matchId)}`);
  const data = await loadConsole(matchId);
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

async function saveReviewedSourceSnapshot(body: any) {
  const matchId = clean(body.matchId);
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, animationMatchId: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
  const provider = clean(body.provider || 'MANUAL_REVIEW').slice(0, 40).toUpperCase().replace(/\s+/g, '_');
  const providerMatchId = integerOrNull(body.providerMatchId) || match.animationMatchId || Math.floor(Date.now() / 1000);
  const rawData = { sourceName: textOrNull(body.sourceName) || provider, sourceUrl: textOrNull(body.sourceUrl), reviewNote: textOrNull(body.reviewNote), xg: { home: numberOrNull(body.xgHome, 0), away: numberOrNull(body.xgAway, 0) }, savedBy: 'match-data-console-source-review' };
  await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId, provider, providerMatchId, minute: integerOrNull(body.minute, 0, 130), homePossession: integerOrNull(body.homePossession, 0, 100), awayPossession: integerOrNull(body.awayPossession, 0, 100), homeAttacks: integerOrNull(body.homeAttacks, 0), awayAttacks: integerOrNull(body.awayAttacks, 0), homeDangerousAttacks: integerOrNull(body.homeDangerousAttacks, 0), awayDangerousAttacks: integerOrNull(body.awayDangerousAttacks, 0), homeShots: integerOrNull(body.homeShots, 0), awayShots: integerOrNull(body.awayShots, 0), homeShotsOnTarget: integerOrNull(body.homeShotsOnTarget, 0), awayShotsOnTarget: integerOrNull(body.awayShotsOnTarget, 0), homeShotsOffTarget: integerOrNull(body.homeShotsOffTarget, 0), awayShotsOffTarget: integerOrNull(body.awayShotsOffTarget, 0), homeCorners: integerOrNull(body.homeCorners, 0), awayCorners: integerOrNull(body.awayCorners, 0), homeYellowCards: integerOrNull(body.homeYellowCards, 0), awayYellowCards: integerOrNull(body.awayYellowCards, 0), homeRedCards: integerOrNull(body.homeRedCards, 0), awayRedCards: integerOrNull(body.awayRedCards, 0), homeScore: integerOrNull(body.homeScore, 0), awayScore: integerOrNull(body.awayScore, 0), rawData } });
  const data = await loadConsole(matchId);
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const url = new URL(req.url);
  const data = await loadConsole(url.searchParams.get('matchId'));
  return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  await ensureConsoleTables();
  const body = await req.json().catch(() => ({}));
  const action = clean(body.action);
  if (action === 'save_operator_note') return saveOperatorNote(body);
  if (action === 'delete_operator_note') return deleteOperatorNote(body);
  if (action === 'save_stats_snapshot') return saveReviewedSourceSnapshot(body);
  if (action === 'generate_broadcast') {
    const matchId = clean(body.matchId);
    if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
    const bundle = await loadMatchBundle(matchId);
    if (!bundle) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    const digest = buildBroadcastDigest(bundle.match, publicSnapshot(bundle.latest), bundle.events as ConsoleEvent[]);
    return NextResponse.json({ ok: true, item: digest }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
}
