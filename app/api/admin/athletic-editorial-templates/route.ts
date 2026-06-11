import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { athleticEditorialTemplates } from '@/lib/athleticEditorialTemplates';

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
    provider: 'The Athletic',
    usage: 'editorial_context_only',
    warning: 'Use short paraphrased summaries and source references. Do not copy long paywalled text or convert editorial context into unsourced numbers.',
    templates: athleticEditorialTemplates,
  });
}
