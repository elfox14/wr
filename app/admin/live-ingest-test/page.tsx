"use client";

import { useMemo, useState } from "react";

type IngestResult = {
  ok?: boolean;
  error?: string;
  mode?: string;
  savedEventsCount?: number;
  match?: any;
  snapshot?: any;
  note?: string;
};

const DEFAULT_MATCH_ID = "cmq6vhhmp012cg7g4u5g50g9u";

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function LiveIngestTestPage() {
  const [secret, setSecret] = useState("");
  const [matchId, setMatchId] = useState(DEFAULT_MATCH_ID);
  const [providerMatchId, setProviderMatchId] = useState("123456");
  const [status, setStatus] = useState("1H");
  const [minute, setMinute] = useState("17");
  const [homeScore, setHomeScore] = useState("0");
  const [awayScore, setAwayScore] = useState("0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const previewPayload = useMemo(() => ({
    matchId: matchId.trim(),
    provider: "MANUAL_TEST",
    providerMatchId: Number(providerMatchId || 0),
    status: status.trim(),
    minute: Number(minute || 0),
    homeScore: Number(homeScore || 0),
    awayScore: Number(awayScore || 0),
    stats: {
      homePossession: 54,
      awayPossession: 46,
      homeShots: 3,
      awayShots: 1,
      homeShotsOnTarget: 1,
      awayShotsOnTarget: 0,
    },
    events: [
      {
        minute: Number(minute || 0),
        type: "shot_on_target",
        teamSide: "home",
        detail: "تسديدة اختبار على المرمى",
        sourceName: "Manual Test",
      },
    ],
  }), [awayScore, homeScore, matchId, minute, providerMatchId, status]);

  async function submitTest() {
    if (!secret.trim()) {
      setResult({ ok: false, error: "أدخل LIVE_INGEST_SECRET أولًا. لا تضعه في الرابط." });
      return;
    }
    if (!matchId.trim()) {
      setResult({ ok: false, error: "أدخل matchId من قاعدة البيانات." });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/internal/live-ingest/match-snapshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-live-ingest-secret": secret.trim(),
        },
        body: JSON.stringify(previewPayload),
      });
      const data = await response.json().catch(() => ({ ok: false, error: "Invalid JSON response" }));
      setResult(response.ok ? data : { ...data, ok: false, error: data.error || `HTTP ${response.status}` });
    } catch (error: any) {
      setResult({ ok: false, error: error?.message || "فشل إرسال Snapshot" });
    } finally {
      setLoading(false);
    }
  }

  const readUrl = `/api/matches/live-stats?dbMatchId=${encodeURIComponent(matchId.trim() || DEFAULT_MATCH_ID)}`;

  return (
    <main dir="rtl" className="min-h-screen bg-[#050510] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-emerald-400/20 bg-white/[0.03] p-6 shadow-2xl">
          <div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">DB-only live ingest</div>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">اختبار إدخال Snapshot للمباراة من الموقع</h1>
          <p className="mt-3 max-w-3xl leading-8 text-slate-300">
            هذه الصفحة ترسل بيانات اختبار إلى endpoint الداخلي. السر لا يظهر في الرابط، بل يرسل في Header فقط. بعد النجاح افتح رابط القراءة للتأكد أن الصفحة تقرأ من قاعدة البيانات فقط.
          </p>
        </section>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">LIVE_INGEST_SECRET أو ADMIN_API_SECRET</span>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="الصق السر هنا — لا تضعه في URL"
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Database Match ID</span>
            <input
              value={matchId}
              onChange={(event) => setMatchId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Provider Match ID</span>
            <input
              value={providerMatchId}
              onChange={(event) => setProviderMatchId(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            >
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="1H">1H</option>
              <option value="HT">HT</option>
              <option value="2H">2H</option>
              <option value="FINISHED">FINISHED</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Minute</span>
            <input
              value={minute}
              onChange={(event) => setMinute(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Home Score</span>
            <input
              value={homeScore}
              onChange={(event) => setHomeScore(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Away Score</span>
            <input
              value={awayScore}
              onChange={(event) => setAwayScore(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0b1020] px-4 py-3 text-white outline-none focus:border-emerald-400"
            />
          </label>

          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row">
            <button
              onClick={submitTest}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 font-black text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "جارٍ الإرسال..." : "إرسال Snapshot اختبار"}
            </button>
            <a
              href={readUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-6 py-3 text-center font-bold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              فتح قراءة live-stats من DB
            </a>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-black">Payload الذي سيتم إرساله</h2>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl bg-black/40 p-4 text-left text-xs leading-6 text-slate-200" dir="ltr">
              {safeJson(previewPayload)}
            </pre>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-black">النتيجة</h2>
            {!result ? (
              <p className="mt-4 rounded-2xl bg-[#0b1020] p-4 text-slate-300">لم يتم الإرسال بعد.</p>
            ) : result.ok ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">
                  تم الحفظ بنجاح. mode: {result.mode || "-"} — أحداث محفوظة: {result.savedEventsCount ?? 0}
                </div>
                <pre className="max-h-[360px] overflow-auto rounded-2xl bg-black/40 p-4 text-left text-xs leading-6 text-slate-200" dir="ltr">
                  {safeJson(result)}
                </pre>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{result.error || "فشل الإرسال"}</div>
                <pre className="max-h-[360px] overflow-auto rounded-2xl bg-black/40 p-4 text-left text-xs leading-6 text-slate-200" dir="ltr">
                  {safeJson(result)}
                </pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
