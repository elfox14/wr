import type { TeamIntelligenceSeedReport } from './seedTeamIntelligenceReports';

type GroupReportTeam = {
  arName: string;
  codes: string[];
};

type GroupReportConfig = {
  key: string;
  arName: string;
  sourceUrl: string;
  teams: GroupReportTeam[];
};

const GROUPS: GroupReportConfig[] = [
  {
    key: 'F',
    arName: 'السادسة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_F',
    teams: [
      { arName: 'هولندا', codes: ['NED', 'NLD', 'NL', 'NETHERLANDS', 'HOLLAND'] },
      { arName: 'اليابان', codes: ['JPN', 'JP', 'JAPAN'] },
      { arName: 'السويد', codes: ['SWE', 'SE', 'SWEDEN'] },
      { arName: 'تونس', codes: ['TUN', 'TN', 'TUNISIA'] },
    ],
  },
  {
    key: 'G',
    arName: 'السابعة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_G',
    teams: [
      { arName: 'بلجيكا', codes: ['BEL', 'BE', 'BELGIUM'] },
      { arName: 'مصر', codes: ['EGY', 'EG', 'EGYPT'] },
      { arName: 'إيران', codes: ['IRN', 'IR', 'IRAN'] },
      { arName: 'نيوزيلندا', codes: ['NZL', 'NZ', 'NEW ZEALAND'] },
    ],
  },
  {
    key: 'H',
    arName: 'الثامنة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_H',
    teams: [
      { arName: 'إسبانيا', codes: ['ESP', 'ES', 'SPAIN', 'ESPAÑA'] },
      { arName: 'الرأس الأخضر', codes: ['CPV', 'CV', 'CAPE VERDE', 'CABO VERDE'] },
      { arName: 'السعودية', codes: ['KSA', 'SA', 'SAUDI ARABIA'] },
      { arName: 'أوروغواي', codes: ['URU', 'UY', 'UR', 'URY', 'URUGUAY', 'أوروغواي', 'اوروجواي'] },
    ],
  },
  {
    key: 'I',
    arName: 'التاسعة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_I',
    teams: [
      { arName: 'فرنسا', codes: ['FRA', 'FR', 'FRANCE'] },
      { arName: 'السنغال', codes: ['SEN', 'SN', 'SENEGAL'] },
      { arName: 'العراق', codes: ['IRQ', 'IQ', 'IRAQ'] },
      { arName: 'النرويج', codes: ['NOR', 'NO', 'NORWAY'] },
    ],
  },
  {
    key: 'J',
    arName: 'العاشرة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_J',
    teams: [
      { arName: 'الأرجنتين', codes: ['ARG', 'AR', 'ARGENTINA'] },
      { arName: 'الجزائر', codes: ['ALG', 'DZ', 'DZA', 'ALGERIA'] },
      { arName: 'النمسا', codes: ['AUT', 'AT', 'AUSTRIA'] },
      { arName: 'الأردن', codes: ['JOR', 'JO', 'JORDAN'] },
    ],
  },
  {
    key: 'K',
    arName: 'الحادية عشرة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_K',
    teams: [
      { arName: 'البرتغال', codes: ['POR', 'PT', 'PORTUGAL'] },
      { arName: 'الكونغو الديمقراطية', codes: ['COD', 'DRC', 'CD', 'DR CONGO', 'CONGO DR', 'DEMOCRATIC REPUBLIC OF THE CONGO'] },
      { arName: 'أوزبكستان', codes: ['UZB', 'UZ', 'UZBEKISTAN'] },
      { arName: 'كولومبيا', codes: ['COL', 'CO', 'COLOMBIA'] },
    ],
  },
  {
    key: 'L',
    arName: 'الثانية عشرة',
    sourceUrl: 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_Group_L',
    teams: [
      { arName: 'إنجلترا', codes: ['ENG', 'EN', 'ENGLAND'] },
      { arName: 'كرواتيا', codes: ['CRO', 'HR', 'CROATIA'] },
      { arName: 'غانا', codes: ['GHA', 'GH', 'GHANA'] },
      { arName: 'بنما', codes: ['PAN', 'PA', 'PANAMA'] },
    ],
  },
];

function buildBody(teamName: string, group: GroupReportConfig) {
  const groupTeams = group.teams.map((team) => team.arName).join('، ');
  return `بطاقة المنتخب: ${teamName}، المجموعة ${group.arName}. تضم المجموعة: ${groupTeams}.

ملخص تنفيذي موثق: المصادر المستخدمة تؤكد وجود ${teamName} في المجموعة ${group.arName} لكأس العالم 2026. لا يستخدم هذا التقرير أي أرقام أداء غير مذكورة صراحة في المصادر.

القوة الهجومية: غير متوفر في المصادر. لا توجد حزمة موثقة كافية عن الأهداف، التسديدات، التسديدات على المرمى، أو جودة الفرص.

القوة الدفاعية: غير متوفر في المصادر. لا توجد حزمة موثقة كافية عن الأهداف المستقبلة، الشباك النظيفة، الضغط، أو الاسترجاع.

وسط الملعب والتحكم: غير متوفر في المصادر. لا توجد بيانات موثقة كافية عن الاستحواذ، دقة التمرير، التمريرات التقدمية، أو السيطرة على الإيقاع.

الكرات الثابتة: غير متوفر في المصادر. لا توجد بيانات موثقة كافية عن الركلات الركنية، الأخطاء الجانبية، أو الأهداف من الكرات الثابتة.

أسماء بارزة في القائمة: غير متوفر في المصادر. لا يتم اختيار أسماء فردية دون مصدر صريح داخل التقرير.

معلومات غير متوفرة في المصادر الحالية: المدرب، القائد، النجم الأبرز بشكل صريح، الرسم الخططي المتوقع، إحصائيات آخر 10 مباريات، الاستحواذ، دقة التمرير، التسديدات، التسديدات على المرمى، والإحصائيات الفردية المتقدمة.

سجل المصادر: تم الاعتماد على صفحة المجموعة المرجعية المتاحة وسياق Reuters العام للبطولة. أي تحديث لاحق من Sports Reference / FBref / Stathead أو FIFA يمكن إضافته من لوحة الأتمتة.

الخلاصة: هذا تقرير افتتاحي جاهز للنشر يحافظ على حدود المصادر، ويفصل بين التحليل الكروي وبين أي تقييمات تداول أو نصائح مالية.`;
}

function buildReport(group: GroupReportConfig, team: GroupReportTeam): TeamIntelligenceSeedReport {
  const groupTeams = group.teams.map((item) => item.arName).join('، ');
  return {
    teamCodes: team.codes,
    title: `تحليل كروي مبدئي — منتخب ${team.arName} 2026`,
    summary: `${team.arName} يدخل المجموعة ${group.arName} ضمن كأس العالم 2026 مع ${groupTeams}. التقرير يثبت بطاقة المجموعة فقط، ويترك التفاصيل الرقمية غير الموثقة كـ غير متوفر في المصادر.`,
    body: buildBody(team.arName, group),
    sourceName: `2026 FIFA World Cup Group ${group.key} reference + Reuters tournament overview`,
    sourceUrl: group.sourceUrl,
    sourceCategory: 'analysis',
    confidence: 'C',
    provider: 'MC_PRIME_CURATED',
    tacticalTags: [`المجموعة ${group.arName}`, 'تحليل مبدئي', 'بطاقة مجموعة موثقة', 'بيانات رقمية محدودة'],
    strengths: ['وجود بطاقة مجموعة موثقة', 'قابلية التحديث من لوحة الأتمتة', 'عدم إدخال أرقام غير موثقة'],
    weaknesses: ['عدم توفر حزمة رقمية موثقة لآخر 10 مباريات', 'عدم توفر الرسم الخططي الرسمي', 'عدم توفر إحصاءات فردية متقدمة'],
    metrics: {
      model: `group-${group.key.toLowerCase()}-curated-v1`,
      dataDepth: 'group-card-only-with-reuters-overview',
      group: group.key,
      matchesAnalyzed: null,
      unavailable: ['explicit star player', 'official expected formation', 'last 10 matches record', 'possession', 'shots', 'shots on target', 'pass accuracy', 'advanced player stats'],
    },
  };
}

export const groupFToLWorldCupReports: TeamIntelligenceSeedReport[] = GROUPS.flatMap((group) => group.teams.map((team) => buildReport(group, team)));
