import { Asset } from '@prisma/client';

// ============================================================
// PART 1: FUNDAMENTAL RATING (FR) — ثابت قبل البطولة (0-100)
// ============================================================

export interface TeamFundamentalData {
  fifaRank: number;           // 1-48
  squadMarketValue: number;   // إجمالي القيمة السوقية بالمليون €
  recentFormPoints: number;   // نقاط آخر 20 مباراة رسمية (max 60)
  avgPlayerScore: number;     // متوسط تقييم التشكيلة الأساسية (0-100)
  benchDepthScore: number;    // جودة البدلاء (0-10، يدوي أو من API)
}

export function calculateTeamFR(data: TeamFundamentalData): number {
  // 1. FIFA Rank (30%) — rank 1 = 100، rank 48 = 27
  const rankScore = Math.max(27, Math.round(100 - (data.fifaRank - 1) * 1.5));

  // 2. القيمة السوقية (25%) — normalize على max 1500M€
  // Brazil ~1200M, Bolivia ~80M
  const marketScore = Math.min(100, Math.round((data.squadMarketValue / 1500) * 100));

  // 3. نتائج آخر سنتين (20%) — نقاط آخر 20 مباراة / 60 * 100
  const formScore = Math.min(100, Math.round((data.recentFormPoints / 60) * 100));

  // 4. جودة التشكيلة الأساسية (15%) — مباشر من avg score اللاعبين
  const squadScore = Math.min(100, data.avgPlayerScore);

  // 5. عمق البدلاء (10%) — من 0 إلى 10
  const benchScore = Math.min(100, data.benchDepthScore * 10);

  const FR = (
    (rankScore  * 0.30) +
    (marketScore * 0.25) +
    (formScore  * 0.20) +
    (squadScore  * 0.15) +
    (benchScore  * 0.10)
  );

  return Math.max(0, Math.min(100, Math.round(FR * 10) / 10));
}

// ============================================================
// PART 2: PLAYER FUNDAMENTAL RATING (0-100) حسب المركز
// ============================================================

interface BasePlayerStats {
  minutesPlayed: number;  // في آخر سنة مع المنتخب والنادي
  disciplineScore: number; // 0-10 (10 = بطاقات صفر)
}

interface ForwardStats extends BasePlayerStats {
  goals: number;
  assists: number;
  matchRating: number;  // متوسط تقييم (0-10)
}

interface MidfielderStats extends BasePlayerStats {
  chanceCreated: number;
  passAccuracy: number;   // نسبة مئوية 0-100
  goalContributions: number;
  ballRecoveries: number;
}

interface DefenderStats extends BasePlayerStats {
  tacklesWon: number;
  interceptions: number;
  errors: number;        // أخطاء مؤدية للخطر (عدد)
  passAccuracy: number;
}

interface GoalkeeperStats extends BasePlayerStats {
  savePercentage: number;  // 0-100
  cleanSheets: number;
  distributionAccuracy: number; // 0-100
  commandingExits: number; // 0-10
}

// نرمّل كل قيمة على max متوقع موضوعي
function normalize(value: number, max: number): number {
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

export function calculateForwardFR(stats: ForwardStats): number {
  const goalsScore        = normalize(stats.goals, 15);           // 15 هدف = 100
  const assistsScore      = normalize(stats.assists, 10);          // 10 أسست = 100
  const ratingScore       = normalize(stats.matchRating, 10) * 10; // 10/10 = 100
  const minutesScore      = normalize(stats.minutesPlayed, 1800);  // 1800 دقيقة = 100
  const disciplineScore   = stats.disciplineScore * 10;

  return Math.round(
    goalsScore      * 0.35 +
    assistsScore    * 0.20 +
    ratingScore     * 0.20 +
    minutesScore    * 0.15 +
    disciplineScore * 0.10
  );
}

export function calculateMidfielderFR(stats: MidfielderStats): number {
  const chanceScore       = normalize(stats.chanceCreated, 60);
  const passScore         = stats.passAccuracy; // مباشرة لأنها نسبة
  const contribScore      = normalize(stats.goalContributions, 15);
  const recoveryScore     = normalize(stats.ballRecoveries, 100);
  const disciplineScore   = stats.disciplineScore * 10;

  return Math.round(
    chanceScore     * 0.25 +
    passScore       * 0.25 +
    contribScore    * 0.20 +
    recoveryScore   * 0.20 +
    disciplineScore * 0.10
  );
}

export function calculateDefenderFR(stats: DefenderStats): number {
  const tackleScore       = normalize(stats.tacklesWon, 80);
  const interceptScore    = normalize(stats.interceptions, 60);
  const errorPenalty      = Math.max(0, 100 - stats.errors * 10); // كل خطأ -10
  const passScore         = stats.passAccuracy;
  const disciplineScore   = stats.disciplineScore * 10;

  return Math.round(
    tackleScore     * 0.30 +
    interceptScore  * 0.25 +
    errorPenalty    * 0.20 +
    passScore       * 0.15 +
    disciplineScore * 0.10
  );
}

export function calculateGoalkeeperFR(stats: GoalkeeperStats): number {
  const saveScore         = stats.savePercentage;
  const cleanSheetScore   = normalize(stats.cleanSheets, 10);
  const distScore         = stats.distributionAccuracy;
  const exitScore         = stats.commandingExits * 10;
  const disciplineScore   = stats.disciplineScore * 10;

  return Math.round(
    saveScore       * 0.40 +
    cleanSheetScore * 0.25 +
    distScore       * 0.15 +
    exitScore       * 0.10 +
    disciplineScore * 0.10
  );
}

// ============================================================
// PART 3: تحويل FR إلى سعر ابتدائي (Exponential Scale)
// ============================================================

export function frToPrice(fr: number, type: 'PLAYER' | 'TEAM'): number {
  if (type === 'PLAYER') {
    if (fr >= 95) return 1500;
    if (fr >= 90) return 1200;
    if (fr >= 85) return 900;
    if (fr >= 80) return 700;
    if (fr >= 75) return 500;
    return 250;
  }
  // المنتخبات بنطاق أعلى لضمان هيمنتها على السوق كأصل أثقل
  if (type === 'TEAM') {
    if (fr >= 90) return 15000;
    if (fr >= 85) return 10000;
    if (fr >= 80) return  7000;
    if (fr >= 75) return  5000;
    if (fr >= 70) return  3500;
    if (fr >= 65) return  2500;
    if (fr >= 60) return  1800;
    return 1000;
  }
  return 250;
}

// ============================================================
// PART 4: MARKET SENTIMENT (MS) — يتغير أثناء البطولة
// ============================================================

export interface MarketSentimentData {
  buyerCount: number;      // عدد المشترين في آخر 24 ساعة
  totalVolume: number;     // إجمالي حجم التداول
  priceDirection: number;  // -1 (هابط) → 0 (محايد) → +1 (صاعد)
  totalHolders: number;    // إجمالي المحتفظين بالأصل
}

export function calculateMarketSentiment(data: MarketSentimentData): number {
  // 1. نسبة المشترين (0-40 نقطة)
  const buyerScore = Math.min(40, (data.buyerCount / 200) * 40);

  // 2. حجم التداول (0-30 نقطة)
  const volumeScore = Math.min(30, (data.totalVolume / 50000) * 30);

  // 3. اتجاه السوق (0-20 نقطة)
  const directionScore = (data.priceDirection + 1) * 10;

  // 4. قاعدة المحتفظين - stability (0-10 نقطة)
  const holderScore = Math.min(10, (data.totalHolders / 500) * 10);

  return Math.min(100, Math.round(buyerScore + volumeScore + directionScore + holderScore));
}

// ============================================================
// PART 5: SYSTEM INTEGRATION WRAPPERS (التوافقية مع قاعدة البيانات)
// ============================================================

export function calculatePlayerPrice(asset: Partial<Asset>): number {
  if (asset.type !== 'PLAYER') return 0;

  // محاكاة الإحصائيات الأساسية بناءً على مستوى اللاعب للتوافق مع قاعدة البيانات الحالية
  const tier = asset.playerTier || 0.5;
  const position = asset.position || 'MID';
  
  // Base normalization from tier (0.0 - 1.0) to stats
  let FR = 70;

  if (position === 'FWD') {
    FR = calculateForwardFR({
      minutesPlayed: 1000 + (tier * 800),
      disciplineScore: 8 + (tier * 2),
      goals: Math.round(tier * 15),
      assists: Math.round(tier * 10),
      matchRating: 6.0 + (tier * 4.0)
    });
  } else if (position === 'MID') {
    FR = calculateMidfielderFR({
      minutesPlayed: 1000 + (tier * 800),
      disciplineScore: 8 + (tier * 2),
      chanceCreated: Math.round(tier * 60),
      passAccuracy: 70 + (tier * 25),
      goalContributions: Math.round(tier * 15),
      ballRecoveries: Math.round(tier * 100)
    });
  } else if (position === 'DEF') {
    FR = calculateDefenderFR({
      minutesPlayed: 1000 + (tier * 800),
      disciplineScore: 7 + (tier * 3),
      tacklesWon: Math.round(tier * 80),
      interceptions: Math.round(tier * 60),
      errors: Math.max(0, Math.round(3 - (tier * 3))),
      passAccuracy: 70 + (tier * 25)
    });
  } else if (position === 'GK') {
    FR = calculateGoalkeeperFR({
      minutesPlayed: 1000 + (tier * 800),
      disciplineScore: 9,
      savePercentage: 60 + (tier * 30),
      cleanSheets: Math.round(tier * 10),
      distributionAccuracy: 50 + (tier * 40),
      commandingExits: Math.round(tier * 10)
    });
  }

  // التقييم الأساسي
  const basePrice = frToPrice(FR, 'PLAYER');
  
  // افتراض حيادية السوق حاليا (سيتم تحديث هذا ديناميكيا من التداول لاحقا)
  const msData: MarketSentimentData = {
    buyerCount: 100,
    totalVolume: 25000,
    priceDirection: 0,
    totalHolders: 250
  };
  
  const MS = calculateMarketSentiment(msData);
  
  // السعر النهائي = 70% تقييم أساسي + 30% شعور السوق
  // لتحقيق ذلك، نطبق التأثير على السعر الابتدائي بنسبة مئوية
  // إذا كان السوق 100/100 -> زيادة 30%، إذا كان 0/100 -> خصم 30%
  const sentimentMultiplier = 0.70 + ((MS / 100) * 0.60); // 0.7 to 1.3

  return Math.round(basePrice * sentimentMultiplier);
}

export function calculateTeamPrice(team: Partial<Asset>, players: Partial<Asset>[]): number {
  if (team.type !== 'TEAM') return 0;

  const top11 = [...players].sort((a, b) => (b.playerTier || 0) - (a.playerTier || 0)).slice(0, 11);
  const avgTier = top11.reduce((sum, p) => sum + (p.playerTier || 0.5), 0) / (top11.length || 1);
  const squadValue = avgTier * 1500; // max ~1500M

  const teamFR = calculateTeamFR({
    fifaRank: team.fifaRank || 24,
    squadMarketValue: squadValue,
    recentFormPoints: 30 + (avgTier * 30),
    avgPlayerScore: 60 + (avgTier * 40),
    benchDepthScore: 5 + (avgTier * 5)
  });

  const basePrice = frToPrice(teamFR, 'TEAM');

  const msData: MarketSentimentData = {
    buyerCount: 100,
    totalVolume: 25000,
    priceDirection: 0,
    totalHolders: 250
  };
  const MS = calculateMarketSentiment(msData);
  const sentimentMultiplier = 0.70 + ((MS / 100) * 0.60);

  return Math.max(100, Math.round(basePrice * sentimentMultiplier));
}
