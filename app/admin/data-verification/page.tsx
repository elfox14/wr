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

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function isAuthorized(params: Record<string, string | string[] | undefined>) {
  const secrets = [process.env.ADMIN_API_SECRET, process.env.CRON_SECRET]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const supplied = String(getParam(params, 'adminSecret') || getParam(params, 'key') || getParam(params, 'cronSecret') || '').trim();
  return !!supplied && secrets.includes(supplied);
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
  const matched = rows.filter((row) => row.notes === 'matched').length;
  const different = rows.filter((row) => row.notes === 'different').length;
  const reportedOnly = rows.filter((row) => row.action === 'reported_only').length;
  const latest = rows[0]?.createdAt ? formatDate(rows[0].createdAt) : '—';

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
