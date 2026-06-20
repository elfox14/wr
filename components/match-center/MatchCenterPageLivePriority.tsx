import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchPageWithDateCard from '@/components/match-page/ProfessionalMatchPageWithDateCard';
import { getMatchPageData } from '@/lib/match-page/getMatchPageData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Match center',
  description: 'Interactive match center.',
};

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageData(matchId);
  if (!data) notFound();
  return <ProfessionalMatchPageWithDateCard data={data} />;
}
