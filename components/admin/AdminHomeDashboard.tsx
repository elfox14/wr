import Link from 'next/link';
import AdminShell from './AdminShell';
import { Activity, ArrowLeft, BarChart3, Bot, CheckCircle2, ClipboardCheck, Database, FileSearch, FileText, Gauge, Globe2, HeartPulse, Link2, Newspaper, PlayCircle, Radio, RefreshCcw, ShieldAlert, Sparkles, Trophy, Wand2 } from 'lucide-react';

const sections = [
  {
    title: 'التشغيل والمراقبة',
    items: [
      { href: '/admin/system-health', title: 'حالة النظام', icon: HeartPulse, description: 'فحص قاعدة البيانات، السيرفر، حالة التشغيل المجدول، وعدد المنتخبات واللاعبين والمباريات. يستخدم بعد كل Deploy أو عند ظهور خلل عام.' },
      { href: '/admin/live-health', title: 'صحة التحديث المباشر', icon: Gauge, description: 'مراقبة تحديثات المباريات الحية والروابط الناقصة والتوصيات. يستخدم وقت المباريات للتأكد من عمل التحديث المباشر.' },
      { href: '/admin/apis', title: 'اختبارات APIs', icon: Activity, description: 'اختبار مزودي البيانات والنتائج الحية وبيانات اللاعبين وتنظيف الأخطاء. يستخدم عند تجربة مصدر بيانات أو فحص مشكلة API.' },
      { href: '/admin/data-verification', title: 'تحقق البيانات', icon: ClipboardCheck, description: 'مقارنة البيانات المحلية ببيانات المزودين ومعرفة المتطابق والمختلف. يستخدم قبل نشر أرقام أو نتائج مهمة.' },
    ],
  },
  {
    title: 'تهيئة البطولة وربط المباريات',
    items: [
      { href: '/admin/worldcup-bootstrap', title: 'بناء بيانات كأس العالم', icon: Database, description: 'جلب المنتخبات واللاعبين والصور والمباريات والمجموعات. يستخدم في بداية البطولة أو عند إعادة المزامنة الكاملة.' },
      { href: '/admin/animation-matches', title: 'ربط مباريات الأنيميشن', icon: Wand2, description: 'اختيار وحفظ رقم المباراة الخارجي لكل مباراة محلية. يستخدم عند غياب بيانات البث التفاعلي أو الملعب.' },
      { href: '/admin/unlinked-matches', title: 'المباريات غير المرتبطة', icon: Link2, description: 'عرض المباريات التي لا تملك ربطًا خارجيًا خلال فترة محددة. يستخدم يوميًا قبل المباريات لمنع فقدان التحديثات.' },
      { href: '/admin/isports-candidates', title: 'مرشحو iSports', icon: FileSearch, description: 'بحث المرشحين المناسبين لمباراة محلية مع درجة ثقة وأسباب التطابق. يستخدم لاختيار أفضل fixture وربطه.' },
      { href: '/admin/isports', title: 'لوحة iSports', icon: Radio, description: 'اختبار نتائج وتشكيلات ولاعبي iSports يدويًا. يستخدم للتجربة والتشخيص قبل اعتماد البيانات.' },
      { href: '/admin/thesportsdb', title: 'TheSportsDB', icon: Globe2, description: 'فحص مزود TheSportsDB كمصدر مساعد. يستخدم عند نقص البيانات من المصدر الأساسي.' },
    ],
  },
  {
    title: 'التحليل والمصادر',
    items: [
      { href: '/admin/team-intelligence', title: 'تقارير المنتخبات', icon: FileText, description: 'إنشاء ومراجعة تقارير Team Intelligence. يستخدم لبناء ملف تحليلي لكل منتخب من مصادر موثوقة.' },
      { href: '/admin/source-automation', title: 'أتمتة المصادر', icon: Bot, description: 'فحص استقبال المصادر وملفات CSV والتقارير التلقائية. يستخدم عند رفع مصادر أو تشغيل إدخال تلقائي.' },
      { href: '/admin/source-review', title: 'مراجعة المصادر', icon: ShieldAlert, description: 'اعتماد أو رفض المصادر التي دخلت تلقائيًا. يستخدم قبل نشر أي معلومة تكتيكية أو رقمية.' },
      { href: '/admin/match-media', title: 'مصادر فيديو المباريات', icon: PlayCircle, description: 'إضافة روابط الملخصات والأهداف والمؤتمرات الرسمية. يستخدم لإرفاق فيديو موثوق بالمباراة أو المقال.' },
    ],
  },
  {
    title: 'المحتوى والنشر',
    items: [
      { href: '/admin/news', title: 'إدارة الأخبار', icon: Newspaper, description: 'تحويل النشرات إلى خبر ومنشور وسكربت ونقاط إنفوجرافيك. يستخدم لإنتاج محتوى سريع قابل للنشر.' },
      { href: '/admin/content-studio', title: 'استوديو المحتوى', icon: FileText, description: 'مراجعة وتعديل وحذف الأخبار وملخصات اليوم وملخصات المباريات. يستخدم كأرشيف تحريري شامل.' },
      { href: '/admin/match-events', title: 'أحداث المباراة', icon: Trophy, description: 'إضافة أهداف وبطاقات وملاحظات لخط المباراة الزمني. يستخدم عند نقص أحداث المزود أو للتعديل اليدوي.' },
      { href: '/daily-summary', title: 'ملخص اليوم', icon: Sparkles, description: 'عرض نتائج ورصد اليوم وسكربت سريع. يستخدم نهاية اليوم لصناعة منشور أو فيديو ملخص.' },
    ],
  },
  {
    title: 'فحص تجربة المستخدم',
    items: [
      { href: '/portfolio', title: 'المحفظة والسوق', icon: BarChart3, description: 'مراجعة شكل المحفظة والأسعار بعد تحديث السوق. يستخدم للتأكد من سلامة واجهة المستخدم.' },
    ],
  },
];

const workflow = [
  { label: 'بعد Deploy', value: 'حالة النظام ثم اختبارات APIs', icon: CheckCircle2 },
  { label: 'قبل المباراة', value: 'صحة التحديث ثم المباريات غير المرتبطة', icon: Radio },
  { label: 'بعد المباراة', value: 'تحقق البيانات ثم كروت الإحصائيات', icon: RefreshCcw },
  { label: 'قبل النشر', value: 'مراجعة المصادر ثم تقارير المنتخبات', icon: ShieldAlert },
];

export default function AdminHomeDashboard() {
  return (
    <AdminShell title="مركز إدارة المنصة" subtitle="لوحة واحدة تجمع صفحات وخدمات الأدمن مع شرح استخدام كل قسم في تشغيل موقع كأس العالم." badge="لوحة تحكم موحدة">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black text-white">{section.title}</h2>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-black text-gray-300">{section.items.length} أقسام</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="group flex min-h-[190px] flex-col rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:-translate-y-1 hover:border-[#0FF0FC]/40 hover:bg-[#0FF0FC]/10">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-[#0FF0FC]"><Icon size={23} /></div>
                      </div>
                      <h3 className="text-lg font-black text-white">{item.title}</h3>
                      <p className="mt-2 text-sm font-bold leading-7 text-gray-400">{item.description}</p>
                      <div className="mt-auto pt-4 inline-flex items-center gap-2 text-sm font-black text-[#0FF0FC]">فتح القسم <ArrowLeft size={16} className="transition group-hover:-translate-x-1" /></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
            <h3 className="mb-4 text-lg font-black text-white">مسار العمل السريع</h3>
            <div className="space-y-3">
              {workflow.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="rounded-xl bg-[#FFD700]/10 p-2 text-[#FFD700]"><Icon size={18} /></div>
                    <div>
                      <p className="text-sm font-black text-white">{item.label}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-gray-400">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm leading-7 text-red-100">
            <h3 className="mb-2 font-black text-white">تنبيه مهم</h3>
            <p>أي عملية إعادة بناء أو مزامنة قد تغير بيانات حية. افحص النظام أولًا، ولا تعتمد أي رقم في المحتوى إلا من مصدر واضح.</p>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
