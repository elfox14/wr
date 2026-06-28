import { NextRequest } from 'next/server';
import { GET } from '../app/api/matches-hub/route';

async function main() {
  const url = new URL('http://localhost:3000/api/matches-hub?filter=today');
  const req = new NextRequest(url);
  const response = await GET(req);
  const data = await response.json();
  console.log('Today filter matches:', JSON.stringify(data, null, 2));

  const urlAll = new URL('http://localhost:3000/api/matches-hub?filter=all');
  const reqAll = new NextRequest(urlAll);
  const responseAll = await GET(reqAll);
  const dataAll = await responseAll.json();
  console.log('All filter matches count:', dataAll.matches?.length);
}

main().catch(console.error);
