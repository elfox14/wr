import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, BarChart3, Flame, Footprints, History, ShieldAlert, Sparkles, Target, TrendingUp, Trophy, UserRound, Zap } from 'lucide-react';

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
  if (!rating) return { label: 'تقديري', color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10' };
  if (rating >= 85) return { label: 'أداء استثنائي', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
  if (rating >= 75) return { label: 'أداء قوي', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
  if (rating >= 65) return { label: 'أداء جيد', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' };
  if (rating < 45) return { label: 'أداء ضعيف', color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' };
  return { label: 'أداء متوسط', color: 'text-gray-300', bg: 'bg-white/5', border: 'border-white/10' };
}

function getPlayerType(asset: any) {
  const position = String(asset.position || '').toUpperCase();
  if (position === 'GK') return 'حارس مرمى';
  if (position === 'DEF') return 'مدافع';
  if (position === 'MID') return 'لاعب وسط';
  if (position === 'FWD') return 'مهاجم';
  return 'لاعب متعدد الأدوار';
}

function getSportsInsight(asset: any, latest: any) {
  const position = String(asset.position || '').toUpperCase();
  const parts: string[] = [];

  if (latest?.internalRating >= 80) parts.push('آخر أداء فعلي قوي، ويعكس جاهزية فنية جيدة داخل الملعب.');
  else if (latest?.internalRating && latest.internalRating < 45) parts.push('آخر أداء فعلي ضعيف، ويحتاج اللاعب لاستعادة تأثيره داخل الملعب.');
  else if (!latest) parts.push('لا توجد بيانات مباراة فعلية حديثة بعد، لذلك يظهر التحليل الفني الحالي كتقدير مبني على بيانات اللاعب الأساسية.');

  if (position === 'FWD') parts.push('كمهاجم، الأهداف والتسديدات على المرمى هي أهم مؤشرات رفع تقييمه الفني.');
  else if (position === 'MID') parts.push('كلاعب وسط، التمريرات المفتاحية ودقة التمرير وصناعة اللعب هي عناصر التحليل الأهم.');
  else if (position === 'DEF') parts.push('كمدافع، التدخلات، الاعتراضات، والشباك النظيفة هي محركات تقييمه الفني.');
  else if (position === 'GK') parts.push('كحارس، التصديات والأهداف المستقبلة والتصدي للفرص الكبيرة هي مؤشرات الأداء الأساسية.');

  if (asset.worldCupLegacy >= 75) parts.push('لديه وزن مونديالي واضح، وهذا يرفع قيمة الخبرة في المباريات الكبيرة.');

  return parts.slice(0, 4);
}

function getMarketInsight(asset: any, latest: any, premiumDiscount: number) {
  const parts: string[] = [];

  if (premiumDiscount <= -5) parts.push('السعر الحالي أقل من القيمة العادلة، ما يجعله مرشحًا للمراقبة داخل السوق.');
  else if (premiumDiscount >= 10) parts.push('السعر أعلى من القيمة العادلة، لذلك يتحرك الأصل بعلاوة تحتاج متابعة.');
  else parts.push('السعر قريب من القيمة العادلة، وحركة الزخم قد تكون العامل الحاسم.');

  if ((asset.marketDemand || 50) >= 70) parts.push('الطلب السوقي مرتفع، ما يعني اهتمامًا واضحًا من المستخدمين.');
  if ((asset.momentum || 50) >= 70) parts.push('الزخم قوي، وقد يزيد تأثير أي خبر أو أداء إيجابي جديد.');
  if ((asset.volatilityScore || 50) >= 70) parts.push('التقلب مرتفع؛ حركة السعر قد تكون حادة بعد المباريات أو الأخبار.');
  if (latest?.momentumImpact) parts.push(`آخر أداء أثّر على الزخم بقيمة ${latest.momentumImpact > 0 ? '+' : ''}${latest.momentumImpact}.`);

  return parts.slice(0, 4);
}

function parseJsonArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
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

function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-black text-white">{value || 'غير متاح'}</span>
    </div>
  );
}

function PillarBar({ label, value, weight, color = 'bg-primary' }: { label: string; value: number; weight?: string; color?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <div className="font-bold text-white">{label}</div>
        <div className="flex items-center gap-2">
          {weight && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">وزن {weight}</span>}
          <span className="font-black text-gray-300 tabular-nums">{safeValue.toFixed(0)}/100</span>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/50">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function EmptyDataNotice({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-gray-400">
      <AlertCircle className="mb-2 text-gray-500" size={18} />
      {text}
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
  const fairValue = Number(asset.fairValue ?? asset.current_price ?? marketPrice);
  const premiumDiscount = getPremiumDiscount(asset);
  const sportsInsights = getSportsInsight(asset, latest);
  const marketInsights = getMarketInsight(asset, latest, premiumDiscount);
  const previousClubs = parseJsonArray(asset.previousClubs);
  const worldCup2022Stats = asset.worldCup2022Stats || null;

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4 pt-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">PLAYER ANALYSIS TERMINAL</span>
              <span className={`rounded-xl border px-3 py-1 text-xs font-black ${ratingMeta.bg} ${ratingMeta.border} ${ratingMeta.color}`}>{ratingMeta.label}</span>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{getPlayerType(asset)}</span>
            </div>
            <h2 className="text-2xl font-black text-white md:text-3xl">تحليل اللاعب: {asset.name}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-gray-400">
              الصفحة مقسومة إلى تحليل رياضي داخل الملعب وتحليل سوقي للسهم الافتراضي. لا يتم عرض بيانات تاريخية وهمية؛ أي معلومة غير متاحة تظهر بوضوح كغير متاحة.
            </p>
          </div>
          <Link href="/performance" className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">
            أداء اليوم <Activity size={16} />
          </Link>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black text-white"><Footprints size={20} className="text-primary" /> التحليل الرياضي الفني</h3>
                <p className="mt-1 text-xs text-gray-500">أداء اللاعب داخل الملعب، مركزه، خبرته، وتاريخه الكروي.</p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">SPORT</span>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <MetricCard label="تقييم الأداء الفعلي" value={rating ? Number(rating).toFixed(1) : '—'} hint={latest ? `آخر تحديث: ${formatDate(latest.createdAt)}` : 'لا توجد مزامنة بعد'} icon={<Target size={16} />} />
              <MetricCard label="التقييم الفني" value={`${Math.round(asset.fundamental || asset.score || 50)}/100`} hint="Fundamental" icon={<Trophy size={16} />} accent="text-accent" />
              <MetricCard label="إرث كأس العالم" value={`${Math.round(asset.worldCupLegacy || 50)}/100`} hint="خبرة وتأثير مونديالي" icon={<History size={16} />} accent="text-yellow-300" />
              <MetricCard label="دقائق آخر أداء" value={latest ? latest.minutes : '—'} hint={latest ? 'من آخر مباراة مزامنة' : 'غير متاح'} icon={<Activity size={16} />} accent="text-success" />
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <InfoRow label="المركز" value={asset.position || 'غير متاح'} />
              <InfoRow label="العمر" value={asset.age ? `${asset.age} سنة` : 'غير متاح'} />
              <InfoRow label="النادي الحالي" value={asset.club || 'غير متاح'} />
              <InfoRow label="المنتخب" value={asset.team?.name || 'غير متاح'} />
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><Sparkles size={16} className="text-primary" /> قراءة فنية</h4>
              <div className="space-y-3">
                {sportsInsights.map((insight, index) => (
                  <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><UserRound size={16} className="text-accent" /> الأندية السابقة</h4>
              {previousClubs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {previousClubs.map((club) => <span key={club} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-gray-300">{club}</span>)}
                </div>
              ) : (
                <EmptyDataNotice text="لا توجد بيانات موثقة للأندية السابقة بعد. يمكن إضافتها لاحقًا عبر API-Football أو إدخالها يدويًا في PlayerProfile." />
              )}
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><Trophy size={16} className="text-yellow-300" /> أداء كأس العالم 2022</h4>
              {worldCup2022Stats ? (
                <pre className="overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs text-gray-300">{JSON.stringify(worldCup2022Stats, null, 2)}</pre>
              ) : (
                <EmptyDataNotice text="لا توجد بيانات كأس العالم 2022 لهذا اللاعب بعد. المرحلة التالية يمكن أن تضيف استيراد StatsBomb Open Data لعرض مشاركاته وإحصائياته التاريخية بدقة." />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black text-white"><BarChart3 size={20} className="text-accent" /> تحليل السهم والسوق</h3>
                <p className="mt-1 text-xs text-gray-500">قيمة اللاعب كأصل افتراضي داخل MC PRIME Exchange.</p>
              </div>
              <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">MARKET</span>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <MetricCard label="السعر الحالي" value={formatPrice(marketPrice)} hint="Market Price" icon={<BarChart3 size={16} />} accent="text-primary" />
              <MetricCard label="القيمة العادلة" value={formatPrice(fairValue)} hint="Fair Value" icon={<Target size={16} />} accent="text-accent" />
              <MetricCard label="خصم / علاوة" value={`${premiumDiscount > 0 ? '+' : ''}${premiumDiscount.toFixed(1)}%`} hint={premiumDiscount <= 0 ? 'أقل أو قريب من العادلة' : 'يتداول بعلاوة'} icon={<TrendingUp size={16} />} accent={premiumDiscount <= 0 ? 'text-success' : 'text-danger'} />
              <MetricCard label="التقلب" value={`${Math.round(asset.volatilityScore || 50)}/100`} hint={(asset.volatilityScore || 50) >= 70 ? 'حركة سعر حادة' : 'قابل للإدارة'} icon={<ShieldAlert size={16} />} accent={(asset.volatilityScore || 50) >= 70 ? 'text-danger' : 'text-yellow-300'} />
              <MetricCard label="الزخم" value={`${Math.round(asset.momentum || 50)}/100`} hint={latest ? `آخر تأثير: ${latest.momentumImpact > 0 ? '+' : ''}${latest.momentumImpact}` : 'تقديري'} icon={<Flame size={16} />} accent="text-success" />
              <MetricCard label="الطلب السوقي" value={`${Math.round(asset.marketDemand || 50)}/100`} hint={latest ? `آخر تأثير: ${latest.marketImpact > 0 ? '+' : ''}${latest.marketImpact}` : 'تقديري'} icon={<Zap size={16} />} accent="text-primary" />
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><Sparkles size={16} className="text-primary" /> قراءة سوقية</h4>
              <div className="space-y-3">
                {marketInsights.map((insight, index) => (
                  <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-4 flex items-center gap-2 font-black text-white"><Activity size={16} className="text-success" /> آخر أداء وتأثيره على السوق</h4>
              {latest ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="الأهداف" value={latest.goals} />
                  <InfoRow label="الأسيست" value={latest.assists} />
                  <InfoRow label="تسديدات على المرمى" value={latest.shotsOnTarget} />
                  <InfoRow label="تمريرات مفتاحية" value={latest.keyPasses} />
                  <InfoRow label="تأثير الزخم" value={`${latest.momentumImpact > 0 ? '+' : ''}${latest.momentumImpact}`} />
                  <InfoRow label="تأثير السوق" value={`${latest.marketImpact > 0 ? '+' : ''}${latest.marketImpact}`} />
                </div>
              ) : (
                <EmptyDataNotice text="لا توجد بيانات أداء فعلية لهذا اللاعب بعد. بعد مزامنة مباراة من لوحة الإدارة سيظهر أثر الأداء على الزخم والطلب." />
              )}
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-4 flex items-center gap-2 font-black text-white"><BarChart3 size={16} className="text-accent" /> أعمدة التقييم السوقي</h4>
              <div className="space-y-4">
                <PillarBar label="Fundamental" value={asset.fundamental || 50} weight="35%" color="bg-primary" />
                <PillarBar label="Popularity" value={asset.popularity || 50} weight="20%" color="bg-yellow-300" />
                <PillarBar label="WorldCupLegacy" value={asset.worldCupLegacy || 50} weight="15%" color="bg-accent" />
                <PillarBar label="MarketDemand" value={asset.marketDemand || 50} weight="20%" color="bg-success" />
                <PillarBar label="Momentum" value={asset.momentum || 50} weight="10%" color="bg-danger" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
