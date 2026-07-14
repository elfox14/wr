import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import KnockoutSyncDashboard from '@/components/admin/KnockoutSyncDashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'مزامنة الأدوار الإقصائية | لوحة الإدارة',
  robots: { index: false, follow: false },
};

export default async function KnockoutSyncAdminPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') redirect('/login');

  return (
    <AdminShell
      title="مزامنة الأدوار الإقصائية"
      subtitle="تشغيل العامل الرسمي ومراجعة اكتمال جميع الأدوار من دور الـ32 حتى مباراة المركز الثالث والنهائي."
      badge="FIFA Knockout Sync"
    >
      <KnockoutSyncDashboard />
    </AdminShell>
  );
}
