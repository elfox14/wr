import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const LIVE_STATUSES = ['IN_PLAY', 'LIVE', 'HT'];
const MAX_LIVE_MINUTES = 180;

function dayHourKey(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'unknown-time';
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function teamsKey(match: any) {
  const ids = [match.homeTeamId || match.homeTeam?.id, match.awayTeamId || match.awayTeam?.id].filter(Boolean).map(String).sort();
  return ids.length === 2 ? ids.join(':') : `${match.homeTeam?.name || 'home'}:${match.awayTeam?.name || 'away'}`.toLowerCase();
}

function dedupeKey(match: any) {
  if (match.animationMatchId) return `animation:${match.animationMatchId}`;
  return `teams:${teamsKey(match)}:${dayHourKey(match.matchDate)}`;
}

function duplicateFamilyKey(match: any) {
  return `teams:${teamsKey(match)}:${dayHourKey(match.matchDate)}`;
}

function isStaleLive(match: any, now = Date.now()) {
  const status = String(match.status || '').toUpperCase();
  if (!LIVE_STATUSES.includes(status)) return false;
  const matchTime = new Date(match.matchDate).getTime();
  if (!Number.isFinite(matchTime)) return false;
  return now - matchTime > MAX_LIVE_MINUTES * 60 * 1000;
}

function normalizeMatchForDisplay(match: any, now = Date.now()) {
  if (!isStaleLive(match, now)) return match;
  return {
    ...match,
    status: 'FINISHED',
    displayStatus: 'FINISHED',
    isStaleAutoFinished: true,
  };
}

function rankMatch(match: any) {
  const status = String(match.status || '').toUpperCase();
  const statusRank = status === 'IN_PLAY' || status === 'LIVE' || status === 'HT' ? 50 : status === 'FINISHED' ? 30 : 10;
  const animationRank = match.animationMatchId ? 20 : 0;
  const externalRank = match.externalId ? 5 : 0;
  return statusRank + animationRank + externalRank;
}

function dedupeMatches(matches: any[]) {
  const now = Date.now();
  const normalizedMatches = matches.map((match) => normalizeMatchForDisplay(match, now));
  const byExact = new Map<string, any>();
  for (const match of normalizedMatches) {
    const key = dedupeKey(match);
    const previous = byExact.get(key);
    if (!previous || rankMatch(match) > rankMatch(previous)) byExact.set(key, match);
  }

  const byFamily = new Map<string, any>();
  for (const match of byExact.values()) {
    const key = duplicateFamilyKey(match);
    const previous = byFamily.get(key);
    if (!previous || rankMatch(match) > rankMatch(previous)) byFamily.set(key, match);
  }

  return Array.from(byFamily.values()).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
}

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: { matchDate: 'asc' },
    });

    return NextResponse.json(dedupeMatches(matches));
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
