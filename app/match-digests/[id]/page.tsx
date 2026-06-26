import { redirect } from 'next/navigation';

export const revalidate = 300;

export default async function MatchDigestRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/matches/${encodeURIComponent(id)}/article`);
}
