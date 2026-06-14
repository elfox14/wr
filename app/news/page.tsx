import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'News | MC PRIME World Cup',
  description: 'Sports news and match updates for MC PRIME World Cup.',
};

export default function NewsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm font-black text-[#0FF0FC]">MC PRIME World Cup</p>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">الأخبار</h1>
        <p className="mt-4 max-w-3xl leading-8 text-gray-300">
          صفحة أخبار رياضية فقط. تم إيقاف أي محتوى مرتبط بالسوق أو التداول أو البورصة من الواجهة العامة.
        </p>
      </section>
    </main>
  );
}
