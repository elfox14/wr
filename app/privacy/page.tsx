import { PageHeader } from '@/components/ui/PageHeader';
import { ShieldAlert } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description: 'سياسة الخصوصية لمنصة WorldCup Exchange',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader 
        title="سياسة الخصوصية" 
        description="تعرف على كيفية جمعنا واستخدامنا لبياناتك"
        icon={<ShieldAlert size={32} />}
        textColor="text-accent"
        glowColor="bg-accent/10"
      />
      
      <div className="prose prose-invert prose-lg max-w-none">
        <div className="bg-surface p-8 rounded-2xl border border-white/5 space-y-8 text-gray-300 leading-relaxed">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. مقدمة</h2>
            <p>
              في WorldCup Exchange، نولي أهمية قصوى لخصوصية زوارنا ومستخدمينا. توضح هذه السياسة ماهية المعلومات التي نجمعها، وكيفية استخدامها، وحماية بياناتك الشخصية عند استخدامك لمنصتنا.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. المعلومات التي نجمعها</h2>
            <p>نحن نقوم بجمع نوعين من المعلومات:</p>
            <ul className="list-disc list-inside mt-2 space-y-2 text-gray-400">
              <li><strong>معلومات شخصية:</strong> مثل الاسم، البريد الإلكتروني، ومعلومات الحساب التي تقدمها عند التسجيل.</li>
              <li><strong>معلومات غير شخصية:</strong> بيانات التصفح، نوع الجهاز، عنوان الـ IP، ومعلومات الاستخدام التي يتم جمعها تلقائياً.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. استخدام ملفات تعريف الارتباط (Cookies)</h2>
            <p>
              نستخدم ملفات تعريف الارتباط لتحسين تجربة المستخدم، تذكر تفضيلاتك، وتوفير محتوى وإعلانات مخصصة (بما في ذلك إعلانات Google AdSense). يمكنك التحكم في إعدادات الكوكيز من خلال متصفحك.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. إعلانات جوجل (Google AdSense)</h2>
            <p>
              نستخدم خدمة Google AdSense لعرض الإعلانات. قد تستخدم Google ملفات تعريف الارتباط (مثل DART cookie) لعرض إعلانات تستند إلى زياراتك لموقعنا والمواقع الأخرى على الإنترنت. يمكنك التعطيل من خلال زيارة سياسة خصوصية شبكة إعلانات Google.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. حماية البيانات</h2>
            <p>
              نحن نتخذ كافة الإجراءات الأمنية والتشفير اللازم لحماية بياناتك من الوصول غير المصرح به، أو التعديل، أو الإفصاح، أو الإتلاف.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. اتصل بنا</h2>
            <p>
              إذا كان لديك أي أسئلة حول سياسة الخصوصية، يرجى التواصل معنا عبر صفحة <a href="/contact" className="text-primary hover:underline">اتصل بنا</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
