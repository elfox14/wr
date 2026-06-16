import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HOSTS = new Set(['isportslive8.com', 'www.isportslive8.com']);

const DEFAULT_LIVE_SCRIPTS = [
  'https://www.isportslive8.com/football/script/SocketHelper.js?ver=1',
  'https://www.isportslive8.com/football/script/event.js?ver=8',
];

const DEFAULT_TIMELINE_SCRIPTS = [
  'https://www.isportslive8.com/football/process/script/SocketHelper.js?ver=1',
  'https://www.isportslive8.com/football/process/script/event.js?ver=8',
];

const DEFAULT_TERMS = [
  'connectWs', 'wss://', 'channels', 'getFlash', 'getConfig', 'GetData', 'scheduleID',
  'accessKey', 'auth', 'ts', '_glflash.Domain', 'SplitRecord', 'SplitColumn', 'dangerAttak',
  'barList', 'statusBar', '$.ajax', '.ajax', 'WebSocket', 'pako', 'inflate', 'lqlivechange',
];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function safeUrl(value: string) {
  const url = new URL(value);
  if (!HOSTS.has(url.hostname.toLowerCase())) throw new Error('Only isportslive8.com URLs are allowed');
  return url.toString();
}

function parseList(value: string | null, fallback: string[]) {
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function snippetAround(text: string, needle: string, radius: number, maxPerTerm: number) {
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const snippets: string[] = [];
  let index = lower.indexOf(target);
  let guard = 0;
  while (index >= 0 && guard < maxPerTerm) {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + needle.length + radius);
    const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
    index = lower.indexOf(target, index + target.length);
    guard += 1;
  }
  return snippets;
}

function extractUrls(text: string, base: string) {
  const urls: string[] = [];
  const patterns = [
    /["']([^"']+\.(?:aspx|ashx|json|php)(?:\?[^"']*)?)["']/gi,
    /["']((?:wss?:)?\/\/[^"']+)["']/gi,
    /["']([^"']*(?:socket|stream|live|event|attack|detail|stats)[^"']*)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = (match[1] || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
      if (!raw || raw.length > 400) continue;
      try {
        const url = raw.startsWith('ws') ? raw : new URL(raw, base).toString();
        urls.push(url);
      } catch {}
    }
  }
  return [...new Set(urls)].slice(0, 80);
}

async function fetchText(url: string, maxBytes: number) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: '*/*',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeScriptScanner/1.0; +https://worldcup.mcprim.com)',
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
  return { ok: response.ok, status: response.status, text: new TextDecoder().decode(Buffer.concat(chunks)) };
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const mode = String(url.searchParams.get('mode') || 'timeline').toLowerCase();
    const scripts = parseList(url.searchParams.get('scripts'), mode === 'live' ? DEFAULT_LIVE_SCRIPTS : DEFAULT_TIMELINE_SCRIPTS).map(safeUrl);
    const terms = parseList(url.searchParams.get('terms'), DEFAULT_TERMS);
    const radius = clamp(url.searchParams.get('radius'), 520, 120, 1600);
    const maxPerTerm = clamp(url.searchParams.get('maxPerTerm'), 2, 1, 8);
    const maxBytes = clamp(url.searchParams.get('maxBytes'), 450000, 40000, 1200000);

    const results = [];
    for (const scriptUrl of scripts.slice(0, 8)) {
      const fetched = await fetchText(scriptUrl, maxBytes);
      const snippets: Record<string, string[]> = {};
      for (const term of terms) {
        const found = snippetAround(fetched.text, term, radius, maxPerTerm);
        if (found.length) snippets[term] = found;
      }
      results.push({
        url: scriptUrl,
        ok: fetched.ok,
        status: fetched.status,
        bytesRead: fetched.text.length,
        extractedUrls: extractUrls(fetched.text, scriptUrl),
        snippets,
      });
    }

    return json({
      ok: true,
      mode: 'isports_script_scan',
      scanMode: mode,
      terms,
      results,
      note: 'Returns targeted short snippets only so we can identify the live/timeline data protocol without dumping full scripts.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
