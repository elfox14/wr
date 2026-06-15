import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { hasUsablePlayerImage, isLikelyEmoji, isLikelyFlagOrTeamImage } from '@/lib/playerDedupe';

type AdminSession = { user?: { email?: string | null; role?: string | null } } | null;

type PlayerImageAuditRow = {
  id: string;
  name: string;
  code: string;
  image: string;
  teamId: string | null;
  teamName: string;
  teamCode: string;
  status: 'usable' | 'missing' | 'invalid' | 'suspicious';
  reason: string;
};

const PLAYER_IMAGE_PATH_MARKERS = [
  '/players/',
  '/player/',
  '/athletes/',
  '/athlete/',
  '/people/',
  '/person/',
  '/profile/',
  '/avatar/',
];

const TRUSTED_PLAYER_IMAGE_HOST_MARKERS = [
  'media.api-sports.io',
  'media.api-football.com',
  'img.a.transfermarkt.technology',
  'tmssl.akamaized.net',
  'cloudinary.com',
  'images.fotmob.com',
  'img.sofascore.com',
  'resources.premierleague.com',
  'digitalhub.fifa.com',
  'digitalhub.fifa.com/transform',
];

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

function toInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(500, Math.floor(parsed))) : fallback;
}

function normalizedImage(value?: string | null) {
  return String(value || '').trim();
}

function parsedImageUrl(value: string) {
  try {
    return new URL(value.startsWith('//') ? `https:${value}` : value, 'https://worldcup.mcprim.com');
  } catch {
    return null;
  }
}

function hasPlayerSpecificPath(value: string) {
  const lower = value.toLowerCase();
  return PLAYER_IMAGE_PATH_MARKERS.some((marker) => lower.includes(marker));
}

function hasTrustedPlayerHost(value: string) {
  const parsed = parsedImageUrl(value);
  const hostAndPath = `${parsed?.hostname || ''}${parsed?.pathname || ''}`.toLowerCase();
  return TRUSTED_PLAYER_IMAGE_HOST_MARKERS.some((marker) => hostAndPath.includes(marker));
}

function auditImage(player: { id: string; name: string; code: string; image: string; teamId: string | null; team?: { name?: string | null; code?: string | null; image?: string | null } | null }): PlayerImageAuditRow {
  const image = normalizedImage(player.image);
  const base = {
    id: player.id,
    name: player.name,
    code: player.code,
    image,
    teamId: player.teamId,
    teamName: player.team?.name || 'غير متوفر',
    teamCode: player.team?.code || '',
  };

  if (!image) {
    return { ...base, status: 'missing', reason: 'لا توجد صورة محفوظة للاعب' };
  }

  if (isLikelyEmoji(image)) {
    return { ...base, status: 'invalid', reason: 'القيمة Emoji وليست صورة لاعب' };
  }

  if (!(image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/'))) {
    return { ...base, status: 'invalid', reason: 'الصورة ليست رابط http/https أو مسار محلي' };
  }

  if (isLikelyFlagOrTeamImage(image)) {
    return { ...base, status: 'invalid', reason: 'الصورة تبدو علم دولة أو شعار منتخب/نادٍ وليست صورة لاعب' };
  }

  if (!hasUsablePlayerImage(image)) {
    return { ...base, status: 'invalid', reason: 'الصورة لا تجتاز فلتر صور اللاعبين في الواجهة' };
  }

  if (!hasPlayerSpecificPath(image) && !hasTrustedPlayerHost(image)) {
    return { ...base, status: 'suspicious', reason: 'الصورة صالحة للعرض لكنها من رابط عام؛ يفضل مراجعتها يدويًا' };
  }

  return { ...base, status: 'usable', reason: 'صورة لاعب صالحة للعرض حسب الفلاتر الحالية' };
}

function takeSamples(rows: PlayerImageAuditRow[], limit: number) {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    team: row.teamName,
    teamCode: row.teamCode,
    image: row.image,
    reason: row.reason,
  }));
}

function groupByTeam(rows: PlayerImageAuditRow[]) {
  const teams = new Map<string, { teamId: string | null; teamName: string; teamCode: string; total: number; usable: number; missing: number; invalid: number; suspicious: number }>();

  for (const row of rows) {
    const key = row.teamId || row.teamName || 'unknown';
    const current = teams.get(key) || {
      teamId: row.teamId,
      teamName: row.teamName,
      teamCode: row.teamCode,
      total: 0,
      usable: 0,
      missing: 0,
      invalid: 0,
      suspicious: 0,
    };
    current.total += 1;
    current[row.status] += 1;
    teams.set(key, current);
  }

  return Array.from(teams.values()).sort((a, b) => b.invalid + b.missing + b.suspicious - (a.invalid + a.missing + a.suspicious));
}

function duplicateImageGroups(rows: PlayerImageAuditRow[], sampleLimit: number) {
  const byImage = new Map<string, PlayerImageAuditRow[]>();
  for (const row of rows) {
    if (!row.image || row.status === 'missing' || row.status === 'invalid') continue;
    const key = row.image.toLowerCase();
    const current = byImage.get(key) || [];
    current.push(row);
    byImage.set(key, current);
  }

  return Array.from(byImage.entries())
    .filter(([, players]) => players.length > 1)
    .slice(0, sampleLimit)
    .map(([image, players]) => ({
      image,
      count: players.length,
      players: players.slice(0, 12).map((player) => ({
        id: player.id,
        name: player.name,
        team: player.teamName,
      })),
    }));
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin.error) return admin.error;

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const sampleLimit = toInt(searchParams.get('limit'), 50);

  const players = await prisma.asset.findMany({
    where: {
      type: 'PLAYER',
      ...(teamId ? { teamId } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      teamId: true,
      team: { select: { name: true, code: true, image: true } },
    },
    orderBy: { name: 'asc' },
    take: 10000,
  });

  const rows = players.map(auditImage);
  const usable = rows.filter((row) => row.status === 'usable');
  const missing = rows.filter((row) => row.status === 'missing');
  const invalid = rows.filter((row) => row.status === 'invalid');
  const suspicious = rows.filter((row) => row.status === 'suspicious');
  const duplicateGroups = duplicateImageGroups(rows, sampleLimit);

  return NextResponse.json({
    ok: true,
    source: 'database_asset_player_images_no_external_api_calls',
    checkedAt: new Date().toISOString(),
    teamId: teamId || null,
    summary: {
      totalPlayers: rows.length,
      usableImages: usable.length,
      missingImages: missing.length,
      invalidImages: invalid.length,
      suspiciousImages: suspicious.length,
      duplicateImageGroups: duplicateGroups.length,
      displaySafe: invalid.length === 0,
      note: 'usableImages تعني أن الرابط يجتاز فلاتر صور اللاعبين وليس علمًا/شعارًا. إثبات الهوية الفعلية لكل وجه يحتاج مصدر صور موثوق لكل لاعب.',
    },
    byTeam: groupByTeam(rows),
    samples: {
      missing: takeSamples(missing, sampleLimit),
      invalid: takeSamples(invalid, sampleLimit),
      suspicious: takeSamples(suspicious, sampleLimit),
      duplicateImageGroups: duplicateGroups,
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
