import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BarChart3, Brain, Coins, Gauge, ShieldCheck, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'منهجية التسعير | MC PRIME Exchange',
  description: 'شرح مبسط لمنهجية تسعير المنتخبات واللاعبين داخل بورصة المونديال الافتراضية: الأداء، الطلب، الشعبية، الزخم، والمخاطرة.',
};

const pillars = [
  {
    weight: '35%',
    title: 'الأداء الفني',
    english: 'Fundamental Score',
    text: 'جودة المنتخب أو اللاعب، قوة التشكيلة، المركز، النتائج، الأرقام الفنية، والتأثير الحقيقي داخل الملعب.',
    icon: Brain,
    tone: 'text-[#0FF0FC] border-[#0FF0FC]/20 bg-[#0FF0FC]/10',
  },
  {
    weight: '20%',
    title: 'الطلب داخل المنصة',
    english: 'Market Demand',
    text: 'اهتمام المستخدمين بالأصل، حجم المتابعة، النشاط الافتراضي، وعدد المحافظ التي تراقبه أو تمتلكه.',
    icon: TrendingUp,
    tone: 'text-[#FFD700] border-[#FFD700]/20 bg-[#FFD700]/10',
  },
  {
    weight: '20%',
    title: 'الشعبية العالمية',
    english: 'Popularity',
    text: 'شعبية المنتخب أو اللاعب جماهيريًا وإعلاميًا، لأنها تؤثر على الانتباه والطلب حتى قبل المباريات.',
    icon: Sparkles,
    tone: 'text-violet-300 border-violet-400/20 bg-violet-400/10',
  },
  {
    weight: '15%',
    title: 'إرث كأس العالم',
    english: 'World Cup Legacy',
    text: 'تاريخ المنتخب أو اللاعب في البطولة، السمعة، الخبرة، والحضور في المواعيد الكبرى.',
    icon: ShieldCheck,
    tone: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10',
  },
  {
    weight: '10%',
    title: 'الزخم الحالي',
    english: 'Momentum',
    text: 'الأحداث الأخيرة مثل هدف، إصابة، بطاقة، رجل المباراة، تصريح مؤثر، أو أداء قوي يغير التوقعات سريعًا.',
    icon: Zap,
    tone: 'text-orange-300 border-orange-400/20 bg-orange-400/10',
  },
];

const movementRules = [
  ['هدف أو أداء حاسم', 'يرفع الزخم والطلب، وقد يدفع السعر أعلى من القيمة العادلة مؤقتًا.'],
  ['إصابة أو غياب مؤثر', 'يخفض الثقة والزخم، ويزيد المخاطرة خاصة للاعبين الأساسيين.'],
  ['مباراة قوية قادمة', 'قد ترفع الطلب قبل المباراة، لكنها تزيد احتمالية التذبذب بعدها.'],
  ['تقرير موثوق جديد', 'يمكن أن يغير قراءة المستخدمين للقيمة حتى قبل تحرك السعر.'],
];

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,215,0,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-6 shadow-anti-gravity lg:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-black text-primary">
              <Gauge size={15} /> PRICING METHODOLOGY
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
              كيف يتحرك سعر المنتخب أو اللاعب؟
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-8 text-gray-300 md:text-lg">
              السعر داخل بورصة المونديال الافتراضية ليس رقمًا عشوائيًا. هو نتيجة مزيج بين التحليل الرياضي، الطلب داخل المنصة، الشعبية، إرث البطولة، والزخم الحالي — وكل ذلك باستخدام أرصدة لعب فقط.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-black transition hover:bg-primary/90">
                ابدأ من التقارير <ArrowRight size={16} />
              </Link>
              <Link href="/market" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15">
                افتح السوق <TrendingUp size={16} />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
            <p className="mb-4 text-sm font-black text-white">معادلة القراءة المبسطة</p>
            <div className="space-y-3">
              {pillars.map((pillar) => (
                <div key={pillar.title} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${pillar.tone}`}>
                    <pillar.icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black text-white">{pillar.title}</p>
                      <span className="font-mono text-sm font-black text-primary">{pillar.weight}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-primary" style={{ width: pillar.weight }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card transition hover:border-primary/30">
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${pillar.tone}`}>
              <pillar.icon size={22} />
            </div>
            <p className="mb-1 font-mono text-sm font-black text-primary">{pillar.weight}</p>
            <h2 className="text-xl font-black text-white">{pillar.title}</h2>
            <p className="mt-1 text-xs font-bold text-gray-500">{pillar.english}</p>
            <p className="mt-3 text-sm leading-7 text-gray-400">{pillar.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/5 bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-primary">FAIR VALUE VS MARKET PRICE</p>
              <h2 className="mt-1 text-2xl font-black text-white">القيمة العادلة ليست السعر</h2>
            </div>
            <Target className="text-primary" size={30} />
          </div>
          <div className="space-y-4 text-sm leading-7 text-gray-300">
            <p>
              <strong className="text-white">القيمة العادلة</strong> هي تقدير تحليلي لقوة الأصل بناءً على العوامل الرياضية والطلبية. أما <strong className="text-white">السعر الحالي</strong> فهو ما يظهر للمستخدم داخل السوق الافتراضي وقد يتحرك أسرع بسبب الزخم والاهتمام.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4">
                <p className="font-black text-emerald-300">Discount</p>
                <p className="mt-1 text-xs text-emerald-100">السعر أقل من القيمة العادلة. قد يكون فرصة، لكن يحتاج مراجعة الزخم والمخاطرة.</p>
              </div>
              <div className="rounded-2xl border border-red-400/15 bg-red-400/10 p-4">
                <p className="font-black text-red-300">Premium</p>
                <p className="mt-1 text-xs text-red-100">السعر أعلى من القيمة العادلة. قد يكون مبررًا بزخم قوي أو طلب جماهيري، لكنه أكثر حساسية للهبوط.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/5 bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-accent">PRICE MOVEMENT RULES</p>
              <h2 className="mt-1 text-2xl font-black text-white">ما الذي يحرّك السعر؟</h2>
            </div>
            <BarChart3 className="text-accent" size={30} />
          </div>
          <div className="space-y-3">
            {movementRules.map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <h3 className="font-black text-white">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-gray-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-emerald-400/15 bg-emerald-400/10 p-6 shadow-card">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-black text-emerald-300">COMPLIANCE</p>
            <h2 className="mt-1 text-2xl font-black text-white">تنبيه مهم</h2>
          </div>
          <p className="text-sm leading-8 text-emerald-100">
            MC PRIME Exchange تجربة تحليل وبورصة رياضية افتراضية. كل الأرصدة داخل المنصة Virtual Credits فقط، ولا يوجد تداول بأموال حقيقية، لا سحب أرباح، لا مراهنات، ولا عملات رقمية.
          </p>
        </div>
      </section>
    </main>
  );
}
