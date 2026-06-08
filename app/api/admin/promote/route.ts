import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function hasValidAdminSecret(req: Request) {
  const expectedSecret = process.env.ADMIN_API_SECRET;
  if (!expectedSecret) return false;

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('adminSecret') || '';

  return [bearer, headerSecret, querySecret].some((value) => value && value === expectedSecret);
}

function normalizeEmail(email: string | null) {
  return String(email || '').trim().toLowerCase();
}

export async function POST(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({
      error: 'User not found',
      message: 'هذا البريد غير موجود في جدول المستخدمين. سجّل دخول مرة واحدة بهذا البريد أولًا ثم أعد المحاولة.',
      email,
    }, { status: 404 });
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({
    success: true,
    message: 'User promoted to ADMIN',
    user: updatedUser,
  });
}

export async function GET(req: Request) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const email = normalizeEmail(searchParams.get('email'));

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({
      error: 'User not found',
      message: 'هذا البريد غير موجود في جدول المستخدمين. سجّل دخول مرة واحدة بهذا البريد أولًا ثم أعد المحاولة.',
      email,
    }, { status: 404 });
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({
    success: true,
    message: 'User promoted to ADMIN',
    user: updatedUser,
  });
}
