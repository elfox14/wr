'use client';

import Link from 'next/link';
import { RefreshCw, Home, AlertTriangle, ArrowRight } from 'lucide-react';

export default function MatchCenterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-[#04110D] px-4 py-16" dir="rtl">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-500/10">
          <AlertTriangle size={36} className="text-amber-400" />
        </div>

        <h1 className="text-2xl font-black text-white sm:text-3xl">تعذّر تحميل بيانات المباراة</h1>
        <p className="mt-4 text-sm font-bold leading-7 text-slate-400">
          قد يكون السبب ضغط مؤقت على الخادم أو انقطاع في مصدر البيانات.
          عادة يُحل تلقائيًا خلال ثوانٍ — جرّب إعادة المحاولة.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#18E58F] px-6 py-3 text-sm font-black text-black transition hover:bg-[#15cc7f]"
          >
            <RefreshCw size={18} />
            إعادة المحاولة
          </button>
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15"
          >
            <ArrowRight size={18} />
            جدول المباريات
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-black text-slate-300 transition hover:bg-white/10"
          >
            <Home size={18} />
            الرئيسية
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-8 text-xs font-bold text-slate-600">رمز الخطأ: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
