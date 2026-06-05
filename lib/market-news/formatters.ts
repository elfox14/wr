// lib/market-news/formatters.ts
type Dict = Record<string, string | number | null | undefined>;

/**
 * Replace {key} placeholders in a template string with actual values.
 */
export function interpolate(template: string, params: Dict = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}

/**
 * Format a number for Arabic (ar-EG) or English (en-US) display.
 */
export function formatNumber(value: number, locale: 'ar' | 'en', digits = 2): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}
