// ============================================================
// lib/fbref/parser.ts
// Parses uploaded FBref/Stathead CSV or JSON exports into
// a normalised FbrefSourcePack ready for import.
// ============================================================

export interface FbrefRow {
  [key: string]: string;
}

export interface FbrefSourcePack {
  teamName: string;
  sourceName: string;
  sourceUrl?: string;
  sourceCategory: 'fbref' | 'stathead' | 'fifa' | 'federation' | 'editorial';
  reportType: string;
  title: string;
  summary: string;
  body: string;
  metrics: Record<string, string | number | null>;
  tacticalTags: string[];
  strengths: string[];
  weaknesses: string[];
  confidence: 'A' | 'B' | 'C' | 'D';
  language: string;
  rows: FbrefRow[];
  warnings: string[];
}

const MISSING_LABEL = 'غير متوفر في المصادر';

// ── CSV parser ─────────────────────────────────────────────────
export function parseCsv(raw: string): FbrefRow[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: FbrefRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

// ── JSON parser ─────────────────────────────────────────────────
export function parseJson(raw: string): FbrefRow[] {
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.rows ?? [parsed];
    return arr.map((item: Record<string, unknown>) => {
      const row: FbrefRow = {};
      Object.entries(item).forEach(([k, v]) => {
        row[k] = v !== null && v !== undefined ? String(v) : '';
      });
      return row;
    });
  } catch {
    return [];
  }
}

// ── metric extractor ───────────────────────────────────────────
const METRIC_KEYS = [
  'Gls', 'Ast', 'xG', 'xAG', 'Poss', 'Sh', 'SoT', 'Cmp%',
  'KP', 'PrgC', 'PrgP', 'Tkl', 'Int', 'Clr', 'Save%',
  'MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts',
];

function extractMetrics(rows: FbrefRow[]): Record<string, string | number | null> {
  const totals: Record<string, number[]> = {};
  rows.forEach((row) => {
    METRIC_KEYS.forEach((key) => {
      if (row[key] !== undefined && row[key] !== '') {
        const n = parseFloat(row[key]);
        if (!isNaN(n)) {
          if (!totals[key]) totals[key] = [];
          totals[key].push(n);
        }
      }
    });
  });
  const metrics: Record<string, string | number | null> = {};
  METRIC_KEYS.forEach((key) => {
    if (totals[key]?.length) {
      const sum = totals[key].reduce((a, b) => a + b, 0);
      metrics[key] = Math.round(sum * 100) / 100;
    } else {
      metrics[key] = MISSING_LABEL;
    }
  });
  return metrics;
}

// ── confidence scorer ───────────────────────────────────────────
function scoreConfidence(rows: FbrefRow[], metrics: Record<string, string | number | null>): 'A' | 'B' | 'C' | 'D' {
  const metricFill = METRIC_KEYS.filter((k) => metrics[k] !== MISSING_LABEL).length;
  const ratio = metricFill / METRIC_KEYS.length;
  if (ratio >= 0.75 && rows.length >= 5) return 'A';
  if (ratio >= 0.5 && rows.length >= 3) return 'B';
  if (ratio >= 0.25) return 'C';
  return 'D';
}

// ── main builder ────────────────────────────────────────────────
interface BuildOptions {
  teamName: string;
  sourceName: string;
  sourceUrl?: string;
  sourceCategory?: FbrefSourcePack['sourceCategory'];
  reportType?: string;
  fileType: 'csv' | 'json';
  raw: string;
}

export function buildSourcePack(opts: BuildOptions): FbrefSourcePack {
  const warnings: string[] = [];
  const rows = opts.fileType === 'csv' ? parseCsv(opts.raw) : parseJson(opts.raw);

  if (rows.length === 0) warnings.push('لم يتم استخراج أي صفوف من الملف');

  const metrics = extractMetrics(rows);
  const confidence = scoreConfidence(rows, metrics);

  const filledCount = Object.values(metrics).filter((v) => v !== MISSING_LABEL).length;
  const totalCount = METRIC_KEYS.length;
  const summary = [
    `تم استيراد ${rows.length} صف من مصدر: ${opts.sourceName}.`,
    `المقاييس المتوفرة: ${filledCount}/${totalCount}.`,
    `مستوى الثقة: ${confidence}.`,
  ].join(' ');

  return {
    teamName: opts.teamName,
    sourceName: opts.sourceName,
    sourceUrl: opts.sourceUrl,
    sourceCategory: opts.sourceCategory ?? 'fbref',
    reportType: opts.reportType ?? 'TEAM_PROFILE',
    title: `تقرير تحليل منتخب: ${opts.teamName}`,
    summary,
    body: rows.length > 0
      ? Object.entries(metrics)
          .map(([k, v]) => `**${k}**: ${v ?? MISSING_LABEL}`)
          .join('\n')
      : MISSING_LABEL,
    metrics,
    tacticalTags: [],
    strengths: [],
    weaknesses: [],
    confidence,
    language: 'ar',
    rows,
    warnings,
  };
}
