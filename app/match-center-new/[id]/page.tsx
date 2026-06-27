import MatchDataPanel from '@/components/match-center-new/MatchDataPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchCenterNewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDataPanel matchId={id} dbMatchId={id} />;
}
