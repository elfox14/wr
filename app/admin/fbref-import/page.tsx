import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import FbrefImportDashboard from '@/components/admin/FbrefImportDashboard';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  const allowedEmails = ['worldcup' + '@' + 'mcprim.com', 'elfox14usa' + '@' + 'gmail.com'];
  return session?.user?.role === 'ADMIN' || allowedEmails.includes(email);
}

export const metadata = {
  title: 'استيراد FBref | MC PRIME Exchange',
};

export default async function FbrefImportPage() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  return <FbrefImportDashboard />;
}
