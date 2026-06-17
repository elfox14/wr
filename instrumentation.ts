export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const state = globalThis as typeof globalThis & { __browserlessFallbackFetchPatched?: boolean };
  if (state.__browserlessFallbackFetchPatched) return;
  state.__browserlessFallbackFetchPatched = true;

  const originalFetch = globalThis.fetch.bind(globalThis);
  const primaryRaw = process.env.BROWSERLESS_ENDPOINT || 'https://production-sfo.browserless.io/content';
  const fallbackRaw = process.env.BROWSERLESS_FALLBACK_ENDPOINT;
  const fallbackFunctionRaw = process.env.BROWSERLESS_FALLBACK_FUNCTION_ENDPOINT || fallbackRaw;
  const fallbackToken = process.env.BROWSERLESS_FALLBACK_TOKEN;
  if (!fallbackRaw || !fallbackToken) return;

  function urlFromInput(input: RequestInfo | URL) {
    try {
      return new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url);
    } catch {
      return null;
    }
  }

  function normalizeEndpoint(raw: string, kind: 'content' | 'function') {
    const base = raw
      .replace(/\/content\/?$/i, `/${kind}`)
      .replace(/\/function\/?$/i, `/${kind}`)
      .replace(/\/+$/g, '');
    return new URL(base.endsWith(`/${kind}`) ? base : `${base}/${kind}`);
  }

  function isPrimaryBrowserlessUrl(url: URL) {
    const primary = normalizeEndpoint(primaryRaw, url.pathname.toLowerCase().includes('function') ? 'function' : 'content');
    return url.hostname === primary.hostname || /(^|\.)browserless\.io$/i.test(url.hostname);
  }

  function shouldRetry(status: number) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  function fallbackUrlFor(url: URL) {
    const kind = url.pathname.toLowerCase().includes('function') ? 'function' : 'content';
    const raw = kind === 'function' ? fallbackFunctionRaw : fallbackRaw;
    if (!raw) return null;
    const target = normalizeEndpoint(raw, kind);
    for (const [key, value] of url.searchParams.entries()) {
      if (key.toLowerCase() !== 'token') target.searchParams.set(key, value);
    }
    target.searchParams.set('token', fallbackToken || '');
    return target.toString();
  }

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const sourceUrl = urlFromInput(input);
    if (!sourceUrl || !isPrimaryBrowserlessUrl(sourceUrl)) return originalFetch(input, init);
    const fallbackUrl = fallbackUrlFor(sourceUrl);
    if (!fallbackUrl) return originalFetch(input, init);

    try {
      const response = await originalFetch(input, init);
      if (!shouldRetry(response.status)) return response;
      const fallbackResponse = await originalFetch(fallbackUrl, init);
      fallbackResponse.headers.set('x-browserless-provider', 'fallback');
      fallbackResponse.headers.set('x-browserless-primary-status', String(response.status));
      return fallbackResponse;
    } catch (error) {
      try {
        const fallbackResponse = await originalFetch(fallbackUrl, init);
        fallbackResponse.headers.set('x-browserless-provider', 'fallback');
        fallbackResponse.headers.set('x-browserless-primary-error', String((error as Error)?.message || error).slice(0, 200));
        return fallbackResponse;
      } catch {
        throw error;
      }
    }
  }) as typeof fetch;
}
