import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function payloadOf(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const { id } = await params;
  const match = await prisma.match.findUnique({ where: { id }, select: { infographicData: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'MATCH_NOT_FOUND' }, { status: 404 });
  const infographic = payloadOf(match.infographicData);
  return NextResponse.json({ ok: true, infographic, status: infographic?.status || 'NOT_GENERATED' }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;
  const { id } = await params;
  const input = await req.json().catch(() => ({}));
  const action = String(input.action || '');
  const match = await prisma.match.findUnique({ where: { id }, select: { infographicData: true } });
  if (!match) return NextResponse.json({ ok: false, error: 'MATCH_NOT_FOUND' }, { status: 404 });

  const current = payloadOf(match.infographicData);
  if (!current || current.version !== 2) {
    return NextResponse.json({ ok: false, error: 'VERIFIED_INFOGRAPHIC_REQUIRED' }, { status: 409 });
  }
  if (!current.source?.snapshotId) {
    return NextResponse.json({ ok: false, error: 'SOURCE_SNAPSHOT_REQUIRED' }, { status: 409 });
  }

  const reviewer = String((auth as any).session?.user?.email || 'admin');
  let next: Record<string, any>;
  if (action === 'approve') {
    next = { ...current, status: 'APPROVED', approvedAt: new Date().toISOString(), approvedBy: reviewer };
  } else if (action === 'unpublish') {
    next = { ...current, status: 'DRAFT_READY', approvedAt: null, approvedBy: null };
  } else {
    return NextResponse.json({ ok: false, error: 'INVALID_ACTION' }, { status: 400 });
  }

  await prisma.match.update({ where: { id }, data: { infographicData: next as any } });
  return NextResponse.json({ ok: true, status: next.status, infographic: next }, { headers: { 'Cache-Control': 'no-store' } });
}
