"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  source: "frame-capture-demo" | "youtube-preview-only" | "operator-review";
};

type FrameMetrics = {
  brightness: number;
  motion: number;
  centerX: number;
  centerY: number;
  greenShare: number;
};

const teamNames: Record<TeamKey, string> = {
  home: "الفريق الأول",
  away: "الفريق الثاني",
};

const initialStats: MatchStats = {
  possession: { home: 50, away: 50 },
  attacks: { home: 0, away: 0 },
  dangerousAttacks: { home: 0, away: 0 },
  shots: { home: 0, away: 0 },
  onTarget: { home: 0, away: 0 },
  corners: { home: 0, away: 0 },
  score: { home: 0, away: 0 },
};

const canvasWidth = 96;
const canvasHeight = 54;

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

function applyEventToStats(previous: MatchStats, generated: DemoEvent): MatchStats {
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
}

function buildEventFromMetrics(metrics: FrameMetrics, index: number, currentTime: number): DemoEvent {
  const team: TeamKey = metrics.centerX >= 50 ? "home" : "away";
  const confidence = Math.min(0.88, Math.max(0.38, 0.38 + metrics.motion / 90 + metrics.greenShare / 4));

  let type: DemoEvent["type"] = "attack";
  let label = "Frame Capture: هجمة عادية من حركة الفيديو";

  if (metrics.motion > 42 && metrics.brightness > 112) {
    type = "target";
    label = "Frame Capture: احتمال تسديدة على المرمى";
  } else if (metrics.motion > 30) {
    type = "shot";
    label = "Frame Capture: احتمال تسديدة";
  } else if (metrics.motion > 18 || metrics.greenShare > 0.36) {
    type = "danger";
    label = "Frame Capture: ضغط أو هجمة خطيرة";
  }

  const minute = Math.max(0, Math.floor(currentTime / 60));
  const second = Math.max(0, Math.floor(currentTime % 60));

  return {
    id: Date.now() + index,
    minute,
    second,
    team,
    label,
    type,
    x: Math.min(96, Math.max(4, metrics.centerX)),
    y: Math.min(88, Math.max(12, metrics.centerY)),
    confidence,
    source: "frame-capture-demo",
  };
}

export default function LiveAnimationDemoPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localVideoName, setLocalVideoName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [stats, setStats] = useState<MatchStats>(initialStats);
  const [isPlaying, setIsPlaying] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const embedUrl = useMemo(() => extractYouTubeEmbedUrl(youtubeUrl), [youtubeUrl]);
  const canAnalyze = Boolean(localVideoUrl);
  const activeEvent = events[0];

  useEffect(() => {
    return () => {
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [localVideoUrl]);

  function resetAnalysis() {
    setCurrentIndex(0);
    setEvents([]);
    setStats(initialStats);
    setIsPlaying(false);
    setAnalysisStarted(false);
    previousFrameRef.current = null;
  }

  function handleLocalVideoChange(file: File | undefined) {
    resetAnalysis();

    if (localVideoUrl) {
      URL.revokeObjectURL(localVideoUrl);
    }

    if (!file) {
      setLocalVideoUrl(null);
      setLocalVideoName("");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setLocalVideoUrl(nextUrl);
    setLocalVideoName(file.name);
  }

  function captureFrameMetrics(): FrameMetrics | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(video, 0, 0, canvasWidth, canvasHeight);
    const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = imageData.data;
    const previousFrame = previousFrameRef.current;

    let brightnessSum = 0;
    let greenSum = 0;
    let motionSum = 0;
    let weightSum = 0;
    let xWeighted = 0;
    let yWeighted = 0;
    let samples = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const brightness = (r + g + b) / 3;
      const greenWeight = Math.max(0, g - (r + b) / 2);
      const pixelIndex = i / 4;
      const x = pixelIndex % canvasWidth;
      const y = Math.floor(pixelIndex / canvasWidth);
      const weight = brightness * 0.12 + greenWeight;

      brightnessSum += brightness;
      greenSum += g;
      weightSum += weight;
      xWeighted += x * weight;
      yWeighted += y * weight;

      if (previousFrame) {
        motionSum += Math.abs(r - (previousFrame[i] ?? 0));
        motionSum += Math.abs(g - (previousFrame[i + 1] ?? 0));
        motionSum += Math.abs(b - (previousFrame[i + 2] ?? 0));
      }

      samples += 1;
    }

    previousFrameRef.current = new Uint8ClampedArray(data);

    const centerX = weightSum > 0 ? (xWeighted / weightSum / canvasWidth) * 100 : 50;
    const centerY = weightSum > 0 ? (yWeighted / weightSum / canvasHeight) * 100 : 50;

    return {
      brightness: samples > 0 ? brightnessSum / samples : 0,
      motion: previousFrame && samples > 0 ? motionSum / (samples * 3) : 0,
      centerX,
      centerY,
      greenShare: samples > 0 ? greenSum / (samples * 255) : 0,
    };
  }

  function handleMainButtonClick() {
    if (!canAnalyze) return;

    const video = videoRef.current;

    if (!analysisStarted) {
      setAnalysisStarted(true);
      setIsPlaying(true);
      void video?.play().catch(() => undefined);
      return;
    }

    setIsPlaying((value) => {
      const nextValue = !value;
      if (nextValue) {
        void video?.play().catch(() => undefined);
      } else {
        video?.pause();
      }
      return nextValue;
    });
  }

  useEffect(() => {
    if (!analysisStarted || !isPlaying || !canAnalyze) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        const metrics = captureFrameMetrics();
        const video = videoRef.current;
        if (!metrics || !video) return index;

        const generated = buildEventFromMetrics(metrics, index, video.currentTime);

        setEvents((previous) => [generated, ...previous].slice(0, 8));
        setStats((previous) => applyEventToStats(previous, generated));

        return index + 1;
      });
    }, 1400);

    return () => window.clearInterval(timer);
  }, [analysisStarted, canAnalyze, isPlaying]);

  const momentumHome = Math.min(100, Math.round((stats.dangerousAttacks.home * 3 + stats.shots.home * 4 + stats.onTarget.home * 5) / 2));
  const momentumAway = Math.min(100, Math.round((stats.dangerousAttacks.away * 3 + stats.shots.away * 4 + stats.onTarget.away * 5) / 2));
  const totalMomentum = Math.max(momentumHome + momentumAway, 1);
  const homeMomentumWidth = Math.round((momentumHome / totalMomentum) * 100);

  const buttonLabel = !canAnalyze
    ? "ارفع ملف فيديو أولًا"
    : !analysisStarted
      ? "ابدأ التقاط الفريمات وتحويلها"
      : isPlaying
        ? "إيقاف التحويل مؤقتًا"
        : "استكمال التحويل";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-6 shadow-2xl shadow-emerald-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-200">
                صفحة تجريبية — Frame Capture To Animation MVP
              </p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                التحويل الحقيقي التجريبي يعمل من ملف فيديو مرفوع
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                YouTube داخل iframe للمعاينة فقط ولا يمكن قراءة فريماته من المتصفح. ارفع ملف فيديو من جهازك، ثم اضغط بدء التحويل ليقوم المتصفح بالتقاط فريمات فعلية من الفيديو وتحويلها إلى Events تجريبية تحرك الملعب.
              </p>
            </div>

            <button
              type="button"
              onClick={handleMainButtonClick}
              disabled={!canAnalyze}
              className="rounded-2xl border border-white/10 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {buttonLabel}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">مصدر الفيديو للتحليل</h2>
                <p className="text-sm text-slate-400">ارفع MP4 أو WebM للتحليل داخل المتصفح. رابط YouTube يظهر كمعاينة فقط.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${analysisStarted ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}>
                {analysisStarted ? "Frame Capture يعمل" : "في انتظار ملف فيديو"}
              </span>
            </div>

            <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-300/30 bg-emerald-400/5 px-4 py-5 text-center transition hover:border-emerald-300/60 hover:bg-emerald-400/10">
              <span className="text-sm font-black text-emerald-100">ارفع فيديو للتحويل الفعلي التجريبي</span>
              <span className="mt-1 text-xs text-slate-400">MP4 / WebM / MOV حسب دعم المتصفح</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => handleLocalVideoChange(event.target.files?.[0])}
              />
            </label>

            {localVideoName && (
              <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                الملف المحدد: {localVideoName}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold text-slate-300">رابط YouTube للمعاينة فقط</label>
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="اختياري للعرض فقط: https://www.youtube.com/watch?v=VIDEO_ID"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-right text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              {localVideoUrl ? (
                <video
                  ref={videoRef}
                  src={localVideoUrl}
                  className="h-full w-full bg-black object-contain"
                  controls
                  muted
                  playsInline
                  onEnded={() => setIsPlaying(false)}
                />
              ) : embedUrl ? (
                <iframe
                  src={embedUrl}
                  title="YouTube preview source"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden p-8 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.2),transparent_45%)]" />
                  <div className="relative rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-100">
                    ارفع ملف فيديو للبدء
                  </div>
                  <p className="relative max-w-md text-sm leading-7 text-slate-300">
                    لن تتحرك الإحصائيات أو الملعب الآن. ارفع فيديو من جهازك ثم اضغط زر التقاط الفريمات وتحويلها.
                  </p>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" width={canvasWidth} height={canvasHeight} />

            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
              هذا ليس نموذج ذكاء اصطناعي احترافي بعد؛ هو Proof of Concept يلتقط فريمات فعلية من الفيديو المرفوع ويستخرج مؤشرات بسيطة مثل الحركة ومركز النشاط ثم يحولها إلى أحداث. YouTube يحتاج Backend Worker أو مصدر فيديو مسموح للوصول للفريمات.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">ملعب 2D مولّد من الفريمات</h2>
                <p className="text-sm text-slate-400">
                  {analysisStarted ? "الكرة تتحرك حسب مؤشرات مستخرجة من فريمات الفيديو." : "سيبدأ التحريك بعد رفع الفيديو والضغط على بدء التحويل."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-2 text-center">
                <p className="text-xs text-slate-400">النتيجة</p>
                <p className="text-2xl font-black text-emerald-200">
                  {stats.score.home} - {stats.score.away}
                </p>
              </div>
            </div>

            <div className={`relative aspect-[16/10] overflow-hidden rounded-3xl border border-emerald-300/20 bg-emerald-950/70 ${!analysisStarted ? "opacity-70" : ""}`}>
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

              {!analysisStarted && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 p-6 text-center">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-5 text-sm leading-7 text-slate-300">
                    الملعب جاهز. ارفع فيديو من جهازك ثم اضغط بدء التحويل ليبدأ التقاط الفريمات.
                  </div>
                </div>
              )}

              {activeEvent && analysisStarted && (
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
            <h3 className="mb-4 text-lg font-black">إحصائيات من فريمات الفيديو</h3>
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
            <h3 className="mb-4 text-lg font-black">زخم المباراة من الفيديو</h3>
            <div className="overflow-hidden rounded-full bg-slate-800">
              <div className="h-4 rounded-full bg-emerald-300 transition-all duration-700" style={{ width: `${homeMomentumWidth}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-300">
              <span>{teamNames.home}: {homeMomentumWidth}%</span>
              <span>{teamNames.away}: {100 - homeMomentumWidth}%</span>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">
              الزخم هنا محسوب تجريبيًا من Events ناتجة من فريمات الفيديو المرفوع: الهجمات الخطيرة + التسديدات + التسديدات على المرمى.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="mb-4 text-lg font-black">Timeline التحويل</h3>
            <div className="max-h-80 space-y-3 overflow-auto pr-1">
              {events.length === 0 ? (
                <p className="text-sm text-slate-400">لم يبدأ التحويل بعد. ارفع فيديو من جهازك واضغط زر بدء التحويل.</p>
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
          <h3 className="mb-4 text-lg font-black">ما المطلوب للنسخة الحقيقية المتقدمة؟</h3>
          <div className="grid gap-3 text-sm leading-7 text-slate-300 md:grid-cols-4">
            <PipelineCard title="1) Backend Worker" text="يستقبل فيديو مسموح قانونيًا أو stream داخلي، وليس iframe YouTube." />
            <PipelineCard title="2) Frame Capture" text="يلتقط فريمات كل ثانية أو 5-10 فريم/ثانية أثناء الهجمات المهمة." />
            <PipelineCard title="3) CV Model" text="يستخدم نموذج رؤية لاكتشاف الكرة واللاعبين والملعب بدل المؤشرات البسيطة الحالية." />
            <PipelineCard title="4) Events API" text="يرسل الأحداث والإحصائيات إلى قاعدة البيانات ثم يحرك ملعب 2D للمستخدم." />
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
