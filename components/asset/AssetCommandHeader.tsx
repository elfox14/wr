import Link from 'next/link';
import { BookOpen, Brain, ShieldCheck, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react';

type AssetCommandHeaderProps = {
  asset: any;
  isTeam: boolean;
};

function formatPrice(value: unknown) {
  const n = Number(value || 0);
  return `${Math.round(n).toLocaleString()}¢`;
}

function scoreValue(value: unknown, fallback = 50) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function premiumDiscount(asset: any) {
  const marketPrice = Number(asset.marketPrice ?? asset.current_price ?? 0);
  const fairValue = Number(asset.fairValue ?? asset.current_price ?? marketPrice);
  if (!fairValue) return 0;
  return ((marketPrice - fairValue) / fairValue) * 100;
}

function verdict(asset: any) {
  const pd = premiumDiscount(asset);
  const momentum = scoreValue(asset.momentum);
  const demand = scoreValue(asset.marketDemand);
  const volatility = scoreValue(asset.volatilityScore);

  if (pd <= -10 && momentum >= 65) return { text: 'فرصة تحليلية قوية', tone: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10' };
  if (momentum >= 75 && demand >= 65) return { text: 'زخم وطلب مرتفعان', tone: 'text-[#0FF0FC] border-[#0FF0FC]/20 bg-[#0FF0FC]/10' };
  if (volatility >= 75) return { text: 'مخاطرة عالية', tone: 'text-red-300 border-red-400/20 bg-red-400/10' };
  if (pd > 12) return { text: 'سعر أعلى من القيمة', tone: 'text-orange-300 border-orange-400/20 bg-orange-400/10' };
  return { text: 'مراقبة وتحليل', tone: 'text-[#FFD700] border-[#FFD700]/20 bg-[#FFD700]/10' };
}

function metricBar(value: number, className: string) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

export function AssetCommandHeader({ asset, isTeam }: AssetCommandHeaderProps) {
  const marketPrice = asset.marketPrice ?? asset.current_price ?? 0;
  const fairValue = asset.fairValue ?? asset.current_price ?? marketPrice;
  const pd = premiumDiscount(asset);
  const change = Number(asset.change ?? 0);
  const isUp = change >= 0;
  const assetVerdict = verdict(asset);
  const momentum = scoreValue(asset.momentum);
  const demand = scoreValue(asset.marketDemand);
  const volatility = scoreValue(asset.volatilityScore);
  const technicalScore = scoreValue(asset.score ?? asset.fundamental);

  return (
    <section className="mx-auto mb-6 w-full max-w-[1600px] px-4">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-5 shadow-anti-gravity lg:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
              <Brain size={14} /> {isTeam ? 'TEAM COMMAND CENTER' : 'PLAYER COMMAND CENTER'}
            </p>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/35 text-2xl font-black text-white">
                {(asset.code || asset.name || '?').toString().slice(0, 3).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-black leading-tight text-white md:text-5xl">
                  {asset.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-300">
                  {isTeam
                    ? 'ملف منتخب تحليلي يجمع التقرير الفني، قوة اللاعبين، مؤشرات السوق، وتأثير المباريات القادمة.'
                    : 'ملف لاعب تحليلي يجمع الأداء الفني، القيمة السوقية، الزخم، الطلب، والمخاطرة قبل أي قرار افتراضي.'}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${assetVerdict.tone}`}>{assetVerdict.text}</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${isUp ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-red-400/20 bg-red-400/10 text-red-300'}`}>
                {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {isUp ? '+' : ''}{change.toFixed(1)}% خلال 24h
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-gray-300">
                {isTeam ? 'منتخب' : asset.position || 'لاعب'} · {asset.code || 'N/A'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-gray-500">السعر الحالي</p>
              <p className="mt-1 text-2xl font-black text-white">{formatPrice(marketPrice)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-gray-500">القيمة العادلة</p>
              <p className="mt-1 text-2xl font-black text-white">{formatPrice(fairValue)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-gray-500">فرق القيمة</p>
              <p className={`mt-1 text-2xl font-black ${pd <= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{pd > 0 ? '+' : ''}{pd.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-gray-500">Football IQ</p>
              <p className="mt-1 text-2xl font-black text-[#0FF0FC]">{technicalScore}/100</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-400">الزخم</span><Zap size={16} className="text-[#0FF0FC]" /></div>
            <p className="mt-2 text-lg font-black text-white">{momentum}/100</p>
            {metricBar(momentum, 'bg-[#0FF0FC]')}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-400">الطلب</span><Target size={16} className="text-[#FFD700]" /></div>
            <p className="mt-2 text-lg font-black text-white">{demand}/100</p>
            {metricBar(demand, 'bg-[#FFD700]')}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-gray-400">المخاطرة</span><ShieldCheck size={16} className="text-emerald-300" /></div>
            <p className="mt-2 text-lg font-black text-white">{volatility}/100</p>
            {metricBar(100 - volatility, 'bg-emerald-400')}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black text-[#FFD700]">لماذا هذا السعر؟</p>
              <p className="mt-1 text-sm leading-6 text-gray-300">
                راجع منهجية التسعير لفهم علاقة السعر بالقيمة العادلة، الزخم، الطلب، المخاطرة، وتأثير المباريات.
              </p>
            </div>
            <Link href="/methodology" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-4 py-3 text-xs font-black text-black transition hover:bg-[#ffe45c]">
              منهجية التسعير <BookOpen size={14} />
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="#technical-analysis" className="rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black transition hover:bg-[#70f7ff]">
            اقرأ التحليل الفني أولًا
          </Link>
          <Link href="/market" className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15">
            العودة للسوق
          </Link>
        </div>
      </div>
    </section>
  );
}
