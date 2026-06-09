export type FootballPosition = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'WG' | 'ST' | 'TEAM';

export type CategoryKey = 'technical' | 'tactical' | 'physical' | 'defensive' | 'attacking' | 'risk';

export type MetricScores = Record<string, number | null | undefined>;

export type CategoryScore = {
  key: CategoryKey;
  label: string;
  score: number;
  weight: number;
  reasons: string[];
};

export type PlayerScoringResult = {
  position: FootballPosition;
  weightedScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  weaknesses: string[];
  roleLabel: string;
  verdict: string;
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  technical: 'الجودة الفنية',
  tactical: 'الوعي التكتيكي',
  physical: 'المجهود البدني',
  defensive: 'الدور الدفاعي',
  attacking: 'التأثير الهجومي',
  risk: 'مخاطر الأداء',
};

const POSITION_WEIGHTS: Record<FootballPosition, Record<CategoryKey, number>> = {
  GK: { technical: 0.18, tactical: 0.24, physical: 0.12, defensive: 0.34, attacking: 0.02, risk: 0.10 },
  CB: { technical: 0.16, tactical: 0.28, physical: 0.14, defensive: 0.32, attacking: 0.02, risk: 0.08 },
  FB: { technical: 0.18, tactical: 0.22, physical: 0.18, defensive: 0.24, attacking: 0.10, risk: 0.08 },
  DM: { technical: 0.20, tactical: 0.30, physical: 0.12, defensive: 0.24, attacking: 0.06, risk: 0.08 },
  CM: { technical: 0.26, tactical: 0.26, physical: 0.12, defensive: 0.12, attacking: 0.16, risk: 0.08 },
  AM: { technical: 0.30, tactical: 0.20, physical: 0.08, defensive: 0.06, attacking: 0.28, risk: 0.08 },
  WG: { technical: 0.26, tactical: 0.16, physical: 0.14, defensive: 0.06, attacking: 0.30, risk: 0.08 },
  ST: { technical: 0.20, tactical: 0.16, physical: 0.12, defensive: 0.04, attacking: 0.40, risk: 0.08 },
  TEAM: { technical: 0.18, tactical: 0.34, physical: 0.10, defensive: 0.16, attacking: 0.14, risk: 0.08 },
};

const ROLE_LABELS: Record<FootballPosition, string> = {
  GK: 'حارس مرمى',
  CB: 'قلب دفاع',
  FB: 'ظهير',
  DM: 'محور دفاعي',
  CM: 'لاعب وسط',
  AM: 'صانع لعب',
  WG: 'جناح',
  ST: 'مهاجم',
  TEAM: 'منتخب',
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function avg(values: Array<number | null | undefined>, fallback = 50) {
  const clean = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!clean.length) return fallback;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function higherIsBetter(value: number | null | undefined, fallback = 50) {
  return clampScore(Number.isFinite(Number(value)) ? Number(value) : fallback);
}

function lowerIsBetter(value: number | null | undefined, fallback = 50) {
  return clampScore(100 - (Number.isFinite(Number(value)) ? Number(value) : fallback));
}

function categoryReasons(key: CategoryKey, score: number, position: FootballPosition) {
  if (score >= 78) {
    const high: Record<CategoryKey, string> = {
      technical: 'جودة تنفيذ عالية تحت الضغط.',
      tactical: 'تمركز وقرارات جيدة داخل النسق.',
      physical: 'قدرة بدنية تساعد على الاستمرارية.',
      defensive: 'تأثير واضح في استرجاع الكرة وحماية المساحات.',
      attacking: 'يساهم في صناعة أو إنهاء الخطورة.',
      risk: 'مخاطر منخفضة مقارنة بالدور المطلوب.',
    };
    return [high[key]];
  }

  if (score <= 45) {
    const low: Record<CategoryKey, string> = {
      technical: 'يحتاج دقة أكبر في التنفيذ الفني.',
      tactical: 'هناك مساحة لتحسين التمركز واتخاذ القرار.',
      physical: 'المجهود البدني قد لا يكفي طوال المباراة.',
      defensive: 'الدور الدفاعي يحتاج ثباتًا أكبر.',
      attacking: 'التأثير الهجومي أقل من المتوقع لهذا الدور.',
      risk: 'المخاطر مرتفعة وقد تؤثر على استقرار التقييم.',
    };
    return [low[key]];
  }

  return [`مستوى ${CATEGORY_LABELS[key]} مقبول بالنسبة لدور ${ROLE_LABELS[position]}.`];
}

function buildCategoryScores(position: FootballPosition, metrics: MetricScores): CategoryScore[] {
  const technical = avg([
    metrics.pass_quality,
    metrics.first_touch,
    metrics.progressive_passing,
    metrics.ball_carrying,
    metrics.decision_quality,
  ]);

  const tactical = avg([
    metrics.positioning,
    metrics.off_ball_movement,
    metrics.space_occupation,
    metrics.press_resistance,
    metrics.role_discipline,
  ]);

  const physical = avg([
    metrics.intensity,
    metrics.sprint_output,
    metrics.workload,
    metrics.duel_power,
    metrics.stamina,
  ]);

  const defensive = avg([
    metrics.interceptions,
    metrics.tackling,
    metrics.duel_success,
    metrics.pressures,
    metrics.recoveries,
    lowerIsBetter(metrics.errors_leading_to_shot),
  ]);

  const attacking = avg([
    metrics.shot_quality,
    metrics.xg_contribution,
    metrics.xa_contribution,
    metrics.key_passes,
    metrics.final_third_actions,
    metrics.box_presence,
  ]);

  const risk = avg([
    lowerIsBetter(metrics.volatility),
    lowerIsBetter(metrics.error_risk),
    higherIsBetter(metrics.availability),
    higherIsBetter(metrics.consistency),
  ]);

  const rawScores: Record<CategoryKey, number> = {
    technical,
    tactical,
    physical,
    defensive,
    attacking,
    risk,
  };

  const weights = POSITION_WEIGHTS[position] || POSITION_WEIGHTS.CM;
  return (Object.keys(weights) as CategoryKey[]).map((key) => {
    const score = clampScore(rawScores[key]);
    return {
      key,
      label: CATEGORY_LABELS[key],
      score,
      weight: weights[key],
      reasons: categoryReasons(key, score, position),
    };
  });
}

function buildStrengths(categoryScores: CategoryScore[]) {
  return [...categoryScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((category) => `${category.label}: ${category.reasons[0]}`);
}

function buildWeaknesses(categoryScores: CategoryScore[]) {
  return [...categoryScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((category) => `${category.label}: ${category.reasons[0]}`);
}

function buildVerdict(score: number, position: FootballPosition) {
  if (score >= 82) return `${ROLE_LABELS[position]} مؤثر جدًا داخل الملعب ويستحق المتابعة الفنية.`;
  if (score >= 70) return `${ROLE_LABELS[position]} جيد تكتيكيًا وفنيًا مع قابلية للتطور.`;
  if (score >= 55) return `${ROLE_LABELS[position]} متوسط، يحتاج سياقًا مناسبًا حتى تظهر قيمته.`;
  return `${ROLE_LABELS[position]} عالي المخاطرة فنيًا ويحتاج مراجعة قبل الاعتماد عليه.`;
}

export function scorePlayerProfile(position: FootballPosition, metrics: MetricScores): PlayerScoringResult {
  const categoryScores = buildCategoryScores(position, metrics);
  const weightedScore = clampScore(categoryScores.reduce((sum, category) => sum + category.score * category.weight, 0));

  return {
    position,
    weightedScore,
    categoryScores,
    strengths: buildStrengths(categoryScores),
    weaknesses: buildWeaknesses(categoryScores),
    roleLabel: ROLE_LABELS[position] || ROLE_LABELS.CM,
    verdict: buildVerdict(weightedScore, position),
  };
}

export function mapPositionToAnalysisRole(position?: string | null, assetType?: string | null): FootballPosition {
  if (assetType === 'TEAM') return 'TEAM';
  const value = String(position || '').toUpperCase();
  if (['GK', 'G', 'GOALKEEPER'].includes(value)) return 'GK';
  if (['CB', 'CENTER_BACK', 'CENTRE_BACK'].includes(value)) return 'CB';
  if (['LB', 'RB', 'LWB', 'RWB', 'FB', 'DEFENDER'].includes(value)) return 'FB';
  if (['DM', 'CDM'].includes(value)) return 'DM';
  if (['CM', 'MID', 'MIDFIELDER'].includes(value)) return 'CM';
  if (['AM', 'CAM'].includes(value)) return 'AM';
  if (['LW', 'RW', 'WG', 'WINGER'].includes(value)) return 'WG';
  if (['ST', 'CF', 'FW', 'FWD', 'FORWARD', 'ATTACKER'].includes(value)) return 'ST';
  return 'CM';
}
