import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildSportsReferenceCsvDraft } from '@/lib/sportsReferenceCsvDraft';

export const dynamic = 'force-dynamic';

type AdminSession = {
  user?: {
    role?: string | null;
    email?: string | null;
  };
} | null;

type CsvDraftPayload = {
  teamName?: string;
  sourceName?: string;
  sourceUrl?: string;
  csvText?: string;
};

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as never) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const payload = await req.json().catch(() => ({})) as CsvDraftPayload;
  const draft = buildSportsReferenceCsvDraft(payload);

  return NextResponse.json({
    ok: true,
    draft,
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  return NextResponse.json({
    ok: true,
    message: 'POST csvText copied from Sports Reference / Stathead / FBref export to generate card sections.',
    example: {
      teamName: 'Mexico',
      sourceName: 'Sports Reference / Stathead / FBref subscription',
      sourceUrl: 'https://www.sports-reference.com/',
      csvText: 'Player,Min,Gls,Ast,xG,Sh,SoT\nPlayer A,900,5,2,4.8,28,12',
    },
  });
}
