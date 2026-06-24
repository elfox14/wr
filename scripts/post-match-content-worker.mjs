#!/usr/bin/env node

const origin = (
  process.env.POST_MATCH_CONTENT_TARGET_ORIGIN ||
  process.env.LIVE_INGEST_TARGET_ORIGIN ||
  process.env.LIVE_SYNC_PUBLIC_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const secret = (
  process.env.POST_MATCH_CONTENT_SECRET ||
  process.env.CRON_SECRET ||
  process.env.ADMIN_API_SECRET ||
  process.env.ADMIN_CRON_SECRET ||
  ''
).trim();

if (!secret) {
  console.error('POST_MATCH_CONTENT_SECRET, CRON_SECRET, ADMIN_API_SECRET, or ADMIN_CRON_SECRET is required.');
  process.exit(1);
}

const params = new URLSearchParams();
params.set('limit', process.env.POST_MATCH_CONTENT_LIMIT || '5');
if (process.env.POST_MATCH_CONTENT_ALLOW_FINISHED) params.set('allowFinished', process.env.POST_MATCH_CONTENT_ALLOW_FINISHED);
if (process.env.POST_MATCH_CONTENT_AUTO_PUBLISH) params.set('autoPublish', process.env.POST_MATCH_CONTENT_AUTO_PUBLISH);

const url = `${origin}/api/cron/post-match-content?${params.toString()}`;

const response = await fetch(url, {
  method: 'GET',
  headers: {
    authorization: `Bearer ${secret}`,
    'x-post-match-content-secret': secret,
  },
});

const payload = await response.json().catch(() => ({}));
if (!response.ok || !payload.ok) {
  console.error('Post-match content worker failed:', JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
