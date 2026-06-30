import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Image from 'next/image';
import InfographicClient from './InfographicClient';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchInfographicPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = resolved.id;

  const matchData = await getMatchPageDataFast(matchId);
  const matchRecord = await prisma.match.findUnique({
    where: { id: matchId },
    select: { infographicData: true }
  });

  if (!matchData || !matchRecord) notFound();

  const infographicData = matchRecord.infographicData as any;

  if (!infographicData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black" dir="rtl">
        <div className="text-center text-white">
          <h1 className="mb-4 text-3xl font-black">البيانات غير متوفرة</h1>
          <p className="text-gray-400">لم يتم توليد إنفوجرافيك لهذه المباراة بعد.</p>
        </div>
      </div>
    );
  }

  return (
    <InfographicClient 
      matchData={matchData} 
      info={infographicData}
    />
  );
}
