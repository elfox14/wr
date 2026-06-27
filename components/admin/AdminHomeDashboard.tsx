import Link from 'next/link';
import AdminShell from './AdminShell';
import { Activity, AlertTriangle, ArrowLeft, BarChart3, Bot, CheckCircle2, ClipboardCheck, Database, FileSearch, FileText, Gauge, Globe2, HeartPulse, Link2, Newspaper, PlayCircle, Radio, RefreshCcw, ShieldAlert, Sparkles, Trophy, Wand2 } from 'lucide-react';

const sections = [
  {
    title: 'التشغيل والمراقبة',
    note: 'القسم الأول الذي تفتحه عند وجود مشكلة في الموقع أو بعد أي نشر جديد.',
    items: [
      { href: '/admin/system-health', title: 'حالة النظام', icon: HeartPulse, what: 'يفحص اتصال قاعدة البيانات، زمن استجابة السيرفر، بيئة التشغيل، حالة التشغيل المجدول، وعدد الأصول والمنتخبات واللاعبين والمباريات.', when: 'بعد كل Deploy، أو عند ظهور صفحة لا تعرض بيانات، أو عند الشك أن قاعدة البيانات لا تتصل بشكل صحيح.' },
      { href: '/admin/live-health', title: 'صحة التحديث المباشر', icon: Gauge, what: 'يراقب حالة المباريات الحية، المباريات غير المرتبطة، توصيات التشغيل، وحالة التحديث التلقائي أثناء المباريات.', when: 'قبل وأثناء المباريات للتأكد أن النتائج والعدادات وشريط المباريات يتم تحديثهم.' },
      { href: '/admin/apis', title: 'اختبارات APIs', icon: Activity, what: 'لوحة لاختبار مزودي البيانات، عرض نتائج مباشرة، فحص بيانات اللاعبين، وتجربة عمليات تنظيف أو مزامنة آمنة.', when: 'عند تجربة مصدر بيانات جديد أو عند وجود اختلاف بين ما يظهر في الموقع وما تتوقعه من المزود.' },
      { href: '/admin/data-verification', title: 'تحقق البيانات', icon: ClipboardCheck, what: 'يقارن بيانات موقعك المحلية ببيانات المزودين ويعرض المتطابق والمختلف والمفقود.', when: 'قبل نشر أرقام حساسة مثل النتيجة، الترتيب، الإحصائيات، أو بيانات TheStats.' },
    ],
  },
  {
    title: 'تهيئة البطولة وربط المباريات',
    note: 'كل ما يخص إنشاء بيانات كأس العالم وربط المباراة بمصدر live أو animation.',
    items: [
      { href: '/admin/worldcup-bootstrap', title: 'بناء بيانات كأس العالم', icon: Database, what: 'يجلب المنتخبات واللاعبين والصور والمباريات والمجموعات ويعيد بناء قاعدة بيانات البطولة.', when: 'في بداية البطولة، أو عند نقص منتخبات/لاعبين/مباريات، أو عند الحاجة لمزامنة كاملة.' },
      { href: '/admin/animation-matches', title: 'ربط مباريات الأنيميشن', icon: Wand2, what: 'يعرض مباريات الموقع ويقترح رقم المباراة الخارجي المناسب ثم يسمح بحفظه على المباراة المحلية.', when: 'عندما لا تظهر بيانات البث التفاعلي أو ملعب المباراة بسبب عدم وجود رقم ربط خارجي.' },
      { href: '/admin/unlinked-matches', title: 'المباريات غير المرتبطة', icon: Link2, what: 'يعرض المباريات التي لا تملك ربطًا خارجيًا داخل نافذة زمنية، مع إمكانية إدخال بيانات الربط يدويًا.', when: 'قبل بداية كل يوم مباريات للتأكد أن كل مباراة قادمة أو مباشرة مربوطة بمصدرها.' },
      { href: '/admin/isports-candidates', title: 'مرشحو iSports', icon: FileSearch, what: 'يبحث عن المرشحين المناسبين لمباراة محلية ويعرض درجة الثقة وأسباب التطابق.', when: 'بعد فتح مباراة غير مرتبطة لاختيار أفضل fixture من iSports وربطه بالمباراة المحلية.' },
      { href: '/admin/isports', title: 'لوحة iSports', icon: Radio, what: 'اختبار نتائج iSports المباشرة، التشكيلات، اللاعبين، والمعلومات القادمة من المزود.', when: 'للتشخيص والتجربة قبل اعتماد بيانات iSports في صفحة المباراة أو الشريط.' },
      { href: '/admin/thesportsdb', title: 'TheSportsDB', icon: Globe2, what: 'فحص مزود TheSportsDB كمصدر مساعد للفرق أو المباريات أو المعلومات العامة.', when: 'عند نقص بيانات من المصدر الأساسي وتحتاج مقارنة أو مصدر داعم.' },
    ],
  },
  {
    title: 'التحليل والمصادر',
    note: 'مهم قبل أي مقال أو فيديو تحليلي حتى لا تعتمد على أرقام غير موثقة.',
    items: [
      { href: '/admin/team-intelligence', title: 'تقارير المنتخبات', icon: FileText, what: 'إنشاء ومراجعة تقارير Team Intelligence الخاصة بكل منتخب وربطها بمركز التحليل.', when: 'قبل كتابة تحليل منتخب أو تجهيز سكربت فيديو تكتيكي.' },
      { href: '/admin/source-automation', title: 'أتمتة المصادر', icon: Bot, what: 'فحص استقبال المصادر، ملفات CSV، التقارير التلقائية، وسجلات تشغيل الأتمتة.', when: 'عند رفع مصادر جديدة أو تشغيل إدخال تلقائي يحتاج مراجعة لاحقة.' },
      { href: '/admin/source-review', title: 'مراجعة المصادر', icon: ShieldAlert, what: 'يعرض المصادر والتقارير التي دخلت تلقائيًا وتحتاج قبولًا أو رفضًا قبل الاعتماد عليها.', when: 'قبل نشر أي معلومة تحليلية. إذا لم تجد الرقم صريحًا، اتركه غير متوفر في المصادر.' },
      { href: '/admin/match-media', title: 'مصادر فيديو المباريات', icon: PlayCircle, what: 'إضافة روابط الملخصات، الأهداف، والمؤتمرات الصحفية من مصادر رسمية أو قابلة للمراجعة.', when: 'عند ربط مقال أو صفحة مباراة بفيديو رسمي بدون رفع الفيديو نفسه.' },
    ],
  },
  {
    title: 'المحتوى والنشر',
    note: 'كل ما يخص الأخبار، الملخصات، أحداث المباراة، والأرشيف التحريري.',
    items: [
      { href: '/admin/news', title: 'إدارة الأخبار', icon: Newspaper, what: 'تحويل النشرات والإيميلات إلى خبر، منشور فيسبوك، سكربت فيديو، ونقاط إنفوجرافيك.', when: 'عند إنتاج خبر سريع أو تحويل مصدر صحفي إلى محتوى جاهز للنشر.' },
      { href: '/admin/content-studio', title: 'استوديو المحتوى', icon: FileText, what: 'مراجعة وتعديل وحذف الأخبار وملخصات اليوم وملخصات المباريات المحفوظة.', when: 'كأرشيف تحريري شامل لتنظيف المحتوى أو فتح منشورات سابقة.' },
      { href: '/admin/match-content-tools', title: 'مقال المباراة والإنفوغرافيك', icon: Sparkles, what: 'يعرض المباريات الأخيرة ويضيف زرين للأدمن فقط: إنشاء/نشر مقال المباراة وتجهيز إنفوغرافيك الإحصائيات من آخر Snapshot محفوظة.', when: 'بعد نهاية المباراة وبعد تأكيد الإحصائيات النهائية من TheStats أو Snapshot موثقة.' },
      { href: '/admin/match-events', title: 'أحداث المباراة', icon: Trophy, what: 'إضافة أهداف، بطاقات، تبديلات، وملاحظات تظهر في Timeline داخل مركز المباراة.', when: 'عند نقص أحداث المزود أو عند الحاجة لإدخال حدث يدوي موثق.' },
      { href: '/daily-summary', title: 'ملخص اليوم', icon: Sparkles, what: 'عرض نتائج ورصد اليوم وسكربت سريع قابل للنشر.', when: 'نهاية اليوم أو قبل صناعة فيديو/منشور ملخص سريع.' },
    ],
  },
  {
    title: 'فحص تجربة المستخدم',
    note: 'روابط تساعدك على التأكد من شكل الموقع بعد تحديث البيانات.',
    items: [
      { href: '/portfolio', title: 'المحفظة والسوق', icon: BarChart3, what: 'مراجعة شكل المحفظة والأسعار بعد تحديث السوق الافتراضي.', when: 'للتأكد أن بيانات السوق لا تكسر تجربة المستخدم أو شكل الواجهة.' },
    ],
  },
];

const backendServices = [
  'المزامنة الرئيسية: تستخدم عند وجود خلل عام في التحديث أو الربط.',
  'مزامنة المباريات المباشرة: تستخدم أثناء المباريات لتحديث الحالة والنتيجة.',
  'مزامنة ما بعد المباراة: تستخدم بعد النهاية لجلب الإحصائيات النهائية والترتيب.',
  'تحقق TheStats: يستخدم لمقارنة بيانات TheStats بالبيانات المحلية.',
  'خدمات القوائم الرسمية: تستخدم لمراجعة القوائم وإصلاح الصور واللاعبين.',
  'حالة أتمتة المصادر: تستخدم لفحص استقبال المصادر والتقارير التلقائية.',
];

const workflow = [
  { label: 'بعد Deploy', value: 'افتح حالة النظام ثم اختبارات APIs.', icon: CheckCircle2 },
  { label: 'قبل المباراة', value: 'افتح صحة التحديث ثم المباريات غير المرتبطة.', icon: Radio },
  { label: 'بعد المباراة', value: 'شغّل المزامنة المناسبة ثم افتح تحقق البيانات.', icon: RefreshCcw },
  { label: 'قبل النشر', value: 'راجع المصادر ثم تقارير المنتخبات.', icon: ShieldAlert },
];

export default function AdminHomeDashboard() {
  return (
    <AdminShell title="مركز إدارة المنصة" subtitle="لوحة واحدة تجمع كل صفحات وخدمات الأدمن مع شرح تفصيلي: ماذا يفعل كل قسم ومتى تستخدمه في تشغيل موقع كأس العالم." badge="لوحة تحكم موحدة">
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl sm:p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">{section.title}</h2>
                  <p className="mt-1 text-xs font-bold leading-6 text-gray-500">{section.note}</p>
                </div>
                <span className="w-fit rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-black text-gray-300">{section.items.length} أقسام</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="group flex min-h-[270px] flex-col rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:-translate-y-1 hover:border-[#0FF0FC]/40 hover:bg-[#0FF0FC]/10">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-[#0FF0FC]"><Icon size={23} /></div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black text-gray-300">صفحة أدمن</span>
                      </div>
                      <h3 className="text-lg font-black text-white">{item.title}</h3>
                      <div className="mt-3 space-y-2 text-sm font-bold leading-7 text-gray-400">
                        <p><span className="font-black text-[#0FF0FC]">ماذا يفعل؟ </span>{item.what}</p>
                        <p><span className="font-black text-[#FFD700]">متى تستخدمه؟ </span>{item.when}</p>
                      </div>
                      <div className="mt-auto pt-4 inline-flex items-center gap-2 text-sm font-black text-[#0FF0FC]">فتح القسم <ArrowLeft size={16} className="transition group-hover:-translate-x-1" /></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl sm:p-5">
            <h2 className="text-xl font-black text-white">الخدمات الخلفية المرتبطة بالأدمن</h2>
            <p className="mt-1 text-xs font-bold leading-6 text-gray-500">هذه خدمات تشغيل وتشخيص تظهر نتائجها داخل الصفحات السابقة، وليست صفحات تصفح عادية.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {backendServices.map((service) => (
                <div key={service} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm font-bold leading-7 text-gray-300">{service}</div>
              ))}
            </div>
          </section>
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
            <h3 className="mb-2 flex items-center gap-2 font-black text-white"><AlertTriangle size={17} /> تنبيه مهم</h3>
            <p>أي عملية إعادة بناء أو مزامنة قد تغير بيانات حية. افحص النظام أولًا، ولا تعتمد أي رقم في المحتوى إلا من مصدر واضح.</p>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
