#!/usr/bin/env bash
set -euo pipefail

# Run from repository root: elfox14/wr
if [ ! -f package.json ] || [ ! -d app ] || [ ! -d lib ]; then
  echo "Run this script from the repository root." >&2
  exit 1
fi

echo "Creating backup branch before changes..."
git branch backup-before-match-page-clean-architecture-$(date +%Y%m%d-%H%M%S) || true

cat > vercel.json <<'JSON'
{
  "crons": []
}
JSON

write_disabled_route() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path" <<'TS'
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      disabled: true,
      mode: 'match_provider_fetch_disabled',
      reason: 'Clean architecture: match pages and the web service must read database snapshots only. Provider API fetching is moved to a separate worker plan.',
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

export async function POST() {
  return GET();
}
TS
}

write_disabled_route app/api/cron/worldcup-live-auto/route.ts
write_disabled_route app/api/cron/live-match-full-sync/route.ts
write_disabled_route app/api/cron/isports-live-sync/route.ts
write_disabled_route app/api/cron/isports-postmatch-confirm/route.ts
write_disabled_route app/api/cron/isports-backfill-events/route.ts
write_disabled_route app/api/cron/the-stats-postmatch-final-sync/route.ts

mkdir -p lib/match-page
cat > lib/match-page/confirmedClock.ts <<'TS'
import type { MatchEventView, MatchStatusView } from './types';
import { asObject, FINISHED_STATUSES, HALF_TIME_STATUSES, LIVE_STATUSES, normalizeStatusValue, rawData, toNumber } from './normalizers';

type SnapshotLike = { minute?: number | null; capturedAt?: Date | string | null; provider?: string | null; rawData?: any };

type ClockEvidence = {
  raw: string;
  minute: number | null;
  source: string;
  capturedAt: number;
};

function statusFromText(value: unknown, minute: number | null) {
  const raw = normalizeStatusValue(String(value || ''));
  if (!raw && minute !== null) return minute >= 46 ? '2H' : '1H';
  if (['FIRST_HALF', 'FIRST', '1ST_HALF', '1H'].includes(raw)) return '1H';
  if (['SECOND_HALF', 'SECOND', '2ND_HALF', '2H'].includes(raw)) return '2H';
  if (raw.includes('HALF') && raw.includes('TIME')) return 'HT';
  if (raw.includes('FINISH') || raw === 'FT' || raw === 'ENDED' || raw === 'COMPLETED') return 'FINISHED';
  if (raw === 'LIVE' || raw === 'IN_PLAY') return minute && minute >= 46 ? '2H' : '1H';
  return raw || '';
}

function minuteFromSnapshot(snapshot: SnapshotLike) {
  const data = rawData(snapshot);
  const meta = asObject(data.meta);
  const flashMeta = asObject(data.flashMeta);
  const nestedFlashMeta = asObject(data.flash?.meta);
  return toNumber(snapshot.minute ?? data.minute ?? data.elapsed ?? meta.minute ?? meta.elapsed ?? flashMeta.minute ?? flashMeta.elapsed ?? nestedFlashMeta.minute ?? nestedFlashMeta.elapsed);
}

function evidenceFromSnapshot(snapshot: SnapshotLike): ClockEvidence | null {
  const data = rawData(snapshot);
  const meta = asObject(data.meta);
  const flashMeta = asObject(data.flashMeta);
  const nestedFlashMeta = asObject(data.flash?.meta);
  const minute = minuteFromSnapshot(snapshot);
  const raw = statusFromText(data.status ?? data.providerStatus ?? data.matchState ?? meta.status ?? meta.matchState ?? flashMeta.matchState ?? nestedFlashMeta.matchState, minute);
  if (!raw && minute === null) return null;
  return {
    raw: raw || (minute !== null ? (minute >= 46 ? '2H' : '1H') : ''),
    minute,
    source: String(snapshot.provider || 'DB_SNAPSHOT'),
    capturedAt: snapshot.capturedAt ? new Date(snapshot.capturedAt).getTime() : 0,
  };
}

function latestEventMinute(events: MatchEventView[]) {
  const minutes = events.map((event) => toNumber(event.minute)).filter((value): value is number => value !== null);
  return minutes.length ? Math.max(...minutes) : null;
}

function statusView(raw: string, minute: number | null): MatchStatusView {
  const value = normalizeStatusValue(raw || 'SCHEDULED');
  if (FINISHED_STATUSES.includes(value) || value === 'FINISHED') {
    return { raw: value, kind: 'finished', label: 'انتهت المباراة', shortLabel: 'انتهت', minute: null, isLive: false, isFinished: true, isScheduled: false };
  }
  if (HALF_TIME_STATUSES.includes(value) || value === 'HT') {
    return { raw: value, kind: 'halftime', label: 'استراحة بين الشوطين', shortLabel: 'استراحة', minute: null, isLive: false, isFinished: false, isScheduled: false };
  }
  if (LIVE_STATUSES.includes(value) || value === '1H' || value === '2H') {
    const label = value === '2H' ? 'الشوط الثاني' : value === 'ET' ? 'وقت إضافي' : 'الشوط الأول';
    return { raw: value, kind: 'live', label, shortLabel: label, minute, isLive: true, isFinished: false, isScheduled: false };
  }
  return { raw: value || 'SCHEDULED', kind: 'scheduled', label: 'لم تبدأ', shortLabel: 'لم تبدأ', minute: null, isLive: false, isFinished: false, isScheduled: true };
}

export function buildConfirmedStatusView(match: any, snapshots: SnapshotLike[], events: MatchEventView[]): MatchStatusView {
  const matchStatus = normalizeStatusValue(match?.status || 'SCHEDULED');
  if (FINISHED_STATUSES.includes(matchStatus)) return statusView('FINISHED', null);
  if (HALF_TIME_STATUSES.includes(matchStatus)) return statusView('HT', null);

  const evidence = snapshots
    .map(evidenceFromSnapshot)
    .filter(Boolean)
    .sort((a, b) => (b!.capturedAt || 0) - (a!.capturedAt || 0))[0] as ClockEvidence | undefined;

  if (evidence) {
    const minute = evidence.minute ?? latestEventMinute(events);
    return statusView(evidence.raw, minute);
  }

  // Critical rule: never start the match clock from matchDate alone.
  // Without provider/event confirmation, keep the match scheduled/pending.
  return statusView(matchStatus, null);
}
TS

python - <<'PY'
from pathlib import Path
path = Path('lib/match-page/getMatchPageData.ts')
text = path.read_text()
if "./confirmedClock" not in text:
    text = text.replace("import { buildEventView, buildSourceList, buildStatMetric, buildStatusView, metricDefinitions, normalizeGroupKey, providerName, providerPriority, rawData, scoreForDisplay, stageLabel, toNumber } from './normalizers';", "import { buildEventView, buildSourceList, buildStatMetric, metricDefinitions, normalizeGroupKey, providerName, providerPriority, rawData, scoreForDisplay, stageLabel, toNumber } from './normalizers';\nimport { buildConfirmedStatusView } from './confirmedClock';")
text = text.replace("const status = forceFinishedStatus(match, advanced, buildStatusView(match, snapshots));", "const status = forceFinishedStatus(match, advanced, buildConfirmedStatusView(match, snapshots, dbEvents.length ? dbEvents : advanced.events));")
path.write_text(text)
PY

mkdir -p app/api/matches/[id]/live-snapshot
cat > app/api/matches/[id]/live-snapshot/route.ts <<'TS'
import { NextResponse } from 'next/server';
import { getMatchPageData } from '@/lib/match-page/getMatchPageData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const data = await getMatchPageData(resolved.id);
  if (!data) return NextResponse.json({ ok: false, error: 'MATCH_NOT_FOUND' }, { status: 404 });

  return NextResponse.json(
    {
      ok: true,
      source: 'DATABASE_ONLY',
      matchId: data.id,
      title: data.title,
      matchDate: data.matchDate,
      venue: data.venue,
      city: data.city,
      referee: data.referee,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      score: data.score,
      status: data.status,
      stats: data.stats,
      events: data.events,
      officialLineup: data.officialLineup,
      groupStandings: data.groupStandings,
      sources: data.sources,
      sourceChecklist: data.sourceChecklist,
      lastUpdatedAt: data.lastUpdatedAt,
      note: 'This endpoint reads only database snapshots. It does not call provider APIs.',
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}
TS

mkdir -p docs
cat > docs/MATCH_PAGE_CLEAN_ARCHITECTURE.md <<'MD'
# Match page clean architecture

## Rule

The match page must never call external provider APIs during page rendering.

## Runtime flow

1. Match page reads DB snapshots only.
2. `/api/matches/[id]/live-snapshot` reads DB snapshots only.
3. External provider calls must run in a separate worker/service, not the Render web service.
4. Browserless/iSports visual pulls are disabled in the web service.
5. The match clock never starts from `matchDate` alone. It needs provider/event confirmation.

## Page phases

### Pre-match

Display schedule, venue, referee, coaches, group/stage, standings, latest form, and source freshness from stored snapshots/manual data.

### Live

Display score, confirmed clock state, events, stats, cards, substitutions, and lineup from database snapshots only.

### Post-match

Final confirmed data should be written by a worker from TheStats, then rendered from DB.

## Disabled web routes

- `/api/cron/worldcup-live-auto`
- `/api/cron/live-match-full-sync`
- `/api/cron/isports-live-sync`
- `/api/cron/isports-postmatch-confirm`
- `/api/cron/isports-backfill-events`
- `/api/cron/the-stats-postmatch-final-sync`

## Future worker tables

Recommended tables when adding a separate worker:

- `MatchPreInfoSnapshot`
- `TeamFormSnapshot`
- `HeadToHeadSnapshot`
- `MatchOfficialsSnapshot`
- `MatchClockState`
- `MatchLiveSnapshot`
- `MatchLineupSnapshot`
- `PlayerMatchStats`
- `DataSourceRun`
- `DataSourceErrorLog`
MD

git status --short

echo "Done. Review changes, then run:"
echo "  npm install"
echo "  npm run build"
echo "  git add . && git commit -m 'Implement clean DB-only match page architecture'"
echo "  git push origin main"
