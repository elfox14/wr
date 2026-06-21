import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-[60vh] bg-[#04110D] px-4 py-20" dir="rtl">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-8xl font-black text-[#18E58F]/25 sm:text-9xl">٤٠٤</p>

        <h1 className="mt-4 text-2xl font-black text-white sm:text-3xl">الصفحة غير موجودة</h1>
        <p className="mt-4 text-sm font-bold leading-7 text-slate-400">
          الرابط الذي تبحث عنه غير موجود أو تم نقله. تأكد من صحة الرابط وحاول مجددًا.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-[#18E58F] px-6 py-3 text-sm font-black text-black transition hover:bg-[#15cc7f]"
          >
            <Home size={18} />
            الصفحة الرئيسية
          </Link>
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15"
          >
            <Search size={18} />
            جدول المباريات
          </Link>
        </div>
      </div>
    </main>
  );
}
