import type { MatchEventView, MatchScore, MatchSourceView, MatchStatMetric, MatchStatusKind, MatchStatusView } from './types';

export const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED'];
export const LIVE_STATUSES = ['IN_PLAY', 'LIVE', '1H', '2H', 'ET', 'BT', 'P'];
export const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME', 'PAUSED'];
export const SCHEDULED_STATUSES = ['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'];

const FINAL_MINUTE_FALLBACK = 120;
const BAD_GROUP_KEYS = ['STAGE', 'GROUP', 'GROUPS', 'GROUP STAGE', 'GROUP_STAGE', 'UNKNOWN', 'NULL', 'N/A'];
type Pair = { home: number | null; away: number | null; source?: string } | null;
type StatusCandidate = { status: string; minute: number | null; priority: number; capturedAt: number; sourceKey: string };

const STAT_ALIASES: Record<string, string[]> = {
  possession: ['possession', 'ball_possession', 'ballPossession'],
  shots: ['shots', 'total_shots', 'totalShots'],
  shotsOnTarget: ['shotsOnTarget', 'shots_on_target', 'on_target_shots', 'shotsOnGoal'],
  shotsOffTarget: ['shotsOffTarget', 'shots_off_target', 'off_target_shots', 'shotsOffGoal', 'shots_wide'],
  blockedShots: ['blockedShots', 'blocked_shots', 'shots_blocked'],
  shotsInsideBox: ['shotsInsideBox', 'shots_inside_box'],
  shotsOutsideBox: ['shotsOutsideBox', 'shots_outside_box'],
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
  passes: ['passes', 'total_passes'],
  accuratePasses: ['accuratePasses', 'accurate_passes'],
  tackles: ['tackles'],
  saves: ['saves', 'goalkeeper_saves', 'goalkeeperSaves'],
  goalkeeperSaves: ['goalkeeperSaves', 'goalkeeper_saves', 'saves'],
  interceptions: ['interceptions'],
  clearances: ['clearances'],
  ballRecoveries: ['ballRecoveries', 'ball_recoveries'],
};

export function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}
export function asObject(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}; }
export function normalizeStatusValue(value?: string | null) { return String(value || '').trim().toUpperCase(); }
export function normalizeGroupKey(value?: string | null) { const raw = String(value || '').trim(); if (!raw || raw.toLowerCase() === 'group') return null; const cleaned = raw.replace(/^group[_\s-]*/i, '').replace(/^المجموعة\s*/i, '').replace(/[_-]+/g, ' ').trim().toUpperCase(); if (!cleaned || BAD_GROUP_KEYS.includes(cleaned)) return null; return cleaned; }
export function groupLabel(value?: string | null) { const key = normalizeGroupKey(value); return key ? `المجموعة ${key}` : null; }
export function stageLabel(stage?: string | null, groupPhase?: string | null) { const group = groupLabel(groupPhase); if (group) return group; const value = String(stage || '').trim(); const normalized = value.toUpperCase(); if (!value || BAD_GROUP_KEYS.includes(normalized) || normalized === 'GROUP') return 'مرحلة المجموعات'; if (normalized.includes('ROUND') && normalized.includes('32')) return 'دور الـ32'; if (normalized.includes('ROUND') && normalized.includes('16')) return 'دور الـ16'; if (normalized.includes('QUARTER')) return 'ربع النهائي'; if (normalized.includes('SEMI')) return 'نصف النهائي'; if (normalized.includes('FINAL') && normalized.includes('THIRD')) return 'تحديد المركز الثالث'; if (normalized.includes('FINAL')) return 'النهائي'; return value.replace(/[_-]+/g, ' '); }
export function providerName(snapshot: any) { const provider = normalizeStatusValue(snapshot?.provider); if (provider.includes('THE_STATS')) return 'TheStats'; if (provider.includes('ISPORT')) return 'iSport'; if (snapshot) return 'قاعدة البيانات'; return ''; }
export function providerKey(snapshot: any) { const provider = normalizeStatusValue(snapshot?.provider); if (provider.includes('THE_STATS') && provider.includes('LIVE')) return 'the-stats-live'; if (provider.includes('THE_STATS')) return 'the-stats'; if (provider.includes('ISPORTS_FLASH')) return 'isports-flash'; if (provider.includes('ISPORTS_REMOTE_LIVE')) return 'isports-remote-live'; if (provider.includes('ISPORTS_TIMELINE')) return 'isports-timeline'; if (provider.includes('ISPORT')) return 'isports-animation'; return snapshot ? `snapshot-${snapshot.id || 'db'}` : 'missing'; }
export function providerPriority(snapshot: any) { const key = providerKey(snapshot); if (key === 'the-stats-live') return 1; if (key === 'the-stats') return 2; if (key === 'isports-flash') return 3; if (key === 'isports-remote-live') return 4; if (key === 'isports-timeline') return 5; if (key === 'isports-animation') return 6; return 9; }
export function buildSourceList(sources: any[]): MatchSourceView[] { const rows = new Map<string, MatchSourceView>(); const sorted = [...(sources || [])].sort((a, b) => providerPriority(a) - providerPriority(b) || new Date(b?.capturedAt || 0).getTime() - new Date(a?.capturedAt || 0).getTime()); sorted.forEach((snapshot, index) => { const key = providerKey(snapshot); if (!snapshot || rows.has(key)) return; const rawProvider = String(snapshot?.provider || '').trim(); rows.set(key, { key, name: providerName(snapshot) || rawProvider || 'مصدر غير معروف', status: index === 0 ? 'active' : 'fallback', priority: providerPriority(snapshot), lastCheckedAt: snapshot?.capturedAt ? new Date(snapshot.capturedAt).toISOString() : null, details: rawProvider || null }); }); return Array.from(rows.values()).sort((a, b) => a.priority - b.priority); }
export function rawData(snapshot: any) { return asObject(snapshot?.rawData); }
export function rawStats(snapshot: any) { const data = rawData(snapshot); const nested = asObject(data.theStatsApi); const liveStatsPayload = asObject(data.liveStats?.data || data.liveStats); const normalizedStats = asObject(data.normalized?.liveStats?.stats); return { ...asObject(nested.providerStats), ...asObject(nested.stats), ...asObject(liveStatsPayload.providerStats), ...asObject(liveStatsPayload.stats), ...asObject(liveStatsPayload.overview), ...normalizedStats, ...asObject(data.providerStats), ...asObject(data.stats) }; }

function pairFromValue(value: any, source: string): Pair { const stat = asObject(value); const all = asObject(stat.all); const home = toNumber(stat.home ?? stat.home_value ?? stat.homeValue ?? all.home); const away = toNumber(stat.away ?? stat.away_value ?? stat.awayValue ?? all.away); return home === null && away === null ? null : { home, away, source }; }
function statPair(snapshot: any, homeKey: string, awayKey: string, statKey: string): Pair { const stats = rawStats(snapshot); const aliases = STAT_ALIASES[statKey] || [statKey]; for (const alias of aliases) { const direct = pairFromValue(stats[alias], providerName(snapshot)); if (direct) return direct; } const home = aliases.map((alias) => toNumber(stats[homeKey] ?? stats[`home_${alias}`] ?? stats[`${alias}_home`] ?? stats[`${alias}Home`])).find((v) => v !== null) ?? null; const away = aliases.map((alias) => toNumber(stats[awayKey] ?? stats[`away_${alias}`] ?? stats[`${alias}_away`] ?? stats[`${alias}Away`])).find((v) => v !== null) ?? null; return home === null && away === null ? null : { home, away, source: providerName(snapshot) }; }
export function buildStatMetric(sources: any[], key: string, label: string, homeKey: string, awayKey: string, suffix = ''): MatchStatMetric { const pair = sources.map((snapshot) => statPair(snapshot, homeKey, awayKey, key)).find(Boolean) as Pair; return { key, label, home: pair?.home ?? null, away: pair?.away ?? null, suffix, source: pair?.source || '', available: pair !== null }; }
export function metricDefinitions(): Array<[string, string, string, string, string?]> { return [
  ['possession', 'الاستحواذ', 'homePossession', 'awayPossession', '%'],
  ['xg', 'الأهداف المتوقعة xG', 'homeXg', 'awayXg'],
  ['npxg', 'xG بدون ركلات جزاء', 'homeNpxg', 'awayNpxg'],
  ['bigChances', 'فرص كبيرة', 'homeBigChances', 'awayBigChances'],
  ['shots', 'التسديدات', 'homeShots', 'awayShots'],
  ['shotsOnTarget', 'على المرمى', 'homeShotsOnTarget', 'awayShotsOnTarget'],
  ['shotsOffTarget', 'خارج المرمى', 'homeShotsOffTarget', 'awayShotsOffTarget'],
  ['blockedShots', 'تسديدات محجوبة', 'homeBlockedShots', 'awayBlockedShots'],
  ['shotsInsideBox', 'تسديدات داخل المنطقة', 'homeShotsInsideBox', 'awayShotsInsideBox'],
  ['shotsOutsideBox', 'تسديدات خارج المنطقة', 'homeShotsOutsideBox', 'awayShotsOutsideBox'],
  ['corners', 'الركنيات', 'homeCorners', 'awayCorners'],
  ['fouls', 'الأخطاء', 'homeFouls', 'awayFouls'],
  ['offsides', 'التسللات', 'homeOffsides', 'awayOffsides'],
  ['yellowCards', 'بطاقات صفراء', 'homeYellowCards', 'awayYellowCards'],
  ['redCards', 'بطاقات حمراء', 'homeRedCards', 'awayRedCards'],
  ['passes', 'التمريرات', 'homePasses', 'awayPasses'],
  ['accuratePasses', 'تمريرات صحيحة', 'homeAccuratePasses', 'awayAccuratePasses'],
  ['tackles', 'تدخلات', 'homeTackles', 'awayTackles'],
  ['interceptions', 'اعتراضات', 'homeInterceptions', 'awayInterceptions'],
  ['clearances', 'تشتيت الكرة', 'homeClearances', 'awayClearances'],
  ['ballRecoveries', 'استرجاع الكرة', 'homeBallRecoveries', 'awayBallRecoveries'],
  ['saves', 'تصديات الحارس', 'homeSaves', 'awaySaves'],
  ['attacks', 'الهجمات', 'homeAttacks', 'awayAttacks'],
  ['dangerousAttacks', 'هجمات خطيرة', 'homeDangerousAttacks', 'awayDangerousAttacks'],
]; }

function snapshotMinute(snapshot: any) { const data = rawData(snapshot); const flashMeta = asObject(data.flashMeta); const nestedFlashMeta = asObject(data.flash?.meta); const meta = asObject(data.meta); return toNumber(snapshot?.minute ?? data.minute ?? flashMeta.elapsed ?? flashMeta.minute ?? nestedFlashMeta.elapsed ?? meta.elapsed ?? meta.minute); }
function statusFromProviderValue(value: unknown, minute: number | null) { const raw = normalizeStatusValue(String(value || '')); if (!raw && minute !== null) return minute >= 46 ? '2H' : '1H'; if (['FIRST_HALF', 'FIRST', '1ST_HALF'].includes(raw)) return '1H'; if (['SECOND_HALF', 'SECOND', '2ND_HALF'].includes(raw)) return '2H'; if (raw.includes('HALF') && raw.includes('TIME')) return 'HT'; if (raw.includes('FINISH') || raw === 'FT' || raw === 'ENDED' || raw === 'COMPLETED') return 'FINISHED'; if (raw === 'LIVE' || raw === 'IN_PLAY') return minute && minute >= 46 ? '2H' : '1H'; return raw || null; }
function statusCandidate(snapshot: any): StatusCandidate | null { const data = rawData(snapshot); const flashMeta = asObject(data.flashMeta); const nestedFlashMeta = asObject(data.flash?.meta); const meta = asObject(data.meta); const minute = snapshotMinute(snapshot); const rawStatus = data.status ?? data.providerStatus ?? data.matchState ?? flashMeta.matchState ?? nestedFlashMeta.matchState ?? meta.status ?? meta.matchState; const status = statusFromProviderValue(rawStatus, minute); if (!status) return null; return { status, minute, priority: providerPriority(snapshot), capturedAt: snapshot?.capturedAt ? new Date(snapshot.capturedAt).getTime() : 0, sourceKey: providerKey(snapshot) }; }
export function statusFromSnapshots(sources: any[]) { const candidates = sources.map(statusCandidate).filter(Boolean) as StatusCandidate[]; const flash = candidates.filter((candidate) => candidate.sourceKey === 'isports-flash').sort((a, b) => b.capturedAt - a.capturedAt)[0]; if (flash && ['HT', 'FINISHED', '2H', '1H', 'PEN'].includes(flash.status)) return { status: flash.status, minute: flash.minute }; const best = candidates.sort((a, b) => a.priority - b.priority || b.capturedAt - a.capturedAt)[0]; return best ? { status: best.status, minute: best.minute } : null; }
export function scoreFromSnapshot(snapshot: any): MatchScore | null { if (!snapshot) return null; const data = rawData(snapshot); const counts = asObject(data.counts); const meta = asObject(data.meta); const flashMeta = asObject(data.flashMeta); const finalScore = asObject(data.normalized?.matchInfo?.finalScore); const home = toNumber(snapshot.homeScore ?? data.homeScore ?? data.home_goals ?? finalScore.home ?? flashMeta.homeScore ?? meta.home_goals ?? counts.homeScore); const away = toNumber(snapshot.awayScore ?? data.awayScore ?? data.away_goals ?? finalScore.away ?? flashMeta.awayScore ?? meta.away_goals ?? counts.awayScore); if (home === null && away === null) return null; return { home, away, source: providerName(snapshot) }; }
export function scoreForDisplay(match: any, sources: any[]): MatchScore { const matchHome = toNumber(match.homeScore); const matchAway = toNumber(match.awayScore); const matchScore: MatchScore = { home: matchHome, away: matchAway, source: 'قاعدة المباراة' }; const matchTotal = Number(matchHome || 0) + Number(matchAway || 0); const snapshotScore = sources.map(scoreFromSnapshot).find(Boolean) || null; const snapshotTotal = Number(snapshotScore?.home || 0) + Number(snapshotScore?.away || 0); if (snapshotScore && snapshotTotal >= matchTotal) return snapshotScore; if (matchHome !== null || matchAway !== null) return matchScore; return snapshotScore || { home: null, away: null, source: '' }; }

function statusKind(status: string): MatchStatusKind { const value = normalizeStatusValue(status); if (FINISHED_STATUSES.includes(value)) return 'finished'; if (HALF_TIME_STATUSES.includes(value)) return 'halftime'; if (LIVE_STATUSES.includes(value)) return 'live'; if (SCHEDULED_STATUSES.includes(value)) return 'scheduled'; return 'delayed'; }
function elapsedMinuteFromKickoff(match: any) { const startMs = new Date(match.matchDate || '').getTime(); if (!Number.isFinite(startMs)) return null; const elapsed = Math.floor((Date.now() - startMs) / 60_000); if (!Number.isFinite(elapsed) || elapsed < 0) return null; return Math.max(1, Math.min(FINAL_MINUTE_FALLBACK + 10, elapsed)); }
function safeLiveMinute(match: any, rawStatus: string, rawMinute: number | null) { const minute = rawMinute === null || rawMinute === undefined ? null : Math.floor(minute as never); }
