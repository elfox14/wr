'use client';

export default function TeamDataSources() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-black mb-2 text-center">مصادر البيانات والشفافية</h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        نلتزم في هذه المنصة بأعلى معايير الدقة الرياضية. يتم جمع وتوثيق كل معلومة مع توضيح مصدرها لضمان تجربة تحليل موثوقة.
      </p>

      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-white/5 text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-4 font-normal">نوع البيانات</th>
              <th className="p-4 font-normal">المصدر الأساسي</th>
              <th className="p-4 font-normal">المصدر البديل</th>
              <th className="p-4 font-normal">تحديث البيانات</th>
              <th className="p-4 font-normal text-center">درجة الثقة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <SourceRow type="جدول المباريات" source="FIFA / ISPORTS" alt="Football-data.org" update="وقت المزامنة التلقائية" confidence="A" confColor="text-green-400" />
            <SourceRow type="النتائج المباشرة" source="ISPORTS Livescores" alt="مصدر بديل" update="كل 60-90 ثانية" confidence="B" confColor="text-blue-400" />
            <SourceRow type="الإحصائيات الحية" source="ISPORTS Analysis" alt="يدوي عند الحاجة" update="أثناء المباراة فقط" confidence="B" confColor="text-blue-400" />
            <SourceRow type="بيانات اللاعبين" source="ISPORTS Squads" alt="FotMob / SofaScore" update="قبل بدء البطولة والمباريات" confidence="B" confColor="text-blue-400" />
            <SourceRow type="التحليل الفني" source="تقرير تحريري حصري" alt="تحليل بيانات الفيديو" update="بعد كل جولة" confidence="D" confColor="text-purple-400" />
            <SourceRow type="البيانات التاريخية" source="أرشيف FIFA الرسمي" alt="-" update="ثابت" confidence="A" confColor="text-green-400" />
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
        <div className="bg-white/5 p-4 rounded-xl border border-green-500/20">
          <p className="font-bold text-green-400 mb-1">الثقة A</p>
          <p className="text-gray-400">بيانات رسمية معتمدة لا تقبل الخطأ.</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-blue-500/20">
          <p className="font-bold text-blue-400 mb-1">الثقة B</p>
          <p className="text-gray-400">مزود بيانات مباشر ومرخص.</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-yellow-500/20">
          <p className="font-bold text-yellow-400 mb-1">الثقة C</p>
          <p className="text-gray-400">مصدر إعلامي رياضي موثوق.</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-purple-500/20">
          <p className="font-bold text-purple-400 mb-1">الثقة D</p>
          <p className="text-gray-400">رأي وملاحظة فنية من فريق التحرير.</p>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ type, source, alt, update, confidence, confColor }: any) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="p-4 font-bold">{type}</td>
      <td className="p-4 text-gray-300">{source}</td>
      <td className="p-4 text-gray-400">{alt}</td>
      <td className="p-4 text-gray-400">{update}</td>
      <td className="p-4 text-center font-black">
        <span className={`px-3 py-1 bg-white/5 rounded-lg border border-white/10 ${confColor}`}>
          {confidence}
        </span>
      </td>
    </tr>
  );
}
