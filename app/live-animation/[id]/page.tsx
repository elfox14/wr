import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import LiveAnimationPitch from '@/components/live-animation/LiveAnimationPitch';
import { getTeamVisualTheme } from '@/lib/teamVisualThemes';
import { withTeamDisplay } from '@/lib/teamDisplay';
import { animationEventLabel, inferLiveAnimationSpatial, normalizeAnimationEventType, type AnimationTeamSide } from '@/lib/liveAnimationSpatial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { params: Promise<{ id: string }> };
type MetricView = { key: string; label: string; home: number | null; away: number | null; suffix?: string; available: boolean };

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'ET', 'P', 'PAUSED'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'BREAK'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];
const KICKOFF_GRACE_MINUTES = 3;
const SOFT_LIVE_MAX_MINUTES = 140;
const METRIC_DEFS: Array<[string, string, string?]> = [
  ['possession', 'الاستحواذ', '%'], ['xg', 'الأهداف المتوقعة xG'], ['npxg', 'xG بدون ركلات جزاء'], ['bigChances', 'فرص كبيرة'],
  ['shots', 'التسديدات'], ['shotsOnTarget', 'على المرمى'], ['shotsOffTarget', 'خارج المرمى'], ['blockedShots', 'تسديدات محجوبة'], ['shotsInsideBox', 'داخل المنطقة'], ['shotsOutsideBox', 'خارج المنطقة'],
  ['corners', 'الركنيات'], ['fouls', 'الأخطاء'], ['offsides', 'التسللات'], ['yellowCards', 'بطاقات صفراء'], ['redCards', 'بطاقات حمراء'],
  ['passes', 'التمريرات'], ['accuratePasses', 'تمريرات صحيحة'], ['tackles', 'تدخلات'], ['interceptions', 'اعتراضات'], ['clearances', 'تشتيت'], ['ballRecoveries', 'استرجاع الكرة'], ['saves', 'تصديات الحارس'],
  ['attacks', 'الهجمات'], ['dangerousAttacks', 'هجمات خطيرة'],
];
const COLUMN_KEYS: Record<string, [string, string]> = {
  possession: ['homePossession', 'awayPossession'], attacks: ['homeAttacks', 'awayAttacks'], dangerousAttacks: ['homeDangerousAttacks', 'awayDangerousAttacks'],
  shots: ['homeShots', 'awayShots'], shotsOnTarget: ['homeShotsOnTarget', 'awayShotsOnTarget'], shotsOffTarget: ['homeShotsOffTarget', 'awayShotsOffTarget'],
  corners: ['homeCorners', 'awayCorners'], yellowCards: ['homeYellowCards', 'awayYellowCards'], redCards: ['homeRedCards', 'awayRedCards'], saves: ['homeSaves', 'awaySaves'],
};

function safeNumber(value: any, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function toNullableNumber(value: any) { if (value === null || value === undefined || value === '') return null; const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value); return Number.isFinite(number) ? number : null; }
function asObject(value: any): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function rawData(snapshot: any) { return asObject(snapshot?.rawData); }
function baseStatusKind(status?: string | null) { const raw = String(status || '').toUpperCase(); if (FINISHED_STATUSES.includes(raw)) return 'finished'; if (HALF_TIME_STATUSES.includes(raw)) return 'halftime'; if (LIVE_STATUSES.includes(raw)) return 'live'; return 'scheduled'; }
function estimatedElapsed(matchDate: any) { const start = new Date(matchDate).getTime(); if (!Number.isFinite(start)) return null; return Math.floor((Date.now() - start) / 60000); }
function firstStateValue(value: any): string | null { const raw = String(value ?? '').trim(); return raw ? raw : null; }
function providerStateFromSnapshot(snapshot: any) { const raw = rawData(snapshot); const rawPayload = raw.raw; const objects = [raw, asObject(raw.stats), asObject(rawPayload), asObject(rawPayload?.data), asObject(rawPayload?.result), asObject(rawPayload?.fixture?.status), asObject(rawPayload?.response?.[0]), asObject(rawPayload?.response?.[0]?.fixture?.status)]; for (const obj of objects) { const value = firstStateValue(obj.state ?? obj.matchState ?? obj.match_state ?? obj.providerState ?? obj.provider_status ?? obj.status ?? obj.short ?? obj.long ?? obj.elapsed); if (value) return value; } if (Array.isArray(rawPayload?.data)) for (const item of rawPayload.data) { const value = providerStateFromSnapshot({ rawData: { raw: item } }); if (value) return value; } if (Array.isArray(rawPayload?.response)) for (const item of rawPayload.response) { const value = providerStateFromSnapshot({ rawData: { raw: item } }); if (value) return value; } return null; }
function phaseFromProviderState(value: string | null) { const raw = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_'); if (!raw) return null; if (['FT', 'FINISHED', 'COMPLETED', 'ENDED', 'AET', 'PEN', '-1', '8', '10'].includes(raw) || raw.includes('ENDED') || raw.includes('FINISHED')) return 'finished'; if (['HT', 'HALFTIME', 'HALF_TIME', 'BREAK', '3'].includes(raw) || raw.includes('HALF')) return 'halftime'; if (['LIVE', 'IN_PLAY', '1H', 'FIRST_HALF', '2H', 'SECOND_HALF', 'ET', 'P', '1', '2'].includes(raw) || raw.includes('LIVE') || raw.includes('PLAY') || raw.includes('FIRST') || raw.includes('SECOND')) return 'live'; if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS', '0'].includes(raw) || raw.includes('NOT_STARTED') || raw.includes('SCHEDULED')) return 'scheduled'; if (/^\d+$/.test(raw) && Number(raw) > 0) return 'live'; return null; }
function minuteFromProviderState(value: string | null) { const raw = String(value || ''); const plus = raw.match(/(\d{1,3})\s*\+\s*(\d{1,2})/); if (plus) return Math.min(130, Number(plus[1]) + Number(plus[2])); const minute = raw.match(/(?:^|[^\d])(\d{1,3})(?:'|m|min|minute|د|$)/i); if (!minute) return null; const n = Number(minute[1]); return Number.isFinite(n) && n > 0 ? Math.min(130, n) : null; }
function softPhase(match: any, latestSnapshot?: any) { const state = providerStateFromSnapshot(latestSnapshot); const fromState = phaseFromProviderState(state); if (fromState && fromState !== 'scheduled') return fromState; const base = baseStatusKind(match.status); if (base !== 'scheduled') return base; if (toNullableNumber(latestSnapshot?.minute) && Number(latestSnapshot.minute) > 0) return 'live'; if (fromState === 'scheduled') return 'scheduled'; const elapsed = estimatedElapsed(match.matchDate); if (elapsed !== null && elapsed >= -KICKOFF_GRACE_MINUTES && elapsed <= SOFT_LIVE_MAX_MINUTES) return 'live'; return 'scheduled'; }
function inferredMinute(match: any, latestSnapshot: any, phase: string) { const snapshotMinute = toNullableNumber(latestSnapshot?.minute); if (snapshotMinute !== null && snapshotMinute > 0) return snapshotMinute; const stateMinute = minuteFromProviderState(providerStateFromSnapshot(latestSnapshot)); if (stateMinute !== null) return stateMinute; if (phase !== 'live') return null; const elapsed = estimatedElapsed(match.matchDate); if (elapsed === null) return 1; return Math.max(1, Math.min(130, elapsed)); }
function isTheStatsSnapshot(snapshot: any) { const p = String(snapshot?.provider || '').toUpperCase(); const raw = rawData(snapshot); return p.includes('THE_STATS') || String(raw.provider || '').toUpperCase().includes('THE_STATS'); }
function isISportsSnapshot(snapshot: any) { const p = String(snapshot?.provider || '').toUpperCase(); return p.includes('ISPORT') || p.includes('AUTOMATED_LIVE_INGEST') || p.includes('WORKER_ISPORTS'); }
function latestTheStatsSnapshot(snapshots: any[]) { return snapshots.find((snapshot) => isTheStatsSnapshot(snapshot) && rawData(snapshot)?.normalized) || snapshots.find(isTheStatsSnapshot) || null; }
function latestISportsSnapshot(snapshots: any[]) { return snapshots.find(isISportsSnapshot) || null; }
function statPairFromSnapshot(snapshot: any, key: string) { if (!snapshot) return null; const pair = asObject(rawData(snapshot)?.normalized?.liveStats?.stats?.[key]); let home = toNullableNumber(pair.home); let away = toNullableNumber(pair.away); const columns = COLUMN_KEYS[key]; if (columns) { home ??= toNullableNumber(snapshot[columns[0]]); away ??= toNullableNumber(snapshot[columns[1]]); } if (home === null && away === null) return null; return { home, away }; }
function buildMetrics(snapshots: any[], finished: boolean): MetricView[] { const theStats = latestTheStatsSnapshot(snapshots); const iSports = latestISportsSnapshot(snapshots); return METRIC_DEFS.map(([key, label, suffix]) => { const primary = key === 'attacks' || key === 'dangerousAttacks' ? null : statPairFromSnapshot(theStats, key); const fallback = statPairFromSnapshot(iSports, key); const pair = primary || fallback; return { key, label, home: pair?.home ?? null, away: pair?.away ?? null, suffix, available: Boolean(pair) }; }).filter((metric) => metric.available); }
function icon(type: string) { const key = String(type || '').toLowerCase(); if (key.includes('goal')) return '⚽'; if (key.includes('yellow')) return '🟨'; if (key.includes('red')) return '🟥'; if (key.includes('sub')) return '🔁'; if (key.includes('shot')) return '🎯'; if (key.includes('corner')) return '🚩'; if (key.includes('penalty')) return '🥅'; if (key.includes('var')) return '📺'; return '●'; }
function color(type: string) { const key = String(type || '').toLowerCase(); if (key.includes('goal')) return '#F8C846'; if (key.includes('red')) return '#FF5C5C'; if (key.includes('yellow')) return '#F8C846'; if (key.includes('shot')) return '#18E58F'; if (key.includes('corner')) return '#A78BFA'; return '#E5E7EB'; }
function sideFromTeam(teamId: string | null | undefined, homeTeamId: string, awayTeamId: string): AnimationTeamSide { if (teamId === homeTeamId) return 'home'; if (teamId === awayTeamId) return 'away'; return 'unknown'; }
function teamIdFromName(teamName: any, home: any, away: any) { const name = String(teamName || '').toLowerCase(); if (!name) return null; if (name.includes(String(home?.name || '').toLowerCase()) || String(home?.name || '').toLowerCase().includes(name)) return home.id; if (name.includes(String(away?.name || '').toLowerCase()) || String(away?.name || '').toLowerCase().includes(name)) return away.id; return null; }
function normalizeEvent(row: any, index: number, homeTeamId: string, awayTeamId: string) { const eventType = String(row.eventType || row.type || 'note'); const teamSide = sideFromTeam(row.teamId, homeTeamId, awayTeamId); const spatial = inferLiveAnimationSpatial({ id: String(row.id || `event-${index}`), type: eventType, detail: row.detail || row.eventLabel, minute: row.minute, teamSide, index, explicitX: row.x, explicitY: row.y, explicitEndX: row.endX, explicitEndY: row.endY }); return { id: String(row.id || `event-${index}`), sequenceNumber: safeNumber(row.sequenceNumber, safeNumber(row.minute, index + 1) * 100 + index + 1), minute: row.minute ?? null, second: row.second ?? null, teamId: row.teamId || null, playerId: row.playerId || null, playerName: row.playerName || null, jerseyNumber: row.jerseyNumber || null, eventType, eventLabel: row.eventLabel || animationEventLabel(eventType), detail: row.detail || row.eventLabel || animationEventLabel(eventType), x: row.x ?? spatial.x, y: row.y ?? spatial.y, endX: row.endX ?? spatial.endX, endY: row.endY ?? spatial.endY, zone: row.zone || spatial.zone, coordinateSource: row.coordinateSource || spatial.coordinateSource, coordinateConfidence: row.coordinateConfidence || spatial.coordinateConfidence, eventSide: row.eventSide || spatial.eventSide, isInferred: row.isInferred === null || row.isInferred === undefined ? spatial.isInferred : Boolean(row.isInferred), anchorZone: row.anchorZone || spatial.anchorZone, displayPriority: safeNumber(row.displayPriority, spatial.displayPriority), provider: row.provider || row.sourceName || 'MATCH_EVENT_FALLBACK', icon: icon(eventType), color: color(eventType), createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString() }; }
function eventDedupeKey(event: any) { return [event.minute ?? '', String(event.eventType || '').toLowerCase(), event.teamId || '', String(event.playerName || '').toLowerCase(), String(event.detail || '').toLowerCase().slice(0, 90)].join('|'); }
function dedupeEvents(events: any[]) { const seen = new Set<string>(); return events.filter((event) => { const key = eventDedupeKey(event); if (seen.has(key)) return false; seen.add(key); return true; }); }
function theStatsEventsFromSnapshot(snapshot: any, match: any) { const list = rawData(snapshot)?.normalized?.eventsDetailed?.all; if (!Array.isArray(list)) return []; return dedupeEvents(list.map((row: any, index: number) => { const minute = toNullableNumber(row.minute); const teamId = row.teamId || teamIdFromName(row.teamName, match.homeTeam, match.awayTeam); return normalizeEvent({ id: `thestats-${row.sequence ?? index}-${minute ?? 'na'}-${row.type || 'event'}`, sequenceNumber: Math.max(0, Number(minute || 0)) * 100 + index + 1, minute, second: row.second ?? null, teamId, playerId: row.playerId || null, playerName: row.playerName || null, eventType: normalizeAnimationEventType(row.type, row.detail), eventLabel: animationEventLabel(normalizeAnimationEventType(row.type, row.detail)), detail: row.detail || row.type || 'حدث', provider: 'FINAL_EVENTS', coordinateSource: 'INFERRED_ZONE', coordinateConfidence: 'MEDIUM', createdAt: snapshot.capturedAt || new Date() }, index, match.homeTeam.id, match.awayTeam.id); })); }
async function readLiveAnimationRows(matchId: string, homeTeamId: string, awayTeamId: string) { try { const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "LiveAnimationEvent" WHERE "matchId" = $1 ORDER BY "sequenceNumber" ASC LIMIT 160`, matchId); const liveRows = rows.filter((row) => !/THE_STATS|FOOTBALL_DATA|FOOTBALL-DATA/i.test(String(row.provider || ''))); if (liveRows.length) return dedupeEvents(liveRows.map((row, index) => normalizeEvent(row, index, homeTeamId, awayTeamId))); } catch {} const events = await prisma.matchEvent.findMany({ where: { matchId, OR: [{ sourceName: { contains: 'ISPORTS' } }, { sourceName: { contains: 'iSports' } }, { sourceName: { contains: 'Live Monitor' } }, { sourceName: { contains: 'Live Ingest' } }] }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 120 }).catch(() => [] as any[]); return dedupeEvents(events.map((event, index) => normalizeEvent({ ...event, eventType: normalizeAnimationEventType(event.type, event.detail), eventLabel: animationEventLabel(normalizeAnimationEventType(event.type, event.detail)), provider: event.sourceName || 'LIVE_EVENT' }, index, homeTeamId, awayTeamId))); }
function buildClock(match: any, latestSnapshot: any, phase: string) { const minute = inferredMinute(match, latestSnapshot, phase); const providerPhase = phaseFromProviderState(providerStateFromSnapshot(latestSnapshot)); const confirmedMinute = toNullableNumber(latestSnapshot?.minute); const confirmedStart = providerPhase === 'live' || providerPhase === 'halftime' || baseStatusKind(match.status) === 'live' || baseStatusKind(match.status) === 'halftime' || Boolean(confirmedMinute && confirmedMinute > 0); if (phase === 'finished') return { label: 'انتهت المباراة', phaseLabel: 'نهاية المباراة', minute: null, verifiedStarted: true, verifiedFinished: true }; if (phase === 'halftime') return { label: 'استراحة بين الشوطين', phaseLabel: 'نهاية الشوط الأول', minute: 45, verifiedStarted: true, verifiedFinished: false }; if (phase === 'live') { const m = minute || 1; if (m <= 45) return { label: `الشوط الأول · د${m}`, phaseLabel: 'الشوط الأول', minute: m, verifiedStarted: confirmedStart, verifiedFinished: false }; if (m <= 60 && !confirmedMinute) return { label: `استراحة محتملة · د${m}`, phaseLabel: 'بين الشوطين تقديريًا', minute: m, verifiedStarted: confirmedStart, verifiedFinished: false }; if (m <= 90) return { label: `الشوط الثاني · د${m}`, phaseLabel: 'الشوط الثاني', minute: m, verifiedStarted: confirmedStart, verifiedFinished: false }; return { label: `وقت بدل ضائع · د${m}`, phaseLabel: 'وقت بدل ضائع', minute: m, verifiedStarted: confirmedStart, verifiedFinished: false }; } return { label: 'لم تبدأ بعد', phaseLabel: 'قبل المباراة', minute: null, verifiedStarted: false, verifiedFinished: false }; }

async function getInitialState(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: { select: { id: true, name: true, code: true, image: true } }, awayTeam: { select: { id: true, name: true, code: true, image: true } }, statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 12 } } });
  if (!match) return null;
  const snapshots = match.statsSnapshots || [];
  const finalSnapshot = latestTheStatsSnapshot(snapshots);
  const preliminaryLatest = snapshots[0] || null;
  const phase = softPhase(match, preliminaryLatest);
  const latestSnapshot = phase === 'finished' && finalSnapshot ? finalSnapshot : preliminaryLatest;
  const finalEvents = phase === 'finished' && finalSnapshot ? theStatsEventsFromSnapshot(finalSnapshot, match) : [];
  const events = finalEvents.length ? finalEvents : await readLiveAnimationRows(match.id, match.homeTeam.id, match.awayTeam.id);
  const lastSequence = events.reduce((max, event) => Math.max(max, Number(event.sequenceNumber || 0)), 0);
  const homeTeam = withTeamDisplay(match.homeTeam);
  const awayTeam = withTeamDisplay(match.awayTeam);
  const homeTheme = getTeamVisualTheme(homeTeam.code, homeTeam.name);
  const awayTheme = getTeamVisualTheme(awayTeam.code, awayTeam.name);
  const clock = buildClock(match, latestSnapshot, phase);
  return { ok: true, mode: 'db_only_live_animation_state_v4_provider_state_clock', matchId: match.id, title: `${homeTeam.name} ضد ${awayTeam.name}`, phase, status: match.status, minute: clock.minute ?? latestSnapshot?.minute ?? null, clock, score: { home: safeNumber(latestSnapshot?.homeScore ?? match.homeScore, 0), away: safeNumber(latestSnapshot?.awayScore ?? match.awayScore, 0) }, teams: { home: { ...homeTeam, theme: homeTheme }, away: { ...awayTeam, theme: awayTheme } }, visualTheme: { home: homeTheme, away: awayTheme }, stats: buildMetrics(snapshots, phase === 'finished'), lastSequence, events, lastUpdatedAt: latestSnapshot?.capturedAt ? latestSnapshot.capturedAt.toISOString() : new Date().toISOString() };
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
            <p className="mt-1 text-sm font-bold text-slate-400">متابعة حية للزمن والأحداث والإحصائيات من البيانات المحفوظة.</p>
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
