import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sportsReferenceSearchTemplates } from '@/lib/sportsReferenceSearchTemplates';
import { getSportsReferenceSourceStatus } from '@/lib/sportsReferenceSource';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
  };
} | null;

async function isAuthorized() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    sourceStatus: getSportsReferenceSourceStatus(),
    templates: sportsReferenceSearchTemplates,
  });
}
