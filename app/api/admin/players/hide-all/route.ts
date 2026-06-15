import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.authorized) return admin.error;

  const result = await prisma.asset.updateMany({
    where: { type: 'PLAYER' },
    data: { isAvailable: false },
  });

  return NextResponse.json({
    ok: true,
    action: 'hide_all_players',
    playersHidden: result.count,
    note: 'All PLAYER assets were hidden with isAvailable=false. Import official squads after this step to reactivate only verified players.',
  });
}
