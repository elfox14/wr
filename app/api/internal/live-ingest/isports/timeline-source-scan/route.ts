import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const HOST = 'www.isportslive8.com';
const SCRIPT_URL = 'https://www.isportslive8.com/football/process/script/event.js?ver=8';

const DEFAULT_TERMS = [
  'function getFlash', 'getFlash =', 'getConfig', 'loadFlashData', 'initDangerAttack', 'statusList',
  'scheduleDetail', 'flashData', 'GetData', 'ReceiveMsg', 'lqlivechange', 'ws-message', 'barDetail',
  'SplitRecord', 'SplitColumn', 'DataType', 'Domain', 'CommonInterface', '.ashx', '.aspx', '$.ajax',
  'XMLHttpRequest', 'zXmlHttp', 'open(', 'send(', 'bomHelper', 'resultCode', 'scheduleID',
];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
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

function extractPossibleEndpoints(text: string) {
  const urls: string[] = [];
  const patterns = [
    /["']([^"']+\.(?:aspx|ashx|asmx|json|php)(?:\?[^"']*)?)["']/gi,
    /(?:open|ajaxGet|ajaxPost)\s*\([^"']*["']([^"']+)["']/gi,
    /url\s*:\s*["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = (match[1] || '').replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
      if (!raw || raw.length > 300) continue;
      try {
        const url = new URL(raw, `https://${HOST}/football/process/script/`).toString();
        if (new URL(url).hostname.endsWith('isportslive8.com')) urls.push(url);
      } catch {}
    }
  }
  return [...new Set(urls)].slice(0, 120);
}

async function fetchText(url: string, maxBytes: number) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: '*/*',
      referer: 'https://www.isportslive8.com/football/process/attackdetail.aspx',
      'user-agent': 'Mozilla/5.0 (compatible; MCPrimeTimelineScanner/1.0; +https://worldcup.mcprim.com)',
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
    const terms = parseList(url.searchParams.get('terms'), DEFAULT_TERMS);
    const radius = clamp(url.searchParams.get('radius'), 1400, 300, 3000);
    const maxPerTerm = clamp(url.searchParams.get('maxPerTerm'), 4, 1, 10);
    const maxBytes = clamp(url.searchParams.get('maxBytes'), 900000, 100000, 1600000);
    const fetched = await fetchText(SCRIPT_URL, maxBytes);
    const snippets: Record<string, string[]> = {};
    for (const term of terms) {
      const found = snippetAround(fetched.text, term, radius, maxPerTerm);
      if (found.length) snippets[term] = found;
    }

    return json({
      ok: true,
      mode: 'isports_timeline_source_scan',
      scriptUrl: SCRIPT_URL,
      status: fetched.status,
      bytesRead: fetched.text.length,
      possibleEndpoints: extractPossibleEndpoints(fetched.text),
      snippets,
      note: 'Targeted scan for the initial timeline data source used by attackdetail.aspx, separate from the lqlivechange websocket.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
