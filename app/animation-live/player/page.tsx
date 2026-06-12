import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Expand, Radio, ShieldCheck } from 'lucide-react';
import AnimationIframe from './AnimationIframe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مشغل البث الأنيميشن | MC PRIME Exchange',
  description: 'مشغل Football Animation Live داخل منصة بورصة المونديال.',
};

const allowedLanguages = new Set(['en', 'th', 'vi', 'id']);
const allowedStatsPanel = new Set(['hide', 'simple']);
const allowedDirectHosts = new Set(['isportslive8.com', 'www.isportslive8.com']);

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeDirectUrl(value?: string | string[]) {
  const raw = getSingleValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!allowedDirectHosts.has(url.hostname)) return null;
    if (!url.pathname.startsWith('/football/')) return null;
    return url;
  } catch {
    return null;
  }
}

export default async function AnimationLivePlayerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY || process.env.ISPORTS_API_KEY || '';
  const matchId = getSingleValue(params.matchId) || '';
  const requestedLang = getSingleValue(params.lang) || 'en';
  const lang = allowedLanguages.has(requestedLang) ? requestedLang : 'en';
  const requestedStatsPanel = getSingleValue(params.statsPanel) || 'simple';
  const statsPanel = allowedStatsPanel.has(requestedStatsPanel) ? requestedStatsPanel : 'simple';
  const teamPanel = getSingleValue(params.teamPanel) === '0' ? '' : '1';
  const directUrl = getSafeDirectUrl(params.directUrl || params.src || params.url);

  const iframeUrl = directUrl || (matchId && accessKey ? new URL('https://www.isportslive8.com/football/detail.html') : new URL('https://www.isportslive8.com/'));
  if (!directUrl && matchId && accessKey) {
    iframeUrl.searchParams.set('matchId', matchId);
    iframeUrl.searchParams.set('accessKey', accessKey);
    iframeUrl.searchParams.set('lang', lang);
    iframeUrl.searchParams.set('statsPanel', statsPanel);
    if (teamPanel) iframeUrl.searchParams.set('teamPanel', teamPanel);
  }
  const iframeUrlString = iframeUrl.toString();
  const playerLabel = directUrl ? 'Direct iSports URL' : 'Football Animation Live';
  const isLinkedMatch = Boolean(directUrl || (matchId && accessKey));

  return (
    <main className="min-h-screen bg-background px-3 py-3 text-white sm:px-5 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.13),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Radio size={13} /> {playerLabel}</p>
              <h1 className="text-xl font-black md:text-3xl">مشغل البث الأنيميشن</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/animation-live" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><ArrowRight size={14} /> مباريات اليوم</Link>
              <Link href={iframeUrlString} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black"><Expand size={14} /> فتح المصدر</Link>
            </div>
          </div>
        </div>

        {isLinkedMatch ? (
          <AnimationIframe src={iframeUrlString} matchId={matchId || iframeUrl.searchParams.get('matchId') || 'direct'} lang={lang} statsPanel={directUrl ? 'direct' : statsPanel} teamPanel={directUrl ? 'direct' : teamPanel} />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-sm text-gray-400">
            <Radio className="mx-auto mb-4 text-gray-500" size={48} />
            <h2 className="mb-2 text-xl font-bold text-white">البث غير متاح</h2>
            <p>المباراة التي اخترتها غير مرتبطة ببث أنيميشن حالياً (Match ID غير متوفر). يرجى اختيار مباراة أخرى من قائمة المباريات اليوم.</p>
            <Link href="/animation-live" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
              العودة لقائمة البث
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. كل الأرصدة Virtual Credits فقط. الروابط المباشرة مسموحة فقط من نطاق iSports الرسمي.</div>
      </section>
    </main>
  );
}
