type ApiFootballParams = Record<string, string | number | boolean | undefined | null>;

export class ApiFootballError extends Error {
  status?: number;
  payload?: unknown;
  keyIndex?: number;

  constructor(message: string, status?: number, payload?: unknown, keyIndex?: number) {
    super(message);
    this.name = 'ApiFootballError';
    this.status = status;
    this.payload = payload;
    this.keyIndex = keyIndex;
  }
}

function getBaseUrl() {
  return process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
}

function getApiKeys() {
  const keyPool = process.env.API_FOOTBALL_KEYS
    ?.split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (keyPool && keyPool.length > 0) return keyPool;

  return [process.env.API_FOOTBALL_KEY].filter(Boolean) as string[];
}

function buildUrl(path: string, params: ApiFootballParams = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${getBaseUrl()}${cleanPath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function hasProviderErrors(payload: any) {
  if (!payload?.errors) return false;
  if (Array.isArray(payload.errors)) return payload.errors.length > 0;
  if (typeof payload.errors === 'object') return Object.keys(payload.errors).length > 0;
  return Boolean(payload.errors);
}

function isQuotaOrRateLimitError(status: number, payload: any) {
  if (status === 429) return true;
  const text = JSON.stringify(payload || {}).toLowerCase();
  return text.includes('rate') || text.includes('limit') || text.includes('quota') || text.includes('requests');
}

export async function apiFootballFetch<T = any>(path: string, params: ApiFootballParams = {}): Promise<T> {
  const keys = getApiKeys();

  if (keys.length === 0) {
    throw new ApiFootballError('API_FOOTBALL_KEY or API_FOOTBALL_KEYS is missing');
  }

  const url = buildUrl(path, params);
  const errors: ApiFootballError[] = [];

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const apiKey = keys[keyIndex];

    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'x-apisports-key': apiKey,
        'accept': 'application/json',
      },
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new ApiFootballError(`API-Football request failed with status ${response.status}`, response.status, payload, keyIndex);
      errors.push(error);
      if (isQuotaOrRateLimitError(response.status, payload) && keyIndex < keys.length - 1) continue;
      throw error;
    }

    if (hasProviderErrors(payload)) {
      const error = new ApiFootballError('API-Football returned errors', response.status, payload.errors, keyIndex);
      errors.push(error);
      if (isQuotaOrRateLimitError(response.status, payload.errors) && keyIndex < keys.length - 1) continue;
      throw error;
    }

    return payload as T;
  }

  const lastError = errors[errors.length - 1];
  throw lastError || new ApiFootballError('API-Football request failed for all keys');
}

export function normalizeName(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
