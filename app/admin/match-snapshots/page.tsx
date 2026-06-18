import Link from 'next/link';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function suppliedSecret(params: Record<string, string | string[] | undefined>) {
  return String(getParam(params, 'adminSecret') || getParam(params, 'key') || getParam(params, 'cronSecret') || '').trim();
}

function isAuthorized(params: Record<string, string | string[] | undefined>) {
  const secrets = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const supplied = suppliedSecret(params);
  return Boolean(supplied && secrets.includes(supplied));
}

function rawObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', { hour12: false });
}

function formatNumber(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('ar-EG', { maximumFractionDigits: digits });
}

function providerBadge(provider?: string | null) {
  const value = String(provider || '').toUpperCase();
  if (value.includes('THE_STATS')) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (value.includes('ISPORTS')) return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function teamName(team: any, fallback: string) {
  return team?.name || team?.code || fallback;
}

function extractStats(snapshot: any) {
  const raw = rawObject(snapshot?.rawData);
  const stats = rawObject(raw.stats || raw.providerStats || raw.theStatsApi?.stats);
  const derived = rawObject(raw.derived || raw.theStatsApi?.derived);
  const lineup = rawObject(raw.lineup || raw.lineups || raw.theStatsApi?.lineup || raw.theStatsApi?.lineups);
  return {
    xg: rawObject(stats.xg),
    npxg: rawObject(stats.npxg),
    bigChances: rawObject(stats.bigChances),
    derivedShotsOffTarget: rawObject(derived.shotsOffTargetForLocalCompare || derived.shotsOffTargetWithBlocked),
    lineup,
    theStatsApiMatchId: raw.theStatsApiMatchId || raw.theStatsApi?.theStatsApiMatchId || null,
  };
}

async function loadSnapshots() {
  return prisma.matchStatsSnapshot.findMany({
    include: {
      match: {
        include: { homeTeam: true, awayTeam: true },
      },
    },
    orderBy: { capturedAt: 'desc' },
    take: 80,
  });
}

export default async function MatchSnapshotsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) || {};
  const secret = suppliedSecret(params);
  if (!isAuthorized(params)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">
          <h1 className="text-2xl font-black">Match Snapshots</h1>
          <p className="mt-3 text-sm leading-6">هذه الصفحة إدارية ومحمية. افتحها بإضافة <code className="rounded bg-white px-1">?adminSecret=...</code>.</p>
        </section>
      </main>
    );
  }

  const snapshots = await loadSnapshots();
  const theStatsCount = snapshots.filter((snapshot) => String(snapshot.provider).toUpperCase().includes('THE_STATS')).length;
  const iSportsCount = snapshots.filter((snapshot) => String(snapshot.provider).toUpperCase().includes('ISPORTS')).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black text-emerald-700">ADMIN · DATA REVIEW</p>
          <h1 className="mt-2 text-3xl font-black">مراجعة Snapshots المباريات</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
            هذه الصفحة تعرض آخر الإحصائيات المحفوظة من كل المصادر. لا تقوم بأي تعديل؛ هدفها مراجعة مصدر كل رقم قبل استخدامه في صفحة المباراة أو المقال أو الإنفوجراف.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Snapshots</p><p className="mt-2 text-3xl font-black">{snapshots.length}</p></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><p className="text-sm text-amber-700">TheStatsAPI</p><p className="mt-2 text-3xl font-black text-amber-800">{theStatsCount}</p></div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm"><p className="text-sm text-cyan-700">iSports</p><p className="mt-2 text-3xl font-black text-cyan-800">{iSportsCount}</p></div>
          <Link href={`/admin/data-verification?adminSecret=${encodeURIComponent(secret)}`} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100">العودة للوحة التحقق</Link>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-black">آخر 80 Snapshot</h2>
            <p className="mt-1 text-sm text-slate-500">راجع xG والتشكيلات ومصدر كل snapshot.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Shots</th>
                  <th className="px-4 py-3">xG</th>
                  <th className="px-4 py-3">npxG</th>
                  <th className="px-4 py-3">Formation</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshots.map((snapshot: any) => {
                  const match = snapshot.match;
                  const stats = extractStats(snapshot);
                  const home = teamName(match?.homeTeam, 'Home');
                  const away = teamName(match?.awayTeam, 'Away');
                  const homeFormation = stats.lineup?.home?.formation || '—';
                  const awayFormation = stats.lineup?.away?.formation || '—';
                  return (
                    <tr key={snapshot.id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(snapshot.capturedAt)}</td>
                      <td className="px-4 py-3"><p className="font-black">{home} vs {away}</p><p className="mt-1 font-mono text-xs text-slate-500">{match?.id}</p></td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${providerBadge(snapshot.provider)}`}>{snapshot.provider}</span><p className="mt-1 font-mono text-[10px] text-slate-400">{stats.theStatsApiMatchId || snapshot.providerMatchId}</p></td>
                      <td className="px-4 py-3 font-black">{formatNumber(snapshot.homeScore, 0)} - {formatNumber(snapshot.awayScore, 0)}</td>
                      <td className="px-4 py-3">{formatNumber(snapshot.homeShots, 0)} - {formatNumber(snapshot.awayShots, 0)}</td>
                      <td className="px-4 py-3">{formatNumber(stats.xg.home)} - {formatNumber(stats.xg.away)}</td>
                      <td className="px-4 py-3">{formatNumber(stats.npxg.home)} - {formatNumber(stats.npxg.away)}</td>
                      <td className="px-4 py-3">{homeFormation} / {awayFormation}</td>
                      <td className="px-4 py-3"><Link href={`/match-center/${match?.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">فتح المباراة</Link></td>
                    </tr>
                  );
                })}
                {!snapshots.length ? <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">لا توجد snapshots بعد.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
