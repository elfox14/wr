import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminHomeDashboard from '@/components/admin/AdminHomeDashboard';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = {
  title: 'لوحة الإدارة | MC PRIME Exchange',
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');
  return <AdminHomeDashboard />;
}
