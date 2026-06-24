export const EGYPT_TIME_ZONE = 'Africa/Cairo';
export const EGYPT_TIME_ZONE_LABEL = 'توقيت مصر';

const EGYPT_FORMATTER = new Intl.DateTimeFormat('ar-EG', {
  timeZone: EGYPT_TIME_ZONE,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatEgyptDateTime(value: Date | string | number | null | undefined) {
  if (!value) return 'غير متوفر';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متوفر';
  return EGYPT_FORMATTER.format(date);
}

export function egyptTimePayload(value: Date | string | number | null | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return {
    timeZone: EGYPT_TIME_ZONE,
    label: EGYPT_TIME_ZONE_LABEL,
    isoUtc: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    formatted: formatEgyptDateTime(value),
  };
}
