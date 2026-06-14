type QueryValue = string | number | boolean | null | undefined;

export type DataHubResponse<T = any> = {
  ok?: boolean;
  data?: T;
  summary?: any;
  apiFootball?: any;
  error?: string;
  message?: string;
  [key: string]: any;
};

export type DataHubFetchOptions = {
  includeToken?: boolean;
  timeoutMs?: number;
};

export function getDataHubConfig() {
  const baseUrl = process.env.MC_PRIME_DATA_HUB_URL || process.env.WORLDCUP_DATA_HUB_URL || 'https://mcprim.com/worldcup/api.php';
  const token = process.env.MC_PRIME_DATA_HUB_TOKEN || process.env.WORLDCUP_DATA_HUB_TOKEN || '';
  const timeoutMs = Number(process.env.MC_PRIME_DATA_HUB_TIMEOUT_MS || 15000);

  return {
    baseUrl,
    token,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
    configured: Boolean(baseUrl),
    hasToken: Boolean(token),
  };
}

function appendParam(url: URL, key: string, value: QueryValue) {
  if (value === undefined || value === null || value === '') return;
  url.searchParams.set(key, String(value));
}

export function buildDataHubUrl(action: string, params: Record<string, QueryValue> = {}, includeToken = false) {
  const cfg = getDataHubConfig();
  const url = new URL(cfg.baseUrl);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => appendParam(url, key, value));
  if (includeToken && cfg.token) url.searchParams.set('token', cfg.token);
  return url;
}

export async function dataHubFetch<T = any>(action: string, params: Record<string, QueryValue> = {}, options: DataHubFetchOptions = {}): Promise<DataHubResponse<T>> {
  const cfg = getDataHubConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || cfg.timeoutMs);

  try {
    const url = buildDataHubUrl(action, params, Boolean(options.includeToken));
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload?.error || payload?.message || `Data Hub request failed with ${response.status}`,
        payload,
      };
    }

    return payload || { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === 'AbortError' ? 'Data Hub request timed out' : error?.message || 'Data Hub request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function unwrapDataHubData<T = any>(payload: DataHubResponse<T>): any {
  return payload?.data ?? payload;
}

export function extractDataHubArray(payload: DataHubResponse, preferredKey: string): any[] {
  const data = unwrapDataHubData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[preferredKey])) return data[preferredKey];
  if (Array.isArray((payload as any)?.[preferredKey])) return (payload as any)[preferredKey];
  return [];
}

export async function getDataHubSummary() {
  return dataHubFetch('summary');
}

export async function getDataHubTeams(params: { includePlaceholders?: boolean; includeApiProfile?: boolean; includeManual?: boolean } = {}) {
  return dataHubFetch('teams', {
    include_placeholders: params.includePlaceholders ? 1 : undefined,
    include_api_profile: params.includeApiProfile ? 1 : undefined,
    include_manual: params.includeManual ? 1 : undefined,
  });
}

export async function getDataHubTeam(teamId: string | number, full = true) {
  return dataHubFetch('team', { team_id: teamId, full: full ? 1 : undefined });
}

export async function getDataHubReadiness() {
  return dataHubFetch('data_readiness');
}

export async function getDataHubSources() {
  return dataHubFetch('sources');
}
