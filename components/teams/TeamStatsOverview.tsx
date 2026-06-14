'use client';

export default function TeamStatsOverview({ matches }: { matches: any[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black">إحصائيات المنتخب (كأس العالم 2026)</h2>
        <div className="text-sm px-3 py-1 bg-white/10 rounded-full text-gray-400">
          متوسط 3 مباريات
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* الهجوم */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            مؤشرات هجومية
          </h3>
          <div className="space-y-4">
            <StatRow label="الأهداف" value="1.5" bg="bg-green-500" width="60%" />
            <StatRow label="التسديدات (المتوسط)" value="14.2" bg="bg-green-500" width="70%" />
            <StatRow label="التسديدات على المرمى" value="5.8" bg="bg-green-500" width="50%" />
            <StatRow label="الهجمات الخطيرة" value="42" bg="bg-green-500" width="80%" />
          </div>
        </div>

        {/* الدفاع */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            مؤشرات دفاعية
          </h3>
          <div className="space-y-4">
            <StatRow label="الأهداف المستقبلة" value="0.8" bg="bg-red-500" width="30%" />
            <StatRow label="التسديدات المستقبلة" value="9.4" bg="bg-red-500" width="45%" />
            <StatRow label="الأخطاء المرتكبة" value="11.2" bg="bg-red-500" width="55%" />
            <StatRow label="نظافة الشباك" value="2" bg="bg-red-500" width="66%" />
          </div>
        </div>

        {/* التحكم */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            مؤشرات التحكم
          </h3>
          <div className="space-y-4">
            <StatRow label="متوسط الاستحواذ" value="56%" bg="bg-blue-500" width="56%" />
            <StatRow label="دقة التمرير" value="84%" bg="bg-blue-500" width="84%" />
            <StatRow label="عدد التمريرات" value="480" bg="bg-blue-500" width="75%" />
            <StatRow label="الركنيات" value="6.5" bg="bg-blue-500" width="60%" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, bg, width }: { label: string, value: string | number, bg: string, width: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full`} style={{ width }} />
      </div>
    </div>
  );
}
