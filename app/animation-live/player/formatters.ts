export function ar(value: number | null | undefined, fallback = '٠') {
  return value === null || value === undefined ? fallback : value.toLocaleString('ar-EG');
}

export function formatMatchDate(value?: string | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'موعد غير متوفر';
  return date.toLocaleString('ar-EG', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUpdatedAt(value?: string | null) {
  if (!value) return 'غير متوفر';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير متوفر';
  return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export function sourceLabel(provider?: string | null) {
  const value = String(provider || '').toUpperCase();
  if (value === 'ISPORTS_COMBINED') return 'iSports Combined';
  if (value === 'ISPORTS_REMOTE_LIVE') return 'iSports Visual Stats';
  if (value === 'ISPORTS_FLASH') return 'iSports FlashData';
  if (value === 'ISPORTS_TIMELINE') return 'iSports Timeline';
  if (value === 'FOOTBALL_DATA') return 'Football-Data';
  return value ? value.replace(/_/g, ' ') : 'قاعدة البيانات';
}
