export type SportsReferenceMode = 'disabled' | 'manual_export' | 'api';

export type SportsReferenceSourceStatus = {
  enabled: boolean;
  mode: SportsReferenceMode;
  ready: boolean;
  provider: 'Sports Reference / Stathead / FBref';
  missing: string[];
  availableConfig: string[];
  nextAction: string;
};

function getMode(): SportsReferenceMode {
  const enabled = process.env.SPORTS_REFERENCE_ENABLED === 'true';
  if (!enabled) return 'disabled';

  const mode = (process.env.SPORTS_REFERENCE_MODE || 'manual_export').toLowerCase();
  if (mode === 'api') return 'api';
  return 'manual_export';
}

export function getSportsReferenceSourceStatus(): SportsReferenceSourceStatus {
  const mode = getMode();
  const enabled = mode !== 'disabled';
  const missing: string[] = [];
  const availableConfig: string[] = [];

  if (!enabled) {
    missing.push('SPORTS_REFERENCE_ENABLED=true');
  } else {
    availableConfig.push('SPORTS_REFERENCE_ENABLED');
  }

  if (mode === 'manual_export') {
    if (process.env.SPORTS_REFERENCE_EXPORTS_DIR) availableConfig.push('SPORTS_REFERENCE_EXPORTS_DIR');
    else missing.push('SPORTS_REFERENCE_EXPORTS_DIR');
  }

  if (mode === 'api') {
    if (process.env.SPORTS_REFERENCE_API_BASE_URL) availableConfig.push('SPORTS_REFERENCE_API_BASE_URL');
    else missing.push('SPORTS_REFERENCE_API_BASE_URL');

    if (process.env.SPORTS_REFERENCE_API_KEY) availableConfig.push('SPORTS_REFERENCE_API_KEY');
    else missing.push('SPORTS_REFERENCE_API_KEY');
  }

  const ready = enabled && missing.length === 0;

  return {
    enabled,
    mode,
    ready,
    provider: 'Sports Reference / Stathead / FBref',
    missing,
    availableConfig,
    nextAction: ready
      ? 'Sports Reference source is ready for automated/manual sourced imports. Use short cited metrics in reports and avoid bulk table republication.'
      : 'Configure the missing environment variables, then run the status endpoint again.',
  };
}

export function buildSportsReferenceMetricSource(sourceUrl?: string | null) {
  return {
    sourceName: 'Sports Reference / Stathead / FBref subscription',
    sourceUrl: sourceUrl || 'https://www.sports-reference.com/',
    sourceCategory: 'stats' as const,
    confidence: 'B' as const,
    provider: 'SPORTS_REFERENCE_SUBSCRIPTION',
  };
}
