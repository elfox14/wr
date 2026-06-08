import { PageHeader } from '@/components/ui/PageHeader';
import { FileText } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'شروط الاستخدام',
  description: 'شروط وأحكام استخدام منصة MC PRIME Exchange',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader 
        title="شروط الاستخدام" 
        description="القواعد واللوائح المنظمة لاستخدام منصتنا"
        icon={<FileText size={32} />}
      />
      
      <div className="prose prose-invert prose-lg max-w-none">
        <div className="bg-surface p-8 rounded-2xl border border-white/5 space-y-8 text-gray-300 leading-relaxed">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. القبول بالشروط</h2>
            <p>
              بدخولك إلى موقع MC PRIME Exchange واستخدامه، فإنك توافق صراحة على الالتزام بشروط الاستخدام هذه. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا يحق لك استخدام المنصة.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. طبيعة المنصة (تنويه هام)</h2>
            <p>
              MC PRIME Exchange هي منصة <strong className="text-white">ترفيهية وتفاعلية بحتة</strong>. جميع الأصول، اللاعبين، المنتخبات، والأرصدة (العملات) داخل الموقع هي <strong className="text-white">وهمية وافتراضية ولا تحمل أي قيمة مالية حقيقية</strong>. لا يتم تداول أي أموال حقيقية أو أوراق مالية قانونية في هذه المنصة بأي شكل من الأشكال.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. حسابات المستخدمين</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-2">
              <li>أنت مسؤول عن الحفاظ على سرية معلومات حسابك وكلمة المرور.</li>
              <li>يحق لإدارة الموقع إيقاف أو إلغاء أي حساب ينتهك هذه الشروط أو يقوم بنشاط احتيالي.</li>
              <li>لا يجوز بيع أو نقل الحسابات أو الأرصدة الافتراضية لأي طرف ثالث.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. حقوق الملكية الفكرية</h2>
            <p>
              جميع المحتويات المعروضة على الموقع، بما في ذلك النصوص والرسومات والشعارات والأيقونات والبرمجيات، هي ملك لمنصة MC PRIME Exchange أو الجهات المرخصة لها، ومحمية بموجب قوانين حقوق الطبع والنشر.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. إخلاء المسؤولية</h2>
            <p>
              المنصة تقدم "كما هي" دون أي ضمانات من أي نوع. نحن لا نتحمل المسؤولية عن أي خسائر معنوية أو توقف في الخدمة. الأرقام والأسعار الافتراضية داخل الموقع تعتمد على خوارزمياتنا الخاصة لأغراض الترفيه ولا تعكس بالضرورة الأداء الواقعي الدقيق.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. التعديلات على الشروط</h2>
            <p>
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إشعار المستخدمين بالتغييرات الجوهرية، واستمرارك في استخدام الموقع يعني قبولك للتعديلات.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
