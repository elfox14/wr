import { PageHeader } from '@/components/ui/PageHeader';
import { FileText } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'شروط الاستخدام',
  description: 'شروط وأحكام استخدام منصة بورصة المونديال من MC PRIME',
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
              بدخولك إلى موقع بورصة المونديال من MC PRIME واستخدامه، فإنك توافق صراحة على الالتزام بشروط الاستخدام هذه. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا يحق لك استخدام المنصة.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. طبيعة المنصة</h2>
            <p>
              بورصة المونديال هي منصة رياضية وترفيهية وتفاعلية بحتة. جميع الأصول، اللاعبين، المنتخبات، الأرصدة، الأسعار، والمؤشرات داخل الموقع هي وهمية وافتراضية ولا تحمل أي قيمة مالية حقيقية.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. لا توجد معاملات مالية حقيقية</h2>
            <p>
              لا تسمح المنصة بإيداع أو سحب أموال، ولا يمكن تحويل الأرصدة الافتراضية إلى قيمة نقدية، ولا تقدم جوائز مالية أو خدمات مالية أو توصيات استثمارية. كل المؤشرات داخل الموقع مخصصة للترفيه والتحليل الرياضي فقط.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. مصادر البيانات والتحقق</h2>
            <p>
              تعتمد الواجهة على قاعدة بيانات المنصة كمصدر عرض أساسي. قد نستخدم مزودي بيانات رياضية خارجيين لتأكيد النتائج أو إثراء الإحصائيات، مع الالتزام بعرض البيانات الرياضية فقط وتجنب أي محتوى مخالف لسياسات النشر والإعلانات.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. حسابات المستخدمين</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-2">
              <li>أنت مسؤول عن الحفاظ على سرية معلومات حسابك وكلمة المرور.</li>
              <li>يحق لإدارة الموقع إيقاف أو إلغاء أي حساب ينتهك هذه الشروط أو يقوم بنشاط احتيالي.</li>
              <li>لا يجوز بيع أو نقل الحسابات أو الأرصدة الافتراضية لأي طرف ثالث.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. حقوق الملكية الفكرية</h2>
            <p>
              جميع المحتويات المعروضة على الموقع، بما في ذلك النصوص والرسومات والشعارات والأيقونات والبرمجيات، هي ملك لمنصة بورصة المونديال أو الجهات المرخصة لها، ومحمية بموجب قوانين حقوق الطبع والنشر.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. إخلاء المسؤولية</h2>
            <p>
              المنصة تقدم كما هي دون أي ضمانات من أي نوع. نحن لا نتحمل المسؤولية عن أي خسائر معنوية أو توقف في الخدمة. الأرقام والأسعار الافتراضية داخل الموقع تعتمد على خوارزميات داخلية لأغراض الترفيه والتحليل الرياضي ولا تعكس أي قيمة مالية.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. التعديلات على الشروط</h2>
            <p>
              نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إشعار المستخدمين بالتغييرات الجوهرية، واستمرارك في استخدام الموقع يعني قبولك للتعديلات.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
