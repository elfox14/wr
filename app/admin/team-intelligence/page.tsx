import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import TeamIntelligenceAdminDashboard from '@/components/admin/TeamIntelligenceAdminDashboard';

type AdminSession = {
  user?: {
    email?: string | null;
    role?: string | null;
  };
} | null;

type Props = {
  searchParams?: Promise<{ teamId?: string }>;
};

function isAdmin(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

export const metadata = {
  title: 'إدارة تقارير المنتخبات | MC PRIME Exchange',
};

export default async function TeamIntelligenceAdminPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) redirect('/login');
  if (!isAdmin(session)) redirect('/');

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTeamId = resolvedSearchParams.teamId || '';

  const teams = await prisma.asset.findMany({
    where: { type: 'TEAM' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  return <TeamIntelligenceAdminDashboard teams={teams} initialTeamId={initialTeamId} />;
}
