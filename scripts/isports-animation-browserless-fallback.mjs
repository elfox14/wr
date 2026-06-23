const DEFAULT_ANIMATION_BASE_URL = 'https://www.isportslive8.com/football/pc.html';

let browserlessRequestsThisRun = 0;

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

function tryJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function canonicalAnimationUrl(providerMatchId) {
  const url = new URL(String(process.env.ISPORTS_ANIMATION_BASE_URL || DEFAULT_ANIMATION_BASE_URL));
  url.searchParams.set('matchId', String(providerMatchId));
  url.searchParams.set('lang', process.env.ISPORTS_ANIMATION_LANG || 'en');
  url.searchParams.set('v', process.env.ISPORTS_ANIMATION_VERSION || '1');
  return url.toString();
}

function endpointToUrl(endpointValue, tokenValue, suffix) {
  const endpoint = String(endpointValue || '').trim().replace(/\/$/, '');
  const token = String(tokenValue || '').trim();
  if (!endpoint) return '';
  const finalEndpoint = endpoint.endsWith(suffix) || endpoint.endsWith(`/chromium${suffix}`) ? endpoint : `${endpoint}${suffix}`;
  const url = new URL(finalEndpoint);
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function browserlessFunctionCandidates() {
  const primaryExplicit = String(process.env.BROWSERLESS_FUNCTION_URL || process.env.BROWSERLESS_FUNCTION_ENDPOINT || '').trim();
  const fallbackExplicit = String(process.env.BROWSERLESS_FALLBACK_FUNCTION_URL || process.env.BROWSERLESS_FALLBACK_FUNCTION_ENDPOINT || '').trim();
  const primaryEndpoint = endpointToUrl(process.env.BROWSERLESS_ENDPOINT, process.env.BROWSERLESS_TOKEN, '/function');
  const fallbackEndpoint = endpointToUrl(process.env.BROWSERLESS_FALLBACK_ENDPOINT, process.env.BROWSERLESS_FALLBACK_TOKEN, '/function');
  const preferFallback = envBool('BROWSERLESS_PREFER_FALLBACK', false);
  const entries = preferFallback
    ? [['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint], ['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint]]
    : [['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint], ['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint]];
  const seen = new Set();
  return entries.filter(([, url]) => Boolean(url)).filter(([, url]) => { if (seen.has(url)) return false; seen.add(url); return true; }).map(([name, url]) => ({ name, url }));
}

function browserlessContentCandidates() {
  const primaryExplicit = String(process.env.BROWSERLESS_CONTENT_URL || '').trim();
  const fallbackExplicit = String(process.env.BROWSERLESS_FALLBACK_CONTENT_URL || '').trim();
  const primaryEndpoint = endpointToUrl(process.env.BROWSERLESS_ENDPOINT, process.env.BROWSERLESS_TOKEN, '/content');
  const fallbackEndpoint = endpointToUrl(process.env.BROWSERLESS_FALLBACK_ENDPOINT, process.env.BROWSERLESS_FALLBACK_TOKEN, '/content');
  const preferFallback = envBool('BROWSERLESS_PREFER_FALLBACK', false);
  const entries = preferFallback
    ? [['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint], ['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint]]
    : [['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint], ['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint]];
  const seen = new Set();
  return entries.filter(([, url]) => Boolean(url)).filter(([, url]) => { if (seen.has(url)) return false; seen.add(url); return true; }).map(([name, url]) => ({ name, url }));
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.replace('%', '').replace(/[^0-9.-]/g, '').trim() : value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function statLinesFromJsonPayload(payload) {
  const lines = [];
  const seen = new Set();
  function add(label, home, away) {
    const h = num(home);
    const a = num(away);
    if (h === null && a === null) return;
    const key = `${label}:${h}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${h ?? ''} ${label} ${a ?? ''}`.trim());
  }
  function sideObject(item, side) {
    const keys = side === 'home' ? ['home', 'homeTeam', 'homeStats', 'homeStatistics', 'teamA', 'localteam', 'host'] : ['away', 'awayTeam', 'awayStats', 'awayStatistics', 'teamB', 'visitorteam', 'guest'];
    for (const key of keys) if (item?.[key] && typeof item[key] === 'object') return item[key];
    return {};
  }
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 6 || lines.length > 60) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const item = asObject(value);
    const home = sideObject(item, 'home');
    const away = sideObject(item, 'away');
    add('Possession', home.possession ?? home.poss ?? home.ballPossession ?? home.ball_possession ?? item.homePossession ?? item.home_possession, away.possession ?? away.poss ?? away.ballPossession ?? away.ball_possession ?? item.awayPossession ?? item.away_possession);
    add('Attacks', home.attacks ?? home.attack ?? home.att ?? item.homeAttacks ?? item.home_attacks, away.attacks ?? away.attack ?? away.att ?? item.awayAttacks ?? item.away_attacks);
    add('Dangerous Attacks', home.dangerousAttacks ?? home.dangerous_attacks ?? home.dAtt ?? home.d_att ?? item.homeDangerousAttacks ?? item.home_dangerous_attacks, away.dangerousAttacks ?? away.dangerous_attacks ?? away.dAtt ?? away.d_att ?? item.awayDangerousAttacks ?? item.away_dangerous_attacks);
    add('Shots', home.shots ?? home.shotsTotal ?? home.shots_total ?? item.homeShots ?? item.home_shots, away.shots ?? away.shotsTotal ?? away.shots_total ?? item.awayShots ?? item.away_shots);
    add('On Target', home.shotsOnTarget ?? home.shots_on_target ?? home.onTarget ?? item.homeShotsOnTarget ?? item.home_shots_on_target, away.shotsOnTarget ?? away.shots_on_target ?? away.onTarget ?? item.awayShotsOnTarget ?? item.away_shots_on_target);
    add('Off Target', home.shotsOffTarget ?? home.shots_off_target ?? home.offTarget ?? item.homeShotsOffTarget ?? item.home_shots_off_target, away.shotsOffTarget ?? away.shots_off_target ?? away.offTarget ?? item.awayShotsOffTarget ?? item.away_shots_off_target);
    add('Corners', home.corners ?? home.corner ?? home.cornerKicks ?? item.homeCorners ?? item.home_corners, away.corners ?? away.corner ?? away.cornerKicks ?? item.awayCorners ?? item.away_corners);
    add('Yellow Cards', home.yellowCards ?? home.yellow_cards ?? home.yellow ?? item.homeYellowCards ?? item.home_yellow_cards, away.yellowCards ?? away.yellow_cards ?? away.yellow ?? item.awayYellowCards ?? item.away_yellow_cards);
    add('Red Cards', home.redCards ?? home.red_cards ?? home.red ?? item.homeRedCards ?? item.home_red_cards, away.redCards ?? away.red_cards ?? away.red ?? item.awayRedCards ?? item.away_red_cards);
    const label = item.type ?? item.name ?? item.key ?? item.stat ?? item.statName ?? item.statisticsType;
    const hv = item.home ?? item.homeValue ?? item.home_value ?? item.homeTeam ?? item.values?.home ?? item.value?.home;
    const av = item.away ?? item.awayValue ?? item.away_value ?? item.awayTeam ?? item.values?.away ?? item.value?.away;
    if (label) add(String(label), hv, av);
    Object.values(item).forEach((child) => visit(child, depth + 1));
  }
  visit(payload);
  return lines;
}

const FUNCTION_CAPTURE_CODE = `export default async function ({ page, context }) {
  const url = context.url;
  const waitMs = context.waitMs || 6000;
  const timeoutMs = context.timeoutMs || 25000;
  const responses = [];
  const maxResponses = 20;
  page.on('response', async (response) => {
    if (responses.length >= maxResponses) return;
    const responseUrl = response.url();
    const contentType = response.headers()['content-type'] || '';
    const interesting = /json|javascript|text|event-stream/i.test(contentType) || /match|stats|stat|event|live|animation|football|score|timeline|socket|analysis/i.test(responseUrl);
    if (!interesting) return;
    try {
      const text = await response.text();
      if (!text || text.length > 250000) return;
      responses.push({ url: responseUrl, status: response.status(), contentType, text: text.slice(0, 12000) });
    } catch {}
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForTimeout(waitMs);
  const text = await page.evaluate(() => document.body ? document.body.innerText : '');
  return { url, text, responses };
}`;

async function fetchFunctionCaptureFrom(functionUrl, sourceUrl) {
  const timeoutMs = envNumber('BROWSERLESS_FALLBACK_TIMEOUT_MS', 18000, 5000, 55000);
  const waitMs = envNumber('BROWSERLESS_FALLBACK_WAIT_MS', 4000, 1000, 20000);
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json,text/plain' },
    body: JSON.stringify({ code: FUNCTION_CAPTURE_CODE, context: { url: sourceUrl, waitMs, timeoutMs } }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Browserless function failed ${response.status}: ${truncate(body, 600)}`);
  const parsed = tryJson(body);
  return parsed?.data || parsed?.result || parsed || { text: body, responses: [] };
}

async function fetchFunctionCapture(sourceUrl) {
  const candidates = browserlessFunctionCandidates();
  if (!candidates.length) return null;
  const errors = [];
  for (const candidate of candidates) {
    try {
      const capture = await fetchFunctionCaptureFrom(candidate.url, sourceUrl);
      return { ...capture, loader: `browserless_function:${candidate.name}` };
    } catch (error) {
      errors.push(`${candidate.name}: ${error?.message || String(error)}`);
    }
  }
  throw new Error(errors.join(' | ') || 'Browserless function failed');
}

async function fetchRenderedHtmlFrom(contentUrl, sourceUrl) {
  const timeoutMs = envNumber('BROWSERLESS_FALLBACK_TIMEOUT_MS', 18000, 5000, 55000);
  const waitForTimeout = envNumber('BROWSERLESS_FALLBACK_WAIT_MS', 4000, 1000, 20000);
  const response = await fetch(contentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'text/html,application/json' },
    body: JSON.stringify({ url: sourceUrl, gotoOptions: { waitUntil: 'networkidle2', timeout: timeoutMs }, waitForTimeout }),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (!response.ok) throw new Error(`Browserless content failed ${response.status}: ${truncate(body, 600)}`);
  if (!contentType.includes('application/json')) return body;
  const json = tryJson(body);
  return String(json?.html || json?.content || json?.data || body);
}

async function fetchContentText(sourceUrl) {
  const candidates = browserlessContentCandidates();
  if (!candidates.length) throw new Error('BROWSERLESS_CONTENT_URL or BROWSERLESS_ENDPOINT is missing');
  const errors = [];
  for (const candidate of candidates) {
    try {
      const html = await fetchRenderedHtmlFrom(candidate.url, sourceUrl);
      return { text: htmlToText(html), loader: `browserless_content:${candidate.name}`, htmlLength: html.length, jsonPayloads: [] };
    } catch (error) {
      errors.push(`${candidate.name}: ${error?.message || String(error)}`);
    }
  }
  throw new Error(errors.join(' | ') || 'Browserless content failed');
}

export async function fetchISportsAnimationBrowserlessText(providerMatchId) {
  if (!envBool('LIVE_INGEST_USE_BROWSERLESS_FALLBACK', false)) {
    return { enabled: false, source: 'ISPORTS_ANIMATION_BROWSERLESS', hasText: false, hasStats: false, skipped: true, reason: 'LIVE_INGEST_USE_BROWSERLESS_FALLBACK is false', error: 'LIVE_INGEST_USE_BROWSERLESS_FALLBACK is false' };
  }

  const maxBrowserlessRequests = envNumber('LIVE_INGEST_MAX_BROWSERLESS_REQUESTS', 1, 0, 10);
  if (browserlessRequestsThisRun >= maxBrowserlessRequests) {
    return { enabled: true, source: 'ISPORTS_ANIMATION_BROWSERLESS', hasText: false, hasStats: false, skipped: true, reason: 'skipped_browserless_run_limit', error: 'skipped_browserless_run_limit', browserlessRequestsThisRun, maxBrowserlessRequests };
  }
  browserlessRequestsThisRun += 1;

  const sourceUrl = canonicalAnimationUrl(providerMatchId);
  let loader = '';
  let text = '';
  let htmlLength = 0;
  const jsonPayloads = [];
  const networkSamples = [];

  const functionFirst = envBool('LIVE_INGEST_BROWSERLESS_FUNCTION_FIRST', true);
  if (functionFirst) {
    const capture = await fetchFunctionCapture(sourceUrl).catch((error) => ({ error: error?.message || String(error) }));
    if (!capture?.error) {
      loader = capture.loader || 'browserless_function';
      text = String(capture.text || '');
      for (const response of Array.isArray(capture.responses) ? capture.responses : []) {
        networkSamples.push({ url: response.url, contentType: response.contentType, textSample: truncate(response.text, 800) });
        const parsed = tryJson(response.text);
        if (parsed) {
          jsonPayloads.push(parsed);
          text += `\n${statLinesFromJsonPayload(parsed).join('\n')}`;
        }
      }
    }
  }

  if (!loader) {
    const content = await fetchContentText(sourceUrl);
    loader = content.loader;
    text = content.text;
    htmlLength = content.htmlLength;
  }

  const debug = envBool('LIVE_INGEST_FALLBACK_DEBUG', false);
  return {
    enabled: true,
    source: 'ISPORTS_ANIMATION_BROWSERLESS',
    sourceUrl,
    hasText: text.length > 0,
    hasStats: false,
    text,
    error: debug ? `debug_text_sample:${truncate(text, 1200)}` : null,
    rawData: { sourceUrl, loader, htmlLength, textSample: truncate(text), jsonPayloads: jsonPayloads.slice(0, 5), networkSamples: networkSamples.slice(0, 10) },
  };
}
