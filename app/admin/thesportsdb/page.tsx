"use client";

import { useState } from "react";
import { ImageIcon, Loader2, RefreshCw, Search, ShieldAlert, Users } from "lucide-react";

type SyncResult = {
  success?: boolean;
  dryRun?: boolean;
  total?: number;
  matched?: number;
  notFound?: number;
  errors?: number;
  results?: Array<{
    assetId: string;
    name: string;
    type: string;
    status: string;
    providerName?: string;
    providerId?: string;
    imageBefore?: string | null;
    imageAfter?: string | null;
    error?: string;
  }>;
  error?: string;
  details?: any;
};

export default function TheSportsDbAdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [type, setType] = useState<"PLAYER" | "TEAM">("PLAYER");
  const [limit, setLimit] = useState(50);
  const [assetId, setAssetId] = useState("");
  const [overwriteImages, setOverwriteImages] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function runSync(dryRun: boolean) {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/thesportsdb/sync-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminSecret ? { Authorization: `Bearer ${adminSecret}` } : {}),
        },
        body: JSON.stringify({
          type,
          limit,
          dryRun,
          overwriteImages,
          ...(assetId.trim() ? { assetId: assetId.trim() } : {}),
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message || "Sync failed" });
    } finally {
      setLoading(false);
    }
  }

  const rows = result?.results || [];

  return (
    <main className="min-h-screen bg-[#050510] text-white px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-cyan-400/20 bg-white/[0.03] p-6 shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-300">
                <ImageIcon className="h-6 w-6" />
                <span className="text-sm font-bold uppercase tracking-[0.3em]">TheSportsDB</span>
              </div>
              <h1 className="mt-3 text-3xl font-black md:text-4xl">تحديث صور اللاعبين والمنتخبات</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                استخدم هذه الصفحة لجلب الصور الحقيقية من TheSportsDB واستبدال الصور القديمة داخل قاعدة البيانات.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm text-slate-300">نوع الأصل</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "PLAYER" | "TEAM")}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              <option value="PLAYER">اللاعبين</option>
              <option value="TEAM">المنتخبات</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">عدد العناصر</span>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm text-slate-300">Asset ID اختياري لتحديث لاعب واحد</span>
            <input
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="مثال: player-lionel-messi"
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 md:col-span-2 lg:col-span-4">
            <input
              type="checkbox"
              checked={overwriteImages}
              onChange={(e) => setOverwriteImages(e.target.checked)}
              className="h-5 w-5 accent-cyan-400"
            />
            <span className="text-sm text-slate-200">استبدال الصور القديمة حتى لو كانت موجودة</span>
          </label>

          <label className="space-y-2 md:col-span-2 lg:col-span-4">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <ShieldAlert className="h-4 w-4" />
              Admin Secret اختياري إذا لم تكن مسجل دخول كأدمن
            </span>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="اتركه فارغًا إذا كنت داخل حساب أدمن"
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </label>

          <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-4 md:flex-row">
            <button
              onClick={() => runSync(true)}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              تجربة بدون حفظ
            </button>
            <button
              onClick={() => runSync(false)}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              تنفيذ التحديث الفعلي
            </button>
          </div>
        </section>

        {result && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            {result.error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
                {result.error}
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">الإجمالي</div>
                    <div className="mt-1 text-2xl font-black">{result.total ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">تم العثور</div>
                    <div className="mt-1 text-2xl font-black text-emerald-300">{result.matched ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">غير موجود</div>
                    <div className="mt-1 text-2xl font-black text-yellow-300">{result.notFound ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">أخطاء</div>
                    <div className="mt-1 text-2xl font-black text-red-300">{result.errors ?? 0}</div>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-white/5 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 text-right">الأصل</th>
                        <th className="px-4 py-3 text-right">الحالة</th>
                        <th className="px-4 py-3 text-right">المطابقة</th>
                        <th className="px-4 py-3 text-right">الصورة الجديدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {rows.map((row) => (
                        <tr key={row.assetId} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div className="font-bold">{row.name}</div>
                            <div className="text-xs text-slate-500">{row.assetId}</div>
                          </td>
                          <td className="px-4 py-3">{row.status}</td>
                          <td className="px-4 py-3">{row.providerName || row.error || "-"}</td>
                          <td className="px-4 py-3">
                            {row.imageAfter ? (
                              <a href={row.imageAfter} target="_blank" className="text-cyan-300 underline">
                                فتح الصورة
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">
          <div className="flex items-start gap-3">
            <Users className="mt-1 h-5 w-5" />
            <p className="text-sm leading-7">
              ابدأ دائمًا بزر <b>تجربة بدون حفظ</b> لأول 20 أو 50 لاعب. إذا كانت المطابقات صحيحة، اضغط <b>تنفيذ التحديث الفعلي</b>.
              لو بعض اللاعبين لم تظهر لهم صور، فهذا يعني أن TheSportsDB لا يملك صورة لهم أو الاسم مختلف.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
