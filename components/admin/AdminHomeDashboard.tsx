import Link from 'next/link';
import AdminShell from './AdminShell';
import { Activity, ArrowLeft, BarChart3, CalendarDays, Database, FileText, Newspaper, RefreshCcw, ShieldAlert, Sparkles, Trophy, Users } from 'lucide-react';

const modules = [
  {
    href: '/admin/apis',
    title: 'اختبارات ومراقبة APIs',
    description: 'فحص البيئة، عرض مباريات API، live scores، أداء اللاعبين، وتنظيف المباريات الخاطئة.',
    icon: Activity,
    tag: 'تشغيل يومي',
  },
  {
    href: '/admin/worldcup-bootstrap',
    title: 'إعادة بناء بيانات كأس العالم',
    description: 'جلب المنتخبات، صورهم، اللاعبين، صور اللاعبين، المباريات، والمجموعات من المزود.',
    icon: Database,
    tag: 'تهيئة البطولة',
  },
  {
    href: '/admin/team-intelligence',
    title: 'إدارة تقارير المنتخبات',
    description: 'تشغيل seed تقارير Team Intelligence يدويًا، ثم مراجعة النتائج في مركز التحليل وIntelligence Hub.',
    icon: FileText,
    tag: 'ذكاء المنتخبات',
  },
  {
    href: '/admin/news',
    title: 'إدارة الأخبار والمحتوى',
    description: 'حوّل الإيميلات والنشرات إلى خبر منشور، ثم إلى منشور فيسبوك وسكربت فيديو ونقاط إنفوجرافيك.',
    icon: Newspaper,
    tag: 'غرفة الأخبار',
  },
  {
    href: '/admin/match-events',
    title: 'إدارة أحداث المباراة',
    description: 'أضف أهدافًا وبطاقات وملاحظات لتظهر في Timeline داخل مركز المباراة.',
    icon: Trophy,
    tag: 'الأهداف والبطاقات',
  },
  {
    href: '/daily-summary',
    title: 'ملخص اليوم',
    description: 'لقطة يومية للنتائج، الرصد الصحفي، أخبار السوق، وسكربت سريع قابل للنشر.',
    icon: Sparkles,
    tag: 'محتوى يومي',
  },
  {
    href: '/portfolio',
    title: 'فحص تجربة المستخدم',
    description: 'راجع شكل المحفظة والأسعار بعد جلب الأصول وتحديث السوق.',
    icon: BarChart3,
    tag: 'واجهة المستخدم',
  },
];

const quickChecks = [
  { label: 'البيئة والأسرار', value: 'DATABASE / NEXTAUTH / CRON', icon: ShieldAlert },
  { label: 'بيانات البطولة', value: '48 منتخب • 1244 لاعب مستهدف', icon: Trophy },
  { label: 'دورة السوق', value: 'LIVE + مزامنة مستمرة', icon: RefreshCcw },
  { label: 'المحتوى اليومي', value: 'News / Summary / Social Pack', icon: CalendarDays },
];

export default function AdminHomeDashboard() {
  return (
    <AdminShell
      title="مركز إدارة المنصة"
      subtitle="لوحة منظمة لإدارة بيانات كأس العالم، اختبار مزودي البيانات، تنظيف الأخطاء، ومراقبة جاهزية التحليل والسوق الافتراضي."
      badge="لوحة تحكم احترافية"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl transition hover:-translate-y-1 hover:border-[#0FF0FC]/40 hover:bg-[#0FF0FC]/10"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-4 text-[#0FF0FC]">
                    <Icon size={26} />
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-gray-300">{module.tag}</span>
                </div>
                <h2 className="text-xl font-black text-white">{module.title}</h2>
                <p className="mt-3 min-h-[76px] text-sm leading-7 text-gray-400">{module.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0FF0FC]">
                  فتح القسم <ArrowLeft size={16} className="transition group-hover:-translate-x-1" />
                </div>
              </Link>
            );
          })}
        </section>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
            <h3 className="mb-4 text-lg font-black text-white">قائمة فحص سريعة</h3>
            <div className="space-y-3">
              {quickChecks.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="rounded-xl bg-[#FFD700]/10 p-2 text-[#FFD700]"><Icon size={18} /></div>
                    <div>
                      <p className="text-sm font-black text-white">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm leading-7 text-red-100">
            <h3 className="mb-2 font-black text-white">تنبيه مهم</h3>
            <p>عمليات “بدء من الصفر” تحذف بيانات التداول والأصول. استخدم المعاينة دائمًا قبل الحفظ النهائي.</p>
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
