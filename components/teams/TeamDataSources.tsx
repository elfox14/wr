'use client';

export default function TeamDataSources() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-black mb-2 text-center">مصادر البيانات والشفافية</h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        نستخدم البيانات الرياضية فقط لتأكيد وإثراء المحتوى. لا نعرض مراهنات أو احتمالات رهان أو روابط لمكاتب مراهنة، وقاعدة بيانات المنصة هي مصدر الحقيقة للواجهة.
      </p>

      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-white/5 text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-4 font-normal">نوع البيانات</th>
              <th className="p-4 font-normal">المصدر الأساسي</th>
              <th className="p-4 font-normal">المصدر البديل/المؤكد</th>
              <th className="p-4 font-normal">طريقة الاستخدام</th>
              <th className="p-4 font-normal text-center">درجة الثقة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <SourceRow type="جدول المباريات" source="قاعدة بيانات المنصة" alt="FIFA / football-data.org / TheStatsAPI" update="تأكيد وإثراء فقط" confidence="A" confColor="text-green-400" />
            <SourceRow type="النتائج المباشرة" source="ISPORTS Livescores" alt="TheStatsAPI بعد المباراة" update="قراءة داخلية من قاعدة البيانات" confidence="B" confColor="text-blue-400" />
            <SourceRow type="الإحصائيات الحية" source="ISPORTS Analysis" alt="TheStatsAPI للتأكيد اللاحق" update="أثناء المباراة ثم مراجعة بعدية" confidence="B" confColor="text-blue-400" />
            <SourceRow type="أحداث المباراة" source="قاعدة البيانات + ISPORTS" alt="TheStatsAPI للتحقق والإثراء" update="أهداف، بطاقات، تبديلات، VAR" confidence="B" confColor="text-blue-400" />
            <SourceRow type="xG والتسديدات المتقدمة" source="TheStatsAPI عند التفعيل" alt="تحليل تحريري" update="بعد المباراة فقط عند توفرها" confidence="B" confColor="text-blue-400" />
            <SourceRow type="بيانات اللاعبين" source="قوائم رسمية / MC PRIME Data Hub معتمد" alt="TheStatsAPI للتحقق" update="لاعبون مع مصدر واضح" confidence="A" confColor="text-green-400" />
            <SourceRow type="التحليل الفني" source="تقرير تحريري حصري" alt="إحصائيات المباراة" update="بعد كل مباراة أو جولة" confidence="D" confColor="text-purple-400" />
            <SourceRow type="بيانات ممنوعة" source="Odds / Betting / Bookmakers" alt="غير مستخدمة نهائيًا" update="محظورة في الكود والسياسة" confidence="محظور" confColor="text-red-400" />
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-bold leading-7 text-red-100">
        تنبيه امتثال: المنصة لا تقدم مراهنات، ولا تعرض أسعار رهان أو احتمالات رهان، ولا تسمح بأي إيداع أو سحب أموال. كل المؤشرات والأسعار داخل الموقع افتراضية وترفيهية فقط.
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
        <div className="bg-white/5 p-4 rounded-xl border border-green-500/20">
          <p className="font-bold text-green-400 mb-1">الثقة A</p>
          <p className="text-gray-400">بيانات رسمية أو مؤكدة داخل قاعدة البيانات.</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-blue-500/20">
          <p className="font-bold text-blue-400 mb-1">الثقة B</p>
          <p className="text-gray-400">مزود بيانات رياضي مباشر أو مصدر تحقق مرخص.</p>
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
