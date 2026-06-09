import { Activity, Brain, ShieldAlert, Sparkles, Target, TrendingUp } from 'lucide-react';
import { analyzeFootballAsset } from '../lib/analysis-adapter';

type Props = {
  asset: any;
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

function IconForCategory({ label }: { label: string }) {
  if (label.includes('فنية')) return <Sparkles size={16} />;
  if (label.includes('تكتيكي')) return <Brain size={16} />;
  if (label.includes('بدني')) return <Activity size={16} />;
  if (label.includes('دفاع')) return <ShieldAlert size={16} />;
  if (label.includes('هجومي')) return <Target size={16} />;
  return <TrendingUp size={16} />;
}

export function FootballTechnicalAnalysis({ asset, compact = false }: Props) {
  if (!asset) return null;

  const analysis = analyzeFootballAsset(asset);
  const title = asset.type === 'TEAM' ? 'التحليل الفني للمنتخب' : 'التحليل الفني للاعب';
  const subtitle = asset.type === 'TEAM'
    ? 'قراءة تكتيكية مبسطة لشكل المنتخب داخل الملعب بناءً على مؤشرات القوة، الزخم، الطلب، والاستقرار.'
    : 'قراءة فنية وتكتيكية مبسطة للاعب حسب مركزه ودوره داخل الملعب.';

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-3 lg:px-4">
      <div className="rounded-[1.7rem] border border-[#0FF0FC]/15 bg-[#101217] p-4 shadow-card lg:rounded-3xl lg:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
              <Brain size={14} /> Football IQ
            </div>
            <h2 className="text-xl font-black text-white lg:text-3xl">{title}</h2>
            <p className="mt-2 max-w-4xl text-xs leading-6 text-gray-400 lg:text-sm lg:leading-7">{subtitle}</p>
          </div>

          <div className={`rounded-[1.4rem] border px-5 py-4 text-center ${scoreTone(analysis.weightedScore)}`}>
            <p className="text-[11px] font-black uppercase tracking-wide">Technical Score</p>
            <p className="text-4xl font-black tabular-nums">{analysis.weightedScore}</p>
            <p className="mt-1 text-xs font-bold">{analysis.roleLabel}</p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-white"><Sparkles size={17} className="text-[#FFD700]" /> حكم التحليل</div>
          <p className="text-sm leading-7 text-gray-300">{analysis.verdict}</p>
        </div>

        <div className={`grid gap-3 ${compact ? 'lg:grid-cols-3' : 'lg:grid-cols-6'}`}>
          {analysis.categoryScores.map((category) => (
            <div key={category.key} className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-white"><IconForCategory label={category.label} /> {category.label}</span>
                <span className="text-sm font-black text-white tabular-nums">{category.score}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${barTone(category.score)}`} style={{ width: `${category.score}%` }} />
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-gray-500">{category.reasons[0]}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
            <h3 className="mb-3 text-sm font-black text-emerald-300">نقاط القوة</h3>
            <ul className="space-y-2 text-xs leading-6 text-gray-300">
              {analysis.strengths.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/5 p-4">
            <h3 className="mb-3 text-sm font-black text-[#FFD700]">نقاط تحتاج متابعة</h3>
            <ul className="space-y-2 text-xs leading-6 text-gray-300">
              {analysis.weaknesses.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
