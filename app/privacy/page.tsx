import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية | بورصة المونديال',
  description: 'سياسة الخصوصية وملفات تعريف الارتباط وإعلانات Google AdSense في موقع بورصة المونديال.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white" dir="rtl">
      <article className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 leading-8 md:p-10">
        <header className="space-y-3 border-b border-white/10 pb-6">
          <p className="text-sm font-black text-[#0FF0FC]">آخر تحديث: 17 يونيو 2026</p>
          <h1 className="text-3xl font-black md:text-5xl">سياسة الخصوصية</h1>
          <p className="text-sm font-bold text-gray-400">
            توضح هذه الصفحة كيفية تعامل موقع بورصة المونديال مع البيانات وملفات تعريف الارتباط والإعلانات، خصوصًا عند استخدام خدمات Google AdSense أو أدوات تحليل الزيارات.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">1. المعلومات التي قد نجمعها</h2>
          <p className="text-gray-300">
            قد يجمع الموقع معلومات غير شخصية مثل نوع الجهاز، المتصفح، الصفحات التي تمت زيارتها، مدة الجلسة، عنوان IP التقريبي، ومصدر الزيارة. إذا استخدمت نماذج التواصل أو سجلت حسابًا، فقد تقدم لنا معلومات مثل الاسم أو البريد الإلكتروني أو محتوى الرسالة.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">2. ملفات تعريف الارتباط Cookies</h2>
          <p className="text-gray-300">
            يستخدم الموقع ملفات تعريف الارتباط لتحسين تجربة التصفح، حفظ بعض التفضيلات، قياس الأداء، وعرض الإعلانات. يمكنك تعطيل ملفات تعريف الارتباط من إعدادات المتصفح، لكن بعض وظائف الموقع قد لا تعمل بالشكل الأمثل.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">3. Google AdSense والإعلانات المخصصة</h2>
          <p className="text-gray-300">
            قد يستخدم Google أو شركاؤه ملفات تعريف الارتباط لعرض إعلانات بناءً على زيارات المستخدم السابقة لهذا الموقع أو لمواقع أخرى. يمكن للمستخدمين تعطيل الإعلانات المخصصة من خلال إعدادات إعلانات Google. كما قد تستخدم شبكات إعلانية خارجية ملفات تعريف ارتباط خاصة بها وفق سياساتها.
          </p>
          <p className="text-gray-300">
            نلتزم بإبلاغ الزوار بوجود ملفات تعريف ارتباط مرتبطة بالإعلانات والتحليلات، ونحرص على عدم جمع أو مشاركة معلومات شخصية حساسة لأغراض إعلانية دون أساس قانوني أو موافقة مناسبة عند الحاجة.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">4. استخدام البيانات</h2>
          <ul className="list-disc space-y-2 pr-6 text-gray-300">
            <li>تشغيل الموقع وتحسين تجربة الاستخدام.</li>
            <li>قياس أداء المحتوى ومعرفة الصفحات الأكثر قراءة.</li>
            <li>عرض إعلانات مناسبة وغير مضللة.</li>
            <li>الرد على رسائل المستخدمين وطلبات التصحيح.</li>
            <li>حماية الموقع من إساءة الاستخدام أو النشاط غير الطبيعي.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">5. الروابط الخارجية</h2>
          <p className="text-gray-300">
            قد تحتوي المقالات على روابط لمصادر خارجية مثل مواقع رياضية أو وكالات أخبار أو مواقع رسمية. نحن غير مسؤولين عن ممارسات الخصوصية في تلك المواقع، وينبغي مراجعة سياساتها عند الانتقال إليها.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">6. حقوق المستخدم</h2>
          <p className="text-gray-300">
            يمكنك التواصل معنا لطلب تصحيح بياناتك، حذف رسالة أرسلتها، أو الاستفسار عن طريقة استخدام معلوماتك. سنحاول الرد خلال مدة معقولة وفق الإمكانات المتاحة وطبيعة الطلب.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#FFD700]">7. اتصل بنا</h2>
          <p className="text-gray-300">
            لأي استفسار متعلق بالخصوصية أو الإعلانات أو تصحيح المحتوى، يرجى زيارة صفحة <Link href="/contact" className="text-[#0FF0FC] hover:underline">اتصل بنا</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
