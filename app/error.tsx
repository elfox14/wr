'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-4xl">
        ⚠️
      </div>

      <h1 className="mb-3 text-2xl font-black text-white sm:text-3xl">
        حدث خطأ غير متوقع
      </h1>

      <p className="mb-8 max-w-md text-sm leading-7 text-gray-400">
        نعتذر، حدث خطأ أثناء تحميل هذه الصفحة. يمكنك المحاولة مرة أخرى أو
        العودة للرئيسية.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-[var(--wc-green)] px-6 py-3 text-sm font-black text-[#04110D] transition hover:brightness-110 active:scale-95"
        >
          إعادة المحاولة
        </button>

        <a
          href="/"
          className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/10 active:scale-95"
        >
          الرئيسية
        </a>
      </div>

      {process.env.NODE_ENV === 'development' && error?.message && (
        <pre className="mt-8 max-w-full overflow-x-auto rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left text-xs text-red-300/80" dir="ltr">
          {error.message}
        </pre>
      )}
    </main>
  );
}
