import FinalRichPage from '@/components/match-page/FinalRichPage';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageDataFast(matchId);
  if (!data) return null;
  return <FinalRichPage data={data} />;
}
