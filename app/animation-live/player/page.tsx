import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Expand, Radio, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مشغل البث الأنيميشن | MC PRIME Exchange',
  description: 'مشغل Football Animation Live داخل منصة بورصة المونديال.',
};

const allowedLanguages = new Set(['en', 'th', 'vi', 'id']);
const allowedStatsPanel = new Set(['hide', 'simple']);

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnimationLivePlayerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY || '';
  const matchId = getSingleValue(params.matchId) || '';
  const requestedLang = getSingleValue(params.lang) || 'en';
  const lang = allowedLanguages.has(requestedLang) ? requestedLang : 'en';
  const requestedStatsPanel = getSingleValue(params.statsPanel) || 'simple';
  const statsPanel = allowedStatsPanel.has(requestedStatsPanel) ? requestedStatsPanel : 'simple';
  const teamPanel = getSingleValue(params.teamPanel) === '0' ? '' : '1';

  const iframeUrl = matchId && accessKey ? new URL('https://www.isportslive8.com/football/detail.html') : null;
  if (iframeUrl) {
    iframeUrl.searchParams.set('matchId', matchId);
    iframeUrl.searchParams.set('accessKey', accessKey);
    iframeUrl.searchParams.set('lang', lang);
    iframeUrl.searchParams.set('statsPanel', statsPanel);
    if (teamPanel) iframeUrl.searchParams.set('teamPanel', teamPanel);
  }

  return (
    <main className="min-h-screen bg-background px-3 py-3 text-white sm:px-5 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.13),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Radio size={13} /> Football Animation Live</p>
              <h1 className="text-xl font-black md:text-3xl">مشغل البث الأنيميشن</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/animation-live" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><ArrowRight size={14} /> مباريات اليوم</Link>
              {iframeUrl && <Link href={iframeUrl.toString()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black"><Expand size={14} /> تكبير الشاشة</Link>}
            </div>
          </div>
        </div>

        {iframeUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black text-gray-300 md:px-4">
              <span>Match ID: {matchId}</span>
              <span>Language: {lang}</span>
              <span>Stats: {statsPanel}</span>
              <span>Team Panel: {teamPanel || 'default'}</span>
            </div>
            <iframe title="Football Animation Live" src={iframeUrl.toString()} className="h-[82vh] w-full border-0 bg-black sm:h-[80vh] lg:h-[78vh]" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-card">
            <p className="text-xl font-black text-white">لم يتم ربط بث هذه المباراة بعد</p>
            <p className="mt-2 text-sm font-bold text-gray-400">زر دخول البث موجود لكل مباراة، لكن تشغيل iframe لمباراة محددة يحتاج Match ID ومفتاح iSports على السيرفر.</p>
            <Link href="/animation-live" className="mt-5 inline-flex rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black">العودة إلى مباريات اليوم</Link>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط.</div>
      </section>
    </main>
  );
}
