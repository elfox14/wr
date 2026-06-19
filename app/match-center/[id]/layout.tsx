import prisma from '@/lib/prisma';
import LiveBroadcastPreview from '@/components/match-center/LiveBroadcastPreview';
import LiveBroadcastPreviewSlot from '@/components/match-center/LiveBroadcastPreviewSlot';

function isLiveStatus(status?: string) {
  const value = String(status || '').toUpperCase();
  return value === 'IN_PLAY' || value === 'LIVE' || value === 'HT';
}

function isFinished(status?: string) {
  return String(status || '').toUpperCase() === 'FINISHED';
}

function schemaEventStatus(status?: string) {
  if (isFinished(status)) return 'https://schema.org/EventCompleted';
  if (isLiveStatus(status)) return 'https://schema.org/EventInProgress';
  return 'https://schema.org/EventScheduled';
}

async function getMatch(id: string) {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!match) return null;

  const players = await prisma.asset.findMany({
    where: { type: 'PLAYER', teamId: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { id: true, name: true, code: true, image: true, teamId: true },
    take: 80,
  });

  return { ...match, squadPlayers: players };
}

export default async function MatchCenterLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const match = await getMatch(resolved.id);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

  const sportsEventJsonLd = match
    ? {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        sport: 'Soccer',
        startDate: match.matchDate.toISOString(),
        eventStatus: schemaEventStatus(match.status),
        url: `${baseUrl}/match-center/${match.id}`,
        competitor: [
          { '@type': 'SportsTeam', name: match.homeTeam.name, url: `${baseUrl}/asset/${match.homeTeam.id}` },
          { '@type': 'SportsTeam', name: match.awayTeam.name, url: `${baseUrl}/asset/${match.awayTeam.id}` },
        ],
      }
    : null;

  const homePlayers = match?.squadPlayers?.filter((player) => player.teamId === match.homeTeamId) || [];
  const awayPlayers = match?.squadPlayers?.filter((player) => player.teamId === match.awayTeamId) || [];

  return (
    <>
      {sportsEventJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }} /> : null}
      {children}
      {match ? (
        <LiveBroadcastPreviewSlot>
          <div className="bg-[#02060d] px-3 pb-5 text-white sm:px-6" dir="rtl">
            <div className="mx-auto max-w-7xl">
              <LiveBroadcastPreview matchId={match.id} events={match.events || []} homeTeam={match.homeTeam} awayTeam={match.awayTeam} homePlayers={homePlayers} awayPlayers={awayPlayers} homeScore={match.homeScore} awayScore={match.awayScore} />
            </div>
          </div>
        </LiveBroadcastPreviewSlot>
      ) : null}
    </>
  );
}
