import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import TeamIntelligenceHub from '@/components/teams/TeamIntelligenceHub';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }: { params: { id: string } }) {
  let team: any = null;
  let players: any[] = [];
  let matches: any[] = [];
  let report: any = null;

  try {
    team = await prisma.asset.findUnique({
      where: { id: params.id },
      include: {
        intelligenceReports: {
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (team) {
      players = await prisma.asset.findMany({
        where: { teamId: team.id, type: 'PLAYER' },
        include: {
          performances: { take: 5, orderBy: { matchDate: 'desc' } }
        }
      });

      matches = await prisma.match.findMany({
        where: { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
        orderBy: { matchDate: 'asc' },
        include: {
          homeTeam: { select: { id: true, name: true, image: true, code: true } },
          awayTeam: { select: { id: true, name: true, image: true, code: true } },
          statsSnapshots: { take: 1, orderBy: { capturedAt: 'desc' } }
        }
      });
      
      report = team.intelligenceReports?.[0] || null;
    }
  } catch (error) {
    console.error("Database connection error, falling back to mock data");
  }

  // Fallback to mock data for demonstration purposes if team is not found or DB fails
  if (!team) {
    team = {
      id: params.id,
      name: 'المنتخب السعودي',
      code: 'KSA',
      image: null, // can be a valid URL
      group: 'Group C',
      continent: 'آسيا',
      fifaRank: 53,
      coach: 'روبرتو مانشيني',
      participations: 6,
    };
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <TeamIntelligenceHub 
        team={team} 
        players={players} 
        matches={matches} 
        intelligenceReport={report} 
      />
    </main>
  );
}
