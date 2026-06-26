import MatchCenterPageLivePriority from '@/components/match-center/MatchCenterPageLivePriority';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchCenterRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return <MatchCenterPageLivePriority matchId={resolved.id} />;
}
