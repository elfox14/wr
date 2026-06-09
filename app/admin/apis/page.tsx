import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';
import AdminApiDashboard from '@/components/admin/AdminApiDashboard';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'admin@worldcup.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = {
  title: 'اختبارات API | MC PRIME Exchange',
};

export default async function AdminApisPage() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  return (
    <AdminShell
      title="اختبارات ومراقبة APIs"
      subtitle="اختبر اتصال المزود، اعرض مباريات API، راقب المباريات الحية، افحص أداء اللاعبين، ونظّف المباريات الخاطئة من مكان واحد."
      badge="API Control Center"
    >
      <AdminApiDashboard embedded />
    </AdminShell>
  );
}
