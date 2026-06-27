import MatchDataPanel from './MatchDataPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchCenterNewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return <MatchDataPanel matchId={resolved.id} />;
}
