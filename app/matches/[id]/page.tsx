import { redirect } from 'next/navigation';

export default async function MatchDetailRedirect({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  redirect(`/match-center/${resolved.id}`);
}
