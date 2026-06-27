import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { ensurePostMatchContentTables } from './schema';
import { GoogleGenAI, Type } from '@google/genai';

const FINISHED_STATUSES = ['FINAL_VERIFIED', 'FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
const DEFAULT_COMPETITION = 'كأس العالم 2026';

export type CandidateMatch = {
  id: string;
  status: string;
  matchDate: Date;
  homeScore: number | null;
  awayScore: number | null;
  groupPhase: string | null;
  stage: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  snapshotId: string | null;
  provider: string | null;
  capturedAt: Date | null;
  homePossession: number | null;
  awayPossession: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  homeYellowCards: number | null;
  awayYellowCards: number | null;
  homeRedCards: number | null;
  awayRedCards: number | null;
  homeAttacks: number | null;
  awayAttacks: number | null;
  homeDangerousAttacks: number | null;
  awayDangerousAttacks: number | null;
};

type Metric = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  suffix?: string;
};

type Section = {
  type: string;
  heading: string;
  content: string;
};

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clean(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `match-${Date.now()}`;
}

function latinSlug(match: CandidateMatch) {
  const home = clean(match.homeTeamCode, match.homeTeamName).replace(/[^a-z0-9]+/gi, '-');
  const away = clean(match.awayTeamCode, match.awayTeamName).replace(/[^a-z0-9]+/gi, '-');
  const date = new Date(match.matchDate).toISOString().slice(0, 10);
  return slugify(`${home}-vs-${away}-world-cup-2026-analysis-${date}`);
}

function scoreLine(match: CandidateMatch) {
  const home = numberOrNull(match.homeScore) ?? 0;
  const away = numberOrNull(match.awayScore) ?? 0;
  return `${match.homeTeamName} ${home} - ${away} ${match.awayTeamName}`;
}

function winnerLabel(match: CandidateMatch) {
  const home = numberOrNull(match.homeScore) ?? 0;
  const away = numberOrNull(match.awayScore) ?? 0;
  if (home > away) return match.homeTeamName;
  if (away > home) return match.awayTeamName;
  return 'التعادل';
}

function metricsFrom(match: CandidateMatch): Metric[] {
  return [
    { key: 'possession', label: 'الاستحواذ', home: match.homePossession, away: match.awayPossession, suffix: '%' },
    { key: 'shots', label: 'التسديدات', home: match.homeShots, away: match.awayShots },
    { key: 'shots_on_target', label: 'التسديدات على المرمى', home: match.homeShotsOnTarget, away: match.awayShotsOnTarget },
    { key: 'corners', label: 'الركنيات', home: match.homeCorners, away: match.awayCorners },
    { key: 'yellow_cards', label: 'البطاقات الصفراء', home: match.homeYellowCards, away: match.awayYellowCards },
    { key: 'red_cards', label: 'البطاقات الحمراء', home: match.homeRedCards, away: match.awayRedCards },
    { key: 'attacks', label: 'الهجمات', home: match.homeAttacks, away: match.awayAttacks },
    { key: 'dangerous_attacks', label: 'الهجمات الخطيرة', home: match.homeDangerousAttacks, away: match.awayDangerousAttacks },
  ].filter((metric) => metric.home !== null || metric.away !== null);
}

function statPhrase(metric: Metric, homeTeam: string, awayTeam: string) {
  const home = metric.home === null ? 'غير متوفر' : `${metric.home}${metric.suffix || ''}`;
  const away = metric.away === null ? 'غير متوفر' : `${metric.away}${metric.suffix || ''}`;
  return `${metric.label}: ${homeTeam} ${home} مقابل ${awayTeam} ${away}`;
}

async function buildSections(match: CandidateMatch, metrics: Metric[]): Promise<Section[]> {
  const fallback = () => {
    const result = scoreLine(match);
    const winner = winnerLabel(match);
    const statusNote = String(match.status || '').toUpperCase() === 'FINAL_VERIFIED'
      ? 'تم بناء هذا التحليل بعد تأكيد الإحصائيات النهائية.'
      : 'هذا تحليل مبني على آخر Snapshot محفوظة بعد نهاية المباراة، ويُفضّل مراجعته قبل النشر النهائي.';
    const topMetrics = metrics.slice(0, 6);
    const shots = metrics.find((metric) => metric.key === 'shots');
    const onTarget = metrics.find((metric) => metric.key === 'shots_on_target');
    const possession = metrics.find((metric) => metric.key === 'possession');

    return [
      {
        type: 'SUMMARY',
        heading: 'ملخص المباراة',
        content: `انتهت مواجهة ${match.homeTeamName} ضد ${match.awayTeamName} بنتيجة ${result} ضمن ${DEFAULT_COMPETITION}. ${winner === 'التعادل' ? 'النتيجة تعكس مباراة متوازنة على مستوى الحسم الرقمي، مع حاجة قراءة التفاصيل الإحصائية لفهم اتجاه السيطرة.' : `النتيجة منحت ${winner} أفضلية واضحة في لوحة النتيجة، لكن قراءة المباراة الحقيقية تظهر من تفاصيل التسديدات، الاستحواذ، وجودة الوصول للمناطق الخطيرة.`} ${statusNote}`,
      },
      {
        type: 'TACTICAL_ANALYSIS',
        heading: 'القراءة الفنية للمباراة',
        content: possession
          ? `إيقاع المباراة يمكن قراءته من مؤشر الاستحواذ أولًا: ${statPhrase(possession, match.homeTeamName, match.awayTeamName)}. هذا الرقم وحده لا يكفي للحكم على السيطرة، لكنه يوضح أين ذهبت فترات امتلاك الكرة، ثم تأتي جودة التسديدات والفرص لتحديد من كان أكثر خطورة.`
          : `القراءة الفنية تعتمد هنا على النتيجة النهائية وأحداث المباراة المحفوظة. لم تصل بيانات استحواذ مؤكدة في Snapshot النهائية، لذلك لا يتم اختراع نسبة سيطرة غير موجودة.`,
      },
      {
        type: 'STATS_ANALYSIS',
        heading: 'الإحصائيات النهائية',
        content: topMetrics.length
          ? `أبرز أرقام المباراة جاءت كالتالي: ${topMetrics.map((metric) => statPhrase(metric, match.homeTeamName, match.awayTeamName)).join('، ')}. هذه الأرقام تمنح القارئ صورة أكثر دقة من النتيجة فقط، خصوصًا عند مقارنة التسديدات بالتسديدات على المرمى.`
          : 'لا توجد إحصائيات تفصيلية مؤكدة محفوظة لهذه المباراة حتى الآن، لذلك تم الاكتفاء بالنتيجة وسياق المباراة دون إضافة أرقام غير موثقة.',
      },
      {
        type: 'TURNING_POINTS',
        heading: 'نقطة التحول',
        content: shots || onTarget
          ? `الفارق الأهم يظهر عند مقارنة حجم المحاولات بجودة الوصول للمرمى. ${shots ? statPhrase(shots, match.homeTeamName, match.awayTeamName) : ''}${shots && onTarget ? '، و' : ''}${onTarget ? statPhrase(onTarget, match.homeTeamName, match.awayTeamName) : ''}. عندما تتقارب النتيجة، تصبح هذه التفاصيل هي المفتاح لفهم من صنع فرصًا أخطر ومن اكتفى بالاستحواذ أو المحاولات البعيدة.`
          : 'لا توجد بيانات تسديدات مؤكدة كافية لاستخراج نقطة تحول رقمية، لذلك يجب الاعتماد على مراجعة Timeline المباراة قبل نشر تفسير نهائي لهذه الجزئية.',
      },
      {
        type: 'GROUP_IMPACT',
        heading: 'ماذا تعني النتيجة؟',
        content: `هذه النتيجة تؤثر مباشرة على حسابات ${match.groupPhase ? `المجموعة ${match.groupPhase}` : 'مرحلة البطولة'}، خصوصًا في بطولة قصيرة مثل كأس العالم حيث يمكن لنقطة واحدة أو فارق هدف أن يغيّر ترتيب المجموعة. صفحة المباراة ستظل هي المرجع الرقمي، بينما يقدم هذا المقال قراءة تحليلية مبنية على البيانات النهائية المحفوظة.`,
      },
    ];
  };

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return fallback();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `أنت محلل رياضي عالمي خبير (مثل كبار محللي قنوات beIN Sports و Sky Sports).
قم بتحليل مباراة: ${match.homeTeamName} ضد ${match.awayTeamName}
النتيجة النهائية: ${match.homeScore} - ${match.awayScore}
الإحصائيات: ${JSON.stringify(metrics)}
المرحلة/المجموعة: ${match.groupPhase || match.stage || DEFAULT_COMPETITION}

المطلوب كتابة مقال تحليلي رياضي باللغة العربية بأسلوب احترافي جداً ومبني على الأرقام.
الأقسام المطلوبة:
1. SUMMARY: ملخص المباراة وسرد الأحداث بشكل درامي مشوق.
2. TACTICAL_ANALYSIS: القراءة الفنية (تكتيك) بناءً على الاستحواذ والتسديدات والبطاقات.
3. STATS_ANALYSIS: تحليل الإحصائيات النهائية وتأثيرها.
4. TURNING_POINTS: نقاط التحول في سير اللعب.
5. GROUP_IMPACT: ماذا تعني النتيجة؟ (تأثيرها على ترتيب البطولة).
6. SOCIAL_THREAD: ثريد تويتر (Twitter Thread) مكون من 3 تغريدات تلخص المقال بأرقام مثيرة وجاهز للنشر.

يجب أن يكون المقال طويلاً وغنياً بالمعلومات (لا يقل عن 600 كلمة) ومناسباً لمحركات البحث (SEO). لا تستخدم جملاً عامة، بل اربط الأرقام بالواقع التكتيكي (مثلاً: "الاستحواذ 60% كان سلبياً بلا فاعلية").`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  heading: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ['type', 'heading', 'content']
              }
            }
          },
          required: ['sections']
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return parsed.sections;
      }
    }
  } catch (error) {
    console.error('AI Generation failed, falling back to templates', error);
  }

  return fallback();
}

function bodyFromSections(sections: Section[]) {
  return sections.map((section) => `## ${section.heading}\n\n${section.content}`).join('\n\n');
}

function seoScoreFor(metrics: Metric[], status: string) {
  let score = 55;
  if (String(status).toUpperCase() === 'FINAL_VERIFIED') score += 20;
  if (metrics.length >= 4) score += 15;
  if (metrics.length >= 7) score += 5;
  return Math.min(score, 95);
}

function statusList(allowFinished: boolean) {
  return allowFinished ? FINISHED_STATUSES : ['FINAL_VERIFIED'];
}

export async function findPostMatchCandidates(limit: number, allowFinished: boolean) {
  await ensurePostMatchContentTables();
  const statuses = statusList(allowFinished);
  const placeholders = statuses.map((_, index) => `$${index + 2}`).join(', ');
  return prisma.$queryRawUnsafe<CandidateMatch[]>(`
    SELECT
      m."id",
      m."status",
      m."matchDate",
      m."homeScore",
      m."awayScore",
      m."groupPhase",
      m."stage",
      m."homeTeamId",
      m."awayTeamId",
      home."name" AS "homeTeamName",
      away."name" AS "awayTeamName",
      home."code" AS "homeTeamCode",
      away."code" AS "awayTeamCode",
      latest."id" AS "snapshotId",
      latest."provider" AS "provider",
      latest."capturedAt" AS "capturedAt",
      latest."homePossession" AS "homePossession",
      latest."awayPossession" AS "awayPossession",
      latest."homeShots" AS "homeShots",
      latest."awayShots" AS "awayShots",
      latest."homeShotsOnTarget" AS "homeShotsOnTarget",
      latest."awayShotsOnTarget" AS "awayShotsOnTarget",
      latest."homeCorners" AS "homeCorners",
      latest."awayCorners" AS "awayCorners",
      latest."homeYellowCards" AS "homeYellowCards",
      latest."awayYellowCards" AS "awayYellowCards",
      latest."homeRedCards" AS "homeRedCards",
      latest."awayRedCards" AS "awayRedCards",
      latest."homeAttacks" AS "homeAttacks",
      latest."awayAttacks" AS "awayAttacks",
      latest."homeDangerousAttacks" AS "homeDangerousAttacks",
      latest."awayDangerousAttacks" AS "awayDangerousAttacks"
    FROM "Match" m
    JOIN "Asset" home ON home."id" = m."homeTeamId"
    JOIN "Asset" away ON away."id" = m."awayTeamId"
    LEFT JOIN LATERAL (
      SELECT * FROM "MatchStatsSnapshot" s
      WHERE s."matchId" = m."id"
      ORDER BY s."capturedAt" DESC
      LIMIT 1
    ) latest ON TRUE
    LEFT JOIN "MatchArticle" article ON article."matchId" = m."id" AND article."language" = 'ar'
    WHERE article."id" IS NULL
      AND UPPER(m."status") IN (${placeholders})
    ORDER BY m."matchDate" DESC
    LIMIT $1
  `, limit, ...statuses);
}

export async function findPostMatchCandidateById(matchId: string) {
  await ensurePostMatchContentTables();
  const rows = await prisma.$queryRawUnsafe<CandidateMatch[]>(`
    SELECT
      m."id",
      m."status",
      m."matchDate",
      m."homeScore",
      m."awayScore",
      m."groupPhase",
      m."stage",
      m."homeTeamId",
      m."awayTeamId",
      home."name" AS "homeTeamName",
      away."name" AS "awayTeamName",
      home."code" AS "homeTeamCode",
      away."code" AS "awayTeamCode",
      latest."id" AS "snapshotId",
      latest."provider" AS "provider",
      latest."capturedAt" AS "capturedAt",
      latest."homePossession" AS "homePossession",
      latest."awayPossession" AS "awayPossession",
      latest."homeShots" AS "homeShots",
      latest."awayShots" AS "awayShots",
      latest."homeShotsOnTarget" AS "homeShotsOnTarget",
      latest."awayShotsOnTarget" AS "awayShotsOnTarget",
      latest."homeShotsOffTarget" AS "homeShotsOffTarget",
      latest."awayShotsOffTarget" AS "awayShotsOffTarget",
      latest."homeCorners" AS "homeCorners",
      latest."awayCorners" AS "awayCorners",
      latest."homeYellowCards" AS "homeYellowCards",
      latest."awayYellowCards" AS "awayYellowCards",
      latest."homeRedCards" AS "homeRedCards",
      latest."awayRedCards" AS "awayRedCards",
      latest."homeAttacks" AS "homeAttacks",
      latest."awayAttacks" AS "awayAttacks",
      latest."homeDangerousAttacks" AS "homeDangerousAttacks",
      latest."awayDangerousAttacks" AS "awayDangerousAttacks"
    FROM "Match" m
    JOIN "Asset" home ON home."id" = m."homeTeamId"
    JOIN "Asset" away ON away."id" = m."awayTeamId"
    LEFT JOIN LATERAL (
      SELECT * FROM "MatchStatsSnapshot" s
      WHERE s."matchId" = m."id"
      ORDER BY s."capturedAt" DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE m."id" = $1
  `, matchId);
  return rows[0] || null;
}

export async function generateArticleForMatch(match: CandidateMatch, options?: { autoPublish?: boolean }) {
  await ensurePostMatchContentTables();
  const articleId = randomUUID();
  const infographicId = randomUUID();
  const heroAssetId = randomUUID();
  const infographicAssetId = randomUUID();
  const jobId = randomUUID();
  const metrics = metricsFrom(match);
  const sections = await buildSections(match, metrics);
  const score = scoreLine(match);
  const slug = latinSlug(match);
  const title = `نتيجة مباراة ${match.homeTeamName} و${match.awayTeamName} في كأس العالم 2026.. تحليل فني وإحصائيات كاملة`;
  const metaTitle = `${match.homeTeamName} ضد ${match.awayTeamName}: نتيجة وتحليل كأس العالم 2026`;
  const metaDescription = `تحليل نتيجة مباراة ${match.homeTeamName} و${match.awayTeamName} في كأس العالم 2026 مع الإحصائيات النهائية وأبرز نقاط التحول بعد تأكيد البيانات.`.slice(0, 158);
  const excerpt = `تحليل احترافي لمباراة ${match.homeTeamName} و${match.awayTeamName} بعد النهاية، مبني على النتيجة والإحصائيات المحفوظة في قاعدة البيانات.`;
  const body = bodyFromSections(sections);
  const status = options?.autoPublish ? 'PUBLISHED' : 'DRAFT_READY';
  const publishedAt = options?.autoPublish ? new Date() : null;
  const heroImageUrl = `/match-article-image/${slug}`;
  const infographicImageUrl = `/match-infographic/${infographicId}`;
  const statsSummary = {
    scoreLine: score,
    status: match.status,
    provider: match.provider,
    capturedAt: match.capturedAt,
    homeTeam: { id: match.homeTeamId, name: match.homeTeamName, code: match.homeTeamCode },
    awayTeam: { id: match.awayTeamId, name: match.awayTeamName, code: match.awayTeamCode },
    metrics,
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ArticleGenerationJob" ("id", "matchId", "status", "sourceSnapshotId", "createdBy") VALUES ($1, $2, 'STARTED', $3, 'post-match-content-engine')`,
    jobId,
    match.id,
    match.snapshotId,
  );

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Clean up existing assets and article for this match to prevent unique constraint conflicts and orphaned rows
      await tx.$executeRawUnsafe(`DELETE FROM "MatchInfographic" WHERE "matchId" = $1`, match.id);
      await tx.$executeRawUnsafe(`DELETE FROM "MediaAsset" WHERE "matchId" = $1 AND "assetType" IN ('ARTICLE_HERO', 'INFOGRAPHIC')`, match.id);
      await tx.$executeRawUnsafe(`DELETE FROM "MatchArticle" WHERE "matchId" = $1 AND "language" = 'ar'`, match.id);

      // 2. Insert the new article
      await tx.$executeRawUnsafe(
        `INSERT INTO "MatchArticle" (
          "id", "matchId", "title", "slug", "metaTitle", "metaDescription", "excerpt", "body", "sections", "statsSummary", "status", "language", "seoScore", "sourceSnapshotId", "heroImageUrl", "infographicImageUrl", "publishedAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, 'ar', $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)`,
        articleId,
        match.id,
        title,
        slug,
        metaTitle,
        metaDescription,
        excerpt,
        body,
        JSON.stringify(sections),
        JSON.stringify(statsSummary),
        status,
        seoScoreFor(metrics, match.status),
        match.snapshotId,
        heroImageUrl,
        infographicImageUrl,
        publishedAt,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "MatchInfographic" ("id", "matchId", "articleId", "type", "title", "imageUrl", "data", "sourceSnapshotId", "status", "updatedAt")
         VALUES ($1, $2, $3, 'MATCH_STATS', $4, $5, $6::jsonb, $7, 'READY', CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO NOTHING`,
        infographicId,
        match.id,
        articleId,
        `إنفوجرافيك إحصائيات ${match.homeTeamName} ضد ${match.awayTeamName}`,
        infographicImageUrl,
        JSON.stringify(statsSummary),
        match.snapshotId,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "MediaAsset" ("id", "matchId", "articleId", "assetType", "url", "width", "height", "altText", "caption", "credit", "source", "licenseStatus", "updatedAt")
         VALUES ($1, $2, $3, 'ARTICLE_HERO', $4, 1200, 675, $5, $6, 'MC PRIME generated template', 'generated-template', 'safe-generated', CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO NOTHING`,
        heroAssetId,
        match.id,
        articleId,
        heroImageUrl,
        `صورة تحليل مباراة ${match.homeTeamName} و${match.awayTeamName}`,
        `صورة تحريرية مولدة آمنًا لمقال ${match.homeTeamName} ضد ${match.awayTeamName}`,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO "MediaAsset" ("id", "matchId", "articleId", "assetType", "url", "width", "height", "altText", "caption", "credit", "source", "licenseStatus", "updatedAt")
         VALUES ($1, $2, $3, 'INFOGRAPHIC', $4, 1200, 675, $5, $6, 'MC PRIME generated template', 'generated-template', 'safe-generated', CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO NOTHING`,
        infographicAssetId,
        match.id,
        articleId,
        infographicImageUrl,
        `إنفوجرافيك إحصائيات ${match.homeTeamName} و${match.awayTeamName}`,
        `إنفوجرافيك مبني على الإحصائيات النهائية المحفوظة`,
      );

      await tx.$executeRawUnsafe(
        `UPDATE "ArticleGenerationJob" SET "status" = 'FINISHED', "articleId" = $1, "finishedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
        articleId,
        jobId,
      );
    });

    return { ok: true, articleId, slug, status, infographicId };
  } catch (error: any) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ArticleGenerationJob" SET "status" = 'FAILED', "errorMessage" = $1, "finishedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
      String(error?.message || error).slice(0, 1000),
      jobId,
    ).catch(() => null);
    throw error;
  }
}

export async function generatePostMatchArticles(options?: { limit?: number; allowFinished?: boolean; autoPublish?: boolean }) {
  const limit = Math.max(1, Math.min(20, Number(options?.limit || 5)));
  const candidates = await findPostMatchCandidates(limit, Boolean(options?.allowFinished));
  const generated = [];
  const skipped = [];

  for (const match of candidates) {
    if (!match.snapshotId) {
      skipped.push({ matchId: match.id, reason: 'No final stats snapshot found.' });
      continue;
    }
    const result = await generateArticleForMatch(match, { autoPublish: Boolean(options?.autoPublish) });
    generated.push({ matchId: match.id, ...result });
  }

  return { candidates: candidates.length, generated, skipped };
}
