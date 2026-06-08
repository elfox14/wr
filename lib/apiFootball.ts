type ApiFootballParams = Record<string, string | number | boolean | undefined | null>;

export class ApiFootballError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = 'ApiFootballError';
    this.status = status;
    this.payload = payload;
  }
}

function getBaseUrl() {
  return process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
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

export async function apiFootballFetch<T = any>(path: string, params: ApiFootballParams = {}): Promise<T> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new ApiFootballError('API_FOOTBALL_KEY is missing');
  }

  const url = buildUrl(path, params);
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
    throw new ApiFootballError(`API-Football request failed with status ${response.status}`, response.status, payload);
  }

  if (payload?.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new ApiFootballError('API-Football returned errors', response.status, payload.errors);
  }

  if (payload?.errors && typeof payload.errors === 'object' && Object.keys(payload.errors).length > 0) {
    throw new ApiFootballError('API-Football returned errors', response.status, payload.errors);
  }

  return payload as T;
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
