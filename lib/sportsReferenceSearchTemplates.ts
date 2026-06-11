export type SportsReferenceCardKey =
  | 'summary'
  | 'identity'
  | 'attack'
  | 'defense'
  | 'midfield'
  | 'setPieces'
  | 'players'
  | 'missing'
  | 'sources';

export type SportsReferenceSearchTemplate = {
  cardKey: SportsReferenceCardKey;
  titleAr: string;
  objectiveAr: string;
  suggestedSearches: string[];
  usefulFields: string[];
  acceptedInput: Array<'source_url' | 'csv_export' | 'copied_results'>;
  unavailableFallback: string;
};

export const sportsReferenceSearchTemplates: SportsReferenceSearchTemplate[] = [
  {
    cardKey: 'summary',
    titleAr: 'ملخص تنفيذي موثق',
    objectiveAr: 'تلخيص أهم أرقام المنتخب أو اللاعبين في جملة قصيرة قابلة للنشر.',
    suggestedSearches: [
      'Team standard stats for the relevant competition/season',
      'Recent team match logs where available',
      'Team comparison by goals, expected goals, shots, and goals against',
    ],
    usefulFields: ['matches', 'goals_for', 'goals_against', 'xg', 'xga', 'shots', 'shots_on_target'],
    acceptedInput: ['source_url', 'csv_export', 'copied_results'],
    unavailableFallback: 'لا تتوفر حزمة إحصائية مختصرة موثقة من Sports Reference / FBref لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'identity',
    titleAr: 'بطاقة المنتخب',
    objectiveAr: 'تثبيت المعلومات الأساسية التي لا يجب أن تكون تقديرية.',
    suggestedSearches: [
      'Team page / squad page on FBref or Sports Reference where available',
      'Competition participant page for the national team',
    ],
    usefulFields: ['team_name', 'competition', 'season', 'coach', 'squad', 'minutes'],
    acceptedInput: ['source_url', 'copied_results'],
    unavailableFallback: 'المدرب أو القائمة الرسمية أو بيانات البطولة غير متوفرة في Sports Reference / FBref لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'attack',
    titleAr: 'القوة الهجومية',
    objectiveAr: 'استخراج أرقام الهجوم بدون توقعات أو أحكام غير موثقة.',
    suggestedSearches: [
      'Team shooting stats',
      'Player shooting stats for squad players',
      'Expected goals / non-penalty xG where available',
    ],
    usefulFields: ['goals', 'xg', 'npxg', 'shots', 'shots_on_target', 'shots_on_target_percentage', 'goals_per_shot'],
    acceptedInput: ['source_url', 'csv_export', 'copied_results'],
    unavailableFallback: 'xG، التسديدات، والتسديدات على المرمى غير متوفرة في المصادر الحالية.',
  },
  {
    cardKey: 'defense',
    titleAr: 'القوة الدفاعية',
    objectiveAr: 'تثبيت صلابة الدفاع من أرقام موثقة فقط.',
    suggestedSearches: [
      'Team standard stats: goals against and clean sheets',
      'Team defensive actions',
      'Goalkeeper and defender stats for squad players',
    ],
    usefulFields: ['goals_against', 'xga', 'clean_sheets', 'tackles', 'interceptions', 'blocks', 'clearances'],
    acceptedInput: ['source_url', 'csv_export', 'copied_results'],
    unavailableFallback: 'xGA، الشباك النظيفة، والأرقام الدفاعية التفصيلية غير متوفرة في المصادر الحالية.',
  },
  {
    cardKey: 'midfield',
    titleAr: 'وسط الملعب والتحكم',
    objectiveAr: 'قياس التحكم والتمرير والتقدم بالكرة من أرقام واضحة.',
    suggestedSearches: [
      'Team passing stats',
      'Player passing stats for midfielders',
      'Progressive passes and carries where available',
    ],
    usefulFields: ['possession', 'passes_completed', 'passes_attempted', 'pass_completion_percentage', 'progressive_passes', 'progressive_carries'],
    acceptedInput: ['source_url', 'csv_export', 'copied_results'],
    unavailableFallback: 'الاستحواذ، دقة التمرير، والتمريرات التقدمية غير متوفرة في المصادر الحالية.',
  },
  {
    cardKey: 'setPieces',
    titleAr: 'الكرات الثابتة',
    objectiveAr: 'تحديد أثر الركلات الركنية والكرات الثابتة دون تخمين.',
    suggestedSearches: [
      'Team miscellaneous stats where set-piece fields are available',
      'Shot-creating actions from dead balls where available',
      'Corners / free kicks / penalties where available',
    ],
    usefulFields: ['corners', 'free_kicks', 'penalties_scored', 'penalties_attempted', 'dead_ball_sca', 'set_piece_goals'],
    acceptedInput: ['source_url', 'csv_export', 'copied_results'],
    unavailableFallback: 'أهداف الكرات الثابتة، الركنيات، ومؤشرات الكرات الميتة غير متوفرة في المصادر الحالية.',
  },
  {
    cardKey: 'players',
    titleAr: 'أسماء بارزة في القائمة',
    objectiveAr: 'عرض أسماء مذكورة أو مدعومة بأرقام دون تسمية النجم الأبرز إلا بمصدر صريح.',
    suggestedSearches: [
      'Player standard stats for squad players',
      'Player shooting / passing / defensive stats by position',
      'Minutes played and goal contributions',
    ],
    usefulFields: ['player', 'club', 'position', 'minutes', 'goals', 'assists', 'xg', 'xa', 'starts'],
    acceptedInput: ['source_url', 'csv_export', 'copied_results'],
    unavailableFallback: 'لا توجد إحصائيات فردية كافية لتسمية لاعب مؤثر؛ استخدم عنوان أسماء بارزة في القائمة.',
  },
  {
    cardKey: 'missing',
    titleAr: 'معلومات غير متوفرة',
    objectiveAr: 'توضيح ما لم نستطع توثيقه بدل ملئه بتقديرات داخلية.',
    suggestedSearches: [
      'Review missing fields after completing all searches',
    ],
    usefulFields: ['xg', 'xga', 'shots', 'shots_on_target', 'possession', 'pass_completion_percentage', 'set_piece_goals', 'official_squad'],
    acceptedInput: ['copied_results'],
    unavailableFallback: 'أي رقم غير موجود في المصدر أو التصدير يكتب صراحة: غير متوفر في المصادر.',
  },
];

export function getSportsReferenceSearchTemplate(cardKey: SportsReferenceCardKey) {
  return sportsReferenceSearchTemplates.find((template) => template.cardKey === cardKey) || null;
}
