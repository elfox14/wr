import { randomUUID } from 'crypto';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

const ArticleSchema = z.object({
  title: z.string().min(20).max(140),
  seoTitle: z.string().min(20).max(70),
  metaDescription: z.string().min(80).max(170),
  excerpt: z.string().min(80).max(320),
  sections: z.object({
    matchSummary: z.string().min(250),
    tacticalReading: z.string().min(300),
    statsAnalysis: z.string().min(300),
    turningPoints: z.string().min(60),
    playerAnalysis: z.string().min(40),
    groupImpact: z.string().min(40),
    conclusion: z.string().min(120),
  }),
  referencedPlayers: z.array(z.string()).max(16),
});

type Pair = { home: number | null; away: number | null };
type FactPack = {
  version: '1.0';
  source: { type: 'FINAL_DB_SNAPSHOT'; snapshotId: string; provider: string; capturedAt: string };
  match: { id: string; competition: string; date: string; stage: string | null; group: string | null; homeTeam: string; awayTeam: string; score: Pair };
  stats: Record<string, Pair>;
  derived: Record<string, Pair | number | string>;
  events: Array<{ minute: number | null; type: string; team: string | null; player: string | null; detail: string }>;
  players: Array<Record<string, string | number | boolean | null>>;
  lineups: unknown;
};

function n(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pair(value: any): Pair | null {
  const source = value?.all && typeof value.all === 'object' ? value.all : value;
  if (!source || typeof source !== 'object') return null;
  const home = n(source.home ?? source.home_team ?? source.homeTeam);
  const away = n(source.away ?? source.away_team ?? source.awayTeam);
  return home === null && away === null ? null : { home, away };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function latestVerifiedSnapshot(match: any) {
  return (match.statsSnapshots || []).find((snapshot: any) => {
    const provider = String(snapshot.provider || '').toUpperCase();
    const normalized = snapshot.rawData?.normalized;
    const stats = normalized?.liveStats?.stats || normalized?.stats;
    return provider.includes('THE_STATS') && stats && Object.keys(stats).length > 0;
  }) || null;
}

export function buildMatchFactPack(match: any, snapshot: any): FactPack {
  const normalized = snapshot.rawData?.normalized || {};
  const liveStats = normalized.liveStats?.stats || normalized.stats || {};
  const definitions: Record<string, any> = {
    possession: liveStats.possession || { home: snapshot.homePossession, away: snapshot.awayPossession },
    xg: liveStats.xg,
    npxg: liveStats.npxg,
    shots: liveStats.shots || { home: snapshot.homeShots, away: snapshot.awayShots },
    shotsOnTarget: liveStats.shotsOnTarget || { home: snapshot.homeShotsOnTarget, away: snapshot.awayShotsOnTarget },
    shotsOffTarget: liveStats.shotsOffTarget,
    bigChances: liveStats.bigChances,
    passes: liveStats.passes,
    accuratePasses: liveStats.accuratePasses,
    corners: liveStats.corners || { home: snapshot.homeCorners, away: snapshot.awayCorners },
    fouls: liveStats.fouls,
    offsides: liveStats.offsides,
    yellowCards: liveStats.yellowCards || { home: snapshot.homeYellowCards, away: snapshot.awayYellowCards },
    redCards: liveStats.redCards || { home: snapshot.homeRedCards, away: snapshot.awayRedCards },
    attacks: liveStats.attacks || { home: snapshot.homeAttacks, away: snapshot.awayAttacks },
    dangerousAttacks: liveStats.dangerousAttacks || { home: snapshot.homeDangerousAttacks, away: snapshot.awayDangerousAttacks },
    tackles: liveStats.tackles,
    interceptions: liveStats.interceptions,
    saves: liveStats.saves,
  };
  const stats: Record<string, Pair> = {};
  for (const [key, value] of Object.entries(definitions)) {
    const parsed = pair(value);
    if (parsed) stats[key] = parsed;
  }

  const derived: FactPack['derived'] = {};
  const score = { home: n(match.homeScore), away: n(match.awayScore) };
  if (stats.shots?.home && score.home !== null) derived.conversionRate = { home: Number(((score.home / stats.shots.home) * 100).toFixed(1)), away: stats.shots.away && score.away !== null ? Number(((score.away / stats.shots.away) * 100).toFixed(1)) : null };
  if (stats.shotsOnTarget && stats.shots) derived.shotAccuracy = { home: stats.shots.home ? Number((((stats.shotsOnTarget.home || 0) / stats.shots.home) * 100).toFixed(1)) : null, away: stats.shots.away ? Number((((stats.shotsOnTarget.away || 0) / stats.shots.away) * 100).toFixed(1)) : null };
  if (score.home !== null && score.away !== null) derived.pointsAwarded = score.home === score.away ? 1 : 3;

  const eventRows = array(normalized.eventsDetailed?.all || normalized.events).slice(0, 120);
  const events = eventRows.map((row: any) => ({
    minute: n(row.minute ?? row.elapsed),
    type: clean(row.type || row.event_type) || 'event',
    team: clean(row.teamName || row.team_name || row.team?.name) || null,
    player: clean(row.playerName || row.player_name || row.player?.name) || null,
    detail: clean(row.detail || row.description || row.text) || clean(row.type) || 'حدث',
  }));

  const players = array(normalized.playerStats).slice(0, 60).map((row: any) => {
    const output: Record<string, string | number | boolean | null> = {
      id: clean(row.playerId || row.player_id) || null,
      name: clean(row.playerName || row.player_name || row.player?.name) || null,
      team: clean(row.teamName || row.team_name || row.team?.name) || null,
      position: clean(row.position) || null,
      started: typeof row.started === 'boolean' ? row.started : null,
    };
    for (const key of ['rating', 'minutes', 'goals', 'assists', 'shots', 'shotsOnTarget', 'expectedGoals', 'expectedAssists', 'passes', 'accuratePasses', 'keyPasses', 'tackles', 'interceptions', 'clearances', 'saves', 'touches', 'yellowCards', 'redCards']) {
      const value = n(row[key]);
      if (value !== null) output[key] = value;
    }
    return output;
  }).filter((row: any) => row.name);

  return {
    version: '1.0',
    source: { type: 'FINAL_DB_SNAPSHOT', snapshotId: snapshot.id, provider: snapshot.provider, capturedAt: new Date(snapshot.capturedAt).toISOString() },
    match: {
      id: match.id,
      competition: match.competition || process.env.NEXT_PUBLIC_COMPETITION_NAME || 'كأس العالم 2026',
      date: new Date(match.matchDate).toISOString(),
      stage: match.stage || null,
      group: match.groupPhase || null,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      score,
    },
    stats,
    derived,
    events,
    players,
    lineups: normalized.lineups || null,
  };
}

function collectNumbers(value: unknown, output = new Set<string>()) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    output.add(String(value)); output.add(value.toFixed(1)); output.add(value.toFixed(2));
  } else if (typeof value === 'string' && /^\d+(?:-\d+)+$/.test(value)) value.split('-').forEach((item) => output.add(item));
  else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectNumbers(item, output));
  return output;
}

function westernDigits(value: string) {
  const ar = '٠١٢٣٤٥٦٧٨٩'; const fa = '۰۱۲۳۴۵۶۷۸۹';
  return value.replace(/[٠-٩]/g, (d) => String(ar.indexOf(d))).replace(/[۰-۹]/g, (d) => String(fa.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, '');
}

export function validateGeneratedArticle(article: z.infer<typeof ArticleSchema>, facts: FactPack) {
  const text = westernDigits([article.title, article.seoTitle, article.metaDescription, article.excerpt, ...Object.values(article.sections)].join(' '));
  const allowed = collectNumbers(facts);
  const date = new Date(facts.match.date);
  [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 90, 45].forEach((value) => allowed.add(String(value)));
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) || [];
  const unsupportedNumbers = [...new Set(numbers.filter((raw) => {
    const value = Number(raw.replace(',', '.'));
    return ![...allowed].some((candidate) => Math.abs(Number(candidate) - value) < 0.001);
  }))];
  const allowedPlayers = new Set(facts.players.map((player) => String(player.name)));
  const unknownPlayers = article.referencedPlayers.filter((name) => !allowedPlayers.has(name));
  return { ok: unsupportedNumbers.length === 0 && unknownPlayers.length === 0, unsupportedNumbers, unknownPlayers };
}

function promptFor(facts: FactPack) {
  return `اكتب مقال تحليل كرة قدم عربي احترافي بعد المباراة باستخدام حزمة الحقائق التالية فقط:\n${JSON.stringify(facts)}\n\nقواعد ملزمة:\n- ممنوع اختراع رقم أو اسم لاعب أو دقيقة أو خطة أو حدث.\n- لا تستخدم قيمة غير موجودة في حزمة الحقائق.\n- إذا غابت معلومة فتجاوزها دون تعويضها أو تقديرها.\n- فسّر الأرقام المتاحة ولا تسردها فقط.\n- القراءة التكتيكية يجب أن تستخدم صياغة حذرة عندما لا توجد خطة أو أحداث كافية.\n- إذا لم تتضمن الحزمة ترتيب المجموعة قبل وبعد المباراة، اذكر بوضوح أن أثر النتيجة على الترتيب غير متوفر ولا تستنتجه.\n- إذا لم توجد بيانات لاعبين، اذكر أن التحليل الفردي غير متوفر ولا تخترع أسماء.\n- لا تذكر مراهنات أو احتمالات أو أسعارًا.\n- referencedPlayers يجب أن يحتوي فقط على الأسماء المستخدمة في المقال والموجودة حرفيًا في players.\n- اكتب بلغة عربية صحفية طبيعية، بعناوين قوية غير مضللة، ومن دون Markdown.`;
}

export async function ensureMatchArticleTables() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MatchArticle" ("id" TEXT PRIMARY KEY, "matchId" TEXT NOT NULL, "title" TEXT NOT NULL, "slug" TEXT NOT NULL UNIQUE, "metaTitle" TEXT NOT NULL, "metaDescription" TEXT NOT NULL, "excerpt" TEXT NOT NULL, "body" TEXT NOT NULL, "sections" JSONB, "statsSummary" JSONB, "status" TEXT NOT NULL DEFAULT 'DRAFT_READY', "language" TEXT NOT NULL DEFAULT 'ar', "seoScore" INTEGER NOT NULL DEFAULT 0, "sourceSnapshotId" TEXT, "heroImageUrl" TEXT, "infographicImageUrl" TEXT, "publishedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE("matchId", "language"))`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ArticleGenerationJob" ("id" TEXT PRIMARY KEY, "matchId" TEXT NOT NULL, "articleId" TEXT, "status" TEXT NOT NULL DEFAULT 'STARTED', "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "finishedAt" TIMESTAMPTZ, "errorMessage" TEXT, "sourceSnapshotId" TEXT, "createdBy" TEXT NOT NULL DEFAULT 'verified-match-article-engine')`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EditorialReview" ("id" TEXT PRIMARY KEY, "articleId" TEXT NOT NULL, "reviewer" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "notes" TEXT, "reviewedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}

export async function generateVerifiedMatchArticle(matchId: string) {
  await ensureMatchArticleTables();
  const jobId = randomUUID();
  await prisma.$executeRawUnsafe(`INSERT INTO "ArticleGenerationJob" ("id", "matchId") VALUES ($1,$2)`, jobId, matchId);
  try {
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 24 } } });
    if (!match) throw new Error('MATCH_NOT_FOUND');
    if (!FINISHED.includes(String(match.status || '').toUpperCase())) throw new Error('MATCH_NOT_FINAL');
    const snapshot = latestVerifiedSnapshot(match);
    if (!snapshot) throw new Error('VERIFIED_SNAPSHOT_NOT_FOUND');
    const facts = buildMatchFactPack(match, snapshot);
    if (Object.keys(facts.stats).length < 3) throw new Error('INSUFFICIENT_VERIFIED_STATS');

    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const generated = await generateObject({ model: google(process.env.MATCH_ARTICLE_MODEL || 'gemini-2.5-flash'), schema: ArticleSchema, system: 'أنت محلل ومحرر كرة قدم عربي. الدقة أهم من البلاغة. لا تستخدم إلا الحقائق المرسلة.', prompt: promptFor(facts), temperature: 0.2 });
    const article = generated.object;
    const validation = validateGeneratedArticle(article, facts);
    const status = validation.ok ? 'DRAFT_READY' : 'REVIEW_REQUIRED';
    const articleId = randomUUID();
    const slug = `match-analysis-${match.id}`;
    const body = Object.values(article.sections).join('\n\n');
    await prisma.$executeRawUnsafe(`INSERT INTO "MatchArticle" ("id","matchId","title","slug","metaTitle","metaDescription","excerpt","body","sections","statsSummary","status","language","sourceSnapshotId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,'ar',$12,NOW()) ON CONFLICT ("matchId","language") DO UPDATE SET "title"=EXCLUDED."title","slug"=EXCLUDED."slug","metaTitle"=EXCLUDED."metaTitle","metaDescription"=EXCLUDED."metaDescription","excerpt"=EXCLUDED."excerpt","body"=EXCLUDED."body","sections"=EXCLUDED."sections","statsSummary"=EXCLUDED."statsSummary","status"=EXCLUDED."status","sourceSnapshotId"=EXCLUDED."sourceSnapshotId","publishedAt"=NULL,"updatedAt"=NOW()`, articleId, match.id, article.title, slug, article.seoTitle, article.metaDescription, article.excerpt, body, JSON.stringify({ ...article.sections, referencedPlayers: article.referencedPlayers, validation }), JSON.stringify(facts), status, snapshot.id);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "MatchArticle" WHERE "matchId"=$1 AND "language"='ar' LIMIT 1`, match.id);
    const savedArticleId = rows[0]?.id || articleId;
    await prisma.$executeRawUnsafe(`INSERT INTO "EditorialReview" ("id","articleId","status","notes") VALUES ($1,$2,'PENDING',$3)`, randomUUID(), savedArticleId, validation.ok ? 'مراجعة تحريرية مطلوبة قبل النشر.' : `فشل التحقق: ${JSON.stringify(validation)}`);
    await prisma.$executeRawUnsafe(`UPDATE "ArticleGenerationJob" SET "status"='COMPLETED',"articleId"=$1,"sourceSnapshotId"=$2,"finishedAt"=NOW() WHERE "id"=$3`, savedArticleId, snapshot.id, jobId);
    return { ok: true, articleId: savedArticleId, slug, status, sourceSnapshotId: snapshot.id, validation, factsCount: { stats: Object.keys(facts.stats).length, events: facts.events.length, players: facts.players.length } };
  } catch (error: any) {
    await prisma.$executeRawUnsafe(`UPDATE "ArticleGenerationJob" SET "status"='FAILED',"errorMessage"=$1,"finishedAt"=NOW() WHERE "id"=$2`, String(error?.message || error).slice(0, 1000), jobId).catch(() => undefined);
    throw error;
  }
}
