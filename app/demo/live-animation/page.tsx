"use client";

import { useEffect, useMemo, useState } from "react";

type TeamKey = "home" | "away";

type MatchStats = {
  possession: Record<TeamKey, number>;
  attacks: Record<TeamKey, number>;
  dangerousAttacks: Record<TeamKey, number>;
  shots: Record<TeamKey, number>;
  onTarget: Record<TeamKey, number>;
  corners: Record<TeamKey, number>;
  score: Record<TeamKey, number>;
};

type DemoEvent = {
  id: number;
  minute: number;
  second: number;
  team: TeamKey;
  label: string;
  type: "attack" | "danger" | "shot" | "target" | "corner" | "goal";
  x: number;
  y: number;
  confidence: number;
  source: "stats-delta" | "vision-placeholder" | "operator";
};

const teamNames: Record<TeamKey, string> = {
  home: "الفريق الأول",
  away: "الفريق الثاني",
};

const initialStats: MatchStats = {
  possession: { home: 56, away: 44 },
  attacks: { home: 12, away: 9 },
  dangerousAttacks: { home: 5, away: 3 },
  shots: { home: 2, away: 1 },
  onTarget: { home: 1, away: 0 },
  corners: { home: 1, away: 0 },
  score: { home: 0, away: 0 },
};

const demoEvents: Array<Omit<DemoEvent, "id" | "minute" | "second">> = [
  { team: "home", label: "هجمة منظمة", type: "attack", x: 62, y: 34, confidence: 0.68, source: "stats-delta" },
  { team: "home", label: "هجمة خطيرة من اليمين", type: "danger", x: 78, y: 24, confidence: 0.73, source: "vision-placeholder" },
  { team: "home", label: "تسديدة خارج المرمى", type: "shot", x: 86, y: 48, confidence: 0.71, source: "stats-delta" },
  { team: "away", label: "انتقال سريع", type: "attack", x: 38, y: 65, confidence: 0.64, source: "stats-delta" },
  { team: "away", label: "ركنية", type: "corner", x: 6, y: 8, confidence: 0.82, source: "operator" },
  { team: "home", label: "تسديدة على المرمى", type: "target", x: 91, y: 50, confidence: 0.78, source: "stats-delta" },
  { team: "home", label: "هدف تجريبي", type: "goal", x: 97, y: 50, confidence: 0.9, source: "operator" },
];

function extractYouTubeEmbedUrl(value: string): string | null {
  if (!value.trim()) return null;

  try {
    const url = new URL(value.trim());

    if (url.hostname.includes("youtube.com")) {
      const watchId = url.searchParams.get("v");
      if (watchId) return `https://www.youtube.com/embed/${watchId}`;

      const parts = url.pathname.split("/").filter(Boolean);
      const liveIndex = parts.indexOf("live");
      const shortsIndex = parts.indexOf("shorts");
      const embedIndex = parts.indexOf("embed");
      const id = parts[liveIndex + 1] || parts[shortsIndex + 1] || parts[embedIndex + 1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}

export default function LiveAnimationDemoPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [stats, setStats] = useState<MatchStats>(initialStats);
  const [isPlaying, setIsPlaying] = useState(true);

  const embedUrl = useMemo(() => extractYouTubeEmbedUrl(videoUrl), [videoUrl]);
  const activeEvent = events[0];

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        const nextIndex = index % demoEvents.length;
        const generated: DemoEvent = {
          ...demoEvents[nextIndex],
          id: Date.now(),
          minute: 18 + Math.floor(index / 3),
          second: (index * 12) % 60,
        };

        setEvents((previous) => [generated, ...previous].slice(0, 8));
        setStats((previous) => {
          const next: MatchStats = JSON.parse(JSON.stringify(previous));
          const team = generated.team;

          if (["attack", "danger", "shot", "target", "corner", "goal"].includes(generated.type)) {
            next.attacks[team] += 1;
          }
          if (["danger", "shot", "target", "goal"].includes(generated.type)) {
            next.dangerousAttacks[team] += 1;
          }
          if (["shot", "target", "goal"].includes(generated.type)) {
            next.shots[team] += 1;
          }
          if (["target", "goal"].includes(generated.type)) {
            next.onTarget[team] += 1;
          }
          if (generated.type === "corner") {
            next.corners[team] += 1;
          }
          if (generated.type === "goal") {
            next.score[team] += 1;
          }

          const drift = generated.team === "home" ? 1 : -1;
          next.possession.home = Math.min(72, Math.max(28, next.possession.home + drift));
          next.possession.away = 100 - next.possession.home;

          return next;
        });

        return index + 1;
      });
    }, 1400);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const momentumHome = Math.min(100, Math.round((stats.dangerousAttacks.home * 3 + stats.shots.home * 4 + stats.onTarget.home * 5) / 2));
  const momentumAway = Math.min(100, Math.round((stats.dangerousAttacks.away * 3 + stats.shots.away * 4 + stats.onTarget.away * 5) / 2));
  const totalMomentum = Math.max(momentumHome + momentumAway, 1);
  const homeMomentumWidth = Math.round((momentumHome / totalMomentum) * 100);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-6 shadow-2xl shadow-emerald-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-200">
                صفحة تجريبية — Live Vision Animation MVP
              </p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                المحاكاة تعمل بدون فيديو — والفيديو اختياري للعرض فقط
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                المحرك التجريبي يولد أحداثًا وإحصائيات تلقائيًا حتى لو لم تضف رابط فيديو. عند إضافة رابط YouTube سيظهر الفيديو بجانب الملعب فقط، أما تحليل الفريمات الحقيقي فيحتاج Backend Worker منفصل.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsPlaying((value) => !value)}
              className="rounded-2xl border border-white/10 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-100"
            >
              {isPlaying ? "إيقاف المحاكاة" : "تشغيل المحاكاة"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">مصدر الفيديو الاختياري</h2>
                <p className="text-sm text-slate-400">اتركه فارغًا لتشغيل المحاكاة فقط، أو ضع رابط YouTube لعرضه بجانب الأنيميشن.</p>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                المحاكاة لا تحتاج فيديو
              </span>
            </div>

            <input
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="اختياري: https://www.youtube.com/watch?v=VIDEO_ID"
              className="mb-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-right text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60"
            />

            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title="YouTube match source"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden p-8 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.22),transparent_45%)]" />
                  <div className="relative rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-100">
                    DEMO MODE شغال الآن
                  </div>
                  <div className="relative flex h-20 items-end gap-2">
                    {Array.from({ length: 18 }).map((_, index) => (
                      <span
                        key={index}
                        className="w-2 rounded-t-full bg-emerald-300/70 transition-all duration-700"
                        style={{ height: `${24 + ((index * 17 + currentIndex * 9) % 56)}px` }}
                      />
                    ))}
                  </div>
                  <p className="relative max-w-md text-sm leading-7 text-slate-300">
                    المحاكاة تعمل من بيانات Events تجريبية بدون فيديو. الفيديو هنا اختياري للعرض فقط، وليس شرطًا لتحريك الملعب أو تحديث الإحصائيات.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">ملعب 2D مولّد من البيانات</h2>
                <p className="text-sm text-slate-400">الكرة تتحرك حسب آخر Event مستنتج.</p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-2 text-center">
                <p className="text-xs text-slate-400">النتيجة</p>
                <p className="text-2xl font-black text-emerald-200">
                  {stats.score.home} - {stats.score.away}
                </p>
              </div>
            </div>

            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-emerald-300/20 bg-emerald-950/70">
              <div className="absolute inset-4 rounded-2xl border-2 border-emerald-200/35" />
              <div className="absolute left-1/2 top-4 h-[calc(100%-2rem)] w-px -translate-x-1/2 bg-emerald-200/25" />
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/25" />
              <div className="absolute left-4 top-1/2 h-32 w-16 -translate-y-1/2 rounded-r-2xl border border-l-0 border-emerald-200/25" />
              <div className="absolute right-4 top-1/2 h-32 w-16 -translate-y-1/2 rounded-l-2xl border border-r-0 border-emerald-200/25" />

              <div
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-lg shadow-white/40 transition-all duration-700"
                style={{
                  left: `${activeEvent?.x ?? 50}%`,
                  top: `${activeEvent?.y ?? 50}%`,
                }}
              />

              {activeEvent && (
                <div
                  className="absolute -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-center text-xs font-bold shadow-xl transition-all duration-700"
                  style={{ left: `${activeEvent.x}%`, top: `${Math.max(8, activeEvent.y - 14)}%` }}
                >
                  <p className="text-emerald-200">{activeEvent.label}</p>
                  <p className="mt-1 text-[10px] text-slate-400">ثقة: {Math.round(activeEvent.confidence * 100)}%</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="mb-4 text-lg font-black">إحصائيات مباشرة تجريبية</h3>
            <div className="space-y-4 text-sm">
              <StatRow label="الاستحواذ" home={stats.possession.home} away={stats.possession.away} suffix="%" />
              <StatRow label="الهجمات" home={stats.attacks.home} away={stats.attacks.away} />
              <StatRow label="الهجمات الخطيرة" home={stats.dangerousAttacks.home} away={stats.dangerousAttacks.away} />
              <StatRow label="التسديدات" home={stats.shots.home} away={stats.shots.away} />
              <StatRow label="على المرمى" home={stats.onTarget.home} away={stats.onTarget.away} />
              <StatRow label="الركنيات" home={stats.corners.home} away={stats.corners.away} />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="mb-4 text-lg font-black">زخم المباراة</h3>
            <div className="overflow-hidden rounded-full bg-slate-800">
              <div className="h-4 rounded-full bg-emerald-300 transition-all duration-700" style={{ width: `${homeMomentumWidth}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-300">
              <span>{teamNames.home}: {homeMomentumWidth}%</span>
              <span>{teamNames.away}: {100 - homeMomentumWidth}%</span>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
              هذا الزخم محسوب من: الهجمات الخطيرة + التسديدات + التسديدات على المرمى. في النسخة الحقيقية سنضيف مصدر الإحصائيات ونتائج AI Vision ومراجعة المشغل.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="mb-4 text-lg font-black">Timeline الأحداث</h3>
            <div className="max-h-80 space-y-3 overflow-auto pr-1">
              {events.length === 0 ? (
                <p className="text-sm text-slate-400">تبدأ الأحداث تلقائيًا بعد لحظات عند تشغيل المحاكاة.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-white">{event.label}</p>
                      <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">
                        {event.minute}:{event.second.toString().padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {teamNames[event.team]} • source: {event.source} • confidence {Math.round(event.confidence * 100)}%
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="mb-4 text-lg font-black">المرحلة التالية لتحويل الفيديو إلى بيانات حقيقية</h3>
          <div className="grid gap-3 text-sm leading-7 text-slate-300 md:grid-cols-4">
            <PipelineCard title="1) Frame Worker" text="يلتقط فريمات من مصدر مسموح قانونيًا كل ثانية أو بمعدل أعلى أثناء الهجمة." />
            <PipelineCard title="2) OCR" text="يقرأ الدقيقة والنتيجة وأسماء الفرق والإحصائيات الظاهرة على الشاشة." />
            <PipelineCard title="3) Vision + Classifier" text="يكشف الكرة واللاعبين واتجاه اللعب ثم يحوّل المشهد إلى Event بثقة محددة." />
            <PipelineCard title="4) Reviewer" text="لوحة مشغل مباشر تؤكد أو تصحح الحدث قبل نشره للزوار." />
          </div>
        </section>
      </section>
    </main>
  );
}

function StatRow({ label, home, away, suffix = "" }: { label: string; home: number; away: number; suffix?: string }) {
  const total = Math.max(home + away, 1);
  const homeWidth = Math.round((home / total) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 font-bold">
        <span>{home}{suffix}</span>
        <span className="text-slate-300">{label}</span>
        <span>{away}{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${homeWidth}%` }} />
      </div>
    </div>
  );
}

function PipelineCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <p className="mb-2 font-black text-emerald-200">{title}</p>
      <p className="text-slate-400">{text}</p>
    </div>
  );
}
