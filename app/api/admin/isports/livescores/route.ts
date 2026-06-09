import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getFootballLivescores } from '@/lib/isportsApi';

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.authorized) return admin.error;

  const { searchParams } = new URL(req.url);
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'adminSecret') params[key] = value;
  });

  try {
    const payload: any = await getFootballLivescores(params);
    const matches = Array.isArray(payload?.data) ? payload.data : [];

    return NextResponse.json({
      success: payload?.code === 0,
      code: payload?.code,
      message: payload?.message,
      total: matches.length,
      matches,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Failed to load iSports livescores',
      primary: error.primary || null,
      fallback: error.fallback || null,
    }, { status: 500 });
  }
}
