const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://worldcup.mcprim.com').replace(/\/$/, '');
const secret = process.env.CRON_SECRET || '';
const url = `${baseUrl}/api/cron/expire-stale-matches`;

const headers = secret ? { Authorization: `Bearer ${secret}` } : {};

console.log(`[render-cron] Calling ${url}`);

const response = await fetch(url, { headers, cache: 'no-store' });
const text = await response.text();

if (!response.ok) {
  console.error(`[render-cron] Failed with ${response.status}: ${text}`);
  process.exit(1);
}

console.log(`[render-cron] Success: ${text}`);
