'use client';

type Props = {
  updatedAt?: Date | string | null;
  compact?: boolean;
};

const LAST_UPDATED_LABEL = '\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b \u0644\u0644\u0628\u064a\u0627\u0646\u0627\u062a';
const NOW_LABEL = '\u0627\u0644\u0622\u0646';
const AGO_PREFIX = '\u0645\u0646\u0630';
const MINUTE_SHORT = '\u062f';
const HOUR_SHORT = '\u0633';

function validDate(value?: Date | string | null) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value);
}

function formatSince(value: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000));
  if (seconds < 45) return NOW_LABEL;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${AGO_PREFIX} ${formatCount(minutes)} ${MINUTE_SHORT}`;
  const hours = Math.floor(minutes / 60);
  return `${AGO_PREFIX} ${formatCount(hours)} ${HOUR_SHORT}`;
}

export default function HomeLastUpdatedStrip({ updatedAt, compact = false }: Props) {
  const date = validDate(updatedAt);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-2 font-black text-[#BFFBFF] ${compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'}`}>
      <span>{LAST_UPDATED_LABEL}</span>
      <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[#FFD700]">
        {formatSince(date)} • {formatTime(date)}
      </span>
    </div>
  );
}
