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

type ChecklistItem = { key: string; label: string; ok: boolean; hint: string };

const SOURCE_POLICY = [
  { group: 'مصادر أساسية للنشر', value: 'TheStatsAPI / API-Football / iSports / FIFA / FotMob / SofaScore', publishable: true },
  { group: 'مصادر مراجعة بعد المباراة', value: 'FBref / FIFA / FotMob / SofaScore', publishable: true },
  { group: 'ملاحظات المشغّل', value: 'MatchOperatorNote', publishable: false },
];

const SOURCE_ACTIONS = [
  { key: 'refresh_console', label: 'Refresh Source Feed', description: 'إعادة تحميل أحداث وإحصائيات المصادر المحفوظة في قاعدة البيانات.', safe: true },
  { key: 'the_stats_events', label: 'Import TheStatsAPI Events', description: 'استخدم route الاستيراد الآمن الموجود لجلب أحداث TheStatsAPI إلى MatchEvent، مع الحفاظ على الملاحظات منفصلة.', safe: true, route: '/api/admin/the-stats-import-match-events' },
  { key: 'live_stats', label: 'Refresh Live Stats', description: 'تحديث آخر Snapshot بعد تشغيل مزود live stats أو cron خارجي.', safe: true },
  { key: 'post_match_review', label: 'Import Post-Match Stats', description: 'إضافة Snapshot مراجعة من FBref/FIFA/FotMob/SofaScore داخل Stats Review فقط.', safe: true },
];

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
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchDataAuditLog" ("id" TEXT PRIMARY KEY,"matchId" TEXT,"action" TEXT NOT NULL,"actorEmail" TEXT,"detail" TEXT,"payload" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchDataAuditLog_matchId_createdAt_idx" ON "MatchDataAuditLog" ("matchId", "createdAt")');
  await ensureStatsTable();
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchDigest" ("id" TEXT PRIMARY KEY,"matchId" TEXT NOT NULL UNIQUE,"matchTitle" TEXT NOT NULL,"scoreLine" TEXT NOT NULL,"statusLabel" TEXT NOT NULL,"summary" TEXT NOT NULL,"turningPoint" TEXT,"videoScript" TEXT NOT NULL,"facebookPost" TEXT,"infographicPoints" JSONB,"status" TEXT NOT NULL DEFAULT 'published',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "MatchDigest_matchId_idx" ON "MatchDigest" ("matchId")');
}

async function logAudit(session: AdminSession, action: string, matchId?: string | null, detail?: string, payload?: unknown) {
  await ensureConsoleTables();
  await prisma.$executeRawUnsafe(`INSERT INTO "MatchDataAuditLog" ("id","matchId","action","actorEmail","detail","payload","createdAt") VALUES ($1,$2,$3,$4,$5,$6::jsonb,CURRENT_TIMESTAMP)`, randomUUID(), matchId || null, action, session?.user?.email || null, detail || null, JSON.stringify(payload || {}));
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
    sourceName: raw.sourceName || raw.providerName || row.provider, sourceUrl: raw.sourceUrl || raw.url || null, reviewNote: raw.reviewNote || null,
    xgHome: xg?.home ?? xg?.local ?? null, xgAway: xg?.away ?? xg?.visitor ?? null,
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

function buildChecklist(match: any, snapshot: any, events: ConsoleEvent[]): ChecklistItem[] {
  const sourceNames = [snapshot?.sourceName || snapshot?.provider, ...events.map((event) => event.sourceName)].filter(Boolean);
  const hasScore = snapshot?.homeScore !== null && snapshot?.homeScore !== undefined && snapshot?.awayScore !== null && snapshot?.awayScore !== undefined;
  const hasStats = Boolean(snapshot && ['homePossession', 'homeShots', 'homeShotsOnTarget', 'homeDangerousAttacks'].some((key) => snapshot[key] !== null && snapshot[key] !== undefined));
  return [
    { key: 'source_events', label: 'يوجد مصدر للأحداث', ok: events.length > 0, hint: events.length ? `${events.length} حدث من المصادر` : 'لا توجد أحداث مصدرية محفوظة' },
    { key: 'source_stats', label: 'يوجد مصدر للإحصائيات', ok: hasStats, hint: hasStats ? `آخر مصدر: ${snapshot?.sourceName || snapshot?.provider || 'غير محدد'}` : 'لا توجد Snapshot إحصائية كافية' },
    { key: 'score', label: 'النتيجة مؤكدة', ok: hasScore, hint: `النتيجة الحالية: ${scoreLine(match, snapshot)}` },
    { key: 'sources', label: 'يوجد اسم مصدر أو رابط', ok: sourceNames.length > 0, hint: sourceNames.length ? Array.from(new Set(sourceNames.map(String))).join('، ') : 'غير متوفر في المصادر' },
    { key: 'operator_notes_excluded', label: 'ملاحظات المشغّل غير داخلة في النشر', ok: true, hint: 'Operator Notes تبقى منفصلة عن MatchEvent' },
    { key: 'missing_numbers_policy', label: 'سياسة الأرقام الناقصة', ok: true, hint: 'أي رقم غير موجود يظهر كـ غير متوفر بدل اختراعه' },
  ];
}

function metricValue(snapshot: any, homeKey: string, awayKey: string) {
  const home = snapshot?.[homeKey]; const away = snapshot?.[awayKey];
  return home === null || home === undefined || away === null || away === undefined ? null : `${home} - ${away}`;
}

function buildStatsComparison(history: any[]) {
  const metrics = [
    { key: 'score', label: 'النتيجة', homeKey: 'homeScore', awayKey: 'awayScore' },
    { key: 'possession', label: 'الاستحواذ', homeKey: 'homePossession', awayKey: 'awayPossession' },
    { key: 'shots', label: 'التسديدات', homeKey: 'homeShots', awayKey: 'awayShots' },
    { key: 'on_target', label: 'على المرمى', homeKey: 'homeShotsOnTarget', awayKey: 'awayShotsOnTarget' },
    { key: 'danger', label: 'هجمات خطيرة', homeKey: 'homeDangerousAttacks', awayKey: 'awayDangerousAttacks' },
    { key: 'corners', label: 'ركنيات', homeKey: 'homeCorners', awayKey: 'awayCorners' },
    { key: 'cards', label: 'إنذارات', homeKey: 'homeYellowCards', awayKey: 'awayYellowCards' },
  ];
  const publicHistory = history.map(publicSnapshot).filter(Boolean) as any[];
  return metrics.map((metric) => {
    const values = publicHistory.map((snapshot) => ({ provider: snapshot.provider, sourceName: snapshot.sourceName || snapshot.provider, value: metricValue(snapshot, metric.homeKey, metric.awayKey), capturedAt: snapshot.capturedAt })).filter((item) => item.value);
    return { ...metric, values, recommended: values[0]?.value || null, status: values.length > 1 ? 'compare' : values.length === 1 ? 'single-source' : 'missing' };
  });
}

function buildInfographicExport(match: any, snapshot: any, events: ConsoleEvent[], history: any[]) {
  const sourceNames = Array.from(new Set([snapshot?.sourceName || snapshot?.provider, ...events.map((event) => event.sourceName)].filter(Boolean).map(String)));
  return {
    matchId: match.id,
    match: matchTitle(match),
    teams: { home: teamName(match.homeTeam, 'الفريق الأول'), away: teamName(match.awayTeam, 'الفريق الثاني') },
    score: scoreLine(match, snapshot),
    status: match.status || 'غير محدد',
    top_events: events.slice(0, 8).map((event) => ({ minute: event.minute, type: event.type, label: eventTypeLabel(event.type), team: eventSide(event, match), player: event.playerName || null, detail: event.detail, source: event.sourceName || 'API' })),
    stats: {
      possession: metricValue(snapshot, 'homePossession', 'awayPossession'), shots: metricValue(snapshot, 'homeShots', 'awayShots'), shots_on_target: metricValue(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget'),
      dangerous_attacks: metricValue(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks'), corners: metricValue(snapshot, 'homeCorners', 'awayCorners'), xg: snapshot?.xgHome !== null && snapshot?.xgHome !== undefined ? `${snapshot.xgHome} - ${snapshot.xgAway}` : null,
    },
    sources: sourceNames.length ? sourceNames : ['غير متوفر في المصادر'],
    snapshots_count: history.length,
    operator_notes_policy: 'excluded_from_publishable_data',
  };
}

function buildBroadcastDigest(match: any, snapshot: any, events: ConsoleEvent[]) {
  const homeName = teamName(match.homeTeam, 'الفريق الأول');
  const awayName = teamName(match.awayTeam, 'الفريق الثاني');
  const title = matchTitle(match);
  const score = scoreLine(match, snapshot);
  const importantEvents = [...events].filter((event) => event.minute !== null && event.minute !== undefined).sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0)).slice(0, 12);
  const stats = [statLine(snapshot, 'homePossession', 'awayPossession', 'الاستحواذ', homeName, awayName), statLine(snapshot, 'homeShots', 'awayShots', 'التسديدات', homeName, awayName), statLine(snapshot, 'homeShotsOnTarget', 'awayShotsOnTarget', 'على المرمى', homeName, awayName), statLine(snapshot, 'homeDangerousAttacks', 'awayDangerousAttacks', 'الهجمات الخطيرة', homeName, awayName), statLine(snapshot, 'homeCorners', 'awayCorners', 'الركنيات', homeName, awayName)].filter(Boolean) as string[];
  const eventLines = importantEvents.length ? importantEvents.map((event) => `د${ar(event.minute)}: ${eventTypeLabel(event.type)} - ${eventSide(event, match)}${event.playerName ? ` (${event.playerName})` : ''}. ${event.detail}`) : ['الأحداث التفصيلية غير كافية حتى الآن، لذلك يعتمد النص على النتيجة والإحصائيات المحفوظة من المصادر.'];
  const sourceNames = Array.from(new Set([snapshot?.sourceName || snapshot?.provider, ...events.map((event) => event.sourceName)].filter(Boolean).map(String)));
  const sourceLine = sourceNames.length ? `مصادر المراجعة: ${sourceNames.join('، ')}.` : 'مصادر المراجعة: غير متوفر في المصادر.';
  const latestMinute = snapshot?.minute ? `حتى الدقيقة ${ar(snapshot.minute)}` : 'بعد آخر تحديث محفوظ';
  const summary = [`ملخص ${title}: النتيجة الحالية/النهائية ${score}، والقراءة مبنية على أحداث وإحصائيات المصادر المتصلة بقاعدة البيانات.`, stats.length ? `أبرز الأرقام: ${stats.join(' | ')}.` : 'الأرقام التفصيلية غير مكتملة حاليًا.', importantEvents[0] ? `نقطة البداية المهمة جاءت مع حدث الدقيقة ${ar(importantEvents[0].minute)}: ${importantEvents[0].detail}` : 'لا توجد نقطة تحول مؤكدة في أحداث المصادر حتى الآن.'].join('\n');
  const liveScript = [`تحديث مباشر من مباراة ${title}. [BREAK 1s]`, `النتيجة الآن ${score}، والقراءة ${latestMinute}. [BREAK 1s]`, ...eventLines.slice(0, 5).map((line) => `${line} [BREAK 1s]`), stats.length ? `رقم سريع: ${stats[0]}. [BREAK 1s]` : 'الأرقام التفصيلية غير متوفرة في المصادر حتى الآن. [BREAK 1s]', sourceLine].join('\n\n');
  const youtubeScript = [`أهلًا بكم في تحليل مباراة ${title}. [BREAK 1s]`, `النتيجة ${score}. التحليل هنا مبني على بيانات المصادر وليس على ملاحظات يدوية. [BREAK 1s]`, 'أولًا، تسلسل الأحداث المؤثرة:', ...eventLines.map((line) => `${line} [BREAK 1s]`), stats.length ? `ثانيًا، قراءة الأرقام: ${stats.join('، ')}. [BREAK 1s]` : 'ثانيًا، لا توجد أرقام كافية في المصادر، لذلك سنلتزم بما هو متاح فقط. [BREAK 1s]', 'تكتيكيًا، راقب جودة التحول بعد فقدان الكرة، وسرعة الوصول للثلث الأخير. [BREAK 1s]', sourceLine].join('\n\n');
  const tiktokScript = [`${title} في دقيقة واحدة. [BREAK 0.5s]`, `النتيجة ${score}. [BREAK 0.5s]`, importantEvents[0] ? `أهم لقطة: د${ar(importantEvents[0].minute)} ${importantEvents[0].detail}. [BREAK 0.5s]` : 'أهم لقطة غير متوفرة في أحداث المصادر. [BREAK 0.5s]', stats[0] ? `أهم رقم: ${stats[0]}. [BREAK 0.5s]` : 'الأرقام التفصيلية غير متوفرة بعد. [BREAK 0.5s]', 'تابع التحليل الكامل بعد المباراة.'].join('\n\n');
  const facebookPost = [`⚽ ${title}`, `النتيجة: ${score}`, importantEvents[0] ? `أهم لقطة: د${ar(importantEvents[0].minute)} - ${importantEvents[0].detail}` : 'أهم لقطة: غير متوفر في أحداث المصادر', stats.length ? `رقم سريع: ${stats[0]}` : 'الأرقام التفصيلية غير مكتملة بعد.', 'ما تقييمك للمباراة؟'].join('\n');
  const infographicPoints = [`النتيجة: ${score}`, snapshot?.minute ? `آخر دقيقة محفوظة: ${ar(snapshot.minute)}` : 'آخر دقيقة محفوظة: غير متوفر', stats[0] || 'الاستحواذ: غير متوفر', stats[1] || 'التسديدات: غير متوفر', importantEvents[0] ? `أبرز حدث: د${ar(importantEvents[0].minute)} ${importantEvents[0].detail}` : 'أبرز حدث: غير متوفر'];
  return { matchId: match.id, matchTitle: title, scoreLine: score, statusLabel: match.status || 'غير محدد', summary, turningPoint: importantEvents[0]?.detail || null, videoScript: youtubeScript, liveScript, youtubeScript, tiktokScript, facebookPost, infographicPoints, status: 'draft' };
}

async function loadMatchBundle(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
  if (!match) return null;
  const latest = await getLatestSnapshot(match.id);
  const events = await prisma.matchEvent.findMany({ where: { matchId: match.id }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 150 });
  const history = await getSnapshotHistory(match.id, 40);
  return { match, latest, events, history };
}

async function loadOperatorNotes(matchId: string) { return prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchOperatorNote" WHERE "matchId" = ${quoteSql(matchId)} ORDER BY COALESCE("minute", 999), "createdAt" ASC LIMIT 120`); }
async function loadAuditLogs(matchId: string) { return prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchDataAuditLog" WHERE "matchId" = ${quoteSql(matchId)} OR "matchId" IS NULL ORDER BY "createdAt" DESC LIMIT 60`); }

async function loadConsole(matchId?: string | null) {
  await ensureConsoleTables();
  const matches = await prisma.match.findMany({ include: { homeTeam: true, awayTeam: true }, orderBy: { matchDate: 'desc' }, take: 160 });
  const selectedMatchId = matchId || matches[0]?.id || '';
  const selectedMatch = selectedMatchId ? await prisma.match.findUnique({ where: { id: selectedMatchId }, include: { homeTeam: true, awayTeam: true } }) : null;
  const events = selectedMatchId ? await prisma.matchEvent.findMany({ where: { matchId: selectedMatchId }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 150 }) : [];
  const operatorNotes = selectedMatchId ? await loadOperatorNotes(selectedMatchId) : [];
  const latest = selectedMatchId ? await getLatestSnapshot(selectedMatchId) : null;
  const latestSnapshot = publicSnapshot(latest);
  const history = selectedMatchId ? await getSnapshotHistory(selectedMatchId, 40) : [];
  const digests = selectedMatchId ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MatchDigest" WHERE "matchId" = ${quoteSql(selectedMatchId)} LIMIT 1`) : [];
  const auditLogs = selectedMatchId ? await loadAuditLogs(selectedMatchId) : [];
  return { matches, selectedMatchId, match: selectedMatch, events, operatorNotes, latestSnapshot, snapshotHistory: history.map(publicSnapshot), existingDigest: digests[0] || null, sourcePolicy: SOURCE_POLICY, sourceActions: SOURCE_ACTIONS, articleChecklist: selectedMatch ? buildChecklist(selectedMatch, latestSnapshot, events as ConsoleEvent[]) : [], statsComparison: buildStatsComparison(history), infographicExport: selectedMatch ? buildInfographicExport(selectedMatch, latestSnapshot, events as ConsoleEvent[], history) : null, auditLogs };
}

async function saveOperatorNote(session: AdminSession, body: any) {
  const matchId = clean(body.matchId);
  const detail = clean(body.detail);
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  if (detail.length < 4) return NextResponse.json({ ok: false, error: 'الملاحظة قصيرة جدًا' }, { status: 400 });
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
  await prisma.$executeRawUnsafe(`INSERT INTO "MatchOperatorNote" ("id","matchId","minute","noteType","teamId","playerName","detail","sourceName","sourceUrl","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, randomUUID(), matchId, integerOrNull(body.minute, 0, 130), clean(body.type || 'operator_note'), textOrNull(body.teamId), textOrNull(body.playerName), detail, textOrNull(body.sourceName) || 'ملاحظة مشغل جانبية', textOrNull(body.sourceUrl));
  await logAudit(session, 'save_operator_note', matchId, 'حفظ ملاحظة جانبية للمراجعة', { type: body.type, minute: body.minute });
  return NextResponse.json({ ok: true, data: await loadConsole(matchId) }, { headers: { 'Cache-Control': 'no-store' } });
}

async function deleteOperatorNote(session: AdminSession, body: any) {
  const id = clean(body.id); const matchId = clean(body.matchId);
  if (!id || !matchId) return NextResponse.json({ ok: false, error: 'id and matchId are required' }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM "MatchOperatorNote" WHERE "id" = ${quoteSql(id)} AND "matchId" = ${quoteSql(matchId)}`);
  await logAudit(session, 'delete_operator_note', matchId, 'حذف ملاحظة جانبية', { id });
  return NextResponse.json({ ok: true, data: await loadConsole(matchId) }, { headers: { 'Cache-Control': 'no-store' } });
}

async function saveReviewedSourceSnapshot(session: AdminSession, body: any) {
  const matchId = clean(body.matchId);
  if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, animationMatchId: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
  const provider = clean(body.provider || 'SOURCE_REVIEW').slice(0, 40).toUpperCase().replace(/\s+/g, '_');
  const providerMatchId = integerOrNull(body.providerMatchId) || match.animationMatchId || Math.floor(Date.now() / 1000);
  const rawData = { sourceName: textOrNull(body.sourceName) || provider, sourceUrl: textOrNull(body.sourceUrl), reviewNote: textOrNull(body.reviewNote), xg: { home: numberOrNull(body.xgHome, 0), away: numberOrNull(body.xgAway, 0) }, savedBy: 'match-data-console-source-review' };
  await prisma.matchStatsSnapshot.create({ data: { id: randomUUID(), matchId, provider, providerMatchId, minute: integerOrNull(body.minute, 0, 130), homePossession: integerOrNull(body.homePossession, 0, 100), awayPossession: integerOrNull(body.awayPossession, 0, 100), homeAttacks: integerOrNull(body.homeAttacks, 0), awayAttacks: integerOrNull(body.awayAttacks, 0), homeDangerousAttacks: integerOrNull(body.homeDangerousAttacks, 0), awayDangerousAttacks: integerOrNull(body.awayDangerousAttacks, 0), homeShots: integerOrNull(body.homeShots, 0), awayShots: integerOrNull(body.awayShots, 0), homeShotsOnTarget: integerOrNull(body.homeShotsOnTarget, 0), awayShotsOnTarget: integerOrNull(body.awayShotsOnTarget, 0), homeShotsOffTarget: integerOrNull(body.homeShotsOffTarget, 0), awayShotsOffTarget: integerOrNull(body.awayShotsOffTarget, 0), homeCorners: integerOrNull(body.homeCorners, 0), awayCorners: integerOrNull(body.awayCorners, 0), homeYellowCards: integerOrNull(body.homeYellowCards, 0), awayYellowCards: integerOrNull(body.awayYellowCards, 0), homeRedCards: integerOrNull(body.homeRedCards, 0), awayRedCards: integerOrNull(body.awayRedCards, 0), homeScore: integerOrNull(body.homeScore, 0), awayScore: integerOrNull(body.awayScore, 0), rawData } });
  await logAudit(session, 'save_stats_snapshot', matchId, 'حفظ Snapshot مراجعة من مصدر خارجي', { provider, sourceUrl: rawData.sourceUrl });
  return NextResponse.json({ ok: true, data: await loadConsole(matchId) }, { headers: { 'Cache-Control': 'no-store' } });
}

async function recordSourceAction(session: AdminSession, body: any) {
  const matchId = clean(body.matchId);
  const sourceAction = clean(body.sourceAction || 'refresh_console');
  await logAudit(session, 'source_action', matchId || null, `تشغيل/تسجيل إجراء مصدر: ${sourceAction}`, { sourceAction });
  return NextResponse.json({ ok: true, data: await loadConsole(matchId) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const url = new URL(req.url);
  return NextResponse.json({ ok: true, data: await loadConsole(url.searchParams.get('matchId')) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  const session = guard.session as AdminSession;
  await ensureConsoleTables();
  const body = await req.json().catch(() => ({}));
  const action = clean(body.action);
  if (action === 'save_operator_note') return saveOperatorNote(session, body);
  if (action === 'delete_operator_note') return deleteOperatorNote(session, body);
  if (action === 'save_stats_snapshot') return saveReviewedSourceSnapshot(session, body);
  if (action === 'record_source_action') return recordSourceAction(session, body);
  if (action === 'generate_broadcast') {
    const matchId = clean(body.matchId);
    if (!matchId) return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400 });
    const bundle = await loadMatchBundle(matchId);
    if (!bundle) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    const digest = buildBroadcastDigest(bundle.match, publicSnapshot(bundle.latest), bundle.events as ConsoleEvent[]);
    await logAudit(session, 'generate_broadcast', matchId, 'توليد سكريبتات بث ويوتيوب وتيك توك من بيانات المصادر', { variants: ['live', 'youtube', 'tiktok'] });
    return NextResponse.json({ ok: true, item: digest, checklist: buildChecklist(bundle.match, publicSnapshot(bundle.latest), bundle.events as ConsoleEvent[]), infographicExport: buildInfographicExport(bundle.match, publicSnapshot(bundle.latest), bundle.events as ConsoleEvent[], bundle.history) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (action === 'generate_infographic') {
    const matchId = clean(body.matchId);
    const bundle = await loadMatchBundle(matchId);
    if (!bundle) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    const exportData = buildInfographicExport(bundle.match, publicSnapshot(bundle.latest), bundle.events as ConsoleEvent[], bundle.history);
    await logAudit(session, 'generate_infographic', matchId, 'توليد JSON للإنفوجرافيك من بيانات المصادر', { sources: exportData.sources });
    return NextResponse.json({ ok: true, item: exportData }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
}
