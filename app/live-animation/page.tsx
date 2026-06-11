

function safeLang(value?: string) {
  const allowed = ['en', 'th', 'vi', 'id'];
  return allowed.includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'en';
}

function safeStatsPanel(value?: string) {
  return value === 'hide' || value === 'simple' ? value : undefined;
}

function safeTeamPanel(value?: string) {
  return value === '1' ? '1' : undefined;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LiveAnimationPage({ searchParams }: { searchParams: SearchParams }) {
  const paramsRaw = await searchParams || {};
  const matchIdStr = Array.isArray(paramsRaw.matchId) ? paramsRaw.matchId[0] : paramsRaw.matchId;
  const matchId = Number(matchIdStr);
  
  const langStr = Array.isArray(paramsRaw.lang) ? paramsRaw.lang[0] : paramsRaw.lang;
  const statsPanelStr = Array.isArray(paramsRaw.statsPanel) ? paramsRaw.statsPanel[0] : paramsRaw.statsPanel;
  const teamPanelStr = Array.isArray(paramsRaw.teamPanel) ? paramsRaw.teamPanel[0] : paramsRaw.teamPanel;

  const accessKey = process.env.ISPORTS_ANIMATION_ACCESS_KEY || process.env.ISPORTS_API_KEY || '';
  const lang = safeLang(langStr);
  const statsPanel = safeStatsPanel(statsPanelStr);
  const teamPanel = safeTeamPanel(teamPanelStr);

  const params = new URLSearchParams();
  if (matchId && Number.isFinite(matchId)) params.set('matchId', String(matchId));
  if (accessKey) params.set('accessKey', accessKey);
  params.set('lang', lang);
  if (statsPanel) params.set('statsPanel', statsPanel);
  if (teamPanel) params.set('teamPanel', teamPanel);

  const iframeSrc = `https://www.isportslive8.com/football/detail.html?${params.toString()}`;
  const isReady = !!matchId && Number.isFinite(matchId) && !!accessKey;

  return (
    <main className="min-h-screen bg-[#050510] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-emerald-400/20 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">iSports Live Animation</p>
              <h1 className="mt-2 text-3xl font-black">البث التحليلي التفاعلي للمباراة</h1>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                هذه الصفحة تعرض Football Live Animation من iSportsAPI عبر iframe. استخدم Match ID من صفحة /admin/isports.
              </p>
            </div>
            {matchId ? (
              <div className="rounded-2xl bg-[#0b1020] px-4 py-3 text-sm text-slate-200">
                Match ID: <span className="font-black text-emerald-300">{matchId}</span>
              </div>
            ) : null}
          </div>
        </section>

        {!isReady ? (
          <section className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">
            {!matchId ? (
              <p>أضف رقم المباراة في الرابط بهذا الشكل: /live-animation?matchId=353609924</p>
            ) : (
              <p>أضف ISPORTS_ANIMATION_ACCESS_KEY في Render Environment Variables ثم أعد النشر.</p>
            )}
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
            <iframe
              src={iframeSrc}
              title="iSports Football Live Animation"
              className="h-[78vh] w-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </section>
        )}
      </div>
    </main>
  );
}
