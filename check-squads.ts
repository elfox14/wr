async function checkSquadSizes() {
  const API_KEY = 'c3c5bd3299344bf0bb15ff8210e798e6';
  const BASE_URL = 'https://api.football-data.org/v4';

  const res = await fetch(`${BASE_URL}/competitions/WC/teams`, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!res.ok) {
    console.error('Failed to fetch:', res.status);
    return;
  }

  const data = await res.json();
  let totalPlayers = 0;
  for (const team of data.teams) {
    const squadSize = team.squad?.length || 0;
    console.log(`${team.tla}: ${squadSize} players`);
    totalPlayers += squadSize;
  }
  console.log(`\nTotal players in API: ${totalPlayers}`);
}

checkSquadSizes();
