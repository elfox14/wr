type MatchStoryCardsProps = {
  lines: string[];
};

export default function MatchStoryCards({ lines }: MatchStoryCardsProps) {
  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[10px] font-black text-gray-400">قصة المباراة</div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {lines.map((line, index) => (
          <div key={`${index}-${line}`} className="rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] font-bold leading-5 text-gray-200">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
