const DEFAULT_ANIMATION_BASE_URL = 'https://www.isportslive8.com/football/pc.html';

function envBool(name, fallback = false) {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function envNumber(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function truncate(value, max = 3000) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function canonicalAnimationUrl(providerMatchId) {
  const url = new URL(String(process.env.ISPORTS_ANIMATION_BASE_URL || DEFAULT_ANIMATION_BASE_URL));
  url.searchParams.set('matchId', String(providerMatchId));
  url.searchParams.set('lang', process.env.ISPORTS_ANIMATION_LANG || 'en');
  url.searchParams.set('v', process.env.ISPORTS_ANIMATION_VERSION || '1');
  return url.toString();
}

function browserlessContentUrl() {
  const explicit = String(process.env.BROWSERLESS_CONTENT_URL || process.env.BROWSERLESS_FALLBACK_CONTENT_URL || '').trim();
  if (explicit) return explicit;

  const endpoint = String(process.env.BROWSERLESS_ENDPOINT || process.env.BROWSERLESS_FALLBACK_ENDPOINT || '').trim().replace(/\/$/, '');
  const token = String(process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_FALLBACK_TOKEN || '').trim();
  if (!endpoint) return '';

  const finalEndpoint = endpoint.endsWith('/content') || endpoint.endsWith('/chromium/content') ? endpoint : `${endpoint}/content`;
  const url = new URL(finalEndpoint);
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|span|a|button)>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

async function fetchRenderedHtml(sourceUrl) {
  const contentUrl = browserlessContentUrl();
  if (!contentUrl) throw new Error('BROWSERLESS_CONTENT_URL or BROWSERLESS_ENDPOINT is missing');

  const timeoutMs = envNumber('BROWSERLESS_FALLBACK_TIMEOUT_MS', 25000, 5000, 55000);
  const waitForTimeout = envNumber('BROWSERLESS_FALLBACK_WAIT_MS', 8000, 1000, 20000);
  const response = await fetch(contentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'text/html,application/json' },
    body: JSON.stringify({
      url: sourceUrl,
      gotoOptions: { waitUntil: 'networkidle2', timeout: timeoutMs },
      waitForTimeout,
    }),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (!response.ok) throw new Error(`Browserless content failed ${response.status}: ${truncate(body, 600)}`);
  if (!contentType.includes('application/json')) return body;
  try {
    const json = JSON.parse(body);
    return String(json.html || json.content || json.data || body);
  } catch {
    return body;
  }
}

export async function fetchISportsAnimationBrowserlessText(providerMatchId) {
  if (!envBool('LIVE_INGEST_USE_BROWSERLESS_FALLBACK', false)) {
    return { enabled: false, hasText: false, skipped: true, reason: 'LIVE_INGEST_USE_BROWSERLESS_FALLBACK is false' };
  }

  const sourceUrl = canonicalAnimationUrl(providerMatchId);
  const html = await fetchRenderedHtml(sourceUrl);
  const text = htmlToText(html);
  return {
    enabled: true,
    source: 'ISPORTS_ANIMATION_BROWSERLESS',
    sourceUrl,
    hasText: text.length > 0,
    text,
    rawData: {
      sourceUrl,
      loader: 'browserless_content',
      htmlLength: html.length,
      textSample: truncate(text),
    },
  };
}
