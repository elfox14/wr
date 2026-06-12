'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Newspaper, Plus, Save } from 'lucide-react';

type PressNewsItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  sourceName: string;
  sourceUrl?: string | null;
  sourceType: string;
  status: string;
  importance: number;
  publishedAt: string;
};

const initialForm = {
  title: '',
  body: '',
  category: 'رصد صحفي',
  sourceName: 'The Athletic FC',
  sourceUrl: '',
  sourceType: 'newsletter',
  importance: 70,
  tags: '',
};

export default function AdminPressNewsClient() {
  const [items, setItems] = useState<PressNewsItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/press-news', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحميل الأخبار');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل الأخبار');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadItems(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/press-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الخبر');
      setMessage('تم نشر الخبر بنجاح في صفحة الأخبار.');
      setForm(initialForm);
      await loadItems();
    } catch (err: any) {
      setError(err?.message || 'فشل حفظ الخبر');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: string, value: any) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Newspaper size={14} /> إدارة الأخبار</p>
              <h1 className="text-3xl font-black">إضافة خبر صحفي</h1>
              <p className="mt-2 text-sm font-bold leading-7 text-gray-400">أضف خبرًا مختصرًا من إيميل أو مصدر خارجي، وسيظهر في صفحة الأخبار بدون تعديل الكود.</p>
            </div>
            <Link href="/news" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black">
              عرض الأخبار <ArrowLeft size={15} />
            </Link>
          </div>
        </div>

        {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div>}
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div>}

        <form onSubmit={submit} className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:grid-cols-2 md:p-6">
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-black text-gray-400">عنوان الخبر</span>
            <input value={form.title} onChange={(event) => updateField('title', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="مثال: افتتاحية عنيفة وثلاث بطاقات حمراء في مباراة المكسيك" />
          </label>

          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-black text-gray-400">نص الخبر المختصر</span>
            <textarea value={form.body} onChange={(event) => updateField('body', event.target.value)} rows={7} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold leading-7 text-white outline-none focus:border-[#0FF0FC]/50" placeholder="اكتب ملخصًا محررًا وليس نقلًا كاملًا من المصدر..." />
          </label>

          <label>
            <span className="mb-2 block text-xs font-black text-gray-400">التصنيف</span>
            <select value={form.category} onChange={(event) => updateField('category', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50">
              <option>رصد صحفي</option>
              <option>مباريات</option>
              <option>لاعبون</option>
              <option>إصابات</option>
              <option>منتخبات</option>
              <option>السوق</option>
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-black text-gray-400">اسم المصدر</span>
            <input value={form.sourceName} onChange={(event) => updateField('sourceName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="The Athletic FC" />
          </label>

          <label>
            <span className="mb-2 block text-xs font-black text-gray-400">رابط المصدر اختياري</span>
            <input value={form.sourceUrl} onChange={(event) => updateField('sourceUrl', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="https://..." />
          </label>

          <label>
            <span className="mb-2 block text-xs font-black text-gray-400">الأهمية من 1 إلى 100</span>
            <input type="number" min={1} max={100} value={form.importance} onChange={(event) => updateField('importance', Number(event.target.value))} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" />
          </label>

          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-black text-gray-400">وسوم اختيارية، مفصولة بفواصل</span>
            <input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="Mexico, South Africa, red cards" />
          </label>

          <button disabled={saving} className="md:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black transition hover:bg-[#FFD700] disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} نشر الخبر
          </button>
        </form>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2 text-xl font-black"><Plus className="text-[#FFD700]" /> آخر الأخبار المضافة</div>
          {loading ? <div className="p-8 text-center text-gray-500">جاري التحميل...</div> : items.length ? (
            <div className="space-y-3">
              {items.slice(0, 12).map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/8 bg-black/25 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black text-gray-500">
                    <span>{item.category} · {item.sourceName}</span>
                    <span>{new Date(item.publishedAt).toLocaleString('ar-EG')}</span>
                  </div>
                  <h3 className="font-black text-white">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-gray-500">{item.body}</p>
                </article>
              ))}
            </div>
          ) : <div className="p-8 text-center text-gray-500">لا توجد أخبار مضافة بعد.</div>}
        </section>
      </section>
    </main>
  );
}
