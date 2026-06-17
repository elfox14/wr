function ar(value: number | null | undefined, fallback = '٠') {
  return value === null || value === undefined ? fallback : value.toLocaleString('ar-EG');
}

type StatProps = {
  label: string;
  home: number | null;
  away: number | null;
  accent?: boolean;
};

function valueClass(accent: boolean) {
  return accent ? 'text-[#FFD700]' : 'text-white';
}

function barClass(accent: boolean, empty: boolean) {
  return `h-full rounded-full ${accent ? 'bg-[#FFD700]' : 'bg-[#0FF0FC]'} ${empty ? 'opacity-25' : ''}`;
}

export function MiniStat({ label, home, away, accent = false }: StatProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 text-xs font-black">
        <span className={valueClass(accent)}>{ar(home)}</span>
        <span className="text-center text-gray-500">{label}</span>
        <span className={valueClass(accent)}>{ar(away)}</span>
      </div>
    </div>
  );
}

export function StatRow({ label, home, away, accent = false }: StatProps) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homePct = total > 0 ? Math.max(6, Math.round((h / total) * 100)) : 50;
  const awayPct = total > 0 ? Math.max(6, Math.round((a / total) * 100)) : 50;
  const empty = home === null && away === null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[44px_1fr_44px] items-center gap-3 text-xs font-black">
        <span className={valueClass(accent)}>{ar(home)}</span>
        <span className="text-center text-gray-400">{label}</span>
        <span className={valueClass(accent)}>{ar(away)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-white/10" dir="rtl">
          <div className={barClass(accent, empty)} style={{ width: `${homePct}%` }} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className={barClass(accent, empty)} style={{ width: `${awayPct}%` }} />
        </div>
      </div>
    </div>
  );
}
