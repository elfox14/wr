export type AthleticEditorialCardKey =
  | 'summary'
  | 'identity'
  | 'attack'
  | 'defense'
  | 'midfield'
  | 'setPieces'
  | 'players'
  | 'missing'
  | 'sources';

export type AthleticEditorialTemplate = {
  cardKey: AthleticEditorialCardKey;
  titleAr: string;
  objectiveAr: string;
  whatToExtract: string[];
  acceptedInput: Array<'article_url' | 'newsletter_item' | 'short_excerpt' | 'user_summary'>;
  editorialRules: string[];
  unavailableFallback: string;
};

export const athleticEditorialTemplates: AthleticEditorialTemplate[] = [
  {
    cardKey: 'summary',
    titleAr: 'ملخص تنفيذي موثق',
    objectiveAr: 'تحويل أهم فكرة في المقال إلى خلاصة قصيرة لا تتضمن توقعات نهائية أو نصائح تداول.',
    whatToExtract: [
      'main team storyline',
      'coach direction or tactical theme',
      'injury or squad context when explicitly mentioned',
      'one clear editorial takeaway',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Do not copy long excerpts from The Athletic.',
      'Use short paraphrased summaries only.',
      'No qualification probabilities or buy/sell recommendations in football analysis.',
    ],
    unavailableFallback: 'لا يتوفر ملخص تحريري موثق من The Athletic لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'identity',
    titleAr: 'بطاقة المنتخب وهوية اللعب',
    objectiveAr: 'استخراج هوية اللعب أو سياق المدرب عندما يذكرها المقال صراحة.',
    whatToExtract: [
      'playing style',
      'pressing approach',
      'build-up approach',
      'coach quotes or reported tactical direction',
      'squad identity narrative',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Only describe tactical identity if the source supports it.',
      'If the source is narrative only, label it as editorial context.',
      'Do not invent formations or tactical numbers.',
    ],
    unavailableFallback: 'هوية اللعب أو توجه المدرب غير متوفر في المصادر التحريرية الحالية.',
  },
  {
    cardKey: 'attack',
    titleAr: 'القوة الهجومية',
    objectiveAr: 'استخدام The Athletic لتفسير أدوار الهجوم وليس لاختراع أرقام هجومية.',
    whatToExtract: [
      'attacking roles',
      'key attacking patterns',
      'wide play / transitions / central combinations',
      'named attackers only when mentioned by source',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Use Sports Reference / FBref for numbers when available.',
      'The Athletic can explain style, not replace missing metrics.',
      'Do not name النجم الأبرز unless the source explicitly frames the player that way.',
    ],
    unavailableFallback: 'لا توجد قراءة هجومية موثقة من The Athletic لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'defense',
    titleAr: 'القوة الدفاعية',
    objectiveAr: 'استخراج سياق التنظيم الدفاعي أو المشاكل الدفاعية الموثقة.',
    whatToExtract: [
      'defensive shape',
      'pressing block',
      'transition defense',
      'injury or selection issues in defense',
      'reported defensive weakness',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Do not add goals conceded, xGA, or clean sheets unless supplied by a stats source.',
      'Use phrases like reported/editorial context when the source is narrative.',
    ],
    unavailableFallback: 'لا توجد قراءة دفاعية موثقة من The Athletic لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'midfield',
    titleAr: 'وسط الملعب والتحكم',
    objectiveAr: 'تلخيص أدوار الوسط والتحكم بالكرة كما يصفها المصدر.',
    whatToExtract: [
      'midfield balance',
      'ball progression',
      'press resistance',
      'creative responsibility',
      'reported midfield weakness or strength',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Do not invent possession or pass completion percentages.',
      'If numbers are absent, state غير متوفر في المصادر.',
    ],
    unavailableFallback: 'لا توجد قراءة موثقة عن وسط الملعب والتحكم من The Athletic حاليًا.',
  },
  {
    cardKey: 'setPieces',
    titleAr: 'الكرات الثابتة',
    objectiveAr: 'التقاط أي إشارة تحريرية عن الكرات الثابتة إذا كانت محورًا في المقال.',
    whatToExtract: [
      'set-piece strength',
      'set-piece vulnerability',
      'penalty/free-kick/corner context',
      'named set-piece takers only if mentioned',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Do not infer set-piece quality without source support.',
      'Prefer stats source for set-piece goal counts.',
    ],
    unavailableFallback: 'مؤشرات الكرات الثابتة غير متوفرة في The Athletic لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'players',
    titleAr: 'أسماء بارزة في القائمة',
    objectiveAr: 'استخراج اللاعبين المذكورين في المقال دون تحويلهم تلقائيًا إلى نجم أبرز.',
    whatToExtract: [
      'players explicitly mentioned',
      'role description',
      'injury status if reported',
      'selection debate',
      'coach comments about player',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Use the title أسماء بارزة في القائمة unless the source explicitly calls a player star/key player.',
      'Do not create individual ratings from editorial text alone.',
    ],
    unavailableFallback: 'لا توجد أسماء فردية كافية موثقة من The Athletic لهذا المنتخب حاليًا.',
  },
  {
    cardKey: 'missing',
    titleAr: 'معلومات غير متوفرة',
    objectiveAr: 'تسجيل ما لا يقدمه المقال حتى لا يتحول التحليل إلى افتراضات.',
    whatToExtract: [
      'missing stats',
      'missing official squad details',
      'missing injury confirmation',
      'missing tactical numbers',
    ],
    acceptedInput: ['article_url', 'newsletter_item', 'short_excerpt', 'user_summary'],
    editorialRules: [
      'Any absent metric must remain غير متوفر في المصادر.',
      'Do not fill gaps from memory or internal estimates.',
    ],
    unavailableFallback: 'أي معلومة غير مذكورة صراحة في المصدر التحريري أو الإحصائي تظل: غير متوفر في المصادر.',
  },
];

export function getAthleticEditorialTemplate(cardKey: AthleticEditorialCardKey) {
  return athleticEditorialTemplates.find((template) => template.cardKey === cardKey) || null;
}
