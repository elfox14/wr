'use client';

import Link from 'next/link';

type Props = {
  initialAssets?: unknown[];
  upcomingMatches?: unknown[];
  assetsCount?: number;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  academyArticles?: unknown[];
};

const cards = [
  ['مركز المباريات', 'مواعيد ونتائج ومتابعة مباريات كأس العالم.', '/matches'],
  ['المجموعات', 'عرض مجموعات البطولة وترتيبها.', '/groups'],
  ['دليل المنتخبات', 'قائمة عامة بالمنتخبات.', '/teams'],
  ['دليل اللاعبين', 'قائمة عامة باللاعبين.', '/players'],
  ['الأخبار', 'أخبار وتقارير رياضية موثقة.', '/news'],
  ['التحليل الفني', 'قراءات كروية وتحليل أداء رياضي.', '/team-intelligence'],
  ['البث التفاعلي', 'متابعة تفاعلية للمباريات عند توفر البيانات الحية.', '/animation-live'],
];

export default function HomeClientSportsNext(_props: Props) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 lg:p-10">
        <p className="text-sm font-black text-[#0FF0FC]">MC PRIME World Cup</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl">منصة رياضية لكأس العالم 2026</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-gray-300 md:text-lg">مباريات، أخبار، مجموعات، قوائم منتخبات ولاعبين، وتحليل فني في تجربة واحدة.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/matches" className="rounded-2xl bg-[#0FF0FC] px-6 py-3 text-sm font-black text-black">مركز المباريات</Link>
          <Link href="/teams" className="rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white">دليل المنتخبات</Link>
          <Link href="/players" className="rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white">دليل اللاعبين</Link>
        </div>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, text, href]) => (
          <Link key={href} href={href} className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <h2 className="text-lg font-black text-white">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-gray-400">{text}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
