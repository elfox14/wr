export type PressNewsMeta = {
  keywords: string[];
  image?: string;
  imageAlt?: string;
  flagA?: string;
  flagB?: string;
  score?: string;
  label?: string;
};

export type WorldCupPressNewsSeedItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  sourceName: string;
  sourceUrl?: string;
  sourceType: string;
  language: string;
  status: string;
  importance: number;
  publishedAt: string;
  tags: PressNewsMeta;
};

const fifaArticle = (slug: string) =>
  `https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/${slug}`;

function makeMeta(id: string, keywords: string[], imageAlt: string, flagA: string, flagB: string, score: string, label: string): PressNewsMeta {
  return {
    keywords,
    image: `/news-image/${id}`,
    imageAlt,
    flagA,
    flagB,
    score,
    label,
  };
}

function articleBody(intro: string, keyMoment: string, analysis: string, question: string) {
  return [intro, keyMoment, analysis, question].join('\n\n');
}

export const WORLD_CUP_2026_OPENING_NEWS: WorldCupPressNewsSeedItem[] = [
  {
    id: 'world-cup-2026-mexico-south-africa-2-0',
    title: 'المكسيك تفتتح كأس العالم 2026 بفوز تاريخي على جنوب أفريقيا 2-0',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('mexico-south-africa-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 96,
    publishedAt: '2026-06-11T22:00:00.000Z',
    tags: makeMeta('world-cup-2026-mexico-south-africa-2-0', ['المكسيك جنوب أفريقيا كأس العالم 2026', 'خوليان كينيونيس', 'راؤول خيمينيز', 'المجموعة A'], 'المكسيك تفوز على جنوب أفريقيا في افتتاح كأس العالم 2026', '🇲🇽', '🇿🇦', '2 - 0', 'افتتاح البطولة'),
    body: articleBody(
      'افتتحت المكسيك كأس العالم 2026 بانتصار مهم على جنوب أفريقيا بنتيجة 2-0، لتبدأ صاحبة الأرض مشوارها بأفضل صورة ممكنة في المجموعة A.',
      'افتتح خوليان كينيونيس التسجيل بعد ضغط مكسيكي ناجح، ثم أضاف راؤول خيمينيز الهدف الثاني برأسية حاسمة في الشوط الثاني.',
      'شهدت المباراة ثلاث بطاقات حمراء، وهو ما منح المكسيك أفضلية واضحة وأبقى جنوب أفريقيا بعيدة عن العودة في النتيجة. الفوز يمنح المكسيك ثلاث نقاط وفارق أهداف مريح قبل مواجهة كوريا الجنوبية وتشيكيا.',
      'سؤال تفاعلي: هل ترى أن بداية المكسيك القوية كافية لجعلها مرشحة لتصدر المجموعة؟'
    ),
  },
  {
    id: 'world-cup-2026-korea-czechia-2-1',
    title: 'كوريا الجنوبية تقلب تأخرها أمام تشيكيا وتفوز 2-1 في بداية مثيرة',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('korea-republic-czechia-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 88,
    publishedAt: '2026-06-12T22:00:00.000Z',
    tags: makeMeta('world-cup-2026-korea-czechia-2-1', ['كوريا الجنوبية تشيكيا كأس العالم 2026', 'هوانغ إن بيوم', 'أو هيون غيو', 'المجموعة A'], 'كوريا الجنوبية تفوز على تشيكيا في كأس العالم 2026', '🇰🇷', '🇨🇿', '2 - 1', 'ريمونتادا آسيوية'),
    body: articleBody(
      'قلبت كوريا الجنوبية تأخرها أمام تشيكيا إلى فوز ثمين بنتيجة 2-1 ضمن منافسات المجموعة A.',
      'تقدمت تشيكيا عبر لاديسلاف كريتشي، قبل أن يرد هوانغ إن بيوم بهدف التعادل، ثم حسم أو هيون غيو المباراة بهدف الفوز.',
      'الفوز جعل المجموعة مشتعلة من الجولة الأولى، وأظهر أن سرعة كوريا في التحولات قد تكون عاملًا مؤثرًا في حسابات التأهل.',
      'سؤال تفاعلي: هل تستطيع كوريا الجنوبية منافسة المكسيك على صدارة المجموعة A؟'
    ),
  },
  {
    id: 'world-cup-2026-canada-bosnia-1-1',
    title: 'كندا تحصد نقطة تاريخية بتعادل مثير مع البوسنة 1-1',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('canada-bosnia-and-herzegovina-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 86,
    publishedAt: '2026-06-12T23:00:00.000Z',
    tags: makeMeta('world-cup-2026-canada-bosnia-1-1', ['كندا البوسنة كأس العالم 2026', 'سايل لارين', 'المجموعة B'], 'كندا تتعادل مع البوسنة وتحصد نقطة تاريخية في كأس العالم', '🇨🇦', '🇧🇦', '1 - 1', 'نقطة تاريخية'),
    body: articleBody(
      'خرجت كندا بنقطة مهمة أمام البوسنة والهرسك بعد تعادل 1-1 في تورنتو.',
      'تقدمت البوسنة أولًا، لكن سايل لارين منح كندا هدف التعادل في توقيت حاسم وأعاد الحياة للمدرجات.',
      'التعادل يحافظ على آمال كندا في مجموعة مفتوحة، بينما ستشعر البوسنة أنها فقدت فرصة الفوز بعد التقدم.',
      'سؤال تفاعلي: هل تكفي نقطة البداية لمنح كندا الثقة في باقي مباريات المجموعة؟'
    ),
  },
  {
    id: 'world-cup-2026-usa-paraguay-4-1',
    title: 'الولايات المتحدة تضرب باراغواي 4-1 في افتتاح قوي على أرضها',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('united-states-paraguay-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 94,
    publishedAt: '2026-06-13T23:00:00.000Z',
    tags: makeMeta('world-cup-2026-usa-paraguay-4-1', ['أمريكا باراغواي كأس العالم 2026', 'فولارين بالوغان', 'جيو ريينا', 'المجموعة D'], 'الولايات المتحدة تفوز على باراغواي 4-1 في كأس العالم 2026', '🇺🇸', '🇵🇾', '4 - 1', 'بداية المضيف'),
    body: articleBody(
      'بدأت الولايات المتحدة كأس العالم 2026 بفوز كبير على باراغواي بنتيجة 4-1.',
      'ظهر فولارين بالوغان بثنائية مهمة، وأضاف جيو ريينا هدفًا جميلًا في الوقت بدل الضائع ليؤكد تفوق أصحاب الأرض.',
      'النتيجة تمنح المنتخب الأمريكي دفعة قوية في المجموعة D، لكنها لا تلغي ضرورة الحذر قبل الاختبارات التالية.',
      'سؤال تفاعلي: هل هذه البداية تجعل أمريكا مرشحة لعبور مريح من المجموعة؟'
    ),
  },
  {
    id: 'world-cup-2026-qatar-switzerland-1-1',
    title: 'قطر تخطف نقطة تاريخية أمام سويسرا بهدف عكسي قاتل',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('qatar-switzerland-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 90,
    publishedAt: '2026-06-13T23:30:00.000Z',
    tags: makeMeta('world-cup-2026-qatar-switzerland-1-1', ['قطر سويسرا كأس العالم 2026', 'هدف عكسي', 'المجموعة B'], 'قطر تتعادل مع سويسرا بهدف قاتل في كأس العالم 2026', '🇶🇦', '🇨🇭', '1 - 1', 'هدف في +90'),
    body: articleBody(
      'خطف منتخب قطر نقطة تاريخية أمام سويسرا بعد تعادل 1-1 في نهاية درامية.',
      'تقدمت سويسرا بركلة جزاء عن طريق بريل إمبولو، قبل أن يأتي التعادل القطري في الوقت بدل الضائع عبر هدف عكسي من ميرو موهايم.',
      'النتيجة تحمل قيمة معنوية كبيرة لقطر وتجعل المجموعة B مفتوحة بعد تعادل كندا والبوسنة أيضًا.',
      'سؤال تفاعلي: هل يستطيع منتخب قطر البناء على هذه النقطة والمنافسة على التأهل؟'
    ),
  },
  {
    id: 'world-cup-2026-brazil-morocco-1-1',
    title: 'البرازيل والمغرب يتعادلان 1-1 في قمة مبكرة بكأس العالم 2026',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('brazil-morocco-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 93,
    publishedAt: '2026-06-14T22:00:00.000Z',
    tags: makeMeta('world-cup-2026-brazil-morocco-1-1', ['البرازيل المغرب كأس العالم 2026', 'فينيسيوس', 'إسماعيل صيباري', 'المجموعة C'], 'البرازيل والمغرب يتعادلان في كأس العالم 2026', '🇧🇷', '🇲🇦', '1 - 1', 'قمة مبكرة'),
    body: articleBody(
      'انتهت مواجهة البرازيل والمغرب بالتعادل 1-1 في واحدة من أقوى مباريات الجولة الافتتاحية.',
      'تقدم المغرب عن طريق إسماعيل صيباري، ثم رد فينيسيوس جونيور بهدف التعادل للبرازيل.',
      'النتيجة تؤكد أن المجموعة C لن تكون سهلة، وتمنح المغرب ثقة كبيرة في مواصلة المنافسة بعد إنجازه التاريخي في 2022.',
      'سؤال تفاعلي: هل كان المغرب أقرب للفوز أم أن التعادل عادل للفريقين؟'
    ),
  },
  {
    id: 'world-cup-2026-scotland-haiti-1-0',
    title: 'اسكتلندا تعود للمونديال بفوز تاريخي على هايتي 1-0',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('scotland-haiti-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 84,
    publishedAt: '2026-06-13T22:30:00.000Z',
    tags: makeMeta('world-cup-2026-scotland-haiti-1-0', ['اسكتلندا هايتي كأس العالم 2026', 'جون ماكغين', 'بن غانون-دوك', 'المجموعة C'], 'اسكتلندا تفوز على هايتي في كأس العالم 2026', '🏴', '🇭🇹', '1 - 0', 'عودة بعد غياب'),
    body: articleBody(
      'عادت اسكتلندا إلى أجواء كأس العالم بفوز ثمين على هايتي بنتيجة 1-0.',
      'جاء هدف اللقاء عبر جون ماكغين بعد هجمة بدأت من الجبهة اليسرى، ليمنح اسكتلندا لحظة تاريخية.',
      'هايتي حاولت العودة في الشوط الثاني، لكن اسكتلندا حافظت على النتيجة حتى النهاية وخرجت بثلاث نقاط مهمة.',
      'سؤال تفاعلي: هل يستطيع هذا الفوز دفع اسكتلندا نحو الدور التالي؟'
    ),
  },
  {
    id: 'world-cup-2026-australia-turkiye-2-0',
    title: 'أستراليا تفاجئ تركيا بفوز 2-0 وأداء مضاد منظم',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('australia-turkiye-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 87,
    publishedAt: '2026-06-14T23:00:00.000Z',
    tags: makeMeta('world-cup-2026-australia-turkiye-2-0', ['أستراليا تركيا كأس العالم 2026', 'إيرانكوندا', 'ميتكالف', 'المجموعة D'], 'أستراليا تفوز على تركيا بهدفين في كأس العالم 2026', '🇦🇺', '🇹🇷', '2 - 0', 'مفاجأة تكتيكية'),
    body: articleBody(
      'قدمت أستراليا بداية قوية في كأس العالم 2026 بفوز مستحق على تركيا بنتيجة 2-0.',
      'افتتح نستوري إيرانكوندا التسجيل بانطلاقة رائعة، ثم حسم كونر ميتكالف النتيجة بتسديدة بعيدة في الشوط الثاني.',
      'تركيا اصطدمت بفريق يعرف كيف يدافع بكتلة واحدة ثم يضرب في المساحات، ما يجعل أستراليا خصمًا صعبًا في المجموعة D.',
      'سؤال تفاعلي: هل كانت أستراليا مفاجأة الجولة في المجموعة D؟'
    ),
  },
  {
    id: 'world-cup-2026-germany-curacao-7-1',
    title: 'ألمانيا تمطر كوراساو بسباعية وتعلن نواياها مبكرًا',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('germany-curacao-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 92,
    publishedAt: '2026-06-14T23:30:00.000Z',
    tags: makeMeta('world-cup-2026-germany-curacao-7-1', ['ألمانيا كوراساو كأس العالم 2026', 'كاي هافرتز', 'جمال موسيالا', 'المجموعة E'], 'ألمانيا تفوز على كوراساو 7-1 في كأس العالم 2026', '🇩🇪', '🇨🇼', '7 - 1', 'انطلاقة كاسحة'),
    body: articleBody(
      'بدأت ألمانيا كأس العالم 2026 بانتصار كبير على كوراساو بنتيجة 7-1.',
      'وزع المنتخب الألماني خطورته على أكثر من لاعب، مع حضور واضح لكاي هافرتز وجمال موسيالا في الثلث الأخير.',
      'السباعية تمنح ألمانيا فارق أهداف ضخمًا وثقة مبكرة، بينما يبقى هدف كوراساو لحظة تاريخية في مشاركتها الأولى.',
      'سؤال تفاعلي: هل هذه النتيجة تعيد ألمانيا إلى دائرة المرشحين للقب؟'
    ),
  },
  {
    id: 'world-cup-2026-netherlands-japan-2-2',
    title: 'هولندا واليابان يتعادلان 2-2 في مباراة مثيرة حتى النهاية',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('netherlands-japan-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 89,
    publishedAt: '2026-06-14T23:45:00.000Z',
    tags: makeMeta('world-cup-2026-netherlands-japan-2-2', ['هولندا اليابان كأس العالم 2026', 'دايتشي كامادا', 'فان دايك', 'المجموعة F'], 'هولندا واليابان يتعادلان 2-2 في كأس العالم 2026', '🇳🇱', '🇯🇵', '2 - 2', 'تعادل درامي'),
    body: articleBody(
      'قدمت هولندا واليابان واحدة من أكثر مباريات الجولة الأولى إثارة، وانتهت المواجهة بالتعادل 2-2.',
      'افتتح فيرجيل فان دايك التسجيل، ثم تعادل كيتو ناكامورا. استعادت هولندا التقدم عبر سامرفيل، لكن دايتشي كامادا خطف التعادل قبل النهاية.',
      'اليابان أثبتت أنها قادرة على مجاراة الكبار، بينما تحتاج هولندا إلى مراجعة تعاملها مع نهايات المباريات.',
      'سؤال تفاعلي: هل كان تعادل اليابان إنذارًا حقيقيًا لهولندا؟'
    ),
  },
  {
    id: 'world-cup-2026-cote-divoire-ecuador-1-0',
    title: 'أماد ديالو يخطف فوز كوت ديفوار على الإكوادور في الدقيقة 90',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('cote-d-ivoire-ecuador-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 85,
    publishedAt: '2026-06-15T22:00:00.000Z',
    tags: makeMeta('world-cup-2026-cote-divoire-ecuador-1-0', ['كوت ديفوار الإكوادور كأس العالم 2026', 'أماد ديالو', 'المجموعة E'], 'كوت ديفوار تفوز على الإكوادور بهدف أماد ديالو', '🇨🇮', '🇪🇨', '1 - 0', 'هدف قاتل'),
    body: articleBody(
      'خطف منتخب كوت ديفوار فوزًا ثمينًا على الإكوادور بنتيجة 1-0.',
      'سجل أماد ديالو هدف المباراة الوحيد في الدقيقة 90، بعدما أهدر الإكوادور فرصًا واضحة في الشوط الأول.',
      'الفوز يمنح كوت ديفوار ثلاث نقاط ثمينة في مجموعة صعبة، بينما ستندم الإكوادور على عدم ترجمة أفضليتها المبكرة إلى أهداف.',
      'سؤال تفاعلي: هل كان ديالو رجل الجولة الأفريقية؟'
    ),
  },
  {
    id: 'world-cup-2026-sweden-tunisia-5-1',
    title: 'السويد تضرب تونس بخماسية وتظهر كإحدى مفاجآت كأس العالم 2026',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('sweden-tunisia-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 91,
    publishedAt: '2026-06-15T22:30:00.000Z',
    tags: makeMeta('world-cup-2026-sweden-tunisia-5-1', ['السويد تونس كأس العالم 2026', 'ياسين أياري', 'إيساك', 'غيوكيريس', 'المجموعة F'], 'السويد تفوز على تونس 5-1 في كأس العالم 2026', '🇸🇪', '🇹🇳', '5 - 1', 'خماسية سويدية'),
    body: articleBody(
      'قدمت السويد عرضًا هجوميًا كبيرًا أمام تونس وانتصرت بنتيجة 5-1.',
      'تألق ياسين أياري بثنائية، بينما سجل ألكسندر إيساك وفيكتور غيوكيريس وماتياس سفانبيرغ بقية الأهداف، وجاء هدف تونس عبر عمر الرقيق.',
      'السويد ظهرت كمنظومة هجومية متنوعة، أما تونس فتحتاج إلى رد فعل سريع على مستوى التنظيم الدفاعي.',
      'سؤال تفاعلي: هل ترى السويد حصانًا أسود حقيقيًا في هذه النسخة؟'
    ),
  },
  {
    id: 'world-cup-2026-spain-cabo-verde-0-0',
    title: 'الرأس الأخضر يصدم إسبانيا بتعادل تاريخي 0-0 في كأس العالم 2026',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('spain-cabo-verde-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 92,
    publishedAt: '2026-06-15T23:00:00.000Z',
    tags: makeMeta('world-cup-2026-spain-cabo-verde-0-0', ['إسبانيا الرأس الأخضر كأس العالم 2026', 'كابو فيردي', 'فوزينها', 'المجموعة H'], 'الرأس الأخضر يتعادل مع إسبانيا في كأس العالم 2026', '🇪🇸', '🇨🇻', '0 - 0', 'مفاجأة كبرى'),
    body: articleBody(
      'حقق منتخب الرأس الأخضر نتيجة تاريخية في أول ظهور له بكأس العالم، بعدما فرض التعادل السلبي 0-0 على إسبانيا.',
      'سيطرت إسبانيا على الكرة، لكنها اصطدمت بتنظيم دفاعي صلب وحارس متألق، ليخرج الرأس الأخضر بنقطة ذهبية.',
      'هذه النتيجة تضع ضغطًا مبكرًا على إسبانيا، وتؤكد أن المنتخب الأفريقي لم يأت للمشاركة فقط.',
      'سؤال تفاعلي: هل يمكن أن تكون نقطة الرأس الأخضر بداية لقصة تأهل تاريخية؟'
    ),
  },
  {
    id: 'world-cup-2026-egypt-belgium-1-1',
    title: 'مصر تفرض التعادل على بلجيكا 1-1 في بداية قوية للفراعنة',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('belgium-egypt-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 98,
    publishedAt: '2026-06-15T23:30:00.000Z',
    tags: makeMeta('world-cup-2026-egypt-belgium-1-1', ['مصر بلجيكا كأس العالم 2026', 'إمام عاشور', 'لوكاكو', 'المجموعة G'], 'مصر تتعادل مع بلجيكا في كأس العالم 2026', '🇪🇬', '🇧🇪', '1 - 1', 'بداية الفراعنة'),
    body: articleBody(
      'خرج منتخب مصر بنقطة مهمة أمام بلجيكا بعد تعادل 1-1 في بداية مشواره بكأس العالم 2026.',
      'افتتح إمام عاشور التسجيل بتسديدة قوية، قبل أن تعود بلجيكا في الشوط الثاني بعد كرة أربكت الدفاع المصري وانتهت بهدف عكسي.',
      'النقطة تضع مصر في وضع جيد داخل المجموعة G، خاصة مع تعادل إيران ونيوزيلندا في المباراة الأخرى.',
      'سؤال تفاعلي: هل ترى تعادل مصر مع بلجيكا بداية مبشرة للتأهل؟'
    ),
  },
  {
    id: 'world-cup-2026-saudi-uruguay-1-1',
    title: 'السعودية تقترب من مفاجأة جديدة وأوروغواي تخطف التعادل 1-1',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('saudi-arabia-uruguay-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 95,
    publishedAt: '2026-06-16T22:00:00.000Z',
    tags: makeMeta('world-cup-2026-saudi-uruguay-1-1', ['السعودية أوروغواي كأس العالم 2026', 'عبدالإله العمري', 'ماكسي أراوخو', 'المجموعة H'], 'السعودية تتعادل مع أوروغواي في كأس العالم 2026', '🇸🇦', '🇺🇾', '1 - 1', 'تعادل بطعم الفوز'),
    body: articleBody(
      'قدم المنتخب السعودي مباراة قوية أمام أوروغواي وانتهت المواجهة بالتعادل 1-1.',
      'تقدم عبدالإله العمري للسعودية قبل نهاية الشوط الأول، قبل أن تعود أوروغواي في الدقيقة 80 عبر ماكسي أراوخو.',
      'رغم ضياع الفوز في الدقائق الأخيرة، تبقى النقطة نتيجة إيجابية جدًا للأخضر أمام منتخب يمتلك خبرة كبيرة.',
      'سؤال تفاعلي: هل يستطيع المنتخب السعودي تحويل هذه البداية إلى تأهل؟'
    ),
  },
  {
    id: 'world-cup-2026-iran-new-zealand-2-2',
    title: 'إيران تعود مرتين وتتقاسم النقاط مع نيوزيلندا في تعادل 2-2',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('ir-iran-new-zealand-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 88,
    publishedAt: '2026-06-16T22:30:00.000Z',
    tags: makeMeta('world-cup-2026-iran-new-zealand-2-2', ['إيران نيوزيلندا كأس العالم 2026', 'إليجا جست', 'رامين رضائيان', 'المجموعة G'], 'إيران ونيوزيلندا يتعادلان 2-2 في كأس العالم 2026', '🇮🇷', '🇳🇿', '2 - 2', 'تعادل المجموعة G'),
    body: articleBody(
      'انتهت مباراة إيران ونيوزيلندا بالتعادل 2-2 في مواجهة مثيرة ضمن المجموعة G.',
      'تقدمت نيوزيلندا مرتين عبر إليجا جست، لكن إيران عادت بهدف رامين رضائيان ثم رأسية محمد محبي.',
      'النتيجة تجعل حسابات مصر وبلجيكا وإيران ونيوزيلندا متساوية تمامًا بعد الجولة الأولى.',
      'سؤال تفاعلي: من تراه الأقرب للتأهل من المجموعة G بعد تعادل الجميع؟'
    ),
  },
  {
    id: 'world-cup-2026-france-senegal-3-1',
    title: 'فرنسا ترد اعتبار 2002 بثلاثية أمام السنغال ومبابي يلمع مبكرًا',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('france-senegal-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 97,
    publishedAt: '2026-06-16T23:00:00.000Z',
    tags: makeMeta('world-cup-2026-france-senegal-3-1', ['فرنسا السنغال كأس العالم 2026', 'كيليان مبابي', 'برادلي باركولا', 'المجموعة I'], 'فرنسا تفوز على السنغال بثلاثية في كأس العالم 2026', '🇫🇷', '🇸🇳', '3 - 1', 'ثنائية مبابي'),
    body: articleBody(
      'بدأت فرنسا مشوارها في كأس العالم 2026 بفوز مهم على السنغال بنتيجة 3-1.',
      'سجل كيليان مبابي هدفين، وأضاف برادلي باركولا الهدف الثالث، بينما اكتفى المنتخب السنغالي بهدف لم يغير مسار المباراة.',
      'الفوز يؤكد أن فرنسا تدخل البطولة كمرشح جدي، بينما سيحتاج السنغال إلى رد فعل سريع في الجولة التالية.',
      'سؤال تفاعلي: هل يستطيع مبابي مطاردة رقم ميسي وكلوزه التاريخي في هذه النسخة؟'
    ),
  },
  {
    id: 'world-cup-2026-norway-iraq-4-1',
    title: 'هالاند يبدأ كأس العالم بثنائية تقود النرويج للفوز على العراق 4-1',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('iraq-norway-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 97,
    publishedAt: '2026-06-17T10:00:00.000Z',
    tags: makeMeta('world-cup-2026-norway-iraq-4-1', ['هالاند كأس العالم 2026', 'النرويج العراق', 'ثنائية هالاند', 'المجموعة I'], 'هالاند يقود النرويج للفوز على العراق في كأس العالم 2026', '🇳🇴', '🇮🇶', '4 - 1', 'ظهور هالاند'),
    body: articleBody(
      'بدأ إيرلينغ هالاند حكايته في كأس العالم بأفضل طريقة ممكنة، بعدما سجل هدفين في فوز النرويج على العراق بنتيجة 4-1.',
      'افتتح هالاند التسجيل ثم عاد ليسجل مجددًا قبل نهاية الشوط الأول، بينما سجل العراق عبر أيمن حسين.',
      'الفوز يمنح النرويج ثقة كبيرة في المجموعة I، كما يدخل هالاند مباشرة في سباق الحذاء الذهبي منذ الجولة الأولى.',
      'سؤال تفاعلي: هل يستطيع هالاند خطف الحذاء الذهبي من مبابي وميسي؟'
    ),
  },
  {
    id: 'world-cup-2026-argentina-algeria-messi-hattrick',
    title: 'ميسي يعادل رقم كلوزه التاريخي بهاتريك أمام الجزائر',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('argentina-v-algeria-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 100,
    publishedAt: '2026-06-17T11:00:00.000Z',
    tags: makeMeta('world-cup-2026-argentina-algeria-messi-hattrick', ['ميسي كأس العالم 2026', 'هاتريك ميسي', 'الأرجنتين الجزائر', 'رقم ميسي التاريخي', 'المجموعة J'], 'ميسي يسجل هاتريك أمام الجزائر ويعادل رقم كلوزه في كأس العالم', '🇦🇷', '🇩🇿', '3 - 0', 'هاتريك تاريخي'),
    body: articleBody(
      'كتب ليونيل ميسي فصلًا جديدًا في تاريخ كأس العالم بعدما سجل هاتريك قاد به الأرجنتين للفوز على الجزائر 3-0 ضمن المجموعة J.',
      'بهذه الثلاثية وصل ميسي إلى 16 هدفًا في تاريخ كأس العالم، معادلًا رقم ميروسلاف كلوزه كأفضل هداف في تاريخ البطولة.',
      'الجزائر حاولت مجاراة الأرجنتين، لكن جودة ميسي الفردية حسمت كل شيء. والأنظار تتجه الآن إلى إمكانية انفراده بالصدارة التاريخية.',
      'سؤال تفاعلي: هل تعتقد أن ميسي سيُنهي كأس العالم 2026 كأعظم هداف في تاريخ البطولة؟'
    ),
  },
  {
    id: 'world-cup-2026-austria-jordan-3-1',
    title: 'النمسا تكسر قلوب الأردن وتفوز 3-1 في الظهور التاريخي للنشامى',
    category: 'مباريات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('austria-jordan-highlights-match-report'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 96,
    publishedAt: '2026-06-17T12:00:00.000Z',
    tags: makeMeta('world-cup-2026-austria-jordan-3-1', ['النمسا الأردن كأس العالم 2026', 'علي علوان', 'أرناوتوفيتش', 'المجموعة J'], 'النمسا تفوز على الأردن في كأس العالم 2026', '🇦🇹', '🇯🇴', '3 - 1', 'أول هدف أردني'),
    body: articleBody(
      'كانت ليلة تاريخية للأردن رغم الخسارة أمام النمسا بنتيجة 3-1، إذ شهدت المباراة أول هدف للنشامى في تاريخ كأس العالم.',
      'تقدمت النمسا عبر رومانو شميد، ثم سجل علي علوان هدفًا تاريخيًا للأردن، قبل أن تحسم النمسا اللقاء بهدف عكسي وركلة جزاء متأخرة.',
      'الأردن خرج دون نقاط، لكنه خرج بلحظة ستبقى في ذاكرة الجماهير، بينما بدأت النمسا البطولة بثلاث نقاط مهمة.',
      'سؤال تفاعلي: هل يستطيع الأردن التعويض في المباراة القادمة رغم الخسارة الافتتاحية؟'
    ),
  },
  {
    id: 'world-cup-2026-top-scorers-june-17',
    title: 'ترتيب هدافي كأس العالم 2026 حتى 17 يونيو: ميسي في الصدارة',
    category: 'إحصائيات',
    sourceName: 'تحرير بورصة المونديال',
    sourceUrl: fifaArticle('adidas-golden-boot-race-top-scorer'),
    sourceType: 'editorial',
    language: 'ar',
    status: 'published',
    importance: 99,
    publishedAt: '2026-06-17T13:00:00.000Z',
    tags: makeMeta('world-cup-2026-top-scorers-june-17', ['ترتيب هدافي كأس العالم 2026', 'الحذاء الذهبي 2026', 'ميسي', 'مبابي', 'هالاند'], 'ترتيب هدافي كأس العالم 2026 بعد الجولة الأولى', '🏆', '⚽', '3 أهداف', 'سباق الهدافين'),
    body: articleBody(
      'اشتعل سباق الحذاء الذهبي مبكرًا في كأس العالم 2026، بعدما تصدر ليونيل ميسي الترتيب بثلاثة أهداف عقب هاتريكه التاريخي أمام الجزائر.',
      'حتى 17 يونيو 2026، يأتي ميسي في الصدارة برصيد 3 أهداف، وخلفه مجموعة من اللاعبين برصيد هدفين: كيليان مبابي، إيرلينغ هالاند، ياسين أياري، كاي هافرتز، فولارين بالوغان، وإليجا جست.',
      'المنافسة ما زالت في بدايتها، لكن أسماء مثل مبابي وهالاند تمنح السباق طابعًا خاصًا، وقد يتغير الترتيب سريعًا مع استمرار دور المجموعات.',
      'سؤال تفاعلي: من ترشحه للفوز بالحذاء الذهبي في كأس العالم 2026؟'
    ),
  },
];

export function getPressNewsMeta(tags: unknown, fallbackTitle = ''): PressNewsMeta {
  if (typeof tags === 'string') {
    const rawTags = tags;
    try {
      return getPressNewsMeta(JSON.parse(rawTags), fallbackTitle);
    } catch {
      return {
        keywords: rawTags.split(',').map((item: string) => item.trim()).filter(Boolean),
        imageAlt: fallbackTitle,
      };
    }
  }

  if (Array.isArray(tags)) {
    return {
      keywords: tags.map((item) => String(item).trim()).filter(Boolean),
      imageAlt: fallbackTitle,
    };
  }

  if (tags && typeof tags === 'object') {
    const meta = tags as Partial<PressNewsMeta>;
    return {
      keywords: Array.isArray(meta.keywords) ? meta.keywords.map((item) => String(item).trim()).filter(Boolean) : [],
      image: typeof meta.image === 'string' ? meta.image : undefined,
      imageAlt: typeof meta.imageAlt === 'string' ? meta.imageAlt : fallbackTitle,
      flagA: typeof meta.flagA === 'string' ? meta.flagA : undefined,
      flagB: typeof meta.flagB === 'string' ? meta.flagB : undefined,
      score: typeof meta.score === 'string' ? meta.score : undefined,
      label: typeof meta.label === 'string' ? meta.label : undefined,
    };
  }

  return { keywords: [], imageAlt: fallbackTitle };
}

let seedPromise: Promise<void> | null = null;

async function seedWorldCupOpeningNews(prisma: any) {
  for (const item of WORLD_CUP_2026_OPENING_NEWS) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PressNews" (
        "id", "title", "body", "category", "sourceName", "sourceUrl", "sourceType", "language", "status", "importance", "tags", "publishedAt", "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET
        "title" = EXCLUDED."title",
        "body" = EXCLUDED."body",
        "category" = EXCLUDED."category",
        "sourceName" = EXCLUDED."sourceName",
        "sourceUrl" = EXCLUDED."sourceUrl",
        "sourceType" = EXCLUDED."sourceType",
        "language" = EXCLUDED."language",
        "status" = EXCLUDED."status",
        "importance" = EXCLUDED."importance",
        "tags" = EXCLUDED."tags",
        "publishedAt" = EXCLUDED."publishedAt",
        "updatedAt" = CURRENT_TIMESTAMP`,
      item.id,
      item.title,
      item.body,
      item.category,
      item.sourceName,
      item.sourceUrl || null,
      item.sourceType,
      item.language,
      item.status,
      item.importance,
      JSON.stringify(item.tags),
      new Date(item.publishedAt)
    );
  }
}

export async function ensureWorldCup2026OpeningNews(prisma: any) {
  if (!seedPromise) {
    seedPromise = seedWorldCupOpeningNews(prisma).catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}
