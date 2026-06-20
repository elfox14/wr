import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchPageClient from '@/components/match-page/ProfessionalMatchPageClient';
import MatchAdvancedExtras from '@/components/match-page/MatchAdvancedExtras';
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
  return <>
    <ProfessionalMatchPageClient data={data} />
    <MatchAdvancedExtras matchId={data.id} />
  </>;
}
