'use client';

import { useEffect, useState } from 'react';
import { Crosshair, Shield, Waypoints, Loader2, ExternalLink } from 'lucide-react';
import type { TeamFBRefStats } from '@/app/api/team-stats/[id]/route';

type FBRefStatsCardsProps = {
  teamId: string;
};

function StatRow({ label, value, unit }: { label: string; value: string | number | null | undefined; unit?: string }) {
  const display = value === null || value === undefined || value === '' ? '—' : `${value}${unit || ''}`;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-black text-white tabular-nums">{display}</span>
    </div>
  );
}

function StatsCard({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15">
      <div className={`mb-3 flex items-center gap-2 text-xs font-black ${color}`}>
        {icon}
        {title}
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

export default function FBRefStatsCards({ teamId }: FBRefStatsCardsProps) {
  const [stats, setStats] = useState<TeamFBRefStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/team-stats/${teamId}`)
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="animate-spin" size={20} />
        <span className="mr-2 text-sm">جاري تحميل إحصاءات FBRef...</span>
      </div>
    );
  }

  if (!stats || !stats.available) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-center text-sm text-gray-400">
        لا تتوفر إحصاءات FBRef لهذا المنتخب بعد. سيتم تحديثها بعد استيراد البيانات.
      </div>
    );
  }

  const { shooting, goalkeeping, misc, matchContext, standing } = stats;

  const conversionRate =
    shooting?.shots && shooting.goals
      ? ((shooting.goals / shooting.shots) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">
            FBREF STATS
          </span>
          {matchContext?.completedCount != null && matchContext.completedCount > 0 && (
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">
              {matchContext.completedCount} مباراة كأس عالم
            </span>
          )}
        </div>
        {stats.sourceUrl && (
          <a
            href={stats.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-primary transition"
          >
            <ExternalLink size={11} />
            المصدر
          </a>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Attack Card */}
        <StatsCard icon={<Crosshair size={15} />} title="الهجوم" color="text-danger">
          <StatRow label="الأهداف" value={shooting?.goals} />
          <StatRow label="إجمالي التسديدات" value={shooting?.shots} />
          <StatRow label="على المرمى" value={shooting?.shotsOnTarget} />
          <StatRow label="دقة التسديد" value={shooting?.shotAccuracy} unit="%" />
          <StatRow label="معدل التحويل" value={conversionRate} unit="%" />
          {standing && standing.gf != null && (
            <StatRow label="أهداف المجموعة" value={standing.gf} />
          )}
        </StatsCard>

        {/* Defense Card */}
        <StatsCard icon={<Shield size={15} />} title="الدفاع والحراسة" color="text-success">
          <StatRow label="أهداف مستقبلة" value={standing?.ga ?? goalkeeping?.goalsAgainst} />
          <StatRow label="الحارس الأساسي" value={goalkeeping?.goalkeeper} />
          <StatRow label="التصديات" value={goalkeeping?.saves} />
          <StatRow label="نسبة التصدي" value={goalkeeping?.savePercentage} />
          <StatRow label="تدخلات ناجحة" value={misc?.tacklesWon} />
          <StatRow label="اعتراضات" value={misc?.interceptions} />
        </StatsCard>

        {/* Style Card */}
        <StatsCard icon={<Waypoints size={15} />} title="الأسلوب والانضباط" color="text-primary">
          <StatRow label="الاستحواذ" value={matchContext?.averagePossession} unit="%" />
          <StatRow
            label="الرسم الخططي"
            value={matchContext?.formations?.length ? matchContext.formations.join(' / ') : null}
          />
          <StatRow label="بطاقات صفراء" value={misc?.yellowCards} />
          <StatRow label="بطاقات حمراء" value={misc?.redCards} />
          <StatRow label="أخطاء مرتكبة" value={misc?.fouls} />
          <StatRow label="عرضيات" value={misc?.crosses} />
        </StatsCard>
      </div>

      {/* Active Shooters */}
      {shooting?.activeShooters && shooting.activeShooters.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <h4 className="mb-3 text-xs font-black text-accent">أنشط المسددين</h4>
          <div className="flex flex-wrap gap-2">
            {shooting.activeShooters.map((shooter, i) => (
              <span
                key={i}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-gray-300"
              >
                {shooter}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Scorers & Assisters */}
      {stats.standard && (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.standard.scorers && stats.standard.scorers.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <h4 className="mb-3 text-xs font-black text-danger">الهدافون</h4>
              <div className="flex flex-wrap gap-2">
                {stats.standard.scorers.map((s, i) => (
                  <span key={i} className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger">{s}</span>
                ))}
              </div>
            </div>
          )}
          {stats.standard.assisters && stats.standard.assisters.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <h4 className="mb-3 text-xs font-black text-primary">صناع اللعب</h4>
              <div className="flex flex-wrap gap-2">
                {stats.standard.assisters.map((a, i) => (
                  <span key={i} className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
