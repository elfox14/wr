'use client';

export default function TeamHistoryPanel({ team }: { team: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* المواجهات التاريخية ضد فرق المجموعة */}
      <div>
        <h2 className="text-2xl font-black mb-6">المواجهات مع فرق المجموعة</h2>
        <div className="space-y-4">
          <H2HCard opponent="المكسيك" played={5} won={1} drawn={2} lost={2} goalsFor={4} goalsAgainst={6} lastMatch="2022 (ودي) - تعادل 1-1" />
          <H2HCard opponent="كرواتيا" played={1} won={0} drawn={0} lost={1} goalsFor={0} goalsAgainst={1} lastMatch="2022 (ودي) - خسارة 0-1" />
          <H2HCard opponent="نيجيريا" played={0} won={0} drawn={0} lost={0} goalsFor={0} goalsAgainst={0} lastMatch="أول مواجهة تاريخية" />
        </div>
      </div>

      {/* تاريخ المشاركات في كأس العالم */}
      <div>
        <h2 className="text-2xl font-black mb-6">تاريخ كأس العالم (Timeline)</h2>
        <div className="relative border-r-2 border-white/10 pr-6 space-y-8 h-[500px] overflow-y-auto hide-scrollbar">
          <TimelineItem year="2026" title="النسخة الحالية" desc="المشاركة السابعة تاريخياً للبحث عن إنجاز جديد." />
          <TimelineItem year="2022" title="مشاركة مشرفة" desc="فوز تاريخي في دور المجموعات، الخروج بـ 3 نقاط." />
          <TimelineItem year="2018" title="عودة بعد غياب" desc="الخروج من دور المجموعات بفوز وحيد في الجولة الثالثة." />
          <TimelineItem year="2006" title="مشاركة" desc="تعادل وخسارتين في دور المجموعات." />
          <TimelineItem year="2002" title="مشاركة" desc="خروج مبكر بدون نقاط من دور المجموعات." />
          <TimelineItem year="1998" title="مشاركة" desc="تعادل وخسارتين." />
          <TimelineItem year="1994" title="الظهور الأول المذهل" desc="أفضل إنجاز تاريخي: الوصول لدور الـ 16." />
        </div>
      </div>
    </div>
  );
}

function H2HCard({ opponent, played, won, drawn, lost, goalsFor, goalsAgainst, lastMatch }: any) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
        <h3 className="font-bold text-lg">ضد {opponent}</h3>
        <span className="text-xs text-gray-400">آخر مواجهة: {lastMatch}</span>
      </div>
      {played === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2">لا توجد مواجهات سابقة مسجلة</p>
      ) : (
        <div className="grid grid-cols-6 gap-2 text-center text-sm">
          <div>
            <p className="text-gray-500 text-[10px]">لعب</p>
            <p className="font-bold">{played}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">فاز</p>
            <p className="font-bold text-green-400">{won}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">تعادل</p>
            <p className="font-bold text-yellow-400">{drawn}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">خسر</p>
            <p className="font-bold text-red-400">{lost}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">له</p>
            <p className="font-bold">{goalsFor}</p>
          </div>
          <div>
            <p className="text-gray-500 text-[10px]">عليه</p>
            <p className="font-bold">{goalsAgainst}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ year, title, desc }: { year: string, title: string, desc: string }) {
  return (
    <div className="relative">
      <div className="absolute w-4 h-4 bg-[#0FF0FC] rounded-full -right-[33px] top-1 border-4 border-black"></div>
      <h3 className="font-black text-xl text-[#0FF0FC] mb-1">{year} — {title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}
