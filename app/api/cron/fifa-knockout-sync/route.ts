import { GET as runGet, POST as runPost } from '../fifa-r32-sync/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  return runGet(req);
}

export async function POST(req: Request) {
  return runPost(req);
}
