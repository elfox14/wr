import type { MatchEventView, MatchScore, MatchSourceView, MatchStatMetric, MatchStatusKind, MatchStatusView } from './types';

export const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
export const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'ET', 'BT', 'P'];
export const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
export const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

const FINAL_MINUTE_FALLBACK = 120;
type Pair = { home: number | null; away: number | null; source?: string } | null;

type StatusCandidate = {
  status: string;
  minute: number | null;
  priority: number;
  capturedAt: number;
  sourceKey: string;
};

const STAT_ALIASES: Record<string, string[]> = {
  possession: ['possession', 'ball_possession', 'ballPossession'],
  shots: ['shots', 'total_shots', 'totalShots'],
  shotsOnTarget: ['shotsOnTarget', 'shots_on_target', 'on_target_shots', 'shotsOnGoal'],
  shotsOffTarget: ['shotsOffTarget', 'shots_off_target', 'off_target_shots', 'shotsOffGoal', 'shots_wide'],
  corners: ['corners', 'corner_kicks', 'cornerKicks'],
  yellowCards: ['yellowCards', 'yellow_cards'],
  redCards: ['redCards', 'red_cards'],
  attacks: ['attacks'],
  dangerousAttacks: ['dangerousAttacks', 'dangerous_attacks'],
  fouls: ['fouls'],
  offsides: ['offsides'],
  xg: ['xg', 'expected_goals', 'expectedGoals'],
  npxg: ['npxg', 'non_penalty_xg', 'nonPenaltyXg', 'non_penalty_expected_goals', 'expected_goals_without_penalties', 'np_expected_goals'],
  bigChances: ['bigChances', 'big_chances'],
};

export function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

export function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export function normalizeStatusValue(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

export function normalizeGroupKey(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase() === 'group') return null;
  const cleaned = raw
    .replace(/^group[_\s-]*/i, '')
    .replace(/^المجموعة\s*/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toUpperCase();
  return cleaned || null;
}

export function groupLabel(value?: string | null) {
  const key = normalizeGroupKey(value);
  return key ? `المجموعة ${key}` : null;
}

export function stageLabel(stage?: string | null, groupPhase?: string | null) {
  const group = groupLabel(groupPhase);
  if (group) return group;
  const value = String(stage || '').trim();
  const normalized = value.toUpperCase();
  if (!value || normalized === 'GROUP') return 'مرحلة المجموعات';
  if (normalized.includes('ROUND') && normalized.includes('32')) return 'دور الـ32';
  if (normalized.includes('ROUND') && normalized.includes('16')) return 'دور الـ16';
  if (normalized.includes('QUARTER')) return 'ربع النهائي';
  if (normalized.includes('SEMI')) return 'نصف النهائي';
  if (normalized.includes('FINAL') && normalized.includes('THIRD')) return 'تحديد المركز الثالث';
  if (normalized.includes('FINAL')) return 'النهائي';
  return value.replace(/[_-]+/g, ' ');
}

export function providerName(snapshot: any) {
  const provider = normalizeStatusValue(snapshot?.provider);
  if (provider.includes('THE_STATS')) return 'TheStats';
  if (provider.includes('ISPORTS_FLASH')) return 'iSport';
  if (provider.includes('ISPORTS_REMOTE_LIVE')) return 'iSport';
  if (provider.includes('ISPORTS_TIMELINE')) return 'iSport';
  if (provider.includes('ISPORT')) return 'iSport';
  if (snapshot) return 'قاعدة البيانات';
  return '';
}

export function providerKey(snapshot: any) {
  const provider = normalizeStatusValue(snapshot?.provider);
  if (provider.includes('THE_STATS') && provider.includes('LIVE')) return 'the-stats-live';
  if (provider.includes('THE_STATS')) return 'the-stats';
  if (provider.includes('ISPORTS_FLASH')) return 'isports-flash';
  if (provider.includes('ISPORTS_REMOTE_LIVE')) return 'isports-remote-live';
  if (provider.includes('ISPORTS_TIMELINE')) return 'isports-timeline';
  if (provider.includes('ISPORT')) return 'isports-animation';
  return snapshot ? `snapshot-${snapshot.id || 'db'}` : 'missing';
}

export function providerPriority(snapshot: any) {
  const key = providerKey(snapshot);
  if (key === 'the-stats-live') return 1;
  if (key === 'the-stats') return 2;
  if (key === 'isports-flash') return 3;
  if (key === 'isports-remote-live') return 4;
  if (key === 'isports-timeline') return 5;
  if (key === 'isports-animation') return 6;
  return 9;
}

export function rawData(snapshot: any) {
  return asObject(snapshot?.rawData);
}

export function rawStats(snapshot: any) {
  const data = rawData(snapshot);
  const nested = asObject(data.theStatsApi);
  const liveStatsPayload = asObject(data.liveStats?.data || data.liveStats);
  return {
    ...asObject(nested.providerStats),
    ...asObject(nested.stats),
    ...asObject(liveStatsPayload.providerStats),
    ...asObject(liveStatsPayload.stats),
    ...asObject(liveStatsPayload.overview),
    ...asObject(data.providerStats),
    ...asObject(data.stats),
  };
}

function pairFromValue(value: any, source: string): Pair {
  const stat = asObject(value);
  const all = asObject(stat.all);
  const home = toNumber(stat.home ?? stat.home_value ?? stat.homeValue ?? all.home);
  const away = toNumber(stat.away ?? stat.away_value ?? stat.awayValue ?? all.away);
  return home === null && away === null ? null : { home, away, source };
}

function statPairFromRaw(stats: Record<string, any>, key: string, source: string): Pair {
  const aliases = Array.from(new Set([key, ...(STAT_ALIASES[key] || [])]));
  for (const alias of aliases) {
    const pair = pairFromValue(stats[alias], source);
    if (pair) return pair;
  }
  return null;
}

function snapshotPair(snapshot: any, key: string, homeKey: string, awayKey: string): Pair {
  if (!snapshot) return null;
  const source = providerName(snapshot);
  const home = toNumber(snapshot[homeKey]);
  const away = toNumber(snapshot[awayKey]);
  if (home !== null || away !== null) return { home, away, source };
  return statPairFromRaw(rawStats(snapshot), key, source);
}

export function buildStatMetric(sources: any[], key: string, label: string, homeKey: string, awayKey: string, suffix = ''): MatchStatMetric {
  const pair = sources.map((snapshot) => snapshotPair(snapshot, key, homeKey, awayKey)).find((value) => value && (value.home !== null || value.away !== null)) || null;
  return {
    key,
    label,
    home: pair?.home ?? null,
    away: pair?.away ?? null,
    suffix,
    source: pair?.source || '',
    available: Boolean(pair),
  };
}

function flashMetaFrom(data: Record<string, any>) {
  const flashMeta = asObject(data.flashMeta);
  const meta = asObject(data.meta);
  const nestedFlashMeta = asObject(asObject(data.theStatsApi).flashMeta);
  return { flashMeta, meta, nestedFlashMeta };
}

export function snapshotMinute(snapshot: any) {
  const data = rawData(snapshot);
  const { flashMeta, meta, nestedFlashMeta } = flashMetaFrom(data);
  const directMinute = toNumber(snapshot?.minute ?? data.minute ?? data.elapsed ?? data.currentMinute ?? flashMeta.minute ?? flashMeta.scheduleMinute ?? nestedFlashMeta.scheduleMinute ?? meta.elapsed_minutes ?? meta.minute);
  if (providerKey(snapshot) === 'isports-flash') {
    const matchState = String(data.matchState ?? data.providerStatus ?? flashMeta.matchState ?? nestedFlashMeta.matchState ?? meta.matchState ?? '').trim();
    if (matchState === '2' || normalizeStatusValue(matchState).includes('HALF')) return null;
    const scheduleMinute = toNumber(flashMeta.scheduleMinute ?? nestedFlashMeta.scheduleMinute);
    const recordsSample = Array.isArray(data.recordsSample) ? data.recordsSample : [];
    if (directMinute !== null && scheduleMinute !== null && directMinute === scheduleMinute && recordsSample.length === 0) return null;
  }
  return directMinute;
}

function statusFromProviderValue(value: unknown, minute: number | null) {
  const status = normalizeStatusValue(String(value ?? ''));
  if (!status) return minute !== null && minute >= FINAL_MINUTE_FALLBACK ? 'FINISHED' : null;
  if (['-1', '4', 'FT', 'FINISHED', 'ENDED', 'COMPLETED'].includes(status)) return 'FINISHED';
  if (['2', 'HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'].includes(status) || status.includes('HALF')) return 'HT';
  if (['3', '2H', 'SECOND_HALF', 'SECOND HALF'].includes(status) || status.includes('SECOND')) return '2H';
  if (['1', '1H', 'FIRST_HALF', 'FIRST HALF'].includes(status) || status.includes('FIRST')) return '1H';
  if (['5', 'P', 'PEN'].includes(status)) return 'PEN';
  if (['LIVE', 'IN_PLAY', 'ET'].includes(status)) return status;
  if (minute !== null && minute >= FINAL_MINUTE_FALLBACK && !['ET', 'AET', 'P', 'PEN', '5'].includes(status)) return 'FINISHED';
  return null;
}

function statusCandidate(snapshot: any): StatusCandidate | null {
  const data = rawData(snapshot);
  const { flashMeta, meta, nestedFlashMeta } = flashMetaFrom(data);
  const minute = snapshotMinute(snapshot);
  const rawStatus = data.status ?? data.providerStatus ?? data.matchState ?? flashMeta.matchState ?? nestedFlashMeta.matchState ?? meta.status ?? meta.matchState;
  const status = statusFromProviderValue(rawStatus, minute);
  if (!status) return null;
  return {
    status,
    minute,
    priority: providerPriority(snapshot),
    capturedAt: snapshot?.capturedAt ? new Date(snapshot.capturedAt).getTime() : 0,
    sourceKey: providerKey(snapshot),
  };
}

export function statusFromSnapshots(sources: any[]) {
  const candidates = sources.map(statusCandidate).filter(Boolean) as StatusCandidate[];
  const flash = candidates
    .filter((candidate) => candidate.sourceKey === 'isports-flash')
    .sort((a, b) => b.capturedAt - a.capturedAt)[0];
  if (flash && ['HT', 'FINISHED', '2H', '1H', 'PEN'].includes(flash.status)) return { status: flash.status, minute: flash.minute };
  const best = candidates.sort((a, b) => a.priority - b.priority || b.capturedAt - a.capturedAt)[0];
  return best ? { status: best.status, minute: best.minute } : null;
}

export function scoreFromSnapshot(snapshot: any): MatchScore | null {
  if (!snapshot) return null;
  const data = rawData(snapshot);
  const counts = asObject(data.counts);
  const meta = asObject(data.meta);
  const flashMeta = asObject(data.flashMeta);
  const home = toNumber(snapshot.homeScore ?? data.homeScore ?? data.home_goals ?? flashMeta.homeScore ?? meta.home_goals ?? counts.homeScore);
  const away = toNumber(snapshot.awayScore ?? data.awayScore ?? data.away_goals ?? flashMeta.awayScore ?? meta.away_goals ?? counts.awayScore);
  if (home === null && away === null) return null;
  return { home, away, source: providerName(snapshot) };
}

export function scoreForDisplay(match: any, sources: any[]): MatchScore {
  const matchHome = toNumber(match.homeScore);
  const matchAway = toNumber(match.awayScore);
  const matchScore: MatchScore = { home: matchHome, away: matchAway, source: 'قاعدة المباراة' };
  const matchTotal = Number(matchHome || 0) + Number(matchAway || 0);
  const snapshotScore = sources.map(scoreFromSnapshot).find(Boolean) || null;
  const snapshotTotal = Number(snapshotScore?.home || 0) + Number(snapshotScore?.away || 0);
  if (snapshotScore && snapshotTotal > matchTotal) return snapshotScore;
  if (matchHome !== null || matchAway !== null) return matchScore;
  return snapshotScore || { home: null, away: null, source: '' };
}

function statusKind(status: string): MatchStatusKind {
  const value = normalizeStatusValue(status);
  if (FINISHED_STATUSES.includes(value)) return 'finished';
  if (HALF_TIME_STATUSES.includes(value)) return 'halftime';
  if (LIVE_STATUSES.includes(value)) return 'live';
  if (SCHEDULED_STATUSES.includes(value)) return 'scheduled';
  return 'delayed';
}

export function buildStatusView(match: any, sources: any[]): MatchStatusView {
  const fromSource = statusFromSnapshots(sources);
  const raw = fromSource?.status || normalizeStatusValue(match.status || 'SCHEDULED');
  const minute = fromSource?.minute ?? sources.map(snapshotMinute).find((value) => value !== null) ?? null;
  const kind = statusKind(raw);
  if (kind === 'finished') return { raw, kind, label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  if (kind === 'halftime') return { raw, kind, label: 'استراحة بين الشوطين', shortLabel: 'استراحة', minute: null, isLive: false, isFinished: false, isScheduled: false };
  if (kind === 'live') {
    const phase = raw === '1H' ? 'الشوط الأول' : raw === '2H' ? 'الشوط الثاني' : raw === 'ET' ? 'وقت إضافي' : 'مباشرة الآن';
    const minuteLabel = minute ? `د${Math.floor(minute).toLocaleString('ar-EG')}` : '';
    return { raw, kind, label: minute ? `${phase} — ${minuteLabel}` : phase, shortLabel: minute ? `${phase} ${minuteLabel}` : phase, minute: minute ? Math.floor(minute) : null, isLive: true, isFinished: false, isScheduled: false };
  }
  const startMs = new Date(match.matchDate || '').getTime();
  if (Number.isFinite(startMs) && Date.now() > startMs + 5 * 60_000 && kind === 'scheduled') {
    return { raw, kind: 'delayed', label: 'بانتظار تأكيد البداية', shortLabel: 'تأخر البدء', minute: null, isLive: false, isFinished: false, isScheduled: false };
  }
  return { raw, kind: 'scheduled', label: 'لم تبدأ', shortLabel: 'لم تبدأ', minute: null, isLive: false, isFinished: false, isScheduled: true };
}

export function eventMinuteLabel(event: any) {
  const detail = String(event?.detail || '');
  const stoppage = detail.match(/(?:د|minute|min)?\s*(45|90|105)\s*\+\s*(\d+)/i);
  if (stoppage) return `د${Number(stoppage[1]).toLocaleString('ar-EG')}+${Number(stoppage[2]).toLocaleString('ar-EG')}`;
  return event.minute !== null && event.minute !== undefined ? `د${Number(event.minute).toLocaleString('ar-EG')}` : '—';
}

export function eventIcon(type?: string | null) {
  const value = normalizeStatusValue(type);
  if (value.includes('GOAL')) return '⚽';
  if (value.includes('YELLOW')) return '🟨';
  if (value.includes('RED')) return '🟥';
  if (value.includes('SUB')) return '🔁';
  if (value.includes('VAR')) return '📺';
  if (value.includes('PEN')) return '🎯';
  if (value.includes('SAVE')) return '🧤';
  if (value.includes('CORNER')) return '🚩';
  if (value.includes('SHOT') || value.includes('CHANCE')) return '🎯';
  return '•';
}

export function buildEventView(event: any): MatchEventView {
  return {
    id: event.id,
    minute: event.minute ?? null,
    minuteLabel: eventMinuteLabel(event),
    type: event.type || 'note',
    icon: eventIcon(event.type),
    teamId: event.teamId || null,
    playerName: event.playerName || null,
    detail: event.detail || 'حدث مباراة',
    sourceName: event.sourceName || null,
    sourceUrl: event.sourceUrl || null,
  };
}

export function buildSourceList(snapshots: any[]): MatchSourceView[] {
  const byKey = new Map<string, MatchSourceView>();
  for (const snapshot of snapshots) {
    const key = providerKey(snapshot);
    const priority = providerPriority(snapshot);
    const previous = byKey.get(key);
    if (previous && previous.priority <= priority) continue;
    byKey.set(key, {
      key,
      name: providerName(snapshot),
      status: priority <= 3 ? 'active' : 'fallback',
      priority,
      lastCheckedAt: snapshot.capturedAt ? new Date(snapshot.capturedAt).toISOString() : null,
      details: snapshot.minute ? `آخر دقيقة مسجلة: ${Number(snapshot.minute).toLocaleString('ar-EG')}` : null,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.priority - b.priority);
}

export function metricDefinitions() {
  return [
    ['possession', 'الاستحواذ', 'homePossession', 'awayPossession', '%'],
    ['attacks', 'الهجمات', 'homeAttacks', 'awayAttacks', ''],
    ['dangerousAttacks', 'الهجمات الخطيرة', 'homeDangerousAttacks', 'awayDangerousAttacks', ''],
    ['shots', 'التسديدات', 'homeShots', 'awayShots', ''],
    ['shotsOnTarget', 'على المرمى', 'homeShotsOnTarget', 'awayShotsOnTarget', ''],
    ['shotsOffTarget', 'خارج المرمى', 'homeShotsOffTarget', 'awayShotsOffTarget', ''],
    ['corners', 'الركنيات', 'homeCorners', 'awayCorners', ''],
    ['yellowCards', 'بطاقات صفراء', 'homeYellowCards', 'awayYellowCards', ''],
    ['redCards', 'بطاقات حمراء', 'homeRedCards', 'awayRedCards', ''],
    ['fouls', 'الأخطاء', 'homeFouls', 'awayFouls', ''],
    ['offsides', 'التسللات', 'homeOffsides', 'awayOffsides', ''],
    ['xg', 'الأهداف المتوقعة xG', 'homeXg', 'awayXg', ''],
    ['npxg', 'الأهداف المتوقعة بدون ركلات جزاء npxG', 'homeNpxg', 'awayNpxg', ''],
    ['bigChances', 'الفرص الكبيرة', 'homeBigChances', 'awayBigChances', ''],
  ] as const;
}
