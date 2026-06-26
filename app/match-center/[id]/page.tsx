import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchCenterRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  redirect(`/live-animation/${encodeURIComponent(resolved.id)}`);
}
