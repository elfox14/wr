'use client';

const sections = [
  { key: 'goalkeeper', title: 'حراسة المرمى' },
  { key: 'defense', title: 'خط الدفاع' },
  { key: 'midfield', title: 'خط الوسط' },
  { key: 'attack', title: 'خط الهجوم' },
  { key: 'transitions', title: 'التحولات' },
  { key: 'setPieces', title: 'الكرات الثابتة' },
];

function getMetrics(report: any) {
  return report?.metrics && typeof report.metrics === 'object' ? report.metrics : {};
}

function lineText(metrics: any, key: string) {
  const value = metrics?.lineAnalysis?.[key] || metrics?.lines?.[key] || metrics?.[key];
  if (typeof value === 'string') return value;
  if (typeof value?.summary === 'string') return value.summary;
  if (typeof value?.note === 'string') return value.note;
  return null;
}

export default function TeamTacticalBoard({ report }: { report: any }) {
  const metrics = getMetrics(report);
  const formation = metrics?.formation || metrics?.shape || metrics?.expectedFormation;
  const strengths = Array.isArray(report?.strengths) ? report.strengths : [];
  const weaknesses = Array.isArray(report?.weaknesses) ? report.weaknesses : [];
  const tags = Array.isArray(report?.tacticalTags) ? report.tacticalTags : [];

  if (!report) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#111] p-6">
        <h2 className="text-2xl font-black mb-3">التحليل الفني للخطوط</h2>
        <p className="text-sm leading-relaxed text-gray-400">غير متوفر في المصادر: لم يتم إدخال تقرير فني موثق لهذا المنتخب بعد.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-2xl font-black mb-2">التحليل الفني للخطوط</h2>
          <p className="text-sm text-gray-400">المصدر: {report.sourceName || 'تقرير تحريري'} {report.confidence ? `• درجة الثقة ${report.confidence}` : ''}</p>
        </div>

        {report.summary && <div className="rounded-2xl border border-white/10 bg-[#111] p-5 text-sm leading-relaxed text-gray-300">{report.summary}</div>}

        <div className="space-y-4">
          {sections.map((section) => {
            const content = lineText(metrics, section.key);
            return (
              <div key={section.key} className="bg-[#111] border border-white/10 rounded-xl p-5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{section.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${content ? 'bg-white/10 text-gray-400' : 'bg-yellow-500/10 text-yellow-300'}`}>
                    {content ? 'تقرير موثق' : 'غير متوفر'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{content || 'غير متوفر في التقرير الحالي: لا توجد ملاحظة موثقة لهذا الخط.'}</p>
              </div>
            );
          })}
        </div>

        {report.body && (
          <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
            <h3 className="mb-3 font-bold">نص التقرير الكامل</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-300">{report.body}</p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-4 text-center">الرسم الخططي</h3>
          <div className="relative w-full aspect-[2/3] bg-green-900/20 border-2 border-white/10 rounded-xl overflow-hidden flex items-center justify-center">
            <div className="absolute inset-x-0 top-0 h-1/2 border-b border-white/20"></div>
            <div className="absolute top-0 w-1/3 h-1/6 border-x border-b border-white/20 left-1/3"></div>
            <div className="absolute bottom-0 w-1/3 h-1/6 border-x border-t border-white/20 left-1/3"></div>
            <div className="absolute top-1/2 left-1/2 w-16 h-16 -ml-8 -mt-8 rounded-full border border-white/20"></div>
            <p className="text-gray-400 text-xs font-bold z-10 text-center px-4">{formation ? `تشكيل موثق: ${formation}` : 'غير متوفر في المصادر'}</p>
          </div>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-3">نقاط القوة والضعف</h3>
          <TagList title="نقاط القوة" items={strengths} />
          <TagList title="نقاط الضعف" items={weaknesses} />
          <TagList title="وسوم تكتيكية" items={tags} />
        </div>
      </div>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-bold mb-2 text-gray-300">{title}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => <span key={item} className="px-2 py-1 bg-white/10 text-gray-300 text-xs rounded border border-white/10">{item}</span>)}
        </div>
      ) : (
        <p className="text-xs text-gray-500">غير متوفر في التقرير الحالي</p>
      )}
    </div>
  );
}
