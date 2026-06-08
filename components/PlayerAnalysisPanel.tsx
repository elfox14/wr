import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, BarChart3, Flame, ShieldAlert, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';

type PlayerAnalysisPanelProps = {
  asset: any;
};

function formatPrice(value: number | null | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()}¢`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'لا يوجد تحديث';
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPremiumDiscount(asset: any) {
  const marketPrice = Number(asset.marketPrice ?? asset.current_price ?? 0);
  const fairValue = Number(asset.fairValue ?? asset.current_price ?? marketPrice);
  return fairValue > 0 ? ((marketPrice - fairValue) / fairValue) * 100 : 0;
}

function getPerformanceLabel(rating?: number | null) {
  if (!rating) return { label: 'لا توجد بيانات أداء فعلية', color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10' };
  if (rating >= 85) return { label: 'أداء استثنائي', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
  if (rating >= 75) return { label: 'أداء قوي', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
  if (rating >= 65) return { label: 'أداء جيد', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' };
  if (rating < 45) return { label: 'أداء ضعيف', color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' };
  return { label: 'أداء متوسط', color: 'text-gray-300', bg: 'bg-white/5', border: 'border-white/10' };
}

function getPlayerInsight(asset: any, latest: any, premiumDiscount: number) {
  const parts: string[] = [];

  if (latest?.internalRating >= 85) parts.push('آخر أداء فعلي للاعب كان ممتازًا وقد يدعم الزخم والطلب السوقي.');
  else if (latest?.internalRating >= 75) parts.push('آخر أداء فعلي إيجابي ويعزز ثقة المتداولين في اللاعب.');
  else if (latest?.internalRating && latest.internalRating < 45) parts.push('آخر أداء فعلي ضعيف وقد يزيد ضغط البيع على الأصل.');
  else if (!latest) parts.push('لم يتم ربط أداء فعلي حديث بعد، لذلك يعتمد التحليل على التقييم التقديري والزخم السوقي.');

  if (premiumDiscount <= -5) parts.push('السعر الحالي أقل من القيمة العادلة، ما يجعله مرشحًا للمراقبة.');
  else if (premiumDiscount >= 10) parts.push('السعر أعلى من القيمة العادلة، ما يعني أن الأصل يتداول بعلاوة واضحة.');

  if ((asset.volatilityScore || 0) >= 70) parts.push('درجة التقلب مرتفعة، لذلك حركة السعر قد تكون حادة بعد الأخبار أو المباريات.');
  else if ((asset.volatilityScore || 0) <= 30) parts.push('درجة التقلب منخفضة نسبيًا، ما يجعله أصلًا أكثر استقرارًا داخل المحفظة.');

  return parts.slice(0, 3);
}

function MetricCard({ label, value, hint, icon, accent = 'text-primary' }: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
      <div className={`mb-2 flex items-center gap-2 text-xs font-bold ${accent}`}>{icon}{label}</div>
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function PillarBar({ label, value, weight, color = 'bg-primary' }: { label: string; value: number; weight: string; color?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <div className="font-bold text-white">{label}</div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">وزن {weight}</span>
          <span className="font-black text-gray-300 tabular-nums">{safeValue.toFixed(0)}/100</span>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/50">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function PlayerAnalysisPanel({ asset }: PlayerAnalysisPanelProps) {
  if (!asset || asset.type !== 'PLAYER') return null;

  const performances = asset.performances || [];
  const latest = performances[0] || null;
  const rating = asset.lastPerformanceRating ?? latest?.internalRating ?? null;
  const ratingMeta = getPerformanceLabel(rating);
  const marketPrice = Number(asset.marketPrice ?? asset.current_price ?? 0);
  const premiumDiscount = getPremiumDiscount(asset);
  const insights = getPlayerInsight(asset, latest, premiumDiscount);

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4 pt-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">PLAYER ANALYSIS TERMINAL</span>
              <span className={`rounded-xl border px-3 py-1 text-xs font-black ${ratingMeta.bg} ${ratingMeta.border} ${ratingMeta.color}`}>{ratingMeta.label}</span>
            </div>
            <h2 className="text-2xl font-black text-white md:text-3xl">تحليل اللاعب: {asset.name}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-400">
              تحليل يجمع بين الأداء الفعلي عند توفره، أعمدة التقييم، القيمة العادلة، الزخم، الطلب، والتقلب. كل البيانات المعروضة محفوظة في قاعدة البيانات ولا تستهلك API عند زيارة الصفحة.
            </p>
          </div>
          <Link href="/performance" className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">
            أداء اليوم <Activity size={16} />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="تقييم الأداء الفعلي"
            value={rating ? `${Number(rating).toFixed(1)}` : '—'}
            hint={latest ? `آخر تحديث: ${formatDate(latest.createdAt)}` : 'لم تتم مزامنة أداء فعلي بعد'}
            icon={<Target size={16} />}
            accent="text-primary"
          />
          <MetricCard
            label="السعر الحالي"
            value={formatPrice(marketPrice)}
            hint={`القيمة العادلة: ${formatPrice(asset.fairValue ?? marketPrice)}`}
            icon={<BarChart3 size={16} />}
            accent="text-accent"
          />
          <MetricCard
            label="خصم / علاوة"
            value={`${premiumDiscount > 0 ? '+' : ''}${premiumDiscount.toFixed(1)}%`}
            hint={premiumDiscount <= 0 ? 'أقل أو قريب من القيمة العادلة' : 'يتداول بعلاوة'}
            icon={<TrendingUp size={16} />}
            accent={premiumDiscount <= 0 ? 'text-success' : 'text-danger'}
          />
          <MetricCard
            label="الزخم"
            value={`${Math.round(asset.momentum || 50)}/100`}
            hint={latest ? `تأثير آخر أداء: ${latest.momentumImpact > 0 ? '+' : ''}${latest.momentumImpact}` : 'زخم تقديري'}
            icon={<Flame size={16} />}
            accent="text-success"
          />
          <MetricCard
            label="التقلب"
            value={`${Math.round(asset.volatilityScore || 50)}/100`}
            hint={(asset.volatilityScore || 50) >= 70 ? 'حركة سعر حادة' : 'مخاطر قابلة للإدارة'}
            icon={<ShieldAlert size={16} />}
            accent={(asset.volatilityScore || 50) >= 70 ? 'text-danger' : 'text-yellow-300'}
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Sparkles size={18} className="text-primary" /> قراءة تحليلية سريعة</h3>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="flex gap-3 rounded-2xl border border-white/5 bg-white/5 p-3 text-sm leading-relaxed text-gray-300">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Zap size={18} className="text-yellow-300" /> آخر أداء فعلي</h3>
            {latest ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/5 p-3"><div className="text-xs text-gray-500">دقائق</div><div className="text-xl font-black text-white">{latest.minutes}</div></div>
                <div className="rounded-2xl bg-white/5 p-3"><div className="text-xs text-gray-500">أهداف</div><div className="text-xl font-black text-success">{latest.goals}</div></div>
                <div className="rounded-2xl bg-white/5 p-3"><div className="text-xs text-gray-500">أسيست</div><div className="text-xl font-black text-accent">{latest.assists}</div></div>
                <div className="rounded-2xl bg-white/5 p-3"><div className="text-xs text-gray-500">تمريرات مفتاحية</div><div className="text-xl font-black text-primary">{latest.keyPasses}</div></div>
                <div className="rounded-2xl bg-white/5 p-3"><div className="text-xs text-gray-500">زخم</div><div className={latest.momentumImpact >= 0 ? 'text-xl font-black text-success' : 'text-xl font-black text-danger'}>{latest.momentumImpact > 0 ? '+' : ''}{latest.momentumImpact}</div></div>
                <div className="rounded-2xl bg-white/5 p-3"><div className="text-xs text-gray-500">تأثير السوق</div><div className={latest.marketImpact >= 0 ? 'text-xl font-black text-success' : 'text-xl font-black text-danger'}>{latest.marketImpact > 0 ? '+' : ''}{latest.marketImpact}</div></div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-gray-400">
                لا توجد بيانات أداء فعلية لهذا اللاعب بعد. بعد انتهاء مباراة ومزامنتها من لوحة الإدارة سيظهر هنا التقييم والاحصائيات المؤثرة.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><BarChart3 size={18} className="text-accent" /> أعمدة تقييم اللاعب</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <PillarBar label="الأداء الفني Fundamental" value={asset.fundamental || 50} weight="35%" color="bg-primary" />
            <PillarBar label="الشعبية Popularity" value={asset.popularity || 50} weight="20%" color="bg-yellow-300" />
            <PillarBar label="إرث كأس العالم Legacy" value={asset.worldCupLegacy || 50} weight="15%" color="bg-accent" />
            <PillarBar label="الطلب السوقي Demand" value={asset.marketDemand || 50} weight="20%" color="bg-success" />
            <PillarBar label="الزخم Momentum" value={asset.momentum || 50} weight="10%" color="bg-danger" />
          </div>
        </div>
      </div>
    </section>
  );
}
