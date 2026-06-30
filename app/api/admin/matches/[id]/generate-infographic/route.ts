import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InfographicDataSchema = z.object({
  motm: z.object({
    name: z.string().describe("Player's full name in Arabic"),
    rating: z.number().describe("Player's match rating (e.g., 8.5)"),
    stats: z.array(z.object({
      label: z.string().describe("Stat label in Arabic (e.g., الأهداف, صناعة, دقة التمرير)"),
      value: z.string().describe("Stat value (e.g., 2, 1, 89%)")
    })).max(4)
  }),
  matchIntelligence: z.array(z.object({
    title: z.string().describe("Short catchy title for the insight in Arabic"),
    description: z.string().describe("Detailed insight description in Arabic (1-2 sentences)")
  })).length(4),
  advancedAnalytics: z.object({
    homeXG: z.number(),
    awayXG: z.number(),
    homeBigChances: z.number(),
    awayBigChances: z.number(),
    shotQualityText: z.string().describe("A short sentence in Arabic summarizing the shot quality of both teams")
  })
});

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) return auth.error;

    const params = await props.params;
    const matchId = params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        statsSnapshots: {
          orderBy: { minute: 'desc' },
          take: 1
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const latestSnapshot = match.statsSnapshots[0];
    if (!latestSnapshot) {
      return NextResponse.json({ error: 'No stats snapshot found for this match' }, { status: 400 });
    }

    const prompt = `Analyze this football match between ${match.homeTeam.name} and ${match.awayTeam.name}.
The final score is ${match.homeScore} - ${match.awayScore}.
Home possession: ${latestSnapshot.homePossession}% | Away possession: ${latestSnapshot.awayPossession}%
Home shots: ${latestSnapshot.homeShots} (on target: ${latestSnapshot.homeShotsOnTarget})
Away shots: ${latestSnapshot.awayShots} (on target: ${latestSnapshot.awayShotsOnTarget})

Generate a premium infographic dataset in Arabic.
1. Determine the Man of the Match (motm) and provide 3-4 key stats for him.
2. Provide 4 "Match Intelligence" insights that explain the tactical flow, turning points, or key reasons for the result.
3. Estimate xG (Expected Goals) and big chances for both teams based on the shot counts and scoreline, and provide a short summary of shot quality.
Ensure all text is in professional, engaging Arabic suitable for a sports broadcast graphic.`;

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    });

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: InfographicDataSchema,
      prompt: prompt,
      temperature: 0.7,
    });

    const infographicData = result.object;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        infographicData: infographicData as any
      }
    });

    return NextResponse.json({ success: true, data: infographicData });

  } catch (error: any) {
    console.error('Error generating infographic:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
