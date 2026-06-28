import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from '@/lib/post-match-content/schema';
import type {
  MatchAnalysisApiResponse,
  MatchAnalysisEventType,
  MatchAnalysisGeneratedSections,
  MatchAnalysisStats,
  TeamPair,
} from '@/lib/match-analysis/match-analysis.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 60;

const DEFAULT_COMPETITION = 'كأس العالم 2026';
const ARTICLE_INTEGRITY_NOTE =
  'هذا المقال مبني على البيانات المحفوظة في قاعدة البيانات بعد مرحلة التحقق. لا يتم جلب أي بيانات خارجية عند فتح الصفحة.';
const FANTASY_NOTE =
  'جميع الأسعار والمؤشرات داخل المنصة افتراضية وترفيهية فقط، ولا تمثل قيمة مالية أو توصية مالية.';

type RouteContext = {
  params: Promise<{ slug: string }> | { slug: string };
};

type ArticleRow = {
  id: string;
  matchId: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  body: string;
  sections: unknown;
  statsSummary: unknown;
  status: string;
  seoScore: number | null;
  sourceSnapshotId: string | null;
  heroImageUrl: string | null;
  infographicImageUrl: string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string;
  matchDate: Date | string;
  matchStatus: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  groupPhase: string | null;
  stage: string | null;
  competition: string | null;
  homeTeamName: string;
  homeTeamCode: string | null;
  awayTeamName: string;
  awayTeamCode: string | null;
};

type SnapshotRow = Record<string, unknown>;

type EventRow = {
  minute: number | null;
  type: string | null;
  teamId: string | null;
  playerName: string | null;
  detail: string | null;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value: Date | string | null | undefined) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function toUtcLabel(value: Date | string | null | undefined) {
  const date = toDate(value) || new Date();
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function pair(home: unknown, away: unknown): TeamPair<number | null> | undefined {
  const homeValue = numberOrNull(home);
  const awayValue = numberOrNull(away);
  if (homeValue === null && awayValue === null) return undefined;
  return { home: homeValue, away: awayValue };
}

function normalizeSectionKey(value: unknown) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .toUpperCase();
}

function sectionText(sections: unknown, keys: string[], fallback = '') {
  const normalizedKeys = keys.map(normalizeSectionKey);

  const record = asRecord(sections);
  for (const [key, value] of Object.entries(record)) {
    if (normalizedKeys.includes(normalizeSectionKey(key))) {
      if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean).join('\n');
      if (typeof value === 'object') return cleanText(asRecord(value).content || asRecord(value).body || asRecord(value).text, fallback);
      return cleanText(value, fallback);
    }
  }

  for (const section of asArray(sections)) {
    const sectionRecord = asRecord(section);
    const sectionKey = normalizeSectionKey(sectionRecord.type || sectionRecord.key || sectionRecord.heading);
    if (!normalizedKeys.includes(sectionKey)) continue;
    const content = sectionRecord.content ?? sectionRecord.body ?? sectionRecord.text ?? sectionRecord.items;
    if (Array.isArray(content)) return content.map((item) => cleanText(item)).filter(Boolean).join('\n');
    return cleanText(content, fallback);
  }

  return fallback;
}

function twitterThreadFrom(sections: unknown) {
  const record = asRecord(sections);
  const direct = record.twitterThread || record.twitter_thread || record.socialThread || record.social_thread;
  if (Array.isArray(direct)) return direct.map((item) => cleanText(item)).filter(Boolean).slice(0, 5);

  const raw = sectionText(sections, ['SOCIAL_THREAD', 'TWITTER_THREAD', 'twitterThread'], '');
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-•\d/.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function buildGeneratedSections(row: ArticleRow): MatchAnalysisGeneratedSections {
  const sections = row.sections;
  const matchSummary = sectionText(sections, ['SUMMARY', 'MATCH_SUMMARY'], row.excerpt || row.metaDescription || '');
  const tacticalReading = sectionText(sections, ['TACTICAL_ANALYSIS', 'TACTICAL_READING'], '');
  const statsAnalysis = sectionText(sections, ['STATS_ANALYSIS', 'STATISTICS_ANALYSIS'], '');
  const turningPoints = sectionText(sections, ['TURNING_POINTS', 'TURNING_POINT'], '');
  const groupImpactAnalysis = sectionText(sections, ['GROUP_IMPACT', 'GROUP_IMPACT_ANALYSIS'], '');
  const twitterThread = twitterThreadFrom(sections);

  return {
    matchSummary,
    tacticalReading,
    statsAnalysis,
    turningPoints,
    groupImpactAnalysis,
    twitterThreadTitle: twitterThread.length ? 'ثريد تويتر المقترح' : '',
    twitterThread,
    rawSections: sections,
  };
}

function buildStats(snapshot: SnapshotRow | null): MatchAnalysisStats {
  const stats: MatchAnalysisStats = {};
  if (!snapshot) return stats;

  const add = (key: keyof MatchAnalysisStats, home: string, away: string) => {
    const value = pair(snapshot[home], snapshot[away]);
    if (value) stats[key] = value;
  };

  add('possession', 'homePossession', 'awayPossession');
  add('shots', 'homeShots', 'awayShots');
  add('shotsOnTarget', 'homeShotsOnTarget', 'awayShotsOnTarget');
  add('corners', 'homeCorners', 'awayCorners');
  add('yellowCards', 'homeYellowCards', 'awayYellowCards');
  add('redCards', 'homeRedCards', 'awayRedCards');
  add('attacks', 'homeAttacks', 'awayAttacks');
  add('dangerousAttacks', 'homeDangerousAttacks', 'awayDangerousAttacks');

  return stats;
}

function eventTypeFrom(value: unknown): MatchAnalysisEventType {
  const text = String(value || '').toLowerCase();
  if (text.includes('goal')) return 'goal';
  if (text.includes('save')) return 'save';
  if (text.includes('card') || text.includes('yellow') || text.includes('red')) return 'card';
  if (text.includes('sub')) return 'substitution';
  if (text.includes('chance') || text.includes('shot')) return 'chance';
  return 'other';
}

function resultLabel(row: ArticleRow) {
  const home = numberOrNull(row.homeScore);
  const away = numberOrNull(row.awayScore);
  if (home === null || away === null) return `${row.homeTeamName} ضد ${row.awayTeamName}`;
  if (home > away) return `فوز ${row.homeTeamName} على ${row.awayTeamName}`;
  if (away > home) return `فوز ${row.awayTeamName} على ${row.homeTeamName}`;
  return `تعادل ${row.homeTeamName} و${row.awayTeamName}`;
}

function groupImpact(row: ArticleRow) {
  const home = numberOrNull(row.homeScore) ?? 0;
  const away = numberOrNull(row.awayScore) ?? 0;
  const goalDiff = home - away;
  const groupLabel = row.groupPhase ? `المجموعة ${row.groupPhase}` : row.stage || 'مرحلة البطولة';

  return {
    summary: `النتيجة مؤثرة في حسابات ${groupLabel}، خصوصًا مع أهمية النقاط وفارق الأهداف في كأس العالم.`,
    homeTeamEffect: goalDiff > 0 ? `ثلاث نقاط وفارق أهداف +${goalDiff}` : goalDiff < 0 ? `هزيمة وفارق أهداف ${goalDiff}` : 'نقطة واحدة وفارق أهداف 0',
    awayTeamEffect: goalDiff < 0 ? `ثلاث نقاط وفارق أهداف +${Math.abs(goalDiff)}` : goalDiff > 0 ? `هزيمة وفارق أهداف -${goalDiff}` : 'نقطة واحدة وفارق أهداف 0',
  };
}

async function readArticle(slug: string) {
  await ensurePostMatchContentTables();

  const rows = await prisma.$queryRawUnsafe<ArticleRow[]>(
    `SELECT
      a."id", a."matchId", a."title", a."slug", a."metaTitle", a."metaDescription", a."excerpt", a."body",
      a."sections", a."statsSummary", a."status", a."seoScore", a."sourceSnapshotId", a."heroImageUrl",
      a."infographicImageUrl", a."publishedAt", a."updatedAt",
      m."matchDate", m."status" AS "matchStatus", m."homeTeamId", m."awayTeamId", m."homeScore", m."awayScore",
      m."groupPhase", m."stage", m."competition",
      ht."name" AS "homeTeamName", ht."code" AS "homeTeamCode",
      at."name" AS "awayTeamName", at."code" AS "awayTeamCode"
    FROM "MatchArticle" a
    JOIN "Match" m ON m."id" = a."matchId"
    JOIN "Asset" ht ON ht."id" = m."homeTeamId"
    JOIN "Asset" at ON at."id" = m."awayTeamId"
    WHERE a."slug" = $1 AND a."language" = 'ar'
    LIMIT 1`,
    slug,
  );

  return rows[0] || null;
}

async function readSnapshot(row: ArticleRow) {
  const rows = await prisma.$queryRawUnsafe<SnapshotRow[]>(
    `SELECT *
    FROM "MatchStatsSnapshot"
    WHERE "matchId" = $1
    ORDER BY CASE WHEN "id" = $2 THEN 0 ELSE 1 END, "capturedAt" DESC
    LIMIT 1`,
    row.matchId,
    row.sourceSnapshotId || '',
  );
  return rows[0] || null;
}

async function readInfographicUrl(row: ArticleRow) {
  if (row.infographicImageUrl) return row.infographicImageUrl;

  const rows = await prisma.$queryRawUnsafe<Array<{ imageUrl: string }>>(
    `SELECT "imageUrl"
    FROM "MatchInfographic"
    WHERE "articleId" = $1 OR "matchId" = $2
    ORDER BY "createdAt" DESC
    LIMIT 1`,
    row.id,
    row.matchId,
  );

  return rows[0]?.imageUrl || null;
}

async function readKeyMoments(row: ArticleRow) {
  const events = await prisma.$queryRawUnsafe<EventRow[]>(
    `SELECT "minute", "type", "teamId", "playerName", "detail"
    FROM "MatchEvent"
    WHERE "matchId" = $1
    ORDER BY "minute" ASC NULLS LAST, "createdAt" ASC
    LIMIT 8`,
    row.matchId,
  );

  return events.map((event) => {
    const team = event.teamId === row.homeTeamId ? row.homeTeamName : event.teamId === row.awayTeamId ? row.awayTeamName : null;
    const playerPrefix = event.playerName ? `${event.playerName}: ` : '';
    return {
      minute: numberOrNull(event.minute),
      team,
      eventType: eventTypeFrom(event.type),
      impact: cleanText(`${playerPrefix}${event.detail || event.type || 'حدث من أحداث المباراة'}`),
    };
  });
}

function buildPayload(row: ArticleRow, snapshot: SnapshotRow | null, infographicUrl: string | null, keyMoments: Awaited<ReturnType<typeof readKeyMoments>>): MatchAnalysisApiResponse {
  const matchCenterUrl = `/match-center/${row.matchId}`;

  return {
    templateVersion: '1.0',
    articleType: 'match_analysis',
    status: row.status as MatchAnalysisApiResponse['status'],
    metadata: {
      slug: row.slug,
      title: row.title,
      seoTitle: row.metaTitle || row.title,
      seoScore: numberOrNull(row.seoScore),
      summaryLine: row.excerpt || row.metaDescription || '',
      stageLabel: row.matchStatus || 'تحليل بعد تأكيد البيانات',
      dataSource: 'Final DB Snapshot',
      lastUpdatedUtc: toUtcLabel(row.updatedAt),
      canonicalUrl: `/articles/${row.slug}`,
      heroImageUrl: row.heroImageUrl,
    },
    match: {
      id: row.matchId,
      homeTeam: { id: row.homeTeamId, name: row.homeTeamName, code: row.homeTeamCode },
      awayTeam: { id: row.awayTeamId, name: row.awayTeamName, code: row.awayTeamCode },
      competition: row.competition || DEFAULT_COMPETITION,
      matchDate: toIsoDate(row.matchDate),
      groupName: row.groupPhase,
      stage: row.stage,
      score: {
        home: numberOrNull(row.homeScore),
        away: numberOrNull(row.awayScore),
      },
      resultLabel: resultLabel(row),
      matchCenterUrl,
    },
    stats: buildStats(snapshot),
    keyMoments,
    groupImpact: groupImpact(row),
    generatedSections: buildGeneratedSections(row),
    assets: {
      infographicUrl,
      matchCenterUrl,
    },
    disclaimers: {
      articleIntegrityNote: ARTICLE_INTEGRITY_NOTE,
      fantasyNote: FANTASY_NOTE,
    },
  };
}

export async function GET(_req: Request, context: RouteContext) {
  const { slug } = await Promise.resolve(context.params);
  const safeSlug = cleanText(slug);

  if (!safeSlug) {
    return NextResponse.json({ ok: false, error: 'slug is required' }, { status: 400 });
  }

  const row = await readArticle(safeSlug);
  if (!row) {
    return NextResponse.json({ ok: false, error: 'match analysis article not found' }, { status: 404 });
  }

  const [snapshot, infographicUrl, keyMoments] = await Promise.all([
    readSnapshot(row),
    readInfographicUrl(row),
    readKeyMoments(row),
  ]);

  return NextResponse.json(buildPayload(row, snapshot, infographicUrl, keyMoments), {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
