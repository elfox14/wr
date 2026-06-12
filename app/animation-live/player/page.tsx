import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Expand, Radio, ShieldCheck } from 'lucide-react';
import AnimationIframe from './AnimationIframe';
import InternalAnimationPlayer from './InternalAnimationPlayer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'مشغل البث الأنيميشن الداخلي | MC PRIME Exchange',
  description: 'مشغل أنيميشن داخلي من قاعدة البيانات مع خيار عرض iSports خارجي داخل منصة بورصة المونديال.',
};

const allowedLanguages = new Set(['en', 'th', 'vi', 'id']);
const allowedStatsPanel = new Set(['hide', 'simple']);

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnimationLivePlayerPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  const matchId = getSingleValue(params.matchId) || '';
  const requestedLang = getSingleValue(params.lang) || 'en';
  const lang = allowedLanguages.has(requestedLang) ? requestedLang : 'en';
  const requestedStatsPanel = getSingleValue(params.statsPanel) || 'simple';
  const statsPanel = allowedStatsPanel.has(requestedStatsPanel) ? requestedStatsPanel : 'simple';
  const teamPanel = getSingleValue(params.teamPanel) === '0' ? '' : '1';
  const showExternal = getSingleValue(params.external) === '1';

  const iframeUrl = matchId ? new URL('https://www.isportslive8.com/football/pc.html') : new URL('https://www.isportslive8.com/');
  if (matchId) {
    iframeUrl.searchParams.set('matchId', matchId);
    iframeUrl.searchParams.set('lang', lang);
    iframeUrl.searchParams.set('v', '1');
    iframeUrl.searchParams.set('statsPanel', statsPanel);
    if (teamPanel) iframeUrl.searchParams.set('teamPanel', teamPanel);
  }
  const iframeUrlString = iframeUrl.toString();
  const isLinkedMatch = Boolean(matchId);

  const externalToggleUrl = `/animation-live/player?matchId=${encodeURIComponent(matchId)}&lang=${encodeURIComponent(lang)}&v=1&statsPanel=${encodeURIComponent(statsPanel)}${teamPanel ? `&teamPanel=${encodeURIComponent(teamPanel)}` : ''}&external=1`;
  const internalUrl = `/animation-live/player?matchId=${encodeURIComponent(matchId)}&lang=${encodeURIComponent(lang)}&v=1&statsPanel=${encodeURIComponent(statsPanel)}${teamPanel ? `&teamPanel=${encodeURIComponent(teamPanel)}` : ''}`;

  return (
    <main className="min-h-screen bg-background px-3 py-3 text-white sm:px-5 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.13),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-4 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Radio size={13} /> Internal Football Animation</p>
              <h1 className="text-xl font-black md:text-3xl">مشغل البث الأنيميشن الداخلي</h1>
              <p className="mt-1 text-xs leading-5 text-gray-400">العرض الأساسي من قاعدة بيانات المنصة. iSports خيار خارجي فقط ولا يتم تحميله تلقائيًا.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/animation-live" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]"><ArrowRight size={14} /> مباريات اليوم</Link>
              {isLinkedMatch && showExternal ? (
                <Link href={internalUrl} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-400 hover:text-black"><ShieldCheck size={14} /> العودة للداخلي</Link>
              ) : null}
              {isLinkedMatch ? (
                <Link href={externalToggleUrl} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-2 text-xs font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black"><Expand size={14} /> عرض iSports اختياري</Link>
              ) : null}
              <Link href={iframeUrlString} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-gray-300 hover:border-[#FFD700]/40 hover:text-[#FFD700]"><Expand size={14} /> فتح خارجي</Link>
            </div>
          </div>
        </div>

        {isLinkedMatch ? (
          <>
            <InternalAnimationPlayer matchId={matchId} />
            {showExternal ? (
              <div className="space-y-2 rounded-3xl border border-[#FFD700]/20 bg-[#FFD700]/[0.035] p-3">
                <div className="rounded-2xl border border-[#FFD700]/20 bg-black/30 px-3 py-2 text-xs font-bold leading-5 text-[#FFD700]">
                  هذا عرض خارجي اختياري من iSports. المشغل الداخلي بالأعلى هو المصدر الأساسي في المنصة.
                </div>
                <AnimationIframe src={iframeUrlString} matchId={matchId} lang={lang} statsPanel={statsPanel} teamPanel={teamPanel} />
              </div>
            ) : null}
          </>
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

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-100"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} /> مهم:</span> العرض الافتراضي داخلي من قاعدة البيانات. الإحصائيات تُقرأ كل 5 دقائق، الأحداث المهمة أسرع من قاعدة البيانات، و iSports لا يُحمّل إلا عند اختيار العرض الخارجي.</div>
      </section>
    </main>
  );
}
