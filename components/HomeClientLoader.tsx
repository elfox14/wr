'use client';

import dynamic from 'next/dynamic';

const HomeClientSportsLiveFocus = dynamic(() => import('@/components/HomeClientSportsLiveFocus'), {
  ssr: false,
  loading: () => (
    <main dir="rtl" className="mx-auto max-w-7xl px-4 py-6 text-white">
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_18px_50px_rgba(0,0,0,.22)]">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#0FF0FC] border-t-transparent" />
        <h1 className="text-xl font-black">جاري تحميل بورصة المونديال</h1>
        <p className="mt-2 text-sm font-bold text-slate-400">نجهز المباريات والبيانات الحية الآن.</p>
      </section>
    </main>
  ),
});

type HomeClientLoaderProps = {
  upcomingMatches?: unknown[];
  tickerMatches?: unknown[];
  nextMarqueeMatch?: unknown | null;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
};

export default function HomeClientLoader(props: HomeClientLoaderProps) {
  return <HomeClientSportsLiveFocus {...props} />;
}
