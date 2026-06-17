import type { DataQuality, PressureModel, Team } from '../types';
import { ar } from '../formatters';
import { windowLabel } from '../livePressureUtils';
import { sideName } from '../pressureUtils';
import DataQualityCard from './DataQualityCard';
import IntelligenceTile from './IntelligenceTile';
import MatchStoryCards from './MatchStoryCards';

type MatchIntelligencePanelProps = {
  pressure: PressureModel;
  quality: DataQuality;
  storyLines: string[];
  articleLines?: string[];
  home: Team;
  away: Team;
};

export default function MatchIntelligencePanel({ pressure, quality, storyLines, articleLines = [], home, away }: MatchIntelligencePanelProps) {
  const leaderName = sideName(pressure.leader, home, away);
  const totalPressure = pressure.home + pressure.away;

  return (
    <section className="order-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">Match Intelligence</div>
          <h2 className="mt-1 text-xl font-black text-white">قراءة ذكية للمباراة</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">
          ضغط إجمالي: <span className="text-white">{ar(totalPressure)}</span>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-3 text-sm font-bold leading-7 text-white">
        {pressure.readout}
      </div>

      <MatchStoryCards lines={storyLines} />

      {articleLines.length ? (
        <article className="mb-3 rounded-3xl border border-[#FFD700]/15 bg-black/25 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-[#FFD700]">مقالة تحليلية مباشرة</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black text-gray-400">تتحدث مع كل حدث وإحصائية</span>
          </div>
          <div className="space-y-2 text-sm font-bold leading-7 text-gray-100">
            {articleLines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 18)}`}>{line}</p>
            ))}
          </div>
        </article>
      ) : null}

      <DataQualityCard quality={quality} />

      <div className="grid gap-3 md:grid-cols-3">
        <IntelligenceTile label="الأخطر الآن" value={leaderName} hint={`المؤشر: ${ar(pressure.home)} - ${ar(pressure.away)}`} accent={pressure.leader !== 'balanced' && pressure.leader !== 'unknown'} />
        <IntelligenceTile label="رتم آخر ١٥ دقيقة" value={pressure.rhythm} hint={`آخر ١٥ دقيقة: ${windowLabel(pressure.window15)}`} />
        <IntelligenceTile label="الخطورة اللحظية" value={pressure.danger} hint={`آخر ٥ دقائق: ${windowLabel(pressure.window5)}`} accent={pressure.danger === 'مرتفعة'} />
      </div>
    </section>
  );
}
