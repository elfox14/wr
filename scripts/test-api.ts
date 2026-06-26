import { theStatsApiFetch } from '../lib/theStatsApi';

async function main() {
  console.log('Testing TheStats API key...');
  try {
    const payload = await theStatsApiFetch('/api/football/matches', { per_page: 1 }, { timeoutMs: 10000 });
    console.log('Success! Payload matches count:', payload?.data?.matches?.length || payload?.data?.length || 0);
    console.log('Payload sample:', JSON.stringify(payload).slice(0, 500));
  } catch (err: any) {
    console.error('API Call Failed:', {
      message: err.message,
      status: err.status,
      code: err.code,
      payload: err.payload
    });
  }
}

main();
