import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div className="mb-4 text-8xl font-black text-[var(--wc-green)] opacity-20 sm:text-9xl">
        404
      </div>

      <h1 className="mb-3 text-2xl font-black text-white sm:text-3xl">
        الصفحة غير موجودة
      </h1>

      <p className="mb-8 max-w-md text-sm leading-7 text-gray-400">
        الصفحة التي تبحث عنها غير موجودة أو تم نقلها. تأكد من الرابط أو عُد
        للرئيسية.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-[var(--wc-green)] px-6 py-3 text-sm font-black text-[#04110D] transition hover:brightness-110 active:scale-95"
        >
          العودة للرئيسية
        </Link>

        <Link
          href="/matches"
          className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/10 active:scale-95"
        >
          المباريات
        </Link>

        <Link
          href="/news"
          className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/10 active:scale-95"
        >
          الأخبار
        </Link>
      </div>
    </main>
  );
}
