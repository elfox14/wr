import Link from 'next/link';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type VerificationRow = {
  id: string;
  provider: string;
  route: string | null;
  localMatchId: string | null;
  providerMatchId: string | null;
  field: string | null;
  localValue: string | null;
  providerValue: string | null;
  action: string;
  confidence: string | null;
  notes: string | null;
  createdAt: Date | string;
};

type RecentMatch = {
  id: string;
  externalId: string | null;
  matchDate: Date | string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string | null; code: string | null } | null;
  awayTeam: { name: string | null; code: string | null } | null;
  statsSnapshots: Array<{ id: string; provider: string; capturedAt: Date | string }>;
};

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

function formatDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-EG', { hour12: false });
}

function statusClass(notes: string | null) {
  if (notes === 'matched') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (notes === 'different') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (notes === 'missing_locally') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function matchTitle(match: RecentMatch) {
  const home = match.homeTeam?.name || match.homeTeam?.code || 'Home';
  const away = match.awayTeam?.name || match.awayTeam?.code || 'Away';
  return `${home} vs ${away}`;
}

function scoreLabel(match: RecentMatch) {
  if (match.homeScore === null || match.awayScore === null) return match.status || '—';
  return `${match.homeScore} - ${match.awayScore}`;
}

function actionUrl(path: string, secret: string, params: Record<string, string | number | boolean>) {
  const query = new URLSearchParams({ adminSecret: secret });
  Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
  return `${path}?${query.toString()}`;
}

function ActionLink({ href, children, tone = 'default' }: { href: string; children: string; tone?: 'default' | 'safe' | 'danger' }) {
  const classes = tone === 'safe'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
    : tone === 'danger'
      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-black transition ${classes}`}>
      {children}
    </a>
  );
}

async function loadRows() {
  try {
    return await prisma.$queryRawUnsafe<VerificationRow[]>(`
      SELECT "id", "provider", "route", "localMatchId", "providerMatchId", "field", "localValue", "providerValue", "action", "confidence", "notes", "createdAt"
      FROM "DataVerificationLog"
      ORDER BY "createdAt" DESC
      LIMIT 200
    `);
  } catch (error) {
    return [];
  }
}

async function loadRecentMatches(): Promise<RecentMatch[]> {
  try {
    return await prisma.match.findMany({
      where: { matchDate: { lte: new Date() } },
      include: {
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
        statsSnapshots: {
          where: { provider: 'THE_STATS_API' },
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { id: true, provider: true, capturedAt: true },
        },
      },
      orderBy: { matchDate: 'desc' },
      take: 12,
    }) as any;
  } catch (error) {
    return [];
  }
}

export default async function DataVerificationPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) || {};
  if (!isAuthorized(params)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">
          <h1 className="text-2xl font-bold">Data Verification</h1>
          <p className="mt-3 text-sm leading-6">
            هذه الصفحة إدارية ومحمية. افتحها بإضافة <code className="rounded bg-white px-1">?adminSecret=...</code> أو استخدم Header عبر أدوات الاختبار.
          </p>
        </div>
      </main>
    );
  }

  const rows = await loadRows();
  const recentMatches = await loadRecentMatches();
  const secret = suppliedSecret(params);
  const matched = rows.filter((row) => row.notes === 'matched').length;
  const different = rows.filter((row) => row.notes === 'different').length;
  const reportedOnly = rows.filter((row) => row.action === 'reported_only').length;
  const latest = rows[0]?.createdAt ? formatDate(rows[0].createdAt) : '—';
  const batchPreviewUrl = actionUrl('/api/admin/the-stats-import-matchday-enrichment', secret, { daysBack: 3, take: 3, dryRun: true });
  const batchImportUrl = actionUrl('/api/admin/the-stats-import-matchday-enrichment', secret, { daysBack: 3, take: 3, dryRun: false });
  const batchForcePreviewUrl = actionUrl('/api/admin/the-stats-import-matchday-enrichment', secret, { daysBack: 3, take: 3, dryRun: true, force: true });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">THE_STATS_API · VERIFY ONLY</p>
          <h1 className="mt-2 text-3xl font-black">لوحة تحقق بيانات المباريات</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            تعرض هذه الصفحة آخر سجلات المقارنة بين قاعدة بيانات الموقع وTheStatsAPI. لا توجد أي تعديلات تلقائية هنا؛ قاعدة البيانات تظل مصدر الحقيقة، والنتائج للمتابعة والمراجعة فقط.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">السجلات المعروضة</p>
            <p className="mt-2 text-3xl font-black">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm text-emerald-700">Matched</p>
            <p className="mt-2 text-3xl font-black text-emerald-800">{matched}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm text-amber-700">Different</p>
            <p className="mt-2 text-3xl font-black text-amber-800">{different}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">آخر تحقق</p>
            <p className="mt-2 text-lg font-bold">{latest}</p>
            <p className="mt-1 text-xs text-slate-500">reported_only: {reportedOnly}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-emerald-700">TheStatsAPI Enrichment Import</p>
              <h2 className="mt-1 text-2xl font-black text-emerald-950">استيراد الإحصائيات والتشكيلات</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-800">
                ابدأ دائمًا بـ Preview. زر Import يحفظ Snapshots منفصلة باسم THE_STATS_API ولا يغير النتيجة ولا يكتب فوق iSports. كل الروابط تفتح في تبويب جديد حتى تراجع JSON قبل أي حفظ.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionLink href={batchPreviewUrl} tone="safe">Batch Preview آخر 3</ActionLink>
              <ActionLink href={batchImportUrl} tone="danger">Batch Import آخر 3</ActionLink>
              <ActionLink href={batchForcePreviewUrl}>Force Preview</ActionLink>
              <Link href={`/admin/match-snapshots?adminSecret=${encodeURIComponent(secret)}`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-50">مراجعة Snapshots</Link>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
            <div className="border-b border-emerald-100 px-4 py-3 text-sm font-black text-emerald-950">آخر المباريات</div>
            <div className="divide-y divide-slate-100">
              {recentMatches.map((match) => {
                const imported = match.statsSnapshots?.[0];
                return (
                  <div key={match.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{matchTitle(match)}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600">{scoreLabel(match)}</span>
                        {imported ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-700">THE_STATS_API محفوظ</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700">لم يتم الاستيراد</span>}
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">{match.id} · {formatDate(match.matchDate)}</p>
                      {imported ? <p className="mt-1 text-xs text-emerald-700">آخر Snapshot: {imported.id} · {formatDate(imported.capturedAt)}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionLink href={actionUrl('/api/admin/the-stats-import-match-enrichment', secret, { matchId: match.id, dryRun: true })} tone="safe">Preview</ActionLink>
                      <ActionLink href={actionUrl('/api/admin/the-stats-import-match-enrichment', secret, { matchId: match.id, dryRun: false })} tone="danger">Import</ActionLink>
                      <ActionLink href={actionUrl('/api/admin/match-infographic-data', secret, { matchId: match.id })}>Infographic JSON</ActionLink>
                      <ActionLink href={`/match-center/${match.id}`}>فتح الصفحة</ActionLink>
                    </div>
                  </div>
                );
              })}
              {!recentMatches.length && <p className="p-6 text-center text-sm text-slate-500">لا توجد مباريات حديثة للعرض.</p>}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-black">آخر 200 سجل</h2>
            <p className="mt-1 text-sm text-slate-500">استخدم هذه الصفحة للمراجعة فقط، ولا تعرضها للعامة.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Provider Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{row.field || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(row.notes)}`}>{row.notes || '—'}</span>
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-700">{row.localValue || '—'}</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-700">{row.providerValue || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.localMatchId || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.providerMatchId || '—'}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      لا توجد سجلات بعد. شغّل endpoint التحقق أولًا لإنشاء DataVerificationLog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
