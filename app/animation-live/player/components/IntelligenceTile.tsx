type IntelligenceTileProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
};

export default function IntelligenceTile({ label, value, hint, accent = false }: IntelligenceTileProps) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? 'border-[#FFD700]/25 bg-[#FFD700]/10' : 'border-white/10 bg-black/25'}`}>
      <div className="text-[10px] font-black text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-black ${accent ? 'text-[#FFD700]' : 'text-white'}`}>{value}</div>
      {hint ? <div className="mt-1 text-[10px] font-bold text-gray-500">{hint}</div> : null}
    </div>
  );
}
