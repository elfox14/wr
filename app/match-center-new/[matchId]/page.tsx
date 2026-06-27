import MatchDataPanel from '@/components/match-center-new/MatchDataPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return <MatchDataPanel matchId={matchId} dbMatchId={matchId} />;
}
