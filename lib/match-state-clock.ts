type MatchLike = {
  status?: unknown;
  minute?: unknown;
  elapsed?: unknown;
  currentMinute?: unknown;
};

type SnapshotLike = {
  status?: unknown;
  minute?: unknown;
  elapsed?: unknown;
  time?: unknown;
  provider?: unknown;
  capturedAt?: unknown;
  rawData?: unknown;
};

type MatchClockKind = 'scheduled' | 'finished' | 'halftime' | 'live' | 'delayed';

type MatchClockView = {
  raw: string;
  state: string;
  kind: MatchClockKind;
  label: string;
  shortLabel: string;
  minute: number | null;
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace('%', '').trim() : value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeMatchState(value: unknown, minute: number | null = null) {
  const objectValue = asObject(value);
  const raw = String(objectValue.short || objectValue.status || objectValue.name || objectValue.long || value || '').trim().toUpperCase();
  if (!raw && minute !== null) return minute >= 46 ? '2H' : '1H';
  if (raw === 'FIRST_HALF' || raw === 'FIRST' || raw === '1ST_HALF') return '1H';
  if (raw === 'SECOND_HALF' || raw === 'SECOND' || raw === '2ND_HALF') return '2H';
  if (raw === 'HT' || raw === 'HALFTIME' || raw === 'HALF_TIME' || raw === 'HALF-TIME' || raw === 'PAUSED' || raw === 'BREAK' || raw === 'INTERVAL') return 'HT';
  if (raw.includes('FINISH') || raw === 'FT' || raw === 'COMPLETED' || raw === 'ENDED' || raw === 'FULL_TIME') return 'FINISHED';
  if (raw === 'LIVE' || raw === 'IN_PLAY') return minute && minute >= 46 ? '2H' : '1H';
  return raw;
}

function snapshotMinute(snapshot: SnapshotLike) {
  const raw = asObject(snapshot.rawData);
  const state = asObject(raw.state);
  const meta = asObject(raw.meta);
  const fixtureStatus = asObject(asObject(raw.fixture).status);
  return toNumber(snapshot.minute ?? snapshot.elapsed ?? snapshot.time ?? raw.minute ?? raw.elapsed ?? raw.currentMinute ?? state.minute ?? state.elapsed ?? meta.minute ?? meta.elapsed ?? fixtureStatus.elapsed);
}

function snapshotState(snapshot: SnapshotLike) {
  const raw = asObject(snapshot.rawData);
  const state = asObject(raw.state);
  const meta = asObject(raw.meta);
  const fixtureStatus = asObject(asObject(raw.fixture).status);
  const minute = snapshotMinute(snapshot);
  return normalizeMatchState(snapshot.status ?? raw.state ?? state.short ?? state.status ?? state.name ?? raw.status ?? raw.providerStatus ?? raw.matchState ?? meta.status ?? fixtureStatus.short ?? fixtureStatus.long, minute);
}

function providerPriority(snapshot: SnapshotLike) {
  const provider = String(snapshot.provider || '').toUpperCase();
  if (provider.includes('THE_STATS') && provider.includes('LIVE')) return 1;
  if (provider.includes('THE_STATS')) return 2;
  if (provider.includes('ISPORTS')) return 3;
  return 9;
}

function view(state: string, rest: Omit<MatchClockView, 'state' | 'raw'>): MatchClockView {
  return { raw: state, state, ...rest };
}

function baseView(): MatchClockView {
  return { raw: '', state: '', kind: 'scheduled', label: '', shortLabel: '', minute: null, isLive: false, isFinished: false, isScheduled: false };
}

export function getProviderMatchClock(match: MatchLike, snapshots: SnapshotLike[] = []) {
  const candidates = snapshots
    .map((snapshot) => ({ state: snapshotState(snapshot), minute: snapshotMinute(snapshot), priority: providerPriority(snapshot), capturedAt: snapshot.capturedAt ? new Date(String(snapshot.capturedAt)).getTime() : 0 }))
    .filter((item) => item.state)
    .sort((a, b) => a.priority - b.priority || b.capturedAt - a.capturedAt);

  const stopState = candidates.find((item) => item.state === 'HT' || item.state === 'FINISHED');
  const best = stopState || candidates[0];
  const matchMinute = toNumber(match.minute ?? match.elapsed ?? match.currentMinute);
  const state = best?.state || normalizeMatchState(match.status, matchMinute) || 'SCHEDULED';
  const minute = best?.minute ?? matchMinute;

  if (state === 'FINISHED') return view(state, { kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false });
  if (state === 'HT') return view(state, { kind: 'halftime', label: 'استراحة بين الشوطين', shortLabel: 'استراحة', minute: null, isLive: false, isFinished: false, isScheduled: false });
  if (state === '1H' || state === '2H' || state === 'ET' || state === 'LIVE' || state === 'IN_PLAY') {
    const safeMinute = minute !== null && minute !== undefined ? Math.floor(minute) : null;
    const phase = state === '1H' ? 'الشوط الأول' : state === '2H' ? 'الشوط الثاني' : state === 'ET' ? 'وقت إضافي' : 'مباشرة الآن';
    const minuteLabel = safeMinute && safeMinute > 0 ? `د${safeMinute.toLocaleString('ar-EG')}` : '';
    return view(state, { kind: 'live', label: minuteLabel ? `${phase} — ${minuteLabel}` : phase, shortLabel: minuteLabel ? `${phase} ${minuteLabel}` : phase, minute: minuteLabel ? safeMinute : null, isLive: true, isFinished: false, isScheduled: false });
  }
  if (state === 'SCHEDULED' || state === 'TIMED' || state === 'NOT_STARTED' || state === 'NS') return view(state, { kind: 'scheduled', label: 'لم تبدأ', shortLabel: 'لم تبدأ', minute: null, isLive: false, isFinished: false, isScheduled: true });
  return view(state, { kind: 'delayed', label: state || 'بانتظار تحديث الحالة', shortLabel: state || 'تحديث الحالة', minute: null, isLive: false, isFinished: false, isScheduled: false });
}
