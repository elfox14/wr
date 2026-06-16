import { gunzipSync, inflateRawSync, inflateSync, unzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type ProbeMode = 'live' | 'timeline';

type ProbeConfig = {
  mode: ProbeMode;
  wsUrl: string;
  channel: string;
  tokenUrls: string[];
};

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

function clamp(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseMode(value: string | null): ProbeMode {
  const mode = String(value || 'live').toLowerCase();
  return mode === 'timeline' || mode === 'process' || mode === 'postmatch' ? 'timeline' : 'live';
}

function modeConfig(mode: ProbeMode): ProbeConfig {
  if (mode === 'timeline') {
    return {
      mode,
      wsUrl: 'wss://zhibo.feijing88.com/stream',
      channel: 'lqlivechange',
      tokenUrls: [
        'https://www.isportslive8.com/commoninterface',
        'https://www.isportslive8.com/Common/CommonInterface.ashx?type=12',
      ],
    };
  }
  return {
    mode,
    wsUrl: 'wss://live.titan007.com/stream',
    channel: 'zqlivechange',
    tokenUrls: [
      `https://www.isportslive8.com/commoninterface?t=${Date.now()}`,
      'https://www.isportslive8.com/Common/CommonInterface.ashx?type=12',
    ],
  };
}

function safeToken(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/^[<{[]/.test(trimmed)) return null;
  return trimmed;
}

async function fetchToken(tokenUrls: string[]) {
  const attempts = [];
  for (const url of tokenUrls) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          accept: 'text/plain,*/*',
          referer: 'https://www.isportslive8.com/',
          'user-agent': 'Mozilla/5.0 (compatible; MCPrimeSocketProbe/1.0; +https://worldcup.mcprim.com)',
        },
      });
      const text = await response.text();
      const token = safeToken(text);
      attempts.push({ url, ok: response.ok, status: response.status, length: text.length, tokenFound: Boolean(token) });
      if (response.ok && token) return { token, attempts };
    } catch (error: any) {
      attempts.push({ url, ok: false, error: String(error?.message || error).slice(0, 260) });
    }
  }
  return { token: null, attempts };
}

function buildSocketUrl(config: ProbeConfig, channel: string, token: string) {
  const url = new URL(config.wsUrl);
  url.searchParams.set('channels', channel || config.channel);
  url.searchParams.set('token', token);
  return url.toString();
}

function maskSocketUrl(value: string) {
  const url = new URL(value);
  if (url.searchParams.has('token')) url.searchParams.set('token', '***');
  return url.toString();
}

function qualityScore(text: string | null) {
  if (!text) return 0;
  const sample = text.slice(0, 4000);
  if (!sample) return 0;
  let score = 0;
  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (char === '\ufffd') score -= 8;
    else if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) score += 2;
    else if (code >= 0x4e00 && code <= 0x9fff) score += 2;
    else if (code >= 32 && code !== 127) score += 1;
    else score -= 3;
  }
  if (/^[\[{]/.test(sample.trim())) score += 20;
  if (/\d+[,^!$]{1,2}\d+/.test(sample)) score += 12;
  if (/goal|corner|attack|danger|stats?|进球|角球|进攻/i.test(sample)) score += 18;
  return score;
}

function cleanString(text: string) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

function asUtf8(buffer: Buffer) {
  const text = cleanString(buffer.toString('utf8'));
  return text || null;
}

function asLatin1StringBuffer(text: string) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return Buffer.from(bytes);
}

function bestDecoded(candidates: Array<{ encoding: string; text: string | null }>) {
  const valid = candidates.filter((candidate) => candidate.text);
  if (!valid.length) return null;
  return valid
    .map((candidate) => ({ ...candidate, score: qualityScore(candidate.text) }))
    .sort((a, b) => b.score - a.score)[0];
}

function decodeBuffer(buffer: Buffer) {
  const candidates: Array<{ encoding: string; text: string | null }> = [];
  const decoders = [
    { name: 'unzip', fn: unzipSync },
    { name: 'gunzip', fn: gunzipSync },
    { name: 'inflate', fn: inflateSync },
    { name: 'inflateRaw', fn: inflateRawSync },
  ];
  for (const decoder of decoders) {
    try {
      candidates.push({ encoding: decoder.name, text: asUtf8(decoder.fn(buffer)) });
    } catch {}
  }
  candidates.push({ encoding: 'utf8', text: asUtf8(buffer) });
  candidates.push({ encoding: 'latin1', text: cleanString(buffer.toString('latin1')) || null });

  const best = bestDecoded(candidates);
  if (best && best.score > 0) return { encoding: best.encoding, text: best.text || '' };
  return { encoding: 'binary', text: buffer.subarray(0, 180).toString('hex') };
}

function decodeStringPayload(value: string) {
  const direct = cleanString(value);
  const binaryBuffer = asLatin1StringBuffer(value);
  const decodedBinary = decodeBuffer(binaryBuffer);
  const best = bestDecoded([
    { encoding: 'text', text: direct || null },
    { encoding: `binaryString:${decodedBinary.encoding}`, text: decodedBinary.text },
  ]);
  if (best && best.score > 0) return { encoding: best.encoding, text: best.text || '' };
  return { encoding: 'text', text: direct || value };
}

async function messageToDecoded(data: any) {
  if (typeof data === 'string') return decodeStringPayload(data);
  if (Buffer.isBuffer(data)) return decodeBuffer(data);
  if (data instanceof ArrayBuffer) return decodeBuffer(Buffer.from(data));
  if (ArrayBuffer.isView(data)) return decodeBuffer(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  if (data?.arrayBuffer) return decodeBuffer(Buffer.from(await data.arrayBuffer()));
  return { encoding: typeof data, text: String(data || '') };
}

function summarizeMessage(text: string, matchId: string | null) {
  const sample = String(text || '').slice(0, 2400);
  return {
    sample,
    length: String(text || '').length,
    hasMatchId: matchId ? sample.includes(matchId) || String(text || '').includes(matchId) : null,
    looksJson: /^[\[{]/.test(sample.trim()),
    contains: {
      goal: /goal|进球/i.test(sample),
      corner: /corner|角球/i.test(sample),
      attack: /attack|进攻/i.test(sample),
      danger: /danger|危险/i.test(sample),
      stats: /stats?|poss|shot|att/i.test(sample),
    },
  };
}

async function probeSocket(socketUrl: string, channel: string, timeoutMs: number, maxMessages: number, matchId: string | null) {
  const WebSocketCtor = (globalThis as any).WebSocket;
  if (!WebSocketCtor) {
    return { supported: false, opened: false, closed: false, messages: [], errors: ['WebSocket is not available in this Node runtime'] };
  }

  return new Promise<any>((resolve) => {
    const messages: any[] = [];
    const errors: string[] = [];
    let opened = false;
    let closed = false;
    let closeCode: number | null = null;
    let closeReason: string | null = null;
    let ws: any = null;
    let finished = false;
    const startedAt = Date.now();

    const finish = () => {
      if (finished) return;
      finished = true;
      try { if (ws && !closed) ws.close(); } catch {}
      resolve({ supported: true, opened, closed, closeCode, closeReason, durationMs: Date.now() - startedAt, messages, errors });
    };

    const timer = setTimeout(finish, timeoutMs);
    try {
      ws = new WebSocketCtor(socketUrl);
      ws.addEventListener('open', () => {
        opened = true;
        try { ws.send(JSON.stringify({ type: 0, channels: [channel] })); } catch {}
      });
      ws.addEventListener('message', async (event: any) => {
        try {
          const decoded = await messageToDecoded(event.data);
          messages.push({ encoding: decoded.encoding, ...summarizeMessage(decoded.text, matchId) });
          if (messages.length >= maxMessages) {
            clearTimeout(timer);
            finish();
          }
        } catch (error: any) {
          errors.push(String(error?.message || error).slice(0, 260));
        }
      });
      ws.addEventListener('close', (event: any) => {
        closed = true;
        closeCode = Number(event?.code || 0) || null;
        closeReason = String(event?.reason || '') || null;
        clearTimeout(timer);
        finish();
      });
      ws.addEventListener('error', (event: any) => {
        errors.push(String(event?.message || event?.type || 'websocket error').slice(0, 260));
      });
    } catch (error: any) {
      clearTimeout(timer);
      resolve({ supported: true, opened, closed, closeCode, closeReason, durationMs: Date.now() - startedAt, messages, errors: [String(error?.message || error).slice(0, 260)] });
    }
  });
}

async function handler(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.error;

  try {
    const url = new URL(req.url);
    const mode = parseMode(url.searchParams.get('mode'));
    const config = modeConfig(mode);
    const channel = url.searchParams.get('channel') || config.channel;
    const timeoutMs = clamp(url.searchParams.get('timeoutMs'), 9000, 1500, 25000);
    const maxMessages = clamp(url.searchParams.get('maxMessages'), 6, 1, 25);
    const matchId = url.searchParams.get('matchId') || null;
    const tokenResult = await fetchToken(config.tokenUrls);

    if (!tokenResult.token) {
      return json({ ok: false, mode: 'isports_socket_probe', probeMode: mode, channel, tokenAttempts: tokenResult.attempts, error: 'Could not fetch websocket token' }, 502);
    }

    const socketUrl = buildSocketUrl(config, channel, tokenResult.token);
    const probe = await probeSocket(socketUrl, channel, timeoutMs, maxMessages, matchId);

    return json({
      ok: true,
      mode: 'isports_socket_probe',
      probeMode: mode,
      channel,
      socketUrl: maskSocketUrl(socketUrl),
      tokenAttempts: tokenResult.attempts,
      probe,
      note: 'Diagnostic only: collects a few short websocket message samples so we can map live stats/timeline safely before saving anything.',
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Internal Server Error' }, 500);
  }
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
