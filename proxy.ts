import { NextResponse, type NextRequest } from 'next/server';

const OFFICIAL_PLAYER_REWRITE_HEADER = 'x-official-player-rewrite';
const OFFICIAL_PLAYER_REWRITE_CONFIRMATION = 'CONFIRM_OFFICIAL_PLAYER_UPDATE';

const OFFICIAL_SQUAD_MAINTENANCE_PATHS = [
  '/api/admin/official-squads/audit',
  '/api/admin/official-squads/prune',
  '/api/admin/official-squads/repair-images',
];

const DISABLED_INGESTION_PREFIXES = [
  '/api/cron/',
  '/api/internal/live-ingest/',
  '/api/admin/isports',
  '/api/admin/api-football',
  '/api/admin/the-stats',
  '/api/admin/match-extra-data',
  '/api/admin/match-extra-debug',
  '/api/admin/match-postmatch-extras',
  '/api/admin/sync-player-clubs',
  '/api/admin/sync-player-images',
  '/api/admin/sync-player-performance',
  '/api/admin/thesportsdb',
  '/api/matches/the-stats-summary-stats',
  '/api/matches/cached-the-stats-summary',
];

function disabledIngestionResponse(pathname: string) {
  return NextResponse.json({
    ok: false,
    error: 'external_ingestion_disabled',
    message: 'External data ingestion is disabled in the web service. Read-only pages should use database snapshots only.',
    path: pathname,
  }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

function isDisabledIngestionPath(pathname: string) {
  return DISABLED_INGESTION_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

function isExternalIngestionEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.EXTERNAL_INGESTION_ENABLED || '').toLowerCase());
}

function isOfficialSquadMutation(pathname: string, method: string) {
  if (method.toUpperCase() !== 'POST') return false;
  if (!pathname.startsWith('/api/admin/official-squads')) return false;

  // Maintenance endpoints have their own dry-run and confirmation guards.
  if (OFFICIAL_SQUAD_MAINTENANCE_PATHS.some((path) => pathname.startsWith(path))) return false;

  return true;
}

function hasExplicitOfficialPlayerRewriteApproval(request: NextRequest) {
  const headerValue = request.headers.get(OFFICIAL_PLAYER_REWRITE_HEADER) || '';
  const queryValue = request.nextUrl.searchParams.get('confirmOfficialPlayerRewrite') || '';
  return headerValue === OFFICIAL_PLAYER_REWRITE_CONFIRMATION || queryValue === OFFICIAL_PLAYER_REWRITE_CONFIRMATION;
}

export function proxy(request: NextRequest) {
  if (!isExternalIngestionEnabled() && isDisabledIngestionPath(request.nextUrl.pathname)) {
    return disabledIngestionResponse(request.nextUrl.pathname);
  }

  if (!isOfficialSquadMutation(request.nextUrl.pathname, request.method)) {
    return NextResponse.next();
  }

  if (hasExplicitOfficialPlayerRewriteApproval(request)) {
    return NextResponse.next();
  }

  return NextResponse.json({
    ok: false,
    error: 'official_player_roster_locked',
    message: 'Official player rosters are locked. Add x-official-player-rewrite: CONFIRM_OFFICIAL_PLAYER_UPDATE only when you explicitly want to modify official players.',
    requiredHeader: OFFICIAL_PLAYER_REWRITE_HEADER,
    requiredHeaderValue: OFFICIAL_PLAYER_REWRITE_CONFIRMATION,
  }, { status: 409 });
}

export const config = {
  matcher: ['/api/:path*'],
};
