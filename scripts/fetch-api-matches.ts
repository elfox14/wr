import fetch from 'node-fetch';

async function main() {
  const API_KEY = 'c3c5bd3299344bf0bb15ff8210e798e6'; // Let's use this token specifically
  const BASE_URL = 'https://api.football-data.org/v4';

  console.log('Fetching matches from football-data.org...');
  const res = await fetch(`${BASE_URL}/competitions/WC/matches`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!res.ok) {
    console.error(`Error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    return;
  }

  const data: any = await res.json();
  const matches = data.matches || [];
  console.log(`Found ${matches.length} matches in API.`);

  const stages = new Set(matches.map((m: any) => m.stage));
  console.log('Stages in API:', Array.from(stages));

  // Let's print all matches from non-group stages
  const knockoutMatches = matches.filter((m: any) => m.stage !== 'GROUP_STAGE');
  console.log(`Knockout matches count in API: ${knockoutMatches.length}`);
  knockoutMatches.forEach((m: any) => {
    console.log(`- [${m.id}] ${m.homeTeam?.name} (${m.homeTeam?.tla}) vs ${m.awayTeam?.name} (${m.awayTeam?.tla}) | Stage: ${m.stage} | Date: ${m.utcDate} | Status: ${m.status}`);
  });
}

main().catch(console.error);
