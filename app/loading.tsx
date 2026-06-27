export default function Loading() {
  return (
    <div
      dir="rtl"
      className="mx-auto flex min-h-[50vh] max-w-7xl flex-col items-center justify-center px-4 py-16"
    >
      {/* Animated football pulse */}
      <div className="relative mb-6">
        <div className="h-14 w-14 animate-pulse rounded-full border-2 border-[var(--wc-green)] bg-[var(--wc-green)]/10 shadow-[0_0_30px_rgba(24,229,143,0.2)]" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          ⚽
        </div>
      </div>

      <p className="mb-6 text-sm font-bold text-gray-400 animate-pulse">
        جارٍ التحميل...
      </p>

      {/* Skeleton cards */}
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="mb-3 h-4 w-3/4 rounded-lg bg-white/10" />
            <div className="mb-2 h-3 w-full rounded-lg bg-white/5" />
            <div className="mb-2 h-3 w-5/6 rounded-lg bg-white/5" />
            <div className="h-3 w-2/3 rounded-lg bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
