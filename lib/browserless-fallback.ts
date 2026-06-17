export type BrowserlessKind = 'content' | 'function';
export type BrowserlessProvider = 'primary' | 'fallback';

type BrowserlessCandidate = {
  provider: BrowserlessProvider;
  endpoint: string;
};

export type BrowserlessPostResult = {
  ok: boolean;
  status: number | null;
  provider: BrowserlessProvider;
  endpoint: string;
  rawLength: number;
  contentType: string | null;
  text: string;
  error: string | null;
};

export function maskBrowserlessUrl(value?: string | null) {
  if (!value) return value || null;
  try {
    const url = new URL(value);
    if (url.searchParams.has('token')) url.searchParams.set('token', '***');
    return url.toString();
  } catch {
    return String(value).replace(/token=([^&\s]+)/gi, 'token=***');
  }
}

function endpointFor(kind: BrowserlessKind, raw: string, token?: string | null) {
  const base = raw
    .replace(/\/content\/?$/i, `/${kind}`)
    .replace(/\/function\/?$/i, `/${kind}`)
    .replace(/\/+$/g, '');
  const url = new URL(base.endsWith(`/${kind}`) ? base : `${base}/${kind}`);
  if (token && !url.searchParams.has('token')) url.searchParams.set('token', token);
  return url.toString();
}

function fallbackRawEndpoint(kind: BrowserlessKind) {
  if (kind === 'function') return process.env.BROWSERLESS_FALLBACK_FUNCTION_ENDPOINT || process.env.BROWSERLESS_FALLBACK_ENDPOINT || null;
  return process.env.BROWSERLESS_FALLBACK_ENDPOINT || null;
}

export function browserlessCandidates(kind: BrowserlessKind): BrowserlessCandidate[] {
  const primaryRaw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const primaryToken = process.env.BROWSERLESS_TOKEN;
  const fallbackRaw = fallbackRawEndpoint(kind);
  const fallbackToken = process.env.BROWSERLESS_FALLBACK_TOKEN;
  const candidates: BrowserlessCandidate[] = [{ provider: 'primary', endpoint: endpointFor(kind, primaryRaw, primaryToken) }];
  if (fallbackRaw && fallbackToken) candidates.push({ provider: 'fallback', endpoint: endpointFor(kind, fallbackRaw, fallbackToken) });
  return candidates;
}

export function shouldUseBrowserlessFallback(result: BrowserlessPostResult) {
  if (result.ok) return false;
  if (result.status === null) return true;
  if ([408, 425, 429].includes(result.status)) return true;
  if (result.status >= 500) return true;
  const error = String(result.error || '').toLowerCase();
  return /timeout|abort|quota|limit|too many|capacity|socket|econn|network/.test(error);
}

export async function postBrowserlessWithFallback(kind: BrowserlessKind, body: unknown, options?: { accept?: string; timeoutMs?: number }) {
  const attempts: BrowserlessPostResult[] = [];
  let last: BrowserlessPostResult | null = null;
  for (const candidate of browserlessCandidates(kind)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(options?.timeoutMs || 90000, 10000));
    try {
      const response = await fetch(candidate.endpoint, {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: options?.accept || 'application/json,*/*' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
      const text = await response.text();
      last = { ok: response.ok, status: response.status, provider: candidate.provider, endpoint: maskBrowserlessUrl(candidate.endpoint) || '', rawLength: text.length, contentType: response.headers.get('content-type'), text, error: response.ok ? null : text.slice(0, 1000) };
    } catch (error: any) {
      last = { ok: false, status: null, provider: candidate.provider, endpoint: maskBrowserlessUrl(candidate.endpoint) || '', rawLength: 0, contentType: null, text: '', error: String(error?.message || error).slice(0, 1000) };
    } finally {
      clearTimeout(timer);
    }
    attempts.push(last);
    if (!shouldUseBrowserlessFallback(last)) break;
  }
  return { ...(last || attempts[0]), attempts } as BrowserlessPostResult & { attempts: BrowserlessPostResult[] };
}
