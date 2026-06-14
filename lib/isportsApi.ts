import { getProviderQuotaBlock, recordProviderRequest } from '@/lib/provider-quota-guard';
import { getCachedProviderResponse, saveProviderResponse } from '@/lib/provider-response-cache';

const PRIMARY_BASE_URL = (process.env.ISPORTS_BASE_URL || 'http://api.isportsapi.com').replace(/\/$/, '');
const FALLBACK_BASE_URL = (process.env.ISPORTS_FALLBACK_BASE_URL || 'http://api2.isportsapi.com').replace(/\/$/, '');
const API_KEY = process.env.ISPORTS_API_KEY || '';

type ISportsParams = Record<string, string | number | boolean | undefined | null>;

function normalizePath(path: string) {
  const cleanPath = String(path || '').trim();
  if (!cleanPath) throw new Error('iSports API path is required');
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    const url = new URL(cleanPath);
    return url.pathname;
  }
  return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
}

function providerMatchIdFromParams(params: ISportsParams = {}) {
  const value = Number(params.matchId || params.fixture || params.id || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function cacheSecondsForPath(path: string) {
  const fromEnv = Number(process.env.ISPORTS_PROVIDER_CACHE_SECONDS || 0);
  if (fromEnv > 0) return Math.floor(fromEnv);
  const cleanPath = normalizePath(path);
  if (cleanPath.includes('livescores') || cleanPath.includes('match_stats') || cleanPath.includes('analysis')) return 90;
  if (cleanPath.includes('fixtures') || cleanPath.includes('schedule')) return 600;
  return 6 * 60 * 60;
}

function buildUrl(baseUrl: string, path: string, params: ISportsParams = {}) {
  if (!API_KEY) throw new Error('ISPORTS_API_KEY is not configured');

  const url = new URL(`${baseUrl}${normalizePath(path)}`);
  url.searchParams.set('api_key', API_KEY);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function assertNotBlocked() {
  const guard = await getProviderQuotaBlock('ISPORTS');
  if (!guard) return;
  const error: any = new Error('ISPORTS quota guard active');
  error.status = 429;
  error.payload = { reason: guard.reason, blockedUntil: guard.blockedUntil, localGuard: true };
  throw error;
}

async function recordRequest(path: string, params: ISportsParams, status: number | null, ok: boolean, reason?: string) {
  try {
    await recordProviderRequest({
      provider: 'ISPORTS',
      route: normalizePath(path),
      providerMatchId: providerMatchIdFromParams(params),
      status,
      ok,
      reason,
    });
  } catch (error) {
    console.warn('iSports request log failed:', error);
  }
}

async function fetchFromBase<T>(baseUrl: string, path: string, params: ISportsParams = {}) {
  const res = await fetch(buildUrl(baseUrl, path, params), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await res.text();
  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    await recordRequest(path, params, res.status, false, JSON.stringify(payload || {}).slice(0, 500));
    const error: any = new Error(`iSportsAPI returned ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    error.baseUrl = baseUrl;
    throw error;
  }

  await recordRequest(path, params, res.status, true);
  return payload as T;
}

export async function isportsFetch<T = any>(path: string, params: ISportsParams = {}) {
  const cleanPath = normalizePath(path);
  const cached = await getCachedProviderResponse({ provider: 'ISPORTS_LEGACY', route: cleanPath, requestParams: params, maxAgeSeconds: cacheSecondsForPath(cleanPath) });
  if (cached?.payload) return cached.payload as T;

  await assertNotBlocked();

  try {
    const payload = await fetchFromBase<T>(PRIMARY_BASE_URL, cleanPath, params);
    await saveProviderResponse({ provider: 'ISPORTS_LEGACY', route: cleanPath, requestParams: params, payload, status: 200, ok: true });
    return payload;
  } catch (primaryError: any) {
    try {
      const payload = await fetchFromBase<T>(FALLBACK_BASE_URL, cleanPath, params);
      await saveProviderResponse({ provider: 'ISPORTS_LEGACY', route: cleanPath, requestParams: params, payload, status: 200, ok: true });
      return payload;
    } catch (fallbackError: any) {
      const error: any = new Error(fallbackError?.message || primaryError?.message || 'iSportsAPI request failed');
      error.primary = {
        message: primaryError?.message,
        status: primaryError?.status,
        payload: primaryError?.payload,
        baseUrl: primaryError?.baseUrl,
      };
      error.fallback = {
        message: fallbackError?.message,
        status: fallbackError?.status,
        payload: fallbackError?.payload,
        baseUrl: fallbackError?.baseUrl,
      };
      throw error;
    }
  }
}

export async function getFootballLivescores(params: ISportsParams = {}) {
  return isportsFetch('/sport/football/livescores', params);
}

export async function getFootballFixtures(params: ISportsParams = {}) {
  return isportsFetch('/sport/football/fixtures', params);
}

export async function getFootballMatchStats(params: ISportsParams = {}) {
  return isportsFetch('/sport/football/match_stats', params);
}

export async function getFootballLineups(params: ISportsParams = {}) {
  return isportsFetch('/sport/football/lineups', params);
}
