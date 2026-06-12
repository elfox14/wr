import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminMatchEventsClient from '@/components/admin/AdminMatchEventsClient';

function isAdmin(session: any) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = {
  title: 'إدارة أحداث المباراة | MC PRIME Exchange',
};

export default async function AdminMatchEventsPage() {
  const session = await getServerSession(authOptions as any);
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');
  return <AdminMatchEventsClient />;
}
