import { redirect } from 'next/navigation';

export default async function MatchDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const safeId = encodeURIComponent(resolved.id);
  redirect(`/match-center/${safeId}`);
}
