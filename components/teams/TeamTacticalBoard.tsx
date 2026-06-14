'use client';

export default function TeamTacticalBoard({ report }: { report: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-black mb-2">التحليل الفني للخطوط</h2>
        
        <div className="space-y-4">
          <TacticalSection 
            title="حراسة المرمى" 
            color="bg-gray-500"
            content="يعتمد الحارس على التمرير القصير لبناء اللعب، وتصل نسبة دقة تمريراته إلى 82%. مميز في التعامل مع الكرات العرضية لكنه يواجه صعوبة تحت الضغط العالي المباشر."
          />
          <TacticalSection 
            title="خط الدفاع" 
            color="bg-blue-500"
            content="شكل الدفاع يعتمد على رباعي كلاسيكي مع تقدم الأظهرة. يواجه الفريق مشاكل في المساحات خلف الأظهرة عند التحول الدفاعي. قوة المواجهات الثنائية تصل إلى 65% كنسبة نجاح."
          />
          <TacticalSection 
            title="خط الوسط" 
            color="bg-yellow-500"
            content="يعتمد الفريق على الاستحواذ لكسر الضغط. يتميز لاعب الارتكاز بجودة التمرير العمودي لكسر الخطوط. وسط الميدان هو نقطة القوة الأكبر بفضل الانسجام والقدرة على حماية الدفاع."
          />
          <TacticalSection 
            title="خط الهجوم" 
            color="bg-red-500"
            content="الاعتماد الأكبر على الأطراف للوصول للمرمى، مع مساهمة فعالة من الأجنحة في الدخول للعمق كمهاجمين إضافيين. جودة التحركات بدون كرة ممتازة وتخلق مساحات للتسديد."
          />
          <TacticalSection 
            title="الكرات الثابتة والتحولات" 
            color="bg-purple-500"
            content="خطير جداً في المرتدات السريعة. في الكرات الثابتة الدفاعية، يعتمد على دفاع المنطقة مما يخلق بعض ثغرات الرقابة الفردية."
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-4 text-center">التشكيل المتوقع (متوسط المراكز)</h3>
          <div className="relative w-full aspect-[2/3] bg-green-900/20 border-2 border-white/10 rounded-xl overflow-hidden flex items-center justify-center">
            {/* تخطيط ملعب افتراضي مبسط */}
            <div className="absolute inset-x-0 top-0 h-1/2 border-b border-white/20"></div>
            <div className="absolute top-0 w-1/3 h-1/6 border-x border-b border-white/20 left-1/3"></div>
            <div className="absolute bottom-0 w-1/3 h-1/6 border-x border-t border-white/20 left-1/3"></div>
            <div className="absolute top-1/2 left-1/2 w-16 h-16 -ml-8 -mt-8 rounded-full border border-white/20"></div>
            
            <p className="text-gray-500 text-xs font-bold z-10 opacity-50">رسم تكتيكي 4-3-3</p>
          </div>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-3">نقاط القوة والضعف</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-green-400 mb-2">+ نقاط القوة</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20">المرتدات السريعة</span>
                <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20">دقة التمرير</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-red-400 mb-2">- نقاط الضعف</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20">الكرات الثابتة الدفاعية</span>
                <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20">المساحات خلف الأظهرة</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TacticalSection({ title, color, content }: { title: string, color: string, content: string }) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl p-5 relative overflow-hidden group">
      <div className={`absolute right-0 top-0 bottom-0 w-1 ${color}`}></div>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg">{title}</h3>
        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-400">ملاحظة تحريرية</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{content}</p>
    </div>
  );
}
