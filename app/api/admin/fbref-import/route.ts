import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'FBref import has been removed from this project.' }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ ok: false, message: 'FBref import has been removed from this project.' }, { status: 410 });
}
