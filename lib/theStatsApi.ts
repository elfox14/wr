type TheStatsApiParams = Record<string, string | number | boolean | null | undefined>;

export type TheStatsApiFetchOptions = {
  timeoutMs?: number;
};

export class TheStatsApiError extends Error {
  status?: number;
  payload?: unknown;
  code?: string;

  constructor(message: string, status?: number, payload?: unknown, code?: string) {
    super(message);
    this.name = 'TheStatsApiError';
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

const BLOCKED_TERMS = [
  'odd',
  'odds',
  'bet',
  'bets',
  'betting',
  'bookmaker',
  'bookmakers',
  'sportsbook',
  'wager',
  'wagering',
  'bet365',
  'pinnacle',
  'betfair',
  'kambi',
  'handicap',
  'asian-handicap',
  'btts',
  'draw-no-bet',
  'dnb',
  'totals',
  'over-under',
  'over_under',
];

const ALLOWED_FOOTBALL_PATHS = [
  '/football',
  '/v1/football',
  '/api/football',
  'football',
  'v1/football',
  'api/football',
];

function env(value: string, fallback = '') {
  return String(process.env[value] || fallback).trim();
}

function normalizePath(path: string) {
  const raw = String(path || '').trim();
  if (!raw) throw new TheStatsApiError('TheStatsAPI path is required', 400, null, 'missing_path');
  if (/^https?:\/\//i.test(raw)) throw new TheStatsApiError('Full external URLs are not allowed. Pass a provider path only.', 400, null, 'external_url_rejected');
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function containsBlockedTerm(value: string) {
  const lower = value.toLowerCase();
  return BLOCKED_TERMS.find((term) => lower.includes(term));
}

export function assertSafeTheStatsApiPath(path: string, params: TheStatsApiParams = {}) {
  const normalizedPath = normalizePath(path);
  const decodedPath = decodeURIComponent(normalizedPath).toLowerCase();
  const blockedPathTerm = containsBlockedTerm(decodedPath);
  if (blockedPathTerm) {
    throw new TheStatsApiError(
      `Blocked TheStatsAPI path because it appears to request prohibited betting/odds data: ${blockedPathTerm}`,
      400,
      { path: normalizedPath, blockedTerm: blockedPathTerm },
      'blocked_betting_endpoint',
    );
  }

  const isFootballPath = ALLOWED_FOOTBALL_PATHS.some((prefix) => decodedPath === prefix || decodedPath.startsWith(`${prefix}/`));
  if (!isFootballPath) {
    throw new TheStatsApiError(
      'Only football data endpoints are allowed for this platform.',
      400,
      { path: normalizedPath, allowedPrefixes: ALLOWED_FOOTBALL_PATHS },
      'non_football_endpoint_rejected',
    );
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    const candidate = `${key}=${value}`;
    const blockedParamTerm = containsBlockedTerm(candidate);
    if (blockedParamTerm) {
      throw new TheStatsApiError(
        `Blocked TheStatsAPI query because it appears to request prohibited betting/odds data: ${blockedParamTerm}`,
        400,
        { key, value, blockedTerm: blockedParamTerm },
        'blocked_betting_query',
      );
    }
  }

  return normalizedPath;
}

export function isTheStatsApiEnabled() {
  return env('THE_STATS_API_ENABLED').toLowerCase() === 'true';
}

export function isTheStatsApiVerifyOnly() {
  return env('THE_STATS_API_VERIFY_ONLY', 'true').toLowerCase() !== 'false';
}

export function getTheStatsApiConfigStatus() {
  return {
    enabled: isTheStatsApiEnabled(),
    verifyOnly: isTheStatsApiVerifyOnly(),
    blockOdds: env('THE_STATS_API_BLOCK_ODDS', 'true').toLowerCase() !== 'false',
    hasKey: Boolean(env('THE_STATS_API_KEY')),
    hasBaseUrl: Boolean(env('THE_STATS_API_BASE_URL', 'https://api.thestatsapi.com')),
    baseUrl: env('THE_STATS_API_BASE_URL', 'https://api.thestatsapi.com').replace(/\/$/, ''),
  };
}

function buildUrl(path: string, params: TheStatsApiParams = {}) {
  const safePath = assertSafeTheStatsApiPath(path, params);
  const baseUrl = env('THE_STATS_API_BASE_URL', 'https://api.thestatsapi.com').replace(/\/$/, '');
  const url = new URL(`${baseUrl}${safePath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function buildHeaders(apiKey: string) {
  const headerName = env('THE_STATS_API_AUTH_HEADER', 'Authorization');
  const scheme = env('THE_STATS_API_AUTH_SCHEME', 'Bearer');
  const value = headerName.toLowerCase() === 'authorization' && scheme
    ? `${scheme} ${apiKey}`
    : apiKey;

  return {
    accept: 'application/json',
    [headerName]: value,
  } as Record<string, string>;
}

function timeoutMs(option?: number) {
  const configured = Number(env('THE_STATS_API_TIMEOUT_MS', '15000'));
  const value = Number(option || configured || 15000);
  return Number.isFinite(value) ? Math.max(1000, Math.min(value, 60000)) : 15000;
}

export async function theStatsApiFetch<T = any>(path: string, params: TheStatsApiParams = {}, options: TheStatsApiFetchOptions = {}): Promise<T> {
  const config = getTheStatsApiConfigStatus();
  if (!config.enabled) {
    throw new TheStatsApiError('TheStatsAPI is disabled. Set THE_STATS_API_ENABLED=true to use verification sync.', 412, config, 'provider_disabled');
  }

  const apiKey = env('THE_STATS_API_KEY');
  if (!apiKey) {
    throw new TheStatsApiError('THE_STATS_API_KEY is missing', 412, config, 'missing_api_key');
  }

  const maxRetries = 3;
  let attempt = 0;

  while (true) {
    attempt++;
    const url = buildUrl(path, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs(options.timeoutMs));

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: buildHeaders(apiKey),
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);

      if (!response.ok) {
        if (response.status === 429 && attempt <= maxRetries) {
          const backoff = Math.pow(2, attempt) * 500 + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        throw new TheStatsApiError(`TheStatsAPI request failed with status ${response.status}`, response.status, payload, 'provider_request_failed');
      }

      return payload as T;
    } catch (error: any) {
      if (error instanceof TheStatsApiError) throw error;

      const isAbort = error?.name === 'AbortError';
      if (attempt <= maxRetries) {
        const backoff = Math.pow(2, attempt) * 500 + Math.random() * 100;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      if (isAbort) {
        throw new TheStatsApiError('TheStatsAPI request timed out', 408, { timeoutMs: timeoutMs(options.timeoutMs) }, 'timeout');
      }
      throw new TheStatsApiError(error?.message || 'TheStatsAPI request failed', undefined, null, 'request_failed');
    } finally {
      clearTimeout(timer);
    }
  }
}

export function safeTheStatsApiError(error: any) {
  return {
    name: error?.name || 'Error',
    message: error?.message || 'Unknown error',
    status: error?.status || null,
    code: error?.code || null,
    payload: error?.payload || null,
  };
}
