"use client";

import { useState } from "react";
import { Activity, Loader2, PlayCircle, RefreshCw, Search, ShieldAlert, Users } from "lucide-react";

type LiveMatch = {
  matchId: string | number;
  leagueName?: string;
  leagueId?: string | number;
  matchTime?: number;
  status?: number;
  homeName?: string;
  awayName?: string;
  homeScore?: number;
  awayScore?: number;
  homeYellow?: number;
  awayYellow?: number;
  homeRed?: number;
  awayRed?: number;
  homeCorner?: number;
  awayCorner?: number;
  hasLineup?: boolean;
};

type ApiResult = {
  success?: boolean;
  error?: string;
  message?: string;
  total?: number;
  totalPlayers?: number;
  matched?: number;
  updated?: number;
  notMatched?: number;
  matches?: LiveMatch[];
  players?: any[];
  results?: any[];
  match?: any;
  skipped?: boolean;
  reason?: string;
};

function formatDate(timestamp?: number) {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(status?: number) {
  if (status === -1) return "انتهت";
  if (status && status > 0) return "مباشر";
  if (status === 0) return "قادمة";
  return String(status ?? "-");
}

export default function ISportsAdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [matchId, setMatchId] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [matches, setMatches] = useState<LiveMatch[]>([]);

  async function requestJson(path: string, options: RequestInit = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(adminSecret ? { Authorization: `Bearer ${adminSecret}` } : {}),
      ...(options.headers || {}),
    } as Record<string, string>;

    const res = await fetch(path, { ...options, headers });
    return res.json();
  }

  async function loadLivescores() {
    setLoading("livescores");
    setResult(null);
    try {
      const qs = new URLSearchParams();
      if (leagueId.trim()) qs.set("leagueId", leagueId.trim());
      const data = await requestJson(`/api/admin/isports/livescores${qs.toString() ? `?${qs}` : ""}`);
      setResult(data);
      setMatches(data.matches || []);
    } catch (error: any) {
      setResult({ error: error.message || "فشل جلب المباريات" });
    } finally {
      setLoading(null);
    }
  }

  async function loadLineups() {
    if (!matchId.trim()) return setResult({ error: "أدخل matchId أولًا" });
    setLoading("lineups");
    setResult(null);
    try {
      const qs = new URLSearchParams({ matchId: matchId.trim() });
      const data = await requestJson(`/api/admin/isports/lineups?${qs}`);
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message || "فشل جلب التشكيل" });
    } finally {
      setLoading(null);
    }
  }

  async function syncLineups(dryRun: boolean) {
    if (!matchId.trim()) return setResult({ error: "أدخل matchId أولًا" });
    setLoading(dryRun ? "syncLineupsDry" : "syncLineups");
    setResult(null);
    try {
      const data = await requestJson("/api/admin/isports/sync-lineups", {
        method: "POST",
        body: JSON.stringify({ matchId: Number(matchId), dryRun }),
      });
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message || "فشل مزامنة التشكيل" });
    } finally {
      setLoading(null);
    }
  }

  async function syncTeamResult(dryRun: boolean) {
    if (!matchId.trim()) return setResult({ error: "أدخل matchId أولًا" });
    setLoading(dryRun ? "syncResultDry" : "syncResult");
    setResult(null);
    try {
      const data = await requestJson("/api/admin/isports/sync-team-result", {
        method: "POST",
        body: JSON.stringify({ matchId: Number(matchId), dryRun }),
      });
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message || "فشل تحديث نتيجة المنتخب" });
    } finally {
      setLoading(null);
    }
  }

  const rows = result?.results || result?.players || [];

  return (
    <main className="min-h-screen bg-[#050510] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-emerald-400/20 bg-white/[0.03] p-6 shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-300">
                <Activity className="h-6 w-6" />
                <span className="text-sm font-bold uppercase tracking-[0.3em]">iSportsAPI</span>
              </div>
              <h1 className="mt-3 text-3xl font-black md:text-4xl">مزامنة المباريات الحية والتشكيلات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                استخدم هذه الصفحة لجلب Livescores و Lineups من iSportsAPI. البيانات المتاحة حاليًا تفيد في النتائج المباشرة، التشكيلات، ربط معرفات اللاعبين، وتحديث تقييم المنتخب من النتيجة.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm text-slate-300">League ID اختياري</span>
            <input
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="مثال كأس العالم: 1572"
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Match ID</span>
            <input
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="مثال: 353609924"
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <ShieldAlert className="h-4 w-4" />
              Admin Secret اختياري إذا لم تكن مسجل دخول كأدمن
            </span>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="اتركه فارغًا إذا كنت داخل حساب أدمن"
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <div className="grid gap-3 md:col-span-2 lg:col-span-4 md:grid-cols-2 lg:grid-cols-5">
            <button
              onClick={loadLivescores}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-60"
            >
              {loading === "livescores" ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" />}
              جلب المباريات
            </button>
            <button
              onClick={loadLineups}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {loading === "lineups" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}
              جلب التشكيل
            </button>
            <button
              onClick={() => syncLineups(true)}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-5 py-3 font-bold text-yellow-100 transition hover:bg-yellow-400/20 disabled:opacity-60"
            >
              {loading === "syncLineupsDry" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              تجربة ربط اللاعبين
            </button>
            <button
              onClick={() => syncLineups(false)}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading === "syncLineups" ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              حفظ ربط اللاعبين
            </button>
            <button
              onClick={() => syncTeamResult(false)}
              disabled={!!loading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-rose-400 px-5 py-3 font-black text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading === "syncResult" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Activity className="h-5 w-5" />}
              تحديث نتيجة المنتخب
            </button>
          </div>
        </section>

        {matches.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-black">المباريات الحية / القادمة</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-right">Match ID</th>
                    <th className="px-4 py-3 text-right">البطولة</th>
                    <th className="px-4 py-3 text-right">المباراة</th>
                    <th className="px-4 py-3 text-right">النتيجة</th>
                    <th className="px-4 py-3 text-right">الحالة</th>
                    <th className="px-4 py-3 text-right">التوقيت</th>
                    <th className="px-4 py-3 text-right">التشكيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {matches.slice(0, 80).map((match) => (
                    <tr key={String(match.matchId)} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <button onClick={() => setMatchId(String(match.matchId))} className="text-emerald-300 underline">
                          {match.matchId}
                        </button>
                      </td>
                      <td className="px-4 py-3">{match.leagueName || "-"}</td>
                      <td className="px-4 py-3 font-bold">{match.homeName} ضد {match.awayName}</td>
                      <td className="px-4 py-3">{match.homeScore ?? 0} - {match.awayScore ?? 0}</td>
                      <td className="px-4 py-3">{statusLabel(match.status)}</td>
                      <td className="px-4 py-3">{formatDate(match.matchTime)}</td>
                      <td className="px-4 py-3">{match.hasLineup ? "متاح" : "غير متاح"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {result && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            {result.error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{result.error}</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">الإجمالي</div>
                    <div className="mt-1 text-2xl font-black">{result.total ?? result.totalPlayers ?? rows.length ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">مطابق</div>
                    <div className="mt-1 text-2xl font-black text-emerald-300">{result.matched ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">تم التحديث</div>
                    <div className="mt-1 text-2xl font-black text-cyan-300">{result.updated ?? 0}</div>
                  </div>
                  <div className="rounded-2xl bg-[#0b1020] p-4">
                    <div className="text-xs text-slate-400">غير مطابق</div>
                    <div className="mt-1 text-2xl font-black text-yellow-300">{result.notMatched ?? 0}</div>
                  </div>
                </div>

                {result.message && <p className="mt-4 rounded-2xl bg-[#0b1020] p-4 text-slate-200">{result.message}</p>}
                {result.skipped && <p className="mt-4 rounded-2xl bg-yellow-400/10 p-4 text-yellow-100">{result.reason}</p>}

                {rows.length > 0 && (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-full divide-y divide-white/10 text-sm">
                      <thead className="bg-white/5 text-slate-300">
                        <tr>
                          <th className="px-4 py-3 text-right">الأصل</th>
                          <th className="px-4 py-3 text-right">المطابقة</th>
                          <th className="px-4 py-3 text-right">الحالة</th>
                          <th className="px-4 py-3 text-right">الدور</th>
                          <th className="px-4 py-3 text-right">التأثير</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {rows.slice(0, 120).map((row: any, index: number) => (
                          <tr key={`${row.assetId || row.providerPlayerId || index}`} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-3">
                              <div className="font-bold">{row.assetName || row.name || row.providerName || "-"}</div>
                              <div className="text-xs text-slate-500">{row.assetId || row.providerPlayerId || "-"}</div>
                            </td>
                            <td className="px-4 py-3">{row.providerName || "-"}</td>
                            <td className="px-4 py-3">{row.status}</td>
                            <td className="px-4 py-3">{row.squadRole || row.side || "-"}</td>
                            <td className="px-4 py-3">
                              {row.teamRating ? `${Number(row.teamRating).toFixed(1)}/100` : row.updateData ? Object.keys(row.updateData).join(", ") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
