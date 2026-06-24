import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfessionalMatchPageWithDateCard from '@/components/match-page/ProfessionalMatchPageWithDateCard';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Match center',
  description: 'Interactive match center.',
};

export default async function MatchCenterPageLivePriority({ matchId }: { matchId: string }) {
  const data = await getMatchPageDataFast(matchId);
  if (!data) notFound();

  return (
    <>
      <ProfessionalMatchPageWithDateCard data={data} />
      <a
        href={`/match-center/${data.id}/advanced`}
        className="fixed bottom-4 left-4 z-50 inline-flex max-w-[calc(100vw-2rem)] items-center justify-center rounded-2xl border border-[#18E58F]/30 bg-[#06140F]/95 px-4 py-3 text-xs font-black text-[#18E58F] shadow-2xl shadow-black/40 backdrop-blur transition hover:bg-[#18E58F] hover:text-black md:bottom-6 md:left-6 md:text-sm"
      >
        خريطة التسديدات و xG
      </a>
    </>
  );
}
