import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchPage from '@/components/match-page/ProfessionalMatchPage';
import { getMatchPageData } from '@/lib/match-page/getMatchPageData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Professional match center | MC PRIME World Cup',
  description: 'Interactive match center with score, timeline, stats, standings, thirds table, and analysis.',
};

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageData(matchId);
  if (!data) notFound();
  return <ProfessionalMatchPage data={data} />;
}
