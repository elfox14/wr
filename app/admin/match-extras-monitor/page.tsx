import Link from 'next/link';
import prisma from '@/lib/prisma';
import { formatEgyptDateTime } from '@/lib/match-page/egyptTime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { searchParams?: Promise<{ key?: string }> };

const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];

function isAuthorized(key?: string | null) {
  const candidate = String(key || '').trim();
  const valid = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET, process.env.ADMIN_CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Boolean(candidate && valid.includes(candidate));
}

function asRecord(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function listFrom(value: any): any[] {
  if (Array.isArray(value)) return value;
  const data = asRecord(value);
  for (const key of ['shotmap', 'shots', 'playerStats', 'lineups', 'data', 'items', 'results']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function snapshotSignals(snapshot: any) {
  const raw = asRecord(snapshot?.rawData);
  const normalized = asRecord(raw.normalized);
  const counts = asRecord(raw.counts);
  const endpointsFailed = Array.isArray(raw.endpointsFailed) ? raw.endpointsFailed : [];
  const shots = Array.isArray(normalized.shotmap) ? normalized.shotmap.length : listFrom(raw.shotmap).length || Number(counts.shots || 0);
  const playerStats = Array.isArray(normalized.playerStats) ? normalized.playerStats.length : Number(counts.playerStats || 0);
  const lineups = normalized.lineups ? Number(counts.lineups || 1) : Number(counts.lineups || 0);
  const rateLimited = Boolean(
    raw.rateLimited ||
    String(snapshot?.provider || '').includes('ERROR') ||
    endpointsFailed.some((item: any) => Number(item?.status) === 429 || String(item?.message || '').includes('429'))
  );

  return {
    shots,
    playerStats,
    lineups,
    hasFullExtras: shots > 0 || playerStats > 0 || lineups > 0,
    rateLimited,
  };
}

function Card({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const toneClass = tone === 'good'
    ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]'
    : tone === 'warn'
      ? 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]'
      : tone === 'bad'
        ? 'border-red-400/25 bg-red-500/10 text-red-200'
        : 'border-white/10 bg-white/[0.04] text-slate-300';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-black opacity-80">{label}</p>
      <b className="mt-2 block text-2xl text-white">{value}</b>
    </div>
  );
}

function statusPill(ok: boolean, text: string) {
  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${ok ? 'border-[#18E58F]/25 bg-[#18E58F]/10 text-[#18E58F]' : 'border-[#F8C846]/25 bg-[#F8C846]/10 text-[#F8C846]'}`}>
      {text}
    </span>
  );
}

export default async function MatchExtrasMonitorPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const key = resolvedSearchParams?.key;

  if (!isAuthorized(key)) {
    return (
      <main className="min-h-screen bg-[#04110D] p-6 text-white" dir="rtl">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-center">
          <h1 className="text-2xl font-black">لوحة مراقبة محمية</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-red-100">
            افتح الصفحة باستخدام مفتاح الإدارة في الرابط: <code className="rounded bg-black/30 px-2 py-1">?key=ADMIN_API_SECRET</code>
          </p>
        </div>
      </main>
    );
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [snapshots, matches] = await Promise.all([
    prisma.matchStatsSnapshot.findMany({
      where: { provider: { startsWith: 'THE_STATS_API' } },
      orderBy: { capturedAt: 'desc' },
      take: 50,
      include: {
        match: {
          include: {
            homeTeam: { select: { id: true, name: true, code: true } },
            awayTeam: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }).catch(() => [] as any[]),
    prisma.match.findMany({
      where: {
        matchDate: { gte: since, lte: new Date(Date.now() + 6 * 60 * 60 * 1000) },
        status: { in: FINISHED_STATUSES },
      },
      orderBy: { matchDate: 'desc' },
      take: 40,
      include: {
        homeTeam: { select: { id: true, name: true, code: true } },
        awayTeam: { select: { id: true, name: true, code: true } },
        statsSnapshots: {
          where: { provider: { startsWith: 'THE_STATS_API' } },
          orderBy: { capturedAt: 'desc' },
          take: 10,
        },
      },
    }).catch(() => [] as any[]),
  ]);

  const snapshotRows = snapshots.map((snapshot: any) => ({ snapshot, signals: snapshotSignals(snapshot) }));
  const successful = snapshotRows.filter((row) => row.signals.hasFullExtras && !row.signals.rateLimited);
  const rateLimited = snapshotRows.filter((row) => row.signals.rateLimited);
  const missing = matches
    .map((match: any) => ({ match, latest: match.statsSnapshots?.[0], hasFullExtras: (match.statsSnapshots || []).some((s: any) => snapshotSignals(s).hasFullExtras) }))
    .filter((row) => !row.hasFullExtras)
    .slice(0, 12);

  return (
    <main className="min-h-screen bg-[#04110D] px-3 py-5 text-white" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black">لوحة مراقبة بيانات التحليل المتقدم</h1>
              <p className="mt-2 text-sm font-bold text-slate-400">
                قراءة من قاعدة البيانات فقط: snapshots، مباريات ناقصة، ومؤشرات 429 إن تم تسجيلها.
              </p>
            </div>
            <Link href="/matches" className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">العودة للمباريات</Link>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Card label="Full Extras ناجحة" value={successful.length} tone="good" />
          <Card label="مباريات ناقصة" value={missing.length} tone={missing.length ? 'warn' : 'good'} />
          <Card label="429 مسجلة" value={rateLimited.length} tone={rateLimited.length ? 'bad' : 'good'} />
          <Card label="Snapshots مفحوصة" value={snapshotRows.length} />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-2xl font-black">آخر Full Extras Snapshots</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="text-xs font-black text-slate-400">
                <tr className="border-b border-white/10">
                  <th className="py-3">المباراة</th>
                  <th>آخر تحديث</th>
                  <th>المصدر</th>
                  <th>Shots</th>
                  <th>Players</th>
                  <th>Lineups</th>
                  <th>الحالة</th>
                  <th>رابط</th>
                </tr>
              </thead>
              <tbody>
                {successful.slice(0, 15).map(({ snapshot, signals }) => (
                  <tr key={snapshot.id} className="border-b border-white/5 text-slate-200">
                    <td className="py-3 font-bold">{snapshot.match?.homeTeam?.name || '—'} ضد {snapshot.match?.awayTeam?.name || '—'}</td>
                    <td className="text-slate-400">{formatEgyptDateTime(snapshot.capturedAt)}</td>
                    <td className="text-slate-400">{snapshot.provider}</td>
                    <td>{signals.shots}</td>
                    <td>{signals.playerStats}</td>
                    <td>{signals.lineups}</td>
                    <td>{statusPill(true, 'جاهز')}</td>
                    <td><Link className="text-[#18E58F] font-black" href={`/match-center/${snapshot.matchId}/advanced`}>فتح</Link></td>
                  </tr>
                ))}
                {!successful.length && (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-400">لا توجد Snapshots ناجحة بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-[#F8C846]/15 bg-[#F8C846]/[0.04] p-5">
            <h2 className="mb-4 text-2xl font-black">مباريات تحتاج Full Extras</h2>
            <div className="space-y-3">
              {missing.map(({ match, latest }) => (
                <div key={match.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{match.homeTeam?.name || '—'} ضد {match.awayTeam?.name || '—'}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-400">{formatEgyptDateTime(match.matchDate)} · {latest ? `آخر Snapshot: ${formatEgyptDateTime(latest.capturedAt)}` : 'لا توجد Snapshot'}</p>
                    </div>
                    {statusPill(false, 'ناقص')}
                  </div>
                </div>
              ))}
              {!missing.length && <p className="rounded-2xl border border-[#18E58F]/20 bg-[#18E58F]/10 p-4 text-sm font-bold text-[#18E58F]">كل المباريات الأخيرة لديها Full Extras أو لا توجد مباريات منتهية ضمن النطاق.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-400/15 bg-red-500/[0.04] p-5">
            <h2 className="mb-4 text-2xl font-black">آخر 429 / Rate Limit مسجلة</h2>
            <div className="space-y-3">
              {rateLimited.slice(0, 10).map(({ snapshot }) => (
                <div key={snapshot.id} className="rounded-2xl border border-red-400/20 bg-black/20 p-4">
                  <h3 className="font-black">{snapshot.match?.homeTeam?.name || '—'} ضد {snapshot.match?.awayTeam?.name || '—'}</h3>
                  <p className="mt-1 text-xs font-bold text-red-100">{formatEgyptDateTime(snapshot.capturedAt)} · {snapshot.provider}</p>
                </div>
              ))}
              {!rateLimited.length && <p className="rounded-2xl border border-[#18E58F]/20 bg-[#18E58F]/10 p-4 text-sm font-bold text-[#18E58F]">لا توجد 429 مسجلة في آخر Snapshots المفحوصة.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
