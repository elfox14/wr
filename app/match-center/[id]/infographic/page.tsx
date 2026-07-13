import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import InfographicClient from './InfographicClient';
import { getMatchPageDataFast } from '@/lib/match-page/getMatchPageDataFast';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchInfographicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const [matchData, matchRecord, session] = await Promise.all([
    getMatchPageDataFast(matchId),
    prisma.match.findUnique({ where: { id: matchId }, select: { infographicData: true } }),
    getServerSession(authOptions),
  ]);

  if (!matchData || !matchRecord) notFound();
  const info = matchRecord.infographicData && typeof matchRecord.infographicData === 'object' && !Array.isArray(matchRecord.infographicData)
    ? matchRecord.infographicData as Record<string, any>
    : null;
  const isApproved = info?.version === 2 && info?.status === 'APPROVED' && Boolean(info?.source?.snapshotId);
  const isAdmin = session?.user?.role === 'ADMIN';

  if (!info || (!isApproved && !isAdmin)) notFound();

  return <InfographicClient matchData={matchData} info={info} isPreview={!isApproved} />;
}
