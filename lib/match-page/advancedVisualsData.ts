import prisma from '@/lib/prisma';
import type { MatchShotMapItem } from './types';
import { rawData, toNumber } from './normalizers';

function cleanText(value: any): string | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text && text !== '[object Object]' && !/^unknown|n\/a|null|undefined|-$/i.test(text)) return text;
  }
  if (value && typeof value === 'object') {
    return cleanText(value.name || value.fullName || value.full_name || value.displayName || value.display_name || value.title || value.label);
  }
  return null;
}

function clampPercent(value: any) {
  const number = toNumber(value);
  if (number === null || number === undefined || Number.isNaN(Number(number))) return null;
  return Math.max(0, Math.min(100, Number(number)));
}

function listFrom(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['shotmap', 'shots', 'events', 'items', 'results', 'data']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function teamMatch(row: any, team: any) {
  const text = String(`${row?.teamId || row?.team_id || ''} ${row?.teamName || row?.team_name || row?.team?.name || row?.team || ''}`).toLowerCase();
  const id = String(team?.id || '').toLowerCase();
  const name = String(team?.name || '').toLowerCase();
  const code = String(team?.code || '').toLowerCase();
  return Boolean((id && text.includes(id)) || (name && text.includes(name)) || (code && text.includes(code)));
}

function normalizeShot(row: any, homeTeam: any, awayTeam: any, index: number): MatchShotMapItem | null {
  const player = row?.player || row?.athlete || row?.shooter || row;
  const team = row?.team || {};
  const outcome = cleanText(row?.outcome || row?.result || row?.shot_outcome || row?.status || row?.type);
  const x = clampPercent(row?.x ?? row?.pitchX ?? row?.pitch_x ?? row?.location?.x ?? row?.coordinates?.x);
  const y = clampPercent(row?.y ?? row?.pitchY ?? row?.pitch_y ?? row?.location?.y ?? row?.coordinates?.y);
  const xg = toNumber(row?.xg ?? row?.expected_goals ?? row?.expectedGoals ?? row?.shot_xg);
  const playerName = cleanText(player?.name || row?.player_name || row?.playerName);
  const teamName = cleanText(team?.name || row?.team_name || row?.teamName || row?.team);
  const teamId = cleanText(team?.id || row?.team_id || row?.teamId) || (teamMatch(row, homeTeam) ? homeTeam.id : teamMatch(row, awayTeam) ? awayTeam.id : null);

  if (x === null && y === null && xg === null && !playerName) return null;

  return {
    id: cleanText(row?.id || row?.event_id || row?.shot_id) || `shot-${index}`,
    minute: toNumber(row?.minute ?? row?.time?.minute ?? row?.elapsed),
    playerName,
    teamName: teamId === homeTeam.id ? homeTeam.name : teamId === awayTeam.id ? awayTeam.name : teamName,
    teamId,
    x: x ?? 50,
    y: y ?? 50,
    xg,
    npxg: toNumber(row?.npxg ?? row?.non_penalty_xg ?? row?.nonPenaltyXg),
    outcome,
    situation: cleanText(row?.situation || row?.play_pattern || row?.phase),
    bodyPart: cleanText(row?.bodyPart || row?.body_part),
    isGoal: /goal|scored|هدف/i.test(String(outcome || row?.type || '')),
    isOnTarget: /on target|saved|goal|scored|على المرمى/i.test(String(outcome || '')),
    isBlocked: /block/i.test(String(outcome || '')),
    isPenalty: /penalty|ركلة جزاء/i.test(String(row?.situation || row?.type || outcome || '')),
  };
}

function extractShotmapFromSnapshots(snapshots: any[], homeTeam: any, awayTeam: any) {
  const shots: MatchShotMapItem[] = [];
  const seen = new Set<string>();

  for (const snapshot of snapshots) {
    const data = rawData(snapshot);
    const normalized = data.normalized || {};
    const candidates = [
      ...listFrom(normalized.shotmap),
      ...listFrom(data.shotmap),
      ...listFrom(data.shots),
      ...listFrom(data.raw?.shotmap),
      ...listFrom(data.raw?.shots),
    ];

    for (const item of candidates) {
      const shot = normalizeShot(item, homeTeam, awayTeam, shots.length + 1);
      if (!shot) continue;
      const key = `${shot.id}:${shot.minute}:${shot.playerName}:${shot.x}:${shot.y}:${shot.xg}`;
      if (seen.has(key)) continue;
      seen.add(key);
      shots.push(shot);
    }

    if (shots.length >= 80) break;
  }

  return shots.sort((a, b) => Number(a.minute || 999) - Number(b.minute || 999));
}

function sumXg(shots: MatchShotMapItem[], teamId: string) {
  const total = shots.filter((shot) => shot.teamId === teamId).reduce((sum, shot) => sum + Number(shot.xg || 0), 0);
  return Number(total.toFixed(2));
}

export async function getMatchAdvancedVisualsData(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, code: true } },
      awayTeam: { select: { id: true, name: true, code: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 20 },
    },
  });

  if (!match) return null;

  const snapshots = [...(match.statsSnapshots || [])];
  const shots = extractShotmapFromSnapshots(snapshots, match.homeTeam, match.awayTeam);
  const topChances = [...shots].sort((a, b) => Number(b.xg || 0) - Number(a.xg || 0)).slice(0, 8);

  return {
    matchId: match.id,
    title: `${match.homeTeam.name} ضد ${match.awayTeam.name}`,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    matchDate: match.matchDate.toISOString(),
    shotmap: shots,
    topChances,
    summary: {
      shots: shots.length,
      homeShots: shots.filter((shot) => shot.teamId === match.homeTeam.id).length,
      awayShots: shots.filter((shot) => shot.teamId === match.awayTeam.id).length,
      homeXg: sumXg(shots, match.homeTeam.id),
      awayXg: sumXg(shots, match.awayTeam.id),
      goals: shots.filter((shot) => shot.isGoal).length,
      onTarget: shots.filter((shot) => shot.isOnTarget).length,
    },
    source: snapshots.find((snapshot) => shots.length && rawData(snapshot)?.normalized?.shotmap)?.provider || 'Snapshot محفوظ',
    lastUpdatedAt: new Date(Math.max(...snapshots.map((snapshot) => new Date(snapshot.capturedAt).getTime()).filter(Number.isFinite), match.matchDate.getTime())).toISOString(),
  };
}
