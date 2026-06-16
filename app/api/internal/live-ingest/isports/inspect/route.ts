import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { canonicalISportsSourceUrl, extractISportsMatchId, htmlToText, loadRenderedPage } from '@/lib/live-ingest/isports-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);
const HINT_WORDS = ['matchid', 'goal', 'corner', 'danger', 'attack', 'process', 'event', 'timeline', 'stats', 'stat', 'ajax', 'api', 'socket', 'live'];

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function json(value: unknown) {
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed');
  return url;
}

function timelineUrl(matchId: number, lang = 'en', version = '1') {
  const url = new URL('https://www.isportslive8.com/football/process/demo.html');
  url.searchParams.set('v', version);
  url.searchParams.set('matchId', String(matchId));
  url.searchParams.set('lang', lang);
  return url.toString();
}

function resolveSourceUrl(reqUrl: URL) {
  const explicit = reqUrl.searchParams.get('sourceUrl');
  if (explicit) return safeUrl(explicit).toString();

  const matchId = Number(reqUrl.searchParams.get('matchId') || reqUrl.searchParams.get('providerMatchId'));
  if (!Number.isFinite(matchId) || matchId <= 0) throw new Error('sourceUrl or matchId is required');

  const mode = String(reqUrl.searchParams.get('mode') || 'live').toLowerCase();
  if (mode === 'timeline' || mode === 'process' || mode === 'postmatch') return timelineUrl(matchId);
  return canonicalISportsSourceUrl(matchId);
}

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

function absoluteUrl(value: string, base: string) {
  try {
    const url = new URL(value, base);
    if (!HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractScriptUrls(html: string, base: string) {
  const output: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const url = absoluteUrl(match[1], base);
    if (url) output.push(url);
  }
  return uniq(output).slice(0, 20);
}

function extractUrlHints(text: string, base: string, providerMatchId?: number | null) {
  const output: string[] = [];
  const patterns = [
    /["']([^"']*(?:matchId|matchid)[^"']*)["']/gi,
    /["']([^"']*(?:process|timeline|event|stats?|live|animation)[^"']*)["']/gi,
    /\b((?:https?:)?\/\/[^\s"'<>]+)\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = (match[1] || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
      if (!raw || raw.length > 500) continue;
      const lower = raw.toLowerCase();
      const hasHint = HINT_WORDS.some((word) => lower.includes(word)) || (providerMatchId ? lower.includes(String(providerMatchId)) : false);
      if (!hasHint) continue;
      const url = raw.startsWith('http') || raw.startsWith('//') || raw.startsWith('/') || raw.includes('?') ? absoluteUrl(raw, base) : null;
      if (url) output.push(url);
    }
  }

  return uniq(output).slice(0, 80);
}

function extractObjectHints(text: string, providerMatchId?: number | null) {
  const snippets: string[] = [];
  const compact = text.replace(/\s+/g, ' ');
  const needles = providerMatchId ? [...HINT_WORDS, String(providerMatchId)] : HINT_WORDS;
  for (const needle of needles) {
    let index = compact.toLowerCase().indexOf(needle.toLowerCase());
    let guard = 0;
    while (index >= 0 && guard < 4 && snippets.length < 30) {
      const start = Math.max(0, index - 220);
      const end = Math.min(compact.length, index + 420);
      const snippet = compact.slice(start, end).trim();
      if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
      index = compact.toLowerCase().indexOf(needle.toLowerCase(), index + needle.length);
      guard += 1;
    }
  }
  return snippets.slice(0, 30);
}

async function fetchText(url: string, maxBytes: number) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: '*/*',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeLiveInspector/1.0; +https://worldcup.mcprim.com)',
    },
  });
  const reader = response.body?.getReader();
  if (!reader) return { ok: response.ok, status: response.status, text: '' };

  let received = 0;
  const chunks: Uint8Array[] = [];
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const slice = value.byteLength + received > maxBytes ? value.slice(0, maxBytes - received) : value;
    chunks.push(slice);
    received += slice.byteLength;
  }
  try { await reader.cancel(); } catch {}
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  return { ok: response.ok, status: response.status, text };
}

async function inspectScripts(scriptUrls: string[], base: string, providerMatchId: number | null, take: number) {
  const scripts = [];
  for (const scriptUrl of scriptUrls.slice(0, take)) {
    try {
      const fetched = await fetchText(scriptUrl, 260_000);
      scripts.push({
        url: scriptUrl,
        status: fetched.status,
        ok: fetched.ok,
        bytesRead: fetched.text.length,
        urlHints: extractUrlHints(fetched.text, base, providerMatchId).slice(0, 25),
        objectHints: extractObjectHints(fetched.text, providerMatchId).slice(0, 8),
      });
    } catch (error: any) {
      scripts.push({ url: scriptUrl, ok: false, error: String(error?.message || error).slice(0, 260) });
    }
  }
  return scripts;
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const reqUrl = new URL(req.url);
    const sourceUrl = resolveSourceUrl(reqUrl);
    const providerMatchId = extractISportsMatchId(sourceUrl);
    const includeScripts = reqUrl.searchParams.get('scripts') !== 'false';
    const scriptTake = clamp(reqUrl.searchParams.get('scriptTake'), 8, 0, 20);

    const page = await loadRenderedPage(sourceUrl);
    const scriptUrls = extractScriptUrls(page.html, sourceUrl);
    const htmlUrlHints = extractUrlHints(page.html, sourceUrl, providerMatchId);
    const htmlObjectHints = extractObjectHints(page.html, providerMatchId);
    const scripts = includeScripts && scriptTake > 0 ? await inspectScripts(scriptUrls, sourceUrl, providerMatchId, scriptTake) : [];
    const combinedUrls = uniq([...htmlUrlHints, ...scripts.flatMap((script: any) => script.urlHints || [])]).slice(0, 120);

    return json({
      ok: true,
      mode: 'isports_page_inspector',
      sourceUrl,
      providerMatchId,
      loader: page.loader,
      rendered: page.rendered,
      pageError: page.error || null,
      htmlLength: page.html.length,
      textLength: page.text.length,
      textSample: page.text.slice(0, 1200),
      scriptUrls,
      apiOrDataUrlHints: combinedUrls,
      htmlObjectHints: htmlObjectHints.slice(0, 12),
      scripts,
      liveReminder: 'mode=live inspects pc.html for live stats; mode=timeline inspects process/demo.html for post-match event timeline.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' });
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
