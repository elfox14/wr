'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminApiDashboard from '@/components/admin/AdminApiDashboard';

function isAdmin(email?: string | null, role?: string | null) {
  return role === 'ADMIN' || email === 'admin@worldcup.com' || email === 'elfox14usa@gmail.com';
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && !isAdmin(session?.user?.email, (session?.user as any)?.role)) router.push('/');
  }, [status, session, router]);

  if (status === 'loading') {
    return <div className="min-h-screen bg-[#050505] p-10 text-center text-white">جاري تحميل لوحة الإدارة...</div>;
  }

  if (!isAdmin(session?.user?.email, (session?.user as any)?.role)) {
    return <div className="min-h-screen bg-[#050505] p-10 text-center text-white">غير مصرح لك بالدخول.</div>;
  }

  return <AdminApiDashboard />;
}
