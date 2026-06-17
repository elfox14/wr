import type { Metadata } from 'next';
import { Mail, MessageSquare, MapPin, Send } from 'lucide-react';

export const metadata: Metadata = {
  title: 'اتصل بنا | بورصة المونديال',
  description: 'تواصل مع فريق بورصة المونديال للاستفسارات العامة، التصحيحات التحريرية، حقوق الصور، الشراكات، أو الدعم الفني.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10">
          <p className="text-sm font-black text-[#0FF0FC]">تواصل معنا</p>
          <h1 className="mt-2 text-3xl font-black md:text-5xl">اتصل بنا</h1>
          <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-gray-400">
            نرحب بالاستفسارات، التصحيحات التحريرية، طلبات إزالة أو تعديل الصور، مقترحات التعاون، وملاحظات المستخدمين حول تجربة الموقع.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h2 className="text-2xl font-black text-[#FFD700]">طرق التواصل</h2>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0FF0FC]/10 text-[#0FF0FC]">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">البريد الإلكتروني</h3>
                <p className="mb-1 text-sm font-bold text-gray-400">للاستفسارات العامة والدعم الفني والتصحيحات.</p>
                <a href="mailto:elfox14usa@gmail.com" className="font-mono text-[#0FF0FC] hover:underline">elfox14usa@gmail.com</a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFD700]/10 text-[#FFD700]">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">التصحيحات التحريرية</h3>
                <p className="text-sm font-bold leading-7 text-gray-400">
                  عند الإبلاغ عن خطأ في نتيجة أو اسم لاعب أو صورة، يرجى إرسال رابط المقال، الجزء المراد تعديله، والمصدر الصحيح إن توفر.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">الإدارة</h3>
                <p className="text-sm font-bold leading-7 text-gray-400">
                  MC PRIME — أسيوط، مصر. الموقع يعمل كمنصة محتوى رياضي رقمية موجهة للقراء العرب.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-xl md:p-8">
            <h2 className="mb-6 text-2xl font-black text-white">أرسل رسالة</h2>
            <form className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300">الاسم بالكامل</label>
                  <input type="text" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition-all focus:border-[#0FF0FC]" placeholder="اكتب اسمك" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300">البريد الإلكتروني</label>
                  <input type="email" className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition-all focus:border-[#0FF0FC]" placeholder="name@example.com" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300">نوع الرسالة</label>
                <select className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition-all focus:border-[#0FF0FC]">
                  <option value="correction">تصحيح خبر أو نتيجة</option>
                  <option value="image-rights">حقوق صورة أو طلب إزالة</option>
                  <option value="general">استفسار عام</option>
                  <option value="business">شراكة أو إعلان</option>
                  <option value="technical">مشكلة فنية</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300">رسالتك</label>
                <textarea rows={6} className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition-all focus:border-[#0FF0FC]" placeholder="اكتب تفاصيل رسالتك هنا..."></textarea>
              </div>

              <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0FF0FC] py-3.5 font-black text-black transition hover:bg-[#FFD700]">
                <Send size={18} /> إرسال الرسالة
              </button>
              <p className="text-center text-xs font-bold leading-6 text-gray-500">
                النموذج الحالي للعرض فقط. للتواصل الفعلي، استخدم البريد الإلكتروني أعلاه.
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
