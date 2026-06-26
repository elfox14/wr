import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasValidAdminSecret } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanMtId(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('mt_')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `mt_${digits}` : null;
}

function cleanInt(value: unknown) {
  const n = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function POST(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim();
  const matchId = String(body.matchId || '').trim();

  if (!matchId) {
    return NextResponse.json({ ok: false, error: 'matchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'set-the-stats-id') {
    const providerMatchId = cleanMtId(body.providerMatchId);
    if (!providerMatchId) {
      return NextResponse.json({ ok: false, error: 'providerMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const match = await prisma.match.update({
      where: { id: matchId },
      data: { externalId: providerMatchId },
      select: { id: true, externalId: true },
    });
    return NextResponse.json({ ok: true, action, match }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'set-animation-id') {
    const animationMatchId = cleanInt(body.animationMatchId);
    if (!animationMatchId) {
      return NextResponse.json({ ok: false, error: 'animationMatchId is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const match = await prisma.match.update({
      where: { id: matchId },
      data: { animationMatchId },
      select: { id: true, animationMatchId: true },
    });
    return NextResponse.json({ ok: true, action, match }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (action === 'clear-animation-id') {
    const match = await prisma.match.update({
      where: { id: matchId },
      data: { animationMatchId: null },
      select: { id: true, animationMatchId: true },
    });
    return NextResponse.json({ ok: true, action, match }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}
