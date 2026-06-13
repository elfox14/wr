import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import FbrefImportDashboard from '@/components/admin/FbrefImportDashboard';

type AdminSession = {
  user?: {
    role?: string | null;
  };
} | null;

export const metadata = {
  title: 'استيراد FBref | MC PRIME Exchange',
};

export default async function FbrefImportPage() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return <FbrefImportDashboard />;
}
