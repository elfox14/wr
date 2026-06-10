export type SourceConfidence = 'A' | 'B' | 'C' | 'D';

export type TeamDataSource = {
  key: string;
  label: string;
  category: 'official' | 'stats' | 'analysis' | 'editorial';
  confidence: SourceConfidence;
  url?: string;
  description: string;
  connected: boolean;
};

export type SourcedMetric = {
  key: string;
  label: string;
  value: string | number;
  sourceKey: string;
  confidence: SourceConfidence;
  note: string;
};

export const TEAM_INTELLIGENCE_SOURCES: TeamDataSource[] = [
  {
    key: 'fifa-ranking',
    label: 'FIFA/Coca-Cola Men\'s World Ranking',
    category: 'official',
    confidence: 'A',
    url: 'https://www.fifa.com/en/fifa-world-ranking/men',
    description: 'مصدر رسمي لتصنيف المنتخبات ونقاط التصنيف عند توفرها.',
    connected: true,
  },
  {
    key: 'football-data',
    label: 'football-data.org World Cup API',
    category: 'stats',
    confidence: 'B',
    url: 'https://www.football-data.org/documentation/quickstart',
    description: 'مصدر آلي للمباريات، النتائج، المنتخبات، والجداول عند توفر مفتاح API.',
    connected: true,
  },
  {
    key: 'api-football',
    label: 'API-Football',
    category: 'stats',
    confidence: 'B',
    url: 'https://www.api-football.com/documentation-v3',
    description: 'مصدر آلي للتشكيلات، اللاعبين، وبعض إحصائيات المباريات عند توفر الاشتراك والمفتاح.',
    connected: true,
  },
  {
    key: 'platform-model',
    label: 'MC PRIME Internal Football Model',
    category: 'editorial',
    confidence: 'D',
    description: 'نموذج داخلي يحول البيانات المتاحة إلى مؤشرات مثل قوة الخطوط، الزخم، المخاطر، والقيمة الفنية.',
    connected: true,
  },
  {
    key: 'opta',
    label: 'Opta / Stats Perform',
    category: 'analysis',
    confidence: 'B',
    description: 'مصدر تحليلي احترافي للـ xG والنماذج المتقدمة؛ يحتاج ترخيصًا تجاريًا قبل استخدامه داخل المنتج.',
    connected: false,
  },
  {
    key: 'statsbomb',
    label: 'StatsBomb',
    category: 'analysis',
    confidence: 'B',
    description: 'مصدر بيانات أحداث متقدمة مثل xG، الضغط، التمريرات التقدمية؛ البيانات الحديثة عادةً تحتاج ترخيصًا.',
    connected: false,
  },
  {
    key: 'wyscout',
    label: 'Wyscout / Hudl',
    category: 'analysis',
    confidence: 'B',
    description: 'مصدر فيديو وكشافين وتحليل لاعبين؛ يحتاج ترخيصًا ولا يجب سحب بياناته بدون اتفاق رسمي.',
    connected: false,
  },
];

export function getSourceByKey(sourceKey: string) {
  return TEAM_INTELLIGENCE_SOURCES.find((source) => source.key === sourceKey);
}

export function getSourceBadge(confidence: SourceConfidence) {
  if (confidence === 'A') return 'رسمي';
  if (confidence === 'B') return 'إحصائي موثوق';
  if (confidence === 'C') return 'إجماع تحليلي';
  return 'تقدير داخلي';
}

export function buildTeamSourcedMetrics(team: any, players: any[], lineScores: { attack: number; midfield: number; defense: number; goalkeeper: number; teamPower: number; avgPlayerScore: number; }) {
  const metrics: SourcedMetric[] = [];

  metrics.push({
    key: 'fifaRank',
    label: 'تصنيف FIFA',
    value: team.fifaRank ? `#${team.fifaRank}` : 'غير متاح',
    sourceKey: 'fifa-ranking',
    confidence: 'A',
    note: team.fifaRank ? 'رقم تصنيف محفوظ في قاعدة البيانات من طبقة FIFA Ranking.' : 'لم يتم حفظ التصنيف لهذا المنتخب بعد.',
  });

  metrics.push({
    key: 'matches',
    label: 'المباريات المرتبطة',
    value: Number((team.homeMatches || []).length + (team.awayMatches || []).length),
    sourceKey: 'football-data',
    confidence: 'B',
    note: 'يعتمد على مباريات World Cup المخزنة من مزامنة football-data.org.',
  });

  metrics.push({
    key: 'squadPlayers',
    label: 'اللاعبون المرتبطون',
    value: players.length || 'غير مكتمل',
    sourceKey: 'api-football',
    confidence: players.length ? 'B' : 'D',
    note: players.length ? 'قائمة لاعبين مرتبطة بالمنتخب داخل قاعدة البيانات.' : 'لا توجد قائمة لاعبين كافية؛ سيتم عرض مؤشرات تقديرية فقط.',
  });

  metrics.push({
    key: 'teamPower',
    label: 'القوة الفنية المركبة',
    value: `${lineScores.teamPower}/100`,
    sourceKey: 'platform-model',
    confidence: 'D',
    note: 'مؤشر داخلي مشتق من جودة القائمة، الزخم، الخبرة، والانسجام، وليس رقمًا رسميًا من مصدر خارجي.',
  });

  metrics.push({
    key: 'lineStrength',
    label: 'قوة الخطوط',
    value: `هجوم ${lineScores.attack} / وسط ${lineScores.midfield} / دفاع ${lineScores.defense}`,
    sourceKey: players.length ? 'api-football' : 'platform-model',
    confidence: players.length ? 'B' : 'D',
    note: players.length ? 'مشتقة من اللاعبين المرتبطين ومراكزهم وتقييماتهم.' : 'تقدير داخلي بسبب عدم اكتمال بيانات اللاعبين.',
  });

  return metrics;
}
