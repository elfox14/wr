import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminMatchEventsClient from '@/components/admin/AdminMatchEventsClient';

function getUser(session: unknown) {
  if (!session || typeof session !== 'object') return null;
  const value = session as { user?: { email?: string | null; role?: string | null } };
  return value.user || null;
}

function isAdmin(session: unknown) {
  const user = getUser(session);
  const email = user?.email || '';
  return user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = {
  title: 'إدارة أحداث المباراة | MC PRIME Exchange',
};

export default async function AdminMatchEventsPage() {
  const session = await getServerSession(authOptions as any);
  if (!getUser(session)) redirect('/login');
  if (!isAdmin(session)) redirect('/');
  return <AdminMatchEventsClient />;
}
