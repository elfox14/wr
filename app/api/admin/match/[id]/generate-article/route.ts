import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { findPostMatchCandidateById, generateArticleForMatch } from '@/lib/post-match-content/generator';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  
  try {
    const match = await findPostMatchCandidateById(id);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const article = await generateArticleForMatch(match, { autoPublish: false });
    return NextResponse.json({ success: true, slug: article.slug });
  } catch (error) {
    console.error('Error generating article:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
