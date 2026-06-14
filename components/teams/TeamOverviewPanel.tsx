'use client';

export default function TeamOverviewPanel({ team, matches }: { team: any, matches: any[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-[#0FF0FC] rounded-full"></span>
            نظرة عامة على المنتخب
          </h2>
          <p className="text-gray-300 leading-relaxed">
            يشارك المنتخب في بطولة كأس العالم 2026 كأحد أبرز المنافسين في مجموعته. يتميز بأسلوب لعب يجمع بين الصلابة الدفاعية والتحولات الهجومية السريعة. في هذه النسخة، يعتمد المدرب بشكل كبير على التوازن بين لاعبي الخبرة والشباب لمحاولة الوصول لأبعد نقطة في البطولة.
          </p>
          
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">القوة الهجومية (البيانات)</p>
              <div className="text-2xl font-bold text-green-400">82/100</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">الصلابة الدفاعية</p>
              <div className="text-2xl font-bold text-yellow-400">76/100</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm mb-1">الاستحواذ المتوقع</p>
              <div className="text-2xl font-bold text-blue-400">55%</div>
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-yellow-500 rounded-full"></span>
            أهم 3 نقاط فنية للمراقبة
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="font-bold mb-1">الخروج بالكرة تحت الضغط</h3>
                <p className="text-sm text-gray-400">هل ينجح لاعبو الارتكاز في كسر خطوط الضغط للمنافسين الكبار؟ الإحصائيات السابقة تشير لدقة تمرير 88% في نصف ملعبهم.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="font-bold mb-1">أدوار الأظهرة الهجومية</h3>
                <p className="text-sm text-gray-400">المنتخب يعتمد على الأطراف لصناعة اللعب بنسبة 40% من الهجمات الخطيرة تأتي عبر الأجنحة.</p>
              </div>
            </li>
            <li className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="font-bold mb-1">التحول السريع (المرتدات)</h3>
                <p className="text-sm text-gray-400">متوسط وصول الفريق لمرمى الخصم بعد استخلاص الكرة هو 12 ثانية، مما يجعله خطيراً في التحولات.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-black mb-4 border-b border-white/10 pb-2">وضع المجموعة</h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((pos) => (
              <div key={pos} className={`flex items-center justify-between p-2 rounded-lg ${pos === 1 ? 'bg-white/10 border border-white/20' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`font-bold w-4 text-center ${pos <= 2 ? 'text-green-400' : 'text-gray-500'}`}>{pos}</span>
                  <span className={pos === 1 ? 'font-bold' : 'text-gray-300'}>{pos === 1 ? team.name : `المنتخب ${pos}`}</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="w-6 text-center text-gray-400" title="لعب">0</span>
                  <span className="w-6 text-center text-gray-400" title="أهداف">0</span>
                  <span className="w-6 text-center font-bold" title="نقاط">0</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">المصدر: حسابات المجموعة الحية</p>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-black mb-4 border-b border-white/10 pb-2">آخر النتائج</h2>
          <div className="space-y-3">
            {[1, 2, 3].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                <span className="truncate w-20 text-right">{team.name}</span>
                <span className="font-bold bg-black px-2 py-1 rounded">0 - 0</span>
                <span className="truncate w-20 text-left text-gray-400">منافس {idx+1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
