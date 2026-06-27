import MatchDataPanel from '@/components/match-center-new/MatchDataPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; matchId?: string; dbMatchId?: string }> }) {
  const params = await searchParams;
  const id = params.id || params.dbMatchId || params.matchId || '';
  return <MatchDataPanel matchId={params.matchId || id} dbMatchId={params.dbMatchId || id} />;
}
