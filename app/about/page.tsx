import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'عن الموقع | بورصة المونديال',
  description: 'تعرف على بورصة المونديال من MC PRIME: منصة عربية لمتابعة أخبار كأس العالم 2026 وتحليل المباريات والمنتخبات واللاعبين بمحتوى تحريري موثق.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white" dir="rtl">
      <article className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 leading-8 md:p-10">
        <header className="space-y-3 border-b border-white/10 pb-6">
          <p className="text-sm font-black text-[#0FF0FC]">MC PRIME SPORTS EXCHANGE</p>
          <h1 className="text-3xl font-black md:text-5xl">عن موقع بورصة المونديال</h1>
          <p className="text-sm font-bold text-gray-400">
            منصة عربية متخصصة في متابعة كأس العالم 2026، تجمع بين الخبر الرياضي، التحليل التكتيكي، صفحات المنتخبات واللاعبين، وتجربة ترفيهية مرتبطة بالبورصة الرياضية الافتراضية.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">من نحن؟</h2>
          <p className="text-gray-300">
            بورصة المونديال هو مشروع رقمي تابع لـ MC PRIME يهدف إلى تقديم تجربة عربية منظمة لمتابعي كرة القدم خلال كأس العالم 2026. نهتم بتقديم أخبار المباريات، ملخصات النتائج، التحليلات التكتيكية، مؤشرات اللاعبين، وصفحات المنتخبات بطريقة مبسطة ومناسبة للقارئ العربي.
          </p>
          <p className="text-gray-300">
            لا يقدّم الموقع خدمات مراهنات أو توصيات مالية حقيقية. أي استخدام لمصطلحات مثل السوق أو البورصة داخل الموقع يأتي في إطار ترفيهي ورياضي افتراضي مرتبط بأداء المنتخبات واللاعبين داخل البطولة.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">ما الذي نقدمه؟</h2>
          <ul className="list-disc space-y-2 pr-6 text-gray-300">
            <li>أخبار موثقة عن مباريات كأس العالم 2026.</li>
            <li>تحليلات مبسطة للمنتخبات واللاعبين والنتائج.</li>
            <li>متابعة لجدول المباريات والمجموعات والترتيب.</li>
            <li>مقالات تفاعلية وأسئلة للنقاش بعد كل مباراة.</li>
            <li>روابط داخلية تساعد القارئ على الانتقال بين الأخبار والمنتخبات واللاعبين.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">منهجية التحرير</h2>
          <p className="text-gray-300">
            نعتمد على المصادر الرسمية والموثوقة قدر الإمكان عند نشر النتائج أو الأرقام أو الأحداث التاريخية. في الأخبار العاجلة، قد يتم تحديث المقال بعد النشر لإضافة معلومات إضافية مثل ترتيب المجموعة، إحصائيات المباراة، أو تصريحات ما بعد اللقاء.
          </p>
          <p className="text-gray-300">
            هدفنا أن يجد القارئ إجابة واضحة وسريعة دون عناوين مضللة أو مبالغات غير ضرورية. لذلك نفضّل العناوين المهنية، ونضيف أسئلة تفاعلية وروابط داخلية تساعد المستخدم على استكمال القراءة داخل الموقع.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">الصور وحقوق النشر</h2>
          <p className="text-gray-300">
            نستخدم صورًا تحريرية آمنة أو صورًا مرخّصة عند توفرها. لا نستخدم شعارات رسمية أو صور وكالات أو لقطات مباريات محفوظة الحقوق دون إذن أو ترخيص مناسب. يمكن أن تظهر داخل الموقع صور بديلة مكوّنة من أعلام ونتائج وتصميمات خاصة بالموقع عند عدم توفر صورة مرخصة.
          </p>
        </section>

        <footer className="border-t border-white/10 pt-6 text-sm font-bold text-gray-400">
          للتواصل أو إرسال تصحيح تحريري، يمكنك زيارة صفحة <Link href="/contact" className="text-[#0FF0FC] hover:underline">اتصل بنا</Link>.
        </footer>
      </article>
    </main>
  );
}
