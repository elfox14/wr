import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { apiFootballFetch, normalizeName } from '@/lib/apiFootball';
import { calculateFairValue, calculatePlayerScore, calculateTeamScore } from '@/lib/scoring';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;
type BootstrapOptions = {
  leagueId: number;
  season: number;
  dryRun: boolean;
  reset: boolean;
  includePlayers: boolean;
  includeFixtures: boolean;
  includeGroups: boolean;
  maxTeams: number;
  from: string;
  to: string;
};

const TARGET_TEAMS = 48;
const TARGET_PLAYERS = 1244;

function isAdminSession(session: AdminSession) {
  const email = session?.user?.email || '';
  return session?.user?.role === 'ADMIN' || email === 'worldcup@mcprim.com' || email === 'elfox14usa@gmail.com';
}

async function requireAdmin() {
  const session = await getServerSession(authOptions as any) as AdminSession;
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminSession(session)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { session };
}

function toBool(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toSlug(value?: string | null) {
  const clean = normalizeName(value || 'item') || 'item';
  return clean.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 80);
}

function normalizeStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'IN_PLAY'].includes(value)) return 'IN_PLAY';
  if (['FT', 'AET', 'PEN', 'FINISHED', 'ENDED'].includes(value)) return 'FINISHED';
  return 'SCHEDULED';
}

function parseStage(round?: string | null) {
  const value = String(round || '').toLowerCase();
  if (value.includes('final') && !value.includes('semi') && !value.includes('quarter')) return 'final';
  if (value.includes('semi')) return 'semi_final';
  if (value.includes('quarter')) return 'quarter_final';
  if (value.includes('16')) return 'round_of_16';
  return 'group';
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  const diff = Math.floor((end - start) / 86400000);
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

function getTeamGroupMap(standingsPayload: any) {
  const map = new Map<number, string>();
  const response = Array.isArray(standingsPayload?.response) ? standingsPayload.response : [];
  for (const item of response) {
    const standings = item?.league?.standings || [];
    for (const groupRows of standings) {
      if (!Array.isArray(groupRows)) continue;
      for (const row of groupRows) {
        const teamId = toNumber(row?.team?.id, 0);
        const group = row?.group || row?.description || item?.league?.round;
        if (teamId && group) map.set(teamId, String(group));
      }
    }
  }
  return map;
}

function extractTeamsFromFixtures(fixtures: any[]) {
  const byId = new Map<number, any>();
  for (const fixture of fixtures) {
    for (const side of ['home', 'away']) {
      const team = fixture?.teams?.[side];
      const id = toNumber(team?.id, 0);
      if (!id || !team?.name) continue;
      if (!byId.has(id)) byId.set(id, team);
    }
  }
  return [...byId.values()];
}

function normalizeTeamItem(item: any) {
  const team = item?.team || item;
  return {
    id: toNumber(team?.id, 0),
    name: team?.name,
    code: team?.code || String(team?.name || '').slice(0, 3).toUpperCase(),
    country: team?.country,
    logo: team?.logo,
    raw: item,
  };
}
