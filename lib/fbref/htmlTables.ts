import type { FbrefTable } from './importer';

export type FbrefLink = { name: string; href: string };

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttr(tag: string, attr: string) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'));
  return match?.[1] || null;
}

function absolutizeHref(href: string | null, pageUrl: string) {
  if (!href) return null;
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return href;
  }
}

function extractFirstHref(html: string, pageUrl: string) {
  const match = html.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return absolutizeHref(match?.[1] || null, pageUrl);
}

function parseCells(rowHtml: string, pageUrl: string) {
  const cells: { key: string | null; text: string; href: string | null }[] = [];
  const cellRegex = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(rowHtml))) {
    const attrs = match[2] || '';
    const inner = match[3] || '';
    cells.push({
      key: getAttr(attrs, 'data-stat'),
      text: cleanText(inner),
      href: extractFirstHref(inner, pageUrl),
    });
  }
  return cells;
}

function parseTable(tableHtml: string, pageUrl: string): FbrefTable | null {
  const tableTag = tableHtml.match(/<table\b([^>]*)>/i)?.[1] || '';
  const id = getAttr(tableTag, 'id');
  const caption = cleanText(tableHtml.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || id || 'table');

  const thead = tableHtml.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '';
  const headerRows = [...thead.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((item) => item[1]);
  const headerCells = parseCells(headerRows[headerRows.length - 1] || '', pageUrl);
  const headers = headerCells.map((cell, index) => cell.key || cell.text || `col_${index}`);

  const tbody = tableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || tableHtml;
  const rowRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  const rows: string[][] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tbody))) {
    const rowAttrs = rowMatch[1] || '';
    if (/class=["'][^"']*thead/i.test(rowAttrs)) continue;
    const cells = parseCells(rowMatch[2] || '', pageUrl);
    const values = cells.map((cell) => cell.text);
    if (values.some(Boolean)) rows.push(values);
  }

  if (!headers.length && !rows.length) return null;
  return { id, caption, headers, rows, rowCount: rows.length, pageUrl };
}

function extractHtmlComments(html: string) {
  return [...html.matchAll(/<!--[\s\S]*?-->/g)]
    .map((match) => match[0].slice(4, -3))
    .filter((comment) => comment.includes('<table'));
}

export function extractFbrefTablesFromHtml(html: string, pageUrl: string) {
  const sources = [html, ...extractHtmlComments(html)];
  const tables: FbrefTable[] = [];

  for (const source of sources) {
    const tableMatches = source.match(/<table\b[\s\S]*?<\/table>/gi) || [];
    for (const tableHtml of tableMatches) {
      const table = parseTable(tableHtml, pageUrl);
      if (!table) continue;
      const key = `${table.id || ''}::${table.caption || ''}`;
      if (!tables.some((existing) => `${existing.id || ''}::${existing.caption || ''}` === key)) tables.push(table);
    }
  }

  return tables;
}

export function extractFbrefSquadLinks(html: string, pageUrl: string): FbrefLink[] {
  const links: FbrefLink[] = [];
  const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html))) {
    const href = absolutizeHref(getAttr(match[1] || '', 'href'), pageUrl);
    if (!href || !/\/en\/squads\/[a-z0-9]+\//i.test(href) || !/Stats/i.test(href)) continue;
    const name = cleanText(match[2] || '').replace(/ Stats$/i, '').trim();
    if (!name) continue;
    if (!links.some((link) => link.href === href)) links.push({ name, href });
  }

  return links;
}
