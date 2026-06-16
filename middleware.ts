import { NextResponse, type NextRequest } from 'next/server';

const OFFICIAL_PLAYER_REWRITE_HEADER = 'x-official-player-rewrite';
const OFFICIAL_PLAYER_REWRITE_CONFIRMATION = 'CONFIRM_OFFICIAL_PLAYER_UPDATE';

const OFFICIAL_SQUAD_MAINTENANCE_PATHS = [
  '/api/admin/official-squads/audit',
  '/api/admin/official-squads/prune',
  '/api/admin/official-squads/repair-images',
];

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

export function middleware(request: NextRequest) {
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
  matcher: ['/api/admin/official-squads/:path*'],
};
