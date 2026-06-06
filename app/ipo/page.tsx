import { PrismaClient } from '@prisma/client';
import IpoClient from './IpoClient';
import { getPlayerRatingLabel, getTeamTierLabel } from '@/lib/scoring';

const prisma = new PrismaClient();

export const revalidate = 60; // Cache for 60 seconds

export default async function IpoPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { current_price: 'desc' },
  });

  const teams = assets.filter((a) => a.type === 'TEAM');
  const players = assets.filter((a) => a.type === 'PLAYER');

  // Add labels to players for grouping
  const labeledPlayers = players.map(p => ({
    ...p,
    ipoLabel: getPlayerRatingLabel(p.score || 60),
  }));

  // Add labels to teams for grouping
  const labeledTeams = teams.map(t => ({
    ...t,
    ipoLabel: getTeamTierLabel(t.score || 60),
  }));

  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Header section passed to client for countdown if needed, or static here */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4 tracking-tight">
            WORLD CUP 2026 IPO
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Secure your shares in the best national teams and superstar players before the official market trading opens. IPO prices are fixed.
          </p>
        </div>

        <IpoClient teams={labeledTeams} players={labeledPlayers} />
      </div>
    </div>
  );
}
