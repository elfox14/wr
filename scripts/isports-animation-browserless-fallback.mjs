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

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function canonicalAnimationUrl(providerMatchId) {
  const url = new URL(String(process.env.ISPORTS_ANIMATION_BASE_URL || DEFAULT_ANIMATION_BASE_URL));
  url.searchParams.set('matchId', String(providerMatchId));
  url.searchParams.set('lang', process.env.ISPORTS_ANIMATION_LANG || 'en');
  url.searchParams.set('v', process.env.ISPORTS_ANIMATION_VERSION || '1');
  return url.toString();
}

function endpointToUrl(endpointValue, tokenValue, suffix) {
  const raw = String(endpointValue || '').trim();
  const token = String(tokenValue || '').trim();
  if (!raw) return '';
  const url = new URL(raw);
  let pathname = url.pathname.replace(/\/$/, '');
  if (pathname.endsWith('/content') || pathname.endsWith('/function')) {
    pathname = pathname.replace(/\/(content|function)$/, suffix);
  } else if (pathname.endsWith('/chromium/content') || pathname.endsWith('/chromium/function')) {
    pathname = pathname.replace(/\/chromium\/(content|function)$/, `/chromium${suffix}`);
  } else if (!pathname.endsWith(suffix) && !pathname.endsWith(`/chromium${suffix}`)) {
    pathname = `${pathname}${suffix}`;
  }
  url.pathname = pathname;
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function uniqueCandidates(entries) {
  const seen = new Set();
  return entries
    .filter(([, url]) => Boolean(url))
    .filter(([, url]) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map(([name, url]) => ({ name, url }));
}

function browserlessFunctionCandidates() {
  const primaryExplicit = endpointToUrl(process.env.BROWSERLESS_FUNCTION_URL || process.env.BROWSERLESS_FUNCTION_ENDPOINT, '', '/function');
  const fallbackExplicit = endpointToUrl(process.env.BROWSERLESS_FALLBACK_FUNCTION_URL || process.env.BROWSERLESS_FALLBACK_FUNCTION_ENDPOINT, '', '/function');
  const primaryEndpoint = endpointToUrl(process.env.BROWSERLESS_ENDPOINT, process.env.BROWSERLESS_TOKEN, '/function');
  const fallbackEndpoint = endpointToUrl(process.env.BROWSERLESS_FALLBACK_ENDPOINT, process.env.BROWSERLESS_FALLBACK_TOKEN, '/function');
  const preferFallback = envBool('BROWSERLESS_PREFER_FALLBACK', false);
  return uniqueCandidates(preferFallback
    ? [['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint], ['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint]]
    : [['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint], ['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint]]);
}

function browserlessContentCandidates() {
  const primaryExplicit = endpointToUrl(process.env.BROWSERLESS_CONTENT_URL || process.env.BROWSERLESS_CONTENT_ENDPOINT, '', '/content');
  const fallbackExplicit = endpointToUrl(process.env.BROWSERLESS_FALLBACK_CONTENT_URL || process.env.BROWSERLESS_FALLBACK_CONTENT_ENDPOINT, '', '/content');
  const primaryEndpoint = endpointToUrl(process.env.BROWSERLESS_ENDPOINT, process.env.BROWSERLESS_TOKEN, '/content');
  const fallbackEndpoint = endpointToUrl(process.env.BROWSERLESS_FALLBACK_ENDPOINT, process.env.BROWSERLESS_FALLBACK_TOKEN, '/content');
  const preferFallback = envBool('BROWSERLESS_PREFER_FALLBACK', false);
  return uniqueCandidates(preferFallback
    ? [['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint], ['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint]]
    : [['primary_explicit', primaryExplicit], ['primary_endpoint', primaryEndpoint], ['fallback_explicit', fallbackExplicit], ['fallback_endpoint', fallbackEndpoint]]);
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
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 7 || lines.length > 80) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const item = value;
    const home = item.home || item.homeTeam || item.homeStats || item.teamA || item.localteam || {};
    const away = item.away || item.awayTeam || item.awayStats || item.teamB || item.visitorteam || {};
    add('Possession', home.possession ?? home.poss ?? home.ballPossession ?? item.homePossession, away.possession ?? away.poss ?? away.ballPossession ?? item.awayPossession);
    add('Attacks', home.attacks ?? home.attack ?? home.att ?? item.homeAttacks, away.attacks ?? away.attack ?? away.att ?? item.awayAttacks);
    add('Dangerous Attacks', home.dangerousAttacks ?? home.dangerous_attacks ?? home.dAtt ?? item.homeDangerousAttacks, away.dangerousAttacks ?? away.dangerous_attacks ?? away.dAtt ?? item.awayDangerousAttacks);
    add('Shots', home.shots ?? home.shotsTotal ?? item.homeShots, away.shots ?? away.shotsTotal ?? item.awayShots);
    add('On Target', home.shotsOnTarget ?? home.shots_on_target ?? home.onTarget ?? item.homeShotsOnTarget, away.shotsOnTarget ?? away.shots_on_target ?? away.onTarget ?? item.awayShotsOnTarget);
    add('Off Target', home.shotsOffTarget ?? home.shots_off_target ?? home.offTarget ?? item.homeShotsOffTarget, away.shotsOffTarget ?? away.shots_off_target ?? away.offTarget ?? item.awayShotsOffTarget);
    add('Corners', home.corners ?? home.corner ?? item.homeCorners, away.corners ?? away.corner ?? item.awayCorners);
    add('Yellow Cards', home.yellowCards ?? home.yellow_cards ?? home.yellow ?? item.homeYellowCards, away.yellowCards ?? away.yellow_cards ?? away.yellow ?? item.awayYellowCards);
    add('Red Cards', home.redCards ?? home.red_cards ?? home.red ?? item.homeRedCards, away.redCards ?? away.red_cards ?? away.red ?? item.awayRedCards);
    const label = item.type ?? item.name ?? item.key ?? item.stat ?? item.statName ?? item.statisticsType;
    if (label) add(String(label), item.homeValue ?? item.home_value ?? item.values?.home ?? item.value?.home, item.awayValue ?? item.away_value ?? item.values?.away ?? item.value?.away);
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
  const maxResponses = 40;
  page.on('response', async (response) => {
    if (responses.length >= maxResponses) return;
    const responseUrl = response.url();
    const contentType = response.headers()['content-type'] || '';
    const interesting = /json|javascript|text|event-stream/i.test(contentType) || /match|stats|stat|event|live|animation|football|score|timeline|socket|analysis/i.test(responseUrl);
    if (!interesting) return;
    try {
      const text = await response.text();
      if (!text || text.length > 250000) return;
      responses.push({ url: responseUrl, status: response.status(), contentType, text: text.slice(0, 16000) });
    } catch {}
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const mainText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
  const frameTexts = [];
  const frameUrls = [];
  for (const frame of page.frames()) {
    try {
      const frameUrl = frame.url();
      if (frameUrl) frameUrls.push(frameUrl);
      const frameText = await frame.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
      if (frameText && frameText !== mainText) frameTexts.push(frameText);
    } catch {}
  }
  const iframeSrcs = await page.evaluate(() => Array.from(document.querySelectorAll('iframe')).map((iframe) => iframe.src).filter(Boolean)).catch(() => []);
  const newline = String.fromCharCode(10);
  return { data: { url, text: [mainText, ...frameTexts].filter(Boolean).join(newline), mainText, frameTexts, frameUrls, iframeSrcs, responses }, type: 'application/json' };
}`;

function inlineFunctionCaptureCode(sourceUrl, waitMs, timeoutMs) {
  return FUNCTION_CAPTURE_CODE
    .replace('const url = context.url;', `const url = ${JSON.stringify(sourceUrl)};`)
    .replace('const waitMs = context.waitMs || 6000;', `const waitMs = ${Number(waitMs)};`)
    .replace('const timeoutMs = context.timeoutMs || 25000;', `const timeoutMs = ${Number(timeoutMs)};`);
}

function unwrapFunctionResponse(body) {
  const parsed = tryJson(body);
  const value = parsed?.data || parsed?.result || parsed;
  return value || { text: body, responses: [] };
}

async function postFunctionRequest(functionUrl, mode, body) {
  const httpTimeout = envNumber('BROWSERLESS_HTTP_TIMEOUT_MS', 8000, 1000, 30000);
  const response = await fetchWithTimeout(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mode === 'javascript' ? 'application/javascript' : 'application/json',
      accept: 'application/json,text/plain,*/*',
    },
    body,
  }, httpTimeout);
  const text = await response.text();
  if (!response.ok) throw new Error(`${mode} ${response.status}: ${truncate(text, 600)}`);
  return unwrapFunctionResponse(text);
}

async function fetchFunctionCaptureFrom(functionUrl, sourceUrl) {
  const timeoutMs = envNumber('BROWSERLESS_FALLBACK_TIMEOUT_MS', 8000, 5000, 55000);
  const waitMs = envNumber('BROWSERLESS_FALLBACK_WAIT_MS', 2000, 1000, 20000);
  const payloadMode = String(process.env.BROWSERLESS_FUNCTION_PAYLOAD_MODE || 'javascript').trim().toLowerCase();
  const errors = [];
  if (payloadMode === 'json' || payloadMode === 'both') {
    try { return await postFunctionRequest(functionUrl, 'json', JSON.stringify({ code: FUNCTION_CAPTURE_CODE, context: { url: sourceUrl, waitMs, timeoutMs } })); }
    catch (error) { errors.push(error?.message || String(error)); }
  }
  if (payloadMode === 'javascript' || payloadMode === 'both') {
    try { return await postFunctionRequest(functionUrl, 'javascript', inlineFunctionCaptureCode(sourceUrl, waitMs, timeoutMs)); }
    catch (error) { errors.push(error?.message || String(error)); }
  }
  throw new Error(`Browserless function failed: ${errors.join(' | ') || `no payload modes matching ${payloadMode}`}`);
}

async function fetchFunctionCapture(sourceUrl) {
  const allCandidates = browserlessFunctionCandidates();
  const maxCandidates = envNumber('BROWSERLESS_FUNCTION_MAX_CANDIDATES', 1, 1, 10);
  const candidates = allCandidates.slice(0, maxCandidates);
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
  const httpTimeout = envNumber('BROWSERLESS_HTTP_TIMEOUT_MS', 8000, 1000, 30000);
  const timeoutMs = envNumber('BROWSERLESS_FALLBACK_TIMEOUT_MS', 8000, 5000, 55000);
  const waitForTimeout = envNumber('BROWSERLESS_FALLBACK_WAIT_MS', 2000, 1000, 20000);
  const response = await fetchWithTimeout(contentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'text/html,application/json' },
    body: JSON.stringify({ url: sourceUrl, gotoOptions: { waitUntil: 'networkidle2', timeout: timeoutMs }, waitForTimeout }),
  }, httpTimeout);
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
  let functionError = '';
  const jsonPayloads = [];
  const networkSamples = [];
  let frameUrls = [];
  let iframeSrcs = [];

  const functionFirst = envBool('LIVE_INGEST_BROWSERLESS_FUNCTION_FIRST', true);
  if (functionFirst) {
    const capture = await fetchFunctionCapture(sourceUrl).catch((error) => ({ error: error?.message || String(error) }));
    if (capture && !capture.error) {
      loader = capture.loader || 'browserless_function';
      text = String(capture.text || '');
      frameUrls = Array.isArray(capture.frameUrls) ? capture.frameUrls : [];
      iframeSrcs = Array.isArray(capture.iframeSrcs) ? capture.iframeSrcs : [];
      for (const response of Array.isArray(capture.responses) ? capture.responses : []) {
        networkSamples.push({ url: response.url, status: response.status, contentType: response.contentType, textSample: truncate(response.text, 1000) });
        const parsed = tryJson(response.text);
        if (parsed) {
          jsonPayloads.push(parsed);
          const lines = statLinesFromJsonPayload(parsed);
          if (lines.length) text += `\n${lines.join('\n')}`;
        }
      }
    } else {
      functionError = capture.error;
    }
  }

  const contentAfterError = envBool('LIVE_INGEST_CONTENT_AFTER_FUNCTION_ERROR', false);
  const shouldTryContent = !loader && (!functionFirst || !functionError || contentAfterError);
  if (shouldTryContent) {
    try {
      const content = await fetchContentText(sourceUrl);
      loader = content.loader;
      text = content.text;
      htmlLength = content.htmlLength;
    } catch (error) {
      functionError = functionError ? `${functionError} | content_fallback_error: ${error?.message || String(error)}` : error?.message || String(error);
    }
  }

  const debug = envBool('LIVE_INGEST_FALLBACK_DEBUG', false);
  const debugParts = [`loader:${loader || 'none'}`, `text:${truncate(text, 1200)}`];
  if (functionError) debugParts.unshift(`function_error:${truncate(functionError, 500)}`);
  if (frameUrls.length) debugParts.push(`frames:${frameUrls.slice(0, 5).join(',')}`);
  if (iframeSrcs.length) debugParts.push(`iframes:${iframeSrcs.slice(0, 5).join(',')}`);

  return {
    enabled: true,
    source: 'ISPORTS_ANIMATION_BROWSERLESS',
    sourceUrl,
    hasText: text.length > 0,
    hasStats: false,
    text,
    error: debug ? `debug_${debugParts.join(' | ')}` : (functionError || null),
    rawData: { sourceUrl, loader, functionError, htmlLength, textSample: truncate(text), frameUrls, iframeSrcs, jsonPayloads: jsonPayloads.slice(0, 5), networkSamples: networkSamples.slice(0, 12) },
  };
}
