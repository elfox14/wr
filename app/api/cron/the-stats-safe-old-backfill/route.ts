import { GET as runBackfillGet, POST as runBackfillPost } from '@/app/api/admin/the-stats-safe-old-backfill/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function withCronDefaults(req: Request) {
  const url = new URL(req.url);
  if (!url.searchParams.get('phase') && !url.searchParams.get('mode') && !url.searchParams.get('sequence')) {
    url.searchParams.set('phase', 'auto');
  }
  if (!url.searchParams.get('limit')) url.searchParams.set('limit', '1');
  if (!url.searchParams.get('candidateWindow')) url.searchParams.set('candidateWindow', '120');
  if (!url.searchParams.get('skipExisting')) url.searchParams.set('skipExisting', 'true');
  if (!url.searchParams.get('endpointDelayMs') && !url.searchParams.get('delayMs')) url.searchParams.set('endpointDelayMs', '7000');
  if (!url.searchParams.get('matchDelayMs')) url.searchParams.set('matchDelayMs', '30000');
  if (!url.searchParams.get('cooldownHours')) url.searchParams.set('cooldownHours', '6');

  return new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
  });
}

export async function GET(req: Request) {
  return runBackfillGet(withCronDefaults(req));
}

export async function POST(req: Request) {
  return runBackfillPost(withCronDefaults(req));
}
