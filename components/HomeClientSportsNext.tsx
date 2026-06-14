'use client';

import Link from 'next/link';

type HomeClientSportsNextProps = {
  initialAssets?: unknown[];
  upcomingMatches?: unknown[];
  assetsCount?: number;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  academyArticles?: unknown[];
};

const cards = [
  {
    title: 'مركز المباريات',
    text: 'مواعيد ونتائج ومتابعة مباريات كأس العالم من مكان واحد.',
    href: '/matches',
  },
  {
    title: 'المجموعات',
    text: 'عرض مجموعات البطولة وترتيبها عند توفر البيانات.',
    href: '/groups',
  },
  {
    title: 'دليل المنتخبات',
    text: 'قائمة عامة بالمنتخبات بدون صفحات تفاصيل فردية حاليًا.',
    href: '/teams',
  },
  {
    title: 'دليل اللاعبين',
    text: 'قائمة عامة باللاعبين بدون صفحات تفاصيل فردية حاليًا.',
    href: '/players',
  },
  {
    title: 'الأخبار',
    text: 'أخبار وتقارير رياضية موثقة بعيدًا عن أي محتوى تداول.',
    href: '/news',
  },
  {
    title: 'التحليل الفني',
    text: 'قراءات كروية وتحليل أداء منفصل عن أي جانب مالي أو افتراضي.',
    href: '/team-intelligence',
  },
  {
    title: 'البث التفاعلي',
    text: 'مركز متابعة تفاعلي للمباريات عند توفر البيانات الحية.',
    href: '/animation-live',
  },
];

export default function HomeClientSportsNext(_props: HomeClientSportsNextProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)] lg:p-10">
        <p className="text-sm font-black text-[#0FF0FC]">MC PRIME World Cup</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
          منصة رياضية لكأس العالم 2026
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-gray-300 md:text-lg">
          مباريات، أخبار، مجموعات، قوائم منتخبات ولاعبين، وتحليل فني في تجربة واحدة. تم حذف وإخفاء كل محتوى البورصة والتداول من الواجهة العامة.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/matches" className="rounded-2xl bg-[#0FF0FC] px-6 py-3 text-sm font-black text-black transition hover:bg-[#0FF0FC]/85">
            مركز المباريات
          </Link>
          <Link href="/teams" className="rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15">
            دليل المنتخبات
          </Link>
          <Link href="/players" className="rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15">
            دليل اللاعبين
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:border-[#0FF0FC]/30 hover:bg-white/[0.06]">
            <h2 className="text-lg font-black text-white">{card.title}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-400">{card.text}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
