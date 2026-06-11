const UNAVAILABLE = 'غير متوفر في المصادر';

export type SportsReferenceCsvDraftInput = {
  teamName?: string;
  sourceName?: string;
  sourceUrl?: string;
  csvText?: string;
};

export type SportsReferenceCsvDraft = {
  summary: string;
  sections: Record<string, string>;
  detectedColumns: string[];
  detectedRows: number;
  warnings: string[];
};

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  if (lines.length < 2) return { headers: [], rows: [] as Record<string, string>[] };

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map((header, index) => normalizeKey(header || `column_${index + 1}`));
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => ({ ...acc, [header]: values[index] || '' }), {} as Record<string, string>);
  });

  return { headers, rows };
}

function findColumn(headers: string[], options: string[]) {
  return headers.find((header) => options.some((option) => header === option || header.includes(option))) || null;
}

function numeric(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/[%,$]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumColumn(rows: Record<string, string>[], column: string | null) {
  if (!column) return null;
  const total = rows.reduce((sum, row) => sum + (numeric(row[column]) || 0), 0);
  return Number.isFinite(total) ? total : null;
}

function firstNonEmpty(rows: Record<string, string>[], column: string | null) {
  if (!column) return null;
  return rows.map((row) => row[column]).find(Boolean) || null;
}

function topNames(rows: Record<string, string>[], nameColumn: string | null, sortColumn: string | null, limit = 5) {
  if (!nameColumn) return [];
  const ranked = [...rows]
    .filter((row) => row[nameColumn])
    .sort((a, b) => (numeric(b[sortColumn || '']) || 0) - (numeric(a[sortColumn || '']) || 0));

  return ranked.slice(0, limit).map((row) => row[nameColumn]);
}

export function buildSportsReferenceCsvDraft(input: SportsReferenceCsvDraftInput): SportsReferenceCsvDraft {
  const csvText = String(input.csvText || '').trim();
  const warnings: string[] = [];
  const { headers, rows } = parseCsv(csvText);

  if (!csvText) warnings.push('لم يتم إرسال CSV أو جدول منسوخ.');
  if (!headers.length || !rows.length) warnings.push('لم يتم التعرف على صفوف كافية من CSV.');

  const teamName = String(input.teamName || '').trim() || 'المنتخب';
  const sourceName = String(input.sourceName || 'Sports Reference / Stathead / FBref subscription').trim();
  const sourceUrl = String(input.sourceUrl || '').trim();

  const playerCol = findColumn(headers, ['player', 'players', 'name']);
  const teamCol = findColumn(headers, ['team', 'squad', 'nation']);
  const goalsCol = findColumn(headers, ['goals', 'gls', 'gf']);
  const assistsCol = findColumn(headers, ['assists', 'ast']);
  const xgCol = findColumn(headers, ['xg', 'expected_goals']);
  const npxgCol = findColumn(headers, ['npxg']);
  const shotsCol = findColumn(headers, ['shots', 'sh']);
  const sotCol = findColumn(headers, ['shots_on_target', 'sot']);
  const goalsAgainstCol = findColumn(headers, ['goals_against', 'ga']);
  const xgaCol = findColumn(headers, ['xga', 'expected_goals_against']);
  const passCompletionCol = findColumn(headers, ['pass_completion', 'cmp_', 'cmp_percent']);
  const possessionCol = findColumn(headers, ['possession', 'poss']);
  const minutesCol = findColumn(headers, ['minutes', 'min']);

  const totalGoals = sumColumn(rows, goalsCol);
  const totalAssists = sumColumn(rows, assistsCol);
  const totalXg = sumColumn(rows, xgCol);
  const totalNpxg = sumColumn(rows, npxgCol);
  const totalShots = sumColumn(rows, shotsCol);
  const totalSot = sumColumn(rows, sotCol);
  const totalGa = sumColumn(rows, goalsAgainstCol);
  const totalXga = sumColumn(rows, xgaCol);
  const possession = firstNonEmpty(rows, possessionCol);
  const passCompletion = firstNonEmpty(rows, passCompletionCol);
  const names = topNames(rows, playerCol, minutesCol || goalsCol || xgCol, 5);
  const detectedTeam = firstNonEmpty(rows, teamCol);

  const attackParts = [
    totalGoals !== null ? `الأهداف: ${totalGoals}.` : null,
    totalAssists !== null ? `التمريرات الحاسمة: ${totalAssists}.` : null,
    totalXg !== null ? `xG: ${Number(totalXg.toFixed(2))}.` : null,
    totalNpxg !== null ? `npxG: ${Number(totalNpxg.toFixed(2))}.` : null,
    totalShots !== null ? `التسديدات: ${totalShots}.` : null,
    totalSot !== null ? `التسديدات على المرمى: ${totalSot}.` : null,
  ].filter(Boolean);

  const defenseParts = [
    totalGa !== null ? `الأهداف المستقبلة: ${totalGa}.` : null,
    totalXga !== null ? `xGA: ${Number(totalXga.toFixed(2))}.` : null,
  ].filter(Boolean);

  const midfieldParts = [
    possession ? `الاستحواذ: ${possession}.` : null,
    passCompletion ? `دقة/اكتمال التمرير: ${passCompletion}.` : null,
  ].filter(Boolean);

  const sections = {
    'بطاقة المنتخب': detectedTeam ? `${teamName}. الفريق/المنتخب في الجدول: ${detectedTeam}.` : teamName,
    'ملخص تنفيذي موثق': rows.length ? `تم تحليل export من ${sourceName} يحتوي على ${rows.length} صفوف و${headers.length} أعمدة.` : UNAVAILABLE,
    'القوة الهجومية': attackParts.length ? `${attackParts.join(' ')} المصدر: ${sourceName}.` : UNAVAILABLE,
    'القوة الدفاعية': defenseParts.length ? `${defenseParts.join(' ')} المصدر: ${sourceName}.` : UNAVAILABLE,
    'وسط الملعب والتحكم': midfieldParts.length ? `${midfieldParts.join(' ')} المصدر: ${sourceName}.` : UNAVAILABLE,
    'الكرات الثابتة': UNAVAILABLE,
    'أسماء بارزة في القائمة': names.length ? `${names.join('، ')}. هذه أسماء ظاهرة في export وليست ترتيبًا نهائيًا للأكثر تأثيرًا.` : UNAVAILABLE,
    'معلومات غير متوفرة': 'أي عمود غير موجود في export لم يتم استنتاجه. راجع الأعمدة الناقصة قبل النشر.',
    'سجل المصادر': sourceUrl ? `${sourceName}: ${sourceUrl}` : sourceName,
  };

  return {
    summary: rows.length ? `مسودة كروت مبنية على export من ${sourceName} لـ ${teamName}.` : `لم يتم توليد مسودة مكتملة لـ ${teamName}.`,
    sections,
    detectedColumns: headers,
    detectedRows: rows.length,
    warnings,
  };
}
