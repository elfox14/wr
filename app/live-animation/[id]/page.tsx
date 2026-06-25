import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import LiveAnimationPitch from '@/components/live-animation/LiveAnimationPitch';
import { getTeamVisualTheme } from '@/lib/teamVisualThemes';
import { withTeamDisplay } from '@/lib/teamDisplay';
import {
  animationEventLabel,
  inferLiveAnimationSpatial,
  normalizeAnimationEventType,
  type AnimationTeamSide,
} from '@/lib/liveAnimationSpatial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET', 'BREAK'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];

function statusKind(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (LIVE_STATUSES.includes(raw)) return 'live';
  if (raw === 'HT') return 'halftime';
  if (FINISHED_STATUSES.includes(raw)) return 'finished';
  return 'scheduled';
}

function safeNumber(value: any, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function icon(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return '⚽';
  if (key.includes('yellow')) return '🟨';
  if (key.includes('red')) return '🟥';
  if (key.includes('sub')) return '🔁';
  if (key.includes('shot')) return '🎯';
  if (key.includes('corner')) return '🚩';
  if (key.includes('penalty')) return '🥅';
  return '●';
}

function color(type: string) {
  const key = String(type || '').toLowerCase();
  if (key.includes('goal')) return '#F8C846';
  if (key.includes('red')) return '#FF5C5C';
  if (key.includes('yellow')) return '#F8C846';
  if (key.includes('shot')) return '#18E58F';
  if (key.includes('corner')) return '#A78BFA';
  return '#E5E7EB';
}

function sideFromTeam(teamId: string | null | undefined, homeTeamId: string, awayTeamId: string): AnimationTeamSide {
  if (teamId === homeTeamId) return 'home';
  if (teamId === awayTeamId) return 'away';
  return 'unknown';
}

function normalizeEvent(row: any, index: number, homeTeamId: string, awayTeamId: string) {
  const eventType = String(row.eventType || row.type || 'note');
  const teamSide = sideFromTeam(row.teamId, homeTeamId, awayTeamId);
  const spatial = inferLiveAnimationSpatial({
    id: String(row.id || `event-${index}`),
    type: eventType,
    detail: row.detail || row.eventLabel,
    minute: row.minute,
    teamSide,
    index,
    explicitX: row.x,
    explicitY: row.y,
    explicitEndX: row.endX,
    explicitEndY: row.endY,
  });

  return {
    id: String(row.id || `event-${index}`),
    sequenceNumber: safeNumber(row.sequenceNumber, safeNumber(row.minute, index + 1) * 100 + index + 1),
    minute: row.minute ?? null,
    second: row.second ?? null,
    teamId: row.teamId || null,
    playerId: row.playerId || null,
    playerName: row.playerName || null,
    jerseyNumber: row.jerseyNumber || null,
    eventType,
    eventLabel: row.eventLabel || animationEventLabel(eventType),
    detail: row.detail || row.eventLabel || animationEventLabel(eventType),
    x: row.x ?? spatial.x,
    y: row.y ?? spatial.y,
    endX: row.endX ?? spatial.endX,
    endY: row.endY ?? spatial.endY,
    zone: row.zone || spatial.zone,
    coordinateSource: row.coordinateSource || spatial.coordinateSource,
    coordinateConfidence: row.coordinateConfidence || spatial.coordinateConfidence,
    eventSide: row.eventSide || spatial.eventSide,
    isInferred: row.isInferred === null || row.isInferred === undefined ? spatial.isInferred : Boolean(row.isInferred),
    anchorZone: row.anchorZone || spatial.anchorZone,
    displayPriority: safeNumber(row.displayPriority, spatial.displayPriority),
    provider: row.provider || row.sourceName || 'MATCH_EVENT_FALLBACK',
    icon: icon(eventType),
    color: color(eventType),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

async function readLiveAnimationRows(matchId: string, homeTeamId: string, awayTeamId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "sequenceNumber",
        "minute",
        "second",
        "teamId",
        "playerId",
        "playerName",
        "jerseyNumber",
        "eventType",
        "eventLabel",
        "x",
        "y",
        "endX",
        "endY",
        "zone",
        "coordinateSource",
        "coordinateConfidence",
        "eventSide",
        "isInferred",
        "anchorZone",
        "displayPriority",
        "provider",
        "createdAt"
      FROM "LiveAnimationEvent"
      WHERE "matchId" = $1
      ORDER BY "sequenceNumber" ASC
      LIMIT 80
    `, matchId);
    if (rows.length) return rows.map((row, index) => normalizeEvent(row, index, homeTeamId, awayTeamId));
  } catch {
    // Migration may not be applied yet. Fallback below.
  }

  const events = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
    take: 80,
  }).catch(() => [] as any[]);

  return events.map((event, index) => {
    const eventType = normalizeAnimationEventType(event.type, event.detail);
    return normalizeEvent({ ...event, eventType, eventLabel: animationEventLabel(eventType) }, index, homeTeamId, awayTeamId);
  });
}

async function getInitialState(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, image: true } },
      awayTeam: { select: { id: true, name: true, code: true, image: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
    },
  });

  if (!match) return null;
  const latestSnapshot = match.statsSnapshots?.[0] || null;
  const events = await readLiveAnimationRows(match.id, match.homeTeam.id, match.awayTeam.id);
  const lastSequence = events.reduce((max, event) => Math.max(max, Number(event.sequenceNumber || 0)), 0);
  const homeTeam = withTeamDisplay(match.homeTeam);
  const awayTeam = withTeamDisplay(match.awayTeam);
  const homeTheme = getTeamVisualTheme(homeTeam.code, homeTeam.name);
  const awayTheme = getTeamVisualTheme(awayTeam.code, awayTeam.name);

  return {
    ok: true,
    mode: 'db_only_live_animation_state',
    matchId: match.id,
    title: `${homeTeam.name} ضد ${awayTeam.name}`,
    phase: statusKind(match.status),
    status: match.status,
    minute: latestSnapshot?.minute ?? null,
    score: {
      home: safeNumber(latestSnapshot?.homeScore ?? match.homeScore, 0),
      away: safeNumber(latestSnapshot?.awayScore ?? match.awayScore, 0),
    },
    teams: {
      home: { ...homeTeam, theme: homeTheme },
      away: { ...awayTeam, theme: awayTheme },
    },
    visualTheme: { home: homeTheme, away: awayTheme },
    lastSequence,
    events,
    source: events.some((event) => event.provider !== 'MATCH_EVENT_FALLBACK') ? 'LiveAnimationEvent' : 'MatchEvent fallback',
    lastUpdatedAt: latestSnapshot?.capturedAt ? latestSnapshot.capturedAt.toISOString() : new Date().toISOString(),
  };
}

export default async function LiveAnimationPage({ params }: PageProps) {
  const { id } = await params;
  const initialState = await getInitialState(id);
  if (!initialState) notFound();

  return (
    <main className="min-h-screen bg-[#04110D] px-3 py-5 text-white" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black">مركز الملعب التفاعلي</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">ملعب افتراضي تفاعلي يقرأ من قاعدة البيانات فقط.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/watch/${id}`} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-4 py-2 text-sm font-black text-[#F8C846] transition hover:bg-[#F8C846] hover:text-black">صفحة البث</Link>
            <Link href={`/match-center/${id}`} className="rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/10 px-4 py-2 text-sm font-black text-[#18E58F] transition hover:bg-[#18E58F] hover:text-black">مركز المباراة</Link>
          </div>
        </header>
        <LiveAnimationPitch initialState={initialState as any} />
      </div>
    </main>
  );
}
