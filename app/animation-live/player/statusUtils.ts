export const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN'];
export const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];

export function normalizeStatus(status?: string | null) {
  return String(status || '').toUpperCase();
}

export function isFinishedStatus(status?: string | null) {
  return FINISHED_STATUSES.includes(normalizeStatus(status));
}

export function isHalfTimeStatus(status?: string | null) {
  return HALF_TIME_STATUSES.includes(normalizeStatus(status));
}

export function displayMatchStatus(status?: string | null) {
  const value = normalizeStatus(status);
  if (isFinishedStatus(value)) return 'انتهت';
  if (isHalfTimeStatus(value)) return 'استراحة';
  if (['IN_PLAY', 'LIVE', '1H', '2H', 'ET'].includes(value)) return 'مباشرة الآن';
  if (['SCHEDULED', 'TIMED', 'NOT_STARTED', 'NS'].includes(value)) return 'قادمة';
  return value || '—';
}
