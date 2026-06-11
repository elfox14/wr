import type { Metadata } from 'next';
import Link from 'next/link';
import { Radio, ShieldCheck, Settings, Tv } from 'lucide-react';

export const metadata: Metadata = {
  title: 'البث الأنيميشن للمباريات | MC PRIME Exchange',
  description: 'تشغيل Football Animation Live عبر iFrame داخل منصة بورصة المونديال.',
};

type AnimationLiveSearchParams = {
  matchId?: string;
  lang?: string;
  statsPanel?: string;
  teamPanel?: string;
};

const allowedLanguages = new Set(['en', 'th', 'vi', 'id']);
const allowedStatsPanel = new Set(['hide', 'simple']);

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnimationLivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.NEXT_PUBLIC_ISPORTS_ANIMATION_ACCESS_KEY || '';
  const matchId = getSingleValue(params.matchId);
  const requestedLang = getSingleValue(params.lang) || 'en';
  const lang = allowedLanguages.has(requestedLang) ? requestedLang : 'en';
  const requestedStatsPanel = getSingleValue(params.statsPanel);
  const statsPanel = requestedStatsPanel && allowedStatsPanel.has(requestedStatsPanel) ? requestedStatsPanel : '';
  const teamPanel = getSingleValue(params.teamPanel) === '1' ? '1' : '';

  const iframeUrl = matchId && accessKey
    ? new URL('https://www.isportslive8.com/football/detail.html')
    : null;

  if (iframeUrl && matchId && accessKey) {
    iframeUrl.searchParams.set('matchId', matchId);
    iframeUrl.searchParams.set('accessKey', accessKey);
    iframeUrl.searchParams.set('lang', lang);
    if (statsPanel) iframeUrl.searchParams.set('statsPanel', statsPanel);
    if (teamPanel) iframeUrl.searchParams.set('teamPanel', teamPanel);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-card md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">
                <Radio size={15} /> Football Animation Live
              </p>
              <h1 className="text-3xl font-black md:text-5xl">البث الأنيميشن للمباريات</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
                صفحة مخصصة لتشغيل اشتراك Football Animation Live عبر iFrame بعد تمرير Match ID الخاص بالمزود.
              </p>
            </div>
            <Link href="/broadcast" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white hover:border-[#0FF0FC]/40 hover:text-[#0FF0FC]">
              <Tv size={16} /> شاشة البث العامة
            </Link>
          </div>
        </div>

        {(!accessKey || !matchId) && (
          <div className="rounded-[2rem] border border-yellow-400/20 bg-yellow-400/10 p-5 md:p-6">
            <div className="mb-3 flex items-center gap-2 text-lg font-black text-yellow-200">
              <Settings size={20} /> إعداد مطلوب قبل التشغيل
            </div>
            <div className="space-y-3 text-sm leading-7 text-yellow-50/90">
              {!accessKey && (
                <p>
                  أضف Access Key في متغيرات البيئة على Render باسم <code className="rounded bg-black/30 px-2 py-1">ISPORTS_ANIMATION_ACCESS_KEY</code> بدون رفعه داخل الكود.
                </p>
              )}
              {!matchId && (
                <p>
                  افتح الصفحة مع Match ID من المزود بهذا الشكل: <code className="rounded bg-black/30 px-2 py-1">/animation-live?matchId=123456&amp;lang=en&amp;statsPanel=simple&amp;teamPanel=1</code>
                </p>
              )}
              <p>
                يجب إضافة نطاق المنصة <code className="rounded bg-black/30 px-2 py-1">worldcup.mcprim.com</code> في Domain Whitelist داخل لوحة تحكم الاشتراك.
              </p>
            </div>
          </div>
        )}

        {iframeUrl && (
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-black text-gray-300 md:px-5">
              <span>Match ID: {matchId}</span>
              <span>Language: {lang}</span>
              <span>Stats: {statsPanel || 'default'}</span>
              <span>Team Panel: {teamPanel || 'default'}</span>
            </div>
            <iframe
              title="Football Animation Live"
              src={iframeUrl.toString()}
              className="h-[72vh] w-full border-0 bg-black"
              allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold leading-7 text-emerald-100">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> مهم:</span> هذا تكامل عرض فقط داخل المنصة. لا يغير طبيعة بورصة المونديال: كل الأرصدة Virtual Credits فقط، ولا توجد مراهنات أو كريبتو أو سحب أرباح.
        </div>
      </section>
    </main>
  );
}
