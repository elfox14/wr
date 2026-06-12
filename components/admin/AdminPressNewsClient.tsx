'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, Newspaper, Plus, Save, Sparkles } from 'lucide-react';

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

function cleanEmailText(value: string) {
  return value
    .replace(/=0A/g, '\n')
    .replace(/=E2=80=99/g, '’')
    .replace(/=E2=80=94/g, '—')
    .replace(/=E2=80=98/g, '‘')
    .replace(/=E2=80=9C/g, '“')
    .replace(/=E2=80=9D/g, '”')
    .replace(/=C2=A3/g, '£')
    .replace(/=\r?\n/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickSource(text: string) {
  if (/the athletic/i.test(text)) return 'The Athletic FC';
  if (/fifa/i.test(text)) return 'FIFA';
  if (/bbc/i.test(text)) return 'BBC Sport';
  if (/fox/i.test(text)) return 'FOX Soccer';
  return 'مصدر صحفي';
}

function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (/(injury|injuries|miss|out of|إصابة|غياب)/i.test(lower)) return 'إصابات';
  if (/(goal|score|win|victory|red card|match|fixture|بطاقة|فوز|مباراة)/i.test(lower)) return 'مباريات';
  if (/(transfer|sign|real madrid|madrid|mourinho|انتقال)/i.test(lower)) return 'منتخبات';
  if (/(price|market|trading|سوق|سعر)/i.test(lower)) return 'السوق';
  return 'رصد صحفي';
}

function sentenceSplit(text: string) {
  return text
    .split(/(?<=[.!؟])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35 && s.length < 280)
    .filter((s) => !/unsubscribe|manage preferences|view online|copyright|all rights reserved/i.test(s));
}

function generateDraftFromEmail(raw: string) {
  const text = cleanEmailText(raw);
  const lower = text.toLowerCase();
  const sourceName = pickSource(text);
  const category = inferCategory(text);
  const tags = new Set<string>();
  let title = '';
  let body = '';

  if (lower.includes('mexico') && lower.includes('south africa') && lower.includes('red card')) {
    title = 'افتتاحية عنيفة: ثلاث بطاقات حمراء في Mexico 2-0 South Africa';
    body = 'رصد صحفي من النشرة يشير إلى أن مباراة افتتاح كأس العالم بين المكسيك وجنوب أفريقيا خرجت بثلاث بطاقات حمراء وفوز مكسيكي 2-0، ما جعلها مادة بارزة للمتابعة من زاوية الانضباط وتأثير الغيابات على الجولة التالية.';
    ['Mexico', 'South Africa', 'red cards', 'World Cup'].forEach((tag) => tags.add(tag));
  } else if (lower.includes('south korea') && lower.includes('czech')) {
    title = 'South Korea 2-1 Czech Republic: ملاحظات صحفية بعد المباراة';
    body = 'الرصد الصحفي يبرز فوز كوريا الجنوبية على التشيك 2-1، مع الإشارة إلى ملاحظات حول الحضور الجماهيري، قوة التشيك في الكرات الثابتة، ودور Hwang In-beom في عودة المنتخب الكوري.';
    ['South Korea', 'Czech Republic', 'Group A'].forEach((tag) => tags.add(tag));
  } else if (lower.includes('alphonso davies')) {
    title = 'ألفونسو ديفيز يغيب عن افتتاح كندا';
    body = 'الرصد الصحفي يشير إلى غياب Alphonso Davies عن مباراة كندا الافتتاحية ضد البوسنة والهرسك، وهو خبر يحتاج متابعة قبل تقييم جاهزية المنتخب الكندي في المجموعة.';
    ['Canada', 'Alphonso Davies', 'injury'].forEach((tag) => tags.add(tag));
  } else if (lower.includes('wataru endo')) {
    title = 'Wataru Endo خارج البطولة ويعلن الاعتزال الدولي';
    body = 'الرصد الصحفي يذكر أن Wataru Endo سيغيب عن كأس العالم بسبب مشكلة في الكاحل، مع إعلانه الاعتزال الدولي، ما يجعله خبرًا مؤثرًا على قراءة منتخب اليابان.';
    ['Japan', 'Wataru Endo', 'injury'].forEach((tag) => tags.add(tag));
  } else {
    const sentences = sentenceSplit(text);
    const first = sentences[0] || text.slice(0, 160);
    title = first.length > 92 ? `${first.slice(0, 89).trim()}...` : first;
    body = sentences.slice(0, 3).join(' ');
    if (body.length < 80) body = text.slice(0, 420);
  }

  const detectedNames = ['Mexico', 'South Africa', 'South Korea', 'Czech Republic', 'Canada', 'Bosnia', 'USMNT', 'Paraguay', 'Japan', 'Raul Jimenez', 'Hwang In-beom', 'Alphonso Davies', 'Wataru Endo'];
  detectedNames.forEach((name) => {
    if (lower.includes(name.toLowerCase())) tags.add(name);
  });

  return {
    title,
    body,
    category,
    sourceName,
    sourceType: 'newsletter',
    importance: lower.includes('opening') || lower.includes('red card') ? 85 : 70,
    tags: Array.from(tags).join(', '),
  };
}

export default function AdminPressNewsClient() {
  const [items, setItems] = useState<PressNewsItem[]>([]);
  const [form, setForm] = useState(initialForm);
  const [emailText, setEmailText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailTextLength = useMemo(() => emailText.trim().length, [emailText]);

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

  function generateFromEmail() {
    setError(null);
    setMessage(null);
    if (emailTextLength < 80) {
      setError('الصق نص الإيميل أولًا، يجب أن يكون النص أطول من 80 حرفًا.');
      return;
    }
    const draft = generateDraftFromEmail(emailText);
    setForm((current) => ({ ...current, ...draft }));
    setMessage('تم توليد مسودة خبر من نص الإيميل. راجعها وعدّلها قبل النشر.');
  }

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
      setEmailText('');
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
              <p className="mt-2 text-sm font-bold leading-7 text-gray-400">الصق نص الإيميل، ولّد مسودة خبر، ثم راجعها وانشرها في صفحة الأخبار.</p>
            </div>
            <Link href="/news" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black">
              عرض الأخبار <ArrowLeft size={15} />
            </Link>
          </div>
        </div>

        {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div>}
        {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div>}

        <section className="rounded-[2rem] border border-[#FFD700]/15 bg-[#FFD700]/[0.035] p-5 md:p-6">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black"><Mail className="text-[#FFD700]" size={20} /> توليد مسودة من نص الإيميل</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">هذه أداة مساعدة محلية داخل الواجهة، ولا تنشر شيئًا قبل الضغط على زر النشر.</p>
            </div>
            <button type="button" onClick={generateFromEmail} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-4 py-3 text-sm font-black text-black transition hover:bg-[#0FF0FC]">
              <Sparkles size={16} /> توليد مسودة
            </button>
          </div>
          <textarea value={emailText} onChange={(event) => setEmailText(event.target.value)} rows={8} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold leading-7 text-white outline-none focus:border-[#FFD700]/50" placeholder="الصق هنا نص الإيميل أو الجزء المهم منه من The Athletic أو أي مصدر صحفي..." />
          <div className="mt-2 text-[11px] font-bold text-gray-500">عدد الأحرف: {emailTextLength}</div>
        </section>

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
