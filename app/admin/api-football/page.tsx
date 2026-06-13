import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function ApiFootballAdminPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <section className="mx-auto max-w-3xl rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-6 shadow-card">
        <div className="mb-4 flex items-center gap-3 text-yellow-100">
          <ShieldAlert className="h-7 w-7" />
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-yellow-200">Provider removed</div>
            <h1 className="text-2xl font-black text-white">تم حذف API-Football من المنصة</h1>
          </div>
        </div>
        <p className="text-sm leading-7 text-yellow-50">
          تم إيقاف هذه الصفحة وإلغاء الاعتماد على API-Football. مصادر البيانات النشطة يجب أن تكون عبر iSports أو الاستيراد اليدوي/المصرح به مثل FBref وملفات التقارير.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/admin/live-health" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">حالة اللايف</Link>
          <Link href="/admin/fbref-import" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">استيراد FBref</Link>
        </div>
      </section>
    </main>
  );
}
