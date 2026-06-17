import type { Snapshot } from '../types';
import { formatUpdatedAt, sourceLabel } from '../formatters';
import { n } from '../matchAnalysisUtils';
import { MiniStat, StatRow } from './StatCards';

type LiveStatsPanelProps = {
  snapshot: Snapshot;
  provider?: string | null;
  updatedAt?: string | null;
};

export default function LiveStatsPanel({ snapshot, provider, updatedAt }: LiveStatsPanelProps) {
  const homePossession = n(snapshot, 'homePossession');
  const awayPossession = n(snapshot, 'awayPossession');
  const homeAttacks = n(snapshot, 'homeAttacks');
  const awayAttacks = n(snapshot, 'awayAttacks');
  const homeDangerousAttacks = n(snapshot, 'homeDangerousAttacks');
  const awayDangerousAttacks = n(snapshot, 'awayDangerousAttacks');
  const homeShots = n(snapshot, 'homeShots');
  const awayShots = n(snapshot, 'awayShots');
  const homeShotsOnTarget = n(snapshot, 'homeShotsOnTarget');
  const awayShotsOnTarget = n(snapshot, 'awayShotsOnTarget');
  const homeShotsOffTarget = n(snapshot, 'homeShotsOffTarget');
  const awayShotsOffTarget = n(snapshot, 'awayShotsOffTarget');
  const homeCorners = n(snapshot, 'homeCorners');
  const awayCorners = n(snapshot, 'awayCorners');
  const homeYellowCards = n(snapshot, 'homeYellowCards');
  const awayYellowCards = n(snapshot, 'awayYellowCards');
  const homeRedCards = n(snapshot, 'homeRedCards');
  const awayRedCards = n(snapshot, 'awayRedCards');

  return (
    <section className="order-3 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-[#FFD700]">Live Stats</div>
          <h2 className="mt-1 text-xl font-black text-white">إحصائيات المباراة</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black text-gray-400">
          {sourceLabel(provider)} · {formatUpdatedAt(updatedAt)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MiniStat label="الاستحواذ" home={homePossession} away={awayPossession} accent />
        <MiniStat label="التسديدات" home={homeShots} away={awayShots} />
        <MiniStat label="على المرمى" home={homeShotsOnTarget} away={awayShotsOnTarget} accent />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <StatRow label="الهجمات" home={homeAttacks} away={awayAttacks} />
        <StatRow label="الهجمات الخطيرة" home={homeDangerousAttacks} away={awayDangerousAttacks} accent />
        <StatRow label="تسديدات خارج المرمى" home={homeShotsOffTarget} away={awayShotsOffTarget} />
        <StatRow label="الركنيات" home={homeCorners} away={awayCorners} />
        <StatRow label="بطاقات صفراء" home={homeYellowCards} away={awayYellowCards} />
        <StatRow label="بطاقات حمراء" home={homeRedCards} away={awayRedCards} accent />
      </div>
    </section>
  );
}
