export const TEAM_REPORT_REQUIRED_SECTIONS = [
  'بطاقة المنتخب',
  'ملخص تنفيذي موثق',
  'القوة الهجومية',
  'القوة الدفاعية',
  'وسط الملعب والتحكم',
  'الكرات الثابتة',
  'أسماء بارزة في القائمة',
  'معلومات غير متوفرة',
  'سجل المصادر',
] as const;

const UNAVAILABLE = 'غير متوفر في المصادر';

export function getMissingTeamReportSections(body?: string | null) {
  const value = body || '';
  return TEAM_REPORT_REQUIRED_SECTIONS.filter((section) => !value.includes(section));
}

type NormalizeTeamReportBodyInput = {
  teamName: string;
  title: string;
  summary: string;
  body?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

export function normalizeTeamReportBody(input: NormalizeTeamReportBodyInput) {
  const currentBody = (input.body || '').trim();
  const missingSections = getMissingTeamReportSections(currentBody);

  if (!missingSections.length) {
    return {
      changed: false,
      body: currentBody,
      missingSections: [],
    };
  }

  const sourceLine = input.sourceUrl ? `${input.sourceName || 'مصدر موثق'}: ${input.sourceUrl}` : (input.sourceName || 'غير متوفر في المصادر');
  const originalBodySection = currentBody
    ? `\n\nالنص الأصلي المحفوظ قبل توحيد الصيغة: ${currentBody}`
    : '';

  const normalizedBody = `بطاقة المنتخب: ${input.teamName}. لا يتم إضافة مدرب أو قائد أو نجم أبرز إلا إذا كان ذلك مذكورًا صراحة في المصادر.

ملخص تنفيذي موثق: ${input.summary || UNAVAILABLE}

القوة الهجومية: ${currentBody.includes('القوة الهجومية') ? '' : UNAVAILABLE}. لا توجد حزمة موثقة كافية في هذا التقرير عن الأهداف، التسديدات، التسديدات على المرمى، أو جودة الفرص.

القوة الدفاعية: ${currentBody.includes('القوة الدفاعية') ? '' : UNAVAILABLE}. لا توجد حزمة موثقة كافية في هذا التقرير عن الأهداف المستقبلة، الشباك النظيفة، الضغط، أو الاسترجاع.

وسط الملعب والتحكم: ${currentBody.includes('وسط الملعب والتحكم') ? '' : UNAVAILABLE}. لا توجد بيانات موثقة كافية في هذا التقرير عن الاستحواذ، دقة التمرير، التمريرات التقدمية، أو السيطرة على الإيقاع.

الكرات الثابتة: ${currentBody.includes('الكرات الثابتة') ? '' : UNAVAILABLE}. لا توجد بيانات موثقة كافية في هذا التقرير عن الركلات الركنية، الأخطاء الجانبية، أو الأهداف من الكرات الثابتة.

أسماء بارزة في القائمة: ${currentBody.includes('أسماء بارزة في القائمة') ? '' : UNAVAILABLE}. لا يتم اختيار أسماء فردية دون مصدر صريح داخل التقرير.

معلومات غير متوفرة في المصادر الحالية: أي رقم أو معلومة غير مثبتة في المصادر تظل: ${UNAVAILABLE}. يشمل ذلك الرسم الخططي المتوقع، النجم الأبرز، الإحصائيات الفردية المتقدمة، وآخر 10 مباريات إذا لم تكن موثقة.

سجل المصادر: ${sourceLine}${originalBodySection}`;

  return {
    changed: true,
    body: normalizedBody,
    missingSections,
  };
}
