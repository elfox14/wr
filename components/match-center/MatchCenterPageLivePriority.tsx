import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchTabsPage from '@/components/match-page/ProfessionalMatchTabsPage';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Match center',
  description: 'Match center page.',
};

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageDataFast(matchId);
  if (!data) notFound();

  return <ProfessionalMatchTabsPage data={data} />;
}
