import { Activity, Brain, Gauge, ShieldAlert, Sparkles, Target, TrendingUp } from 'lucide-react';
import { MarketAnalysisBadge } from './MarketAnalysisBadge';
import { analyzeFootballAsset, type FootballAnalysisAssetInput } from '../lib/analysis-adapter';

 type Props = {
  asset: FootballAnalysisAssetInput;
  compact?: boolean;
};

function scoreTone(score: number) {
  if (score >= 78) return 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10';
  if (score >= 60) return 'text-[#0FF0FC] border-[#0FF0FC]/25 bg-[#0FF0FC]/10';
  if (score >= 45) return 'text-[#FFD700] border-[#FFD700]/25 bg-[#FFD700]/10';
  return 'text-red-300 border-red-400/25 bg-red-400/10';
}

function barTone(score: number) {
  if (score >= 78) return 'bg-emerald-400';
  if (score >= 60) return 'bg-[#0FF0FC]';
  if (score >= 45) return 'bg-[#FFD700]';
  return 'bg-red-400';
}

function gradeLabel(score: number) {
  if (score >= 82) return 'جاهزية فنية ممتازة';
  if (score >= 70) return 'جاهزية قوية';
  if (score >= 55) return 'جاهزية متوسطة';
  return 'يحتاج متابعة فنية';
}

function IconForCategory({ label }: { label: string }) {
  if (label.includes('فنية')) return <Sparkles size={16} />;
  if (label.includes('تكتيكي')) return <Brain size={16} />;
  if (label.includes('بدني')) return <Activity size={16} />;
  if (label.includes('دفاع')) return <ShieldAlert size={16} />;
  if (label.includes('هجومي')) return <Target size={16} />;
  return <TrendingUp size={16} />;
}

function SourceNotice({ isTeam }: { isTeam: boolean }) {
  return (
    <div className="rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.045] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-yellow-200"><Gauge size={17} /> مصدر الأرقام</div>
      <p className="text-xs leading-6 text-gray-300">
        {isTeam
          ? 'هذا التب مخصص لمؤشرات الجاهزية فقط. أي رقم غير موثق من مصدر خارجي أو مزود بيانات مرخّص يجب التعامل معه كغير متوفر في المصادر، ولا يظهر هنا كتوصية تداول أو تقييم سعري.'
          : 'هذا التقييم فني وسوقي مبسط داخل المنصة، وليس توصية مالية أو ضمان حركة سعرية.'}
      </p>
    </div>
  );
}

export function FootballTechnicalAnalysis({ asset, compact = false }: Props) {
  if (!asset) return null;

  const analysis = analyzeFootballAsset(asset);
  const isTeam = asset.type === 'TEAM';
  const title = isTeam ? 'مؤشرات الجاهزية' : 'التحليل الفني للاعب';
  const subtitle = isTeam
    ? 'تب منفصل لمؤشرات الجاهزية الكروية فقط. التداول والسعر والقيمة العادلة في تب التداول.'
    : 'قراءة فنية وتكتيكية مبسطة للاعب حسب مركزه ودوره داخل الملعب.';

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-3 lg:px-4">
      <div className="overflow-hidden rounded-[1.7rem] border border-[#0FF0FC]/15 bg-[#101217] shadow-card lg:rounded-3xl">
        <div className="border-b border-white/10 bg-gradient-to-br from-[#0FF0FC]/10 via-transparent to-[#FFD700]/5 p-4 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
                <Brain size={14} /> {isTeam ? 'READINESS INDICATORS' : 'Football IQ'}
              </div>
              <h2 className="text-xl font-black text-white lg:text-3xl">{title}</h2>
              <p className="mt-2 text-xs leading-6 text-gray-400 lg:text-sm lg:leading-7">{subtitle}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
              <div className={`rounded-[1.4rem] border px-5 py-4 text-center ${scoreTone(analysis.weightedScore)}`}>
                <p className="text-[11px] font-black uppercase tracking-wide">Readiness Score</p>
                <p className="text-4xl font-black tabular-nums">{analysis.weightedScore}</p>
                <p className="mt-1 text-xs font-bold">{gradeLabel(analysis.weightedScore)}</p>
              </div>
              {!isTeam && <MarketAnalysisBadge asset={asset} />}
              {isTeam && <SourceNotice isTeam={isTeam} />}
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          <div className="mb-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-white"><Sparkles size={17} className="text-[#FFD700]" /> قراءة الجاهزية</div>
            <p className="text-sm leading-7 text-gray-300">{analysis.verdict}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black text-gray-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">الدور: {analysis.roleLabel}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">نوع الأصل: {isTeam ? 'منتخب' : 'لاعب'}</span>
            </div>
          </div>

          {!compact && (
            <>
              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {analysis.categoryScores.map((category) => (
                  <div key={category.key} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-black text-white"><IconForCategory label={category.label} /> {category.label}</div>
                      <span className={`rounded-lg border px-2 py-1 text-xs font-black ${scoreTone(category.score)}`}>{category.score}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${barTone(category.score)}`} style={{ width: `${category.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-300"><TrendingUp size={17} /> نقاط القوة</div>
                  <ul className="space-y-2 text-sm leading-6 text-gray-300">
                    {analysis.strengths.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>

                <div className="rounded-2xl border border-red-400/15 bg-red-400/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-red-300"><ShieldAlert size={17} /> نقاط تحتاج متابعة</div>
                  <ul className="space-y-2 text-sm leading-6 text-gray-300">
                    {analysis.weaknesses.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-white"><Gauge size={17} className="text-[#0FF0FC]" /> ملاحظة تحريرية</div>
                <p className="text-xs leading-6 text-gray-400">
                  {isTeam
                    ? 'لا يتم استخدام هذا التب لعرض السعر، القيمة العادلة، أو توصيات التداول. أي رقم غير موثق بمصدر واضح يجب استبداله بعبارة: غير متوفر في المصادر.'
                    : 'هذا التقييم يدمج القراءة الفنية مع السعر الافتراضي داخل المنصة. الهدف منه مساعدة المستخدم على فهم جودة الأصل كرويًا، وليس تقديم توصية مالية أو ضمان حركة سعرية.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
