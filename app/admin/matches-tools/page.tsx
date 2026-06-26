import prisma from '@/lib/prisma';
import AdminMatchToolsClient from '@/components/admin/AdminMatchToolsClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validKey(key: string) {
  const allowed = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Boolean(key) && allowed.includes(key);
}

function snapshotSummary(snapshot: any) {
  if (!snapshot) return null;
  return {
    provider: snapshot.provider,
    providerMatchId: snapshot.providerMatchId ?? null,
    capturedAt: snapshot.capturedAt?.toISOString?.() || String(snapshot.capturedAt),
    homePossession: snapshot.homePossession,
    awayPossession: snapshot.awayPossession,
    homeShots: snapshot.homeShots,
    awayShots: snapshot.awayShots,
  };
}

export default async function AdminMatchesToolsPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const params = typeof (searchParams as any)?.then === 'function' ? await searchParams as SearchParams : (searchParams || {}) as SearchParams;
  const adminKey = String(first(params.key) || '').trim();

  if (!validKey(adminKey)) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-900 bg-red-950/40 p-6">
          <h1 className="text-2xl font-bold">غير مصرح</h1>
          <p className="mt-3 text-sm text-red-100">افتح الصفحة مع مفتاح الإدارة في الرابط.</p>
          <code className="mt-4 block rounded-xl bg-slate-950 p-3 text-xs text-slate-300">/admin/matches-tools?key=ADMIN_KEY</code>
        </div>
      </main>
    );
  }

  const matches = await prisma.match.findMany({
    orderBy: { matchDate: 'desc' },
    take: 180,
    include: {
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
      statsSnapshots: {
        orderBy: { capturedAt: 'desc' },
        take: 8,
        select: {
          provider: true,
          providerMatchId: true,
          capturedAt: true,
          homePossession: true,
          awayPossession: true,
          homeShots: true,
          awayShots: true,
        },
      },
      _count: { select: { events: true } },
    },
  });

  const rows = matches.map((match) => {
    const theStats = match.statsSnapshots.find((snapshot) => snapshot.provider.startsWith('THE_STATS_API')) || null;
    const latest = match.statsSnapshots[0] || null;
    return {
      id: match.id,
      externalId: match.externalId,
      animationMatchId: match.animationMatchId,
      homeTeam: match.homeTeam?.name || match.homeTeamId,
      awayTeam: match.awayTeam?.name || match.awayTeamId,
      homeCode: match.homeTeam?.code || null,
      awayCode: match.awayTeam?.code || null,
      matchDate: match.matchDate.toISOString(),
      status: match.status,
      score: `${match.homeScore ?? 0}-${match.awayScore ?? 0}`,
      stage: match.stage,
      groupPhase: match.groupPhase,
      latestSnapshot: snapshotSummary(latest),
      latestTheStatsSnapshot: snapshotSummary(theStats),
      eventsCount: match._count.events,
    };
  });

  return <AdminMatchToolsClient adminKey={adminKey} matches={rows} />;
}
