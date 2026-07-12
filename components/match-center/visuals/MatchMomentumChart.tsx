'use client';

export type VerifiedMomentumPoint = { minute: number; value: number };

export default function MatchMomentumChart({ points = [] }: { points?: VerifiedMomentumPoint[] }) {
  const verified = points.filter((point) => Number.isFinite(point.minute) && Number.isFinite(point.value));
  if (!verified.length) return null;
  const maxMinute = Math.max(90, ...verified.map((point) => point.minute));
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
      {verified.map((point, index) => {
        const height = Math.min(100, Math.abs(point.value));
        return <div key={`${point.minute}-${index}`} className="absolute top-0 h-full" style={{ left: `${(point.minute / maxMinute) * 100}%` }}><div className="flex h-full w-1 flex-col"><div className="flex flex-1 items-end">{point.value > 0 && <i className="w-full bg-[#0FF0FC]" style={{ height: `${height}%` }} />}</div><div className="flex flex-1 items-start">{point.value < 0 && <i className="w-full bg-[#F8C846]" style={{ height: `${height}%` }} />}</div></div></div>;
      })}
    </div>
  );
}

