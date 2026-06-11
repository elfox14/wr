import { Prisma, PrismaClient } from '@prisma/client';
import { groupAWorldCupReports } from './groupAWorldCupReports';
import { groupBWorldCupReports } from './groupBWorldCupReports';
import { groupCWorldCupReports } from './groupCWorldCupReports';
import { groupDWorldCupReports } from './groupDWorldCupReports';
import { groupEWorldCupReports } from './groupEWorldCupReports';

export type TeamIntelligenceSeedReport = {
  teamCodes: string[];
  title: string;
  summary: string;
  body: string;
  sourceName: string;
  sourceUrl?: string;
  sourceCategory: 'official' | 'stats' | 'analysis' | 'editorial';
  confidence: 'A' | 'B' | 'C' | 'D';
  provider: string;
  tacticalTags: string[];
  strengths: string[];
  weaknesses: string[];
  metrics?: Prisma.InputJsonValue;
};

const editorialSeedReports: TeamIntelligenceSeedReport[] = [
  {
    teamCodes: ['ARG', 'AR', 'ARGENTINA'],
    title: 'ملف الأرجنتين الفني: خبرة بطولة وشخصية مباريات كبيرة',
    summary: 'الأرجنتين تدخل أي بطولة كمنتخب عالي الشخصية، يعتمد على توازن الوسط، جودة النجوم، والخبرة في إدارة اللحظات الحاسمة.',
    body: 'هذا التقرير افتتاحي داخلي يعتمد على التصنيف المحفوظ، تاريخ المشاركات، وقوة القائمة داخل قاعدة البيانات. عند ربط مصادر مرخصة مثل Opta أو StatsBomb يمكن استبدال التقديرات بمؤشرات xG والضغط والتمريرات التقدمية.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['خبرة عالية', 'تحكم بالإيقاع', 'مباريات كبرى'],
    strengths: ['شخصية تنافسية قوية', 'خبرة في إدارة الضغط', 'جودة فردية قادرة على حسم المباريات'],
    weaknesses: ['الحاجة لمتابعة جاهزية النجوم بدنيًا', 'تأثر النسق عند غياب صانع اللعب الأساسي'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['BRA', 'BR', 'BRAZIL'],
    title: 'ملف البرازيل الفني: موهبة هجومية وسقف فني مرتفع',
    summary: 'البرازيل عادةً تملك وفرة هجومية كبيرة، لكن نجاحها يعتمد على توازن الوسط والحماية الدفاعية خلف الأظهرة.',
    body: 'قراءة أولية مبنية على جودة اللاعبين والمؤشرات الداخلية. التقييم النهائي يحتاج تحديثات إصابات وقائمة رسمية وإحصائيات مباريات حديثة.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['هجوم سريع', 'مهارة فردية', 'تحولات'],
    strengths: ['أجنحة قادرة على خلق التفوق الفردي', 'عمق هجومي كبير', 'تهديد مستمر في المساحات'],
    weaknesses: ['الحاجة لتوازن دفاعي أفضل', 'تذبذب الأداء أمام المنتخبات المنظمة'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['FRA', 'FR', 'FRANCE'],
    title: 'ملف فرنسا الفني: قوة بدنية وعمق في كل الخطوط',
    summary: 'فرنسا من أكثر المنتخبات اكتمالًا من حيث العمق، السرعة، والقدرة على اللعب بأكثر من شكل تكتيكي.',
    body: 'تقرير داخلي تمهيدي؛ قوة فرنسا تظهر في تنوع الحلول بين التحولات السريعة والسيطرة المرحلية. يجب تحديثه عند ظهور القائمة الرسمية والإصابات.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['عمق القائمة', 'تحولات سريعة', 'مرونة تكتيكية'],
    strengths: ['سرعة في الهجوم', 'دكة قوية', 'قدرة على التكيف مع الخصم'],
    weaknesses: ['احتمال تراجع الانسجام مع كثرة الخيارات', 'الحاجة لمتابعة جاهزية القادة'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['ESP', 'ES', 'SPAIN'],
    title: 'ملف إسبانيا الفني: استحواذ وبناء لعب منظم',
    summary: 'إسبانيا تعتمد غالبًا على الاستحواذ، جودة التمرير، وتحريك الخصم حتى تظهر المساحات في الثلث الأخير.',
    body: 'القراءة الحالية افتتاحية، وتحتاج لاحقًا إلى مؤشرات دقيقة مثل التمريرات التقدمية، استرجاع الكرة، وجودة الفرص.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['استحواذ', 'ضغط عكسي', 'تمريرات قصيرة'],
    strengths: ['تحكم في الإيقاع', 'جودة فنية في الوسط', 'قدرة على تدوير الكرة تحت الضغط'],
    weaknesses: ['الحاجة لفعالية أعلى أمام المرمى', 'المساحات خلف الخط المتقدم'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['ENG', 'EN', 'ENGLAND'],
    title: 'ملف إنجلترا الفني: جودة فردية عالية وسؤال التوازن',
    summary: 'إنجلترا تملك أسماء قوية في الهجوم والوسط، لكن نجاحها يتوقف على وضوح الأدوار والتوازن بين النجوم.',
    body: 'تقرير تمهيدي داخلي، مناسب كبداية لصفحة المنتخب إلى أن يتم إدخال تقارير من مصادر رسمية أو إحصائية.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['نجوم هجومية', 'كرات ثابتة', 'ضغط متوسط'],
    strengths: ['مواهب فردية كثيرة', 'خطورة في الكرات الثابتة', 'خيارات هجومية متعددة'],
    weaknesses: ['ضغط جماهيري عالٍ', 'الحاجة لتوازن في الوسط والدفاع'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['MAR', 'MA', 'MOROCCO'],
    title: 'ملف المغرب الفني: تنظيم دفاعي وتحولات ذكية',
    summary: 'المغرب يملك هوية قوية تقوم على الانضباط، التحولات، واللعب بثقة أمام المنتخبات الكبرى.',
    body: 'هذا التقرير الداخلي يستفيد من السمعة الفنية الحديثة للمنتخب لكنه لا يغني عن تقارير المباراة والإصابات والتشكيل الرسمي.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['تنظيم دفاعي', 'تحولات', 'روح تنافسية'],
    strengths: ['انضباط تكتيكي', 'خبرة في مباريات الضغط', 'قدرة على اللعب ضد منتخبات أعلى استحواذًا'],
    weaknesses: ['الحاجة لزيادة الفاعلية الهجومية', 'تأثر المنظومة بغياب عناصر محورية'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['EGY', 'EG', 'EGYPT'],
    title: 'ملف مصر الفني: قوة الأطراف وخبرة النجوم',
    summary: 'مصر تحتاج إلى توازن واضح بين الاستفادة من النجوم، تأمين العمق الدفاعي، وتحسين الخروج بالكرة تحت الضغط.',
    body: 'تقرير داخلي افتتاحي. يمكن تطويره لاحقًا بملاحظات فيديو حقيقية لكل مباراة، مثل مشاكل الخروج بالكرة أو جودة التحولات.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['أطراف', 'كرات طولية', 'خبرة'],
    strengths: ['خبرة دولية لدى العناصر الكبرى', 'قدرة على خلق خطورة من الأطراف', 'دافع جماهيري كبير'],
    weaknesses: ['الخروج بالكرة تحت الضغط', 'الحاجة لانسجام أعلى في الوسط', 'تذبذب جودة التحولات الدفاعية'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
  {
    teamCodes: ['KSA', 'SA', 'SAUDI ARABIA'],
    title: 'ملف السعودية الفني: تنظيم وحماس مع حاجة للثبات',
    summary: 'السعودية تعتمد على الحماس والتنظيم، وتحتاج إلى ثبات دفاعي واستغلال أفضل للهجمات السريعة.',
    body: 'تقرير داخلي مبدئي، يحتاج لاحقًا إلى بيانات مباريات حديثة وتحديث قائمة اللاعبين النهائية.',
    sourceName: 'MC PRIME Editorial Desk',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME',
    tacticalTags: ['حماس', 'ضغط', 'تحولات'],
    strengths: ['روح جماعية عالية', 'قدرة على مفاجأة الخصوم', 'سرعات في التحول'],
    weaknesses: ['الحاجة للثبات الدفاعي', 'إدارة النسق أمام الضغط المستمر'],
    metrics: { model: 'editorial-v1', dataDepth: 'baseline' },
  },
];

export const teamIntelligenceSeedReports: TeamIntelligenceSeedReport[] = [
  ...groupAWorldCupReports,
  ...groupBWorldCupReports,
  ...groupCWorldCupReports,
  ...groupDWorldCupReports,
  ...groupEWorldCupReports,
  ...editorialSeedReports,
];

type SeedTeam = {
  id: string;
  name: string;
  code: string;
  group?: string | null;
  continent?: string | null;
  fifaRank?: number | null;
  score?: number | null;
  momentum?: number | null;
  worldCupLegacy?: number | null;
};

function buildGenericReport(team: SeedTeam): Omit<TeamIntelligenceSeedReport, 'teamCodes'> {
  const rankText = team.fifaRank ? `تصنيف FIFA الحالي داخل المنصة: #${team.fifaRank}.` : 'تصنيف FIFA غير مكتمل داخل قاعدة البيانات ويحتاج تحديثًا لاحقًا.';
  const groupText = team.group ? `المجموعة ${team.group}` : 'المجموعة غير محددة بعد';
  const scoreText = Math.round(Number(team.score || 50));

  return {
    title: `ملف ${team.name} الفني: تقرير افتتاحي قابل للتحديث`,
    summary: `${team.name} لديه ملف افتتاحي في مركز Team Intelligence يعتمد على بيانات قاعدة المنصة الحالية، ${groupText}، ومؤشر قوة داخلي ${scoreText}/100.`,
    body: `هذا التقرير تم إنشاؤه تلقائيًا لضمان تغطية جميع المنتخبات داخل مركز تقارير المنتخبات. ${rankText} القراءة الحالية افتتاحية وليست بديلًا عن المصادر الرسمية أو تقارير المباريات، لكنها تمنح الصفحة أساسًا قابلًا للتطوير بإضافة نقاط القوة والضعف والوسوم التكتيكية يدويًا أو من مصادر إحصائية لاحقًا.`,
    sourceName: 'MC PRIME Auto Intelligence Baseline',
    sourceCategory: 'editorial',
    confidence: 'D',
    provider: 'MC_PRIME_AUTO',
    tacticalTags: ['تقرير افتتاحي', 'متابعة مطلوبة', 'تحديث تدريجي'],
    strengths: ['وجود المنتخب داخل قاعدة البيانات', 'إمكانية تحديث التقرير من لوحة الإدارة', 'قابلية الربط لاحقًا بمصادر رسمية وإحصائية'],
    weaknesses: ['التحليل الحالي عام', 'يحتاج قائمة رسمية ومؤشرات مباريات حديثة', 'الثقة D حتى إضافة مصادر خارجية موثقة'],
    metrics: {
      model: 'auto-baseline-v1',
      dataDepth: 'generic-team-coverage',
      teamCode: team.code,
      teamGroup: team.group || null,
      teamContinent: team.continent || null,
      teamScore: team.score || null,
      momentum: team.momentum || null,
      worldCupLegacy: team.worldCupLegacy || null,
    },
  };
}

async function createReportForTeam(prisma: PrismaClient, team: SeedTeam, report: Omit<TeamIntelligenceSeedReport, 'teamCodes'>) {
  const existing = await prisma.teamIntelligenceReport.findFirst({
    where: {
      teamId: team.id,
      title: report.title,
      provider: report.provider,
    },
  });

  if (existing) return false;

  const metrics: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue = report.metrics ?? Prisma.JsonNull;

  await prisma.teamIntelligenceReport.create({
    data: {
      teamId: team.id,
      title: report.title,
      summary: report.summary,
      body: report.body,
      reportType: 'TEAM_PROFILE',
      language: 'ar',
      sourceName: report.sourceName,
      sourceUrl: report.sourceUrl,
      sourceCategory: report.sourceCategory,
      confidence: report.confidence,
      provider: report.provider,
      metrics,
      tacticalTags: report.tacticalTags,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      lastCheckedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  return true;
}

export async function seedTeamIntelligenceReports(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  const missingTeams: string[] = [];

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: {
      id: true,
      name: true,
      code: true,
      group: true,
      continent: true,
      fifaRank: true,
      score: true,
      momentum: true,
      worldCupLegacy: true,
    },
    orderBy: { name: 'asc' },
  });

  for (const report of teamIntelligenceSeedReports) {
    const team = teams.find((candidate) => report.teamCodes.some((code) => candidate.code.toLowerCase() === code.toLowerCase()));

    if (!team) {
      skipped++;
      missingTeams.push(report.teamCodes.join('/'));
      continue;
    }

    const wasCreated = await createReportForTeam(prisma, team, report);
    if (wasCreated) created++;
    else skipped++;
  }

  for (const team of teams) {
    const hasAnyReport = await prisma.teamIntelligenceReport.findFirst({
      where: { teamId: team.id },
      select: { id: true },
    });

    if (hasAnyReport) {
      skipped++;
      continue;
    }

    const genericReport = buildGenericReport(team);
    const wasCreated = await createReportForTeam(prisma, team, genericReport);
    if (wasCreated) created++;
    else skipped++;
  }

  return {
    created,
    skipped,
    missingTeams,
    totalTeams: teams.length,
    curatedReports: teamIntelligenceSeedReports.length,
  };
}
