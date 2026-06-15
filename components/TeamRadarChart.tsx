'use client';

import { useEffect, useState } from 'react';
import { Radar } from 'lucide-react';
import type { TeamFBRefStats } from '@/app/api/team-stats/[id]/route';

type RadarMetric = {
  label: string;
  labelAr: string;
  value: number; // 0-1
};

type TeamRadarChartProps = {
  teamId: string;
  teamName: string;
  /** Pre-computed values from server data (matches, players) */
  formScore?: number | null; // 0-1 from match results
  squadDepth?: number | null; // 0-1 from player count / 26
};

function computeMetrics(
  stats: TeamFBRefStats | null,
  formScore: number,
  squadDepth: number
): RadarMetric[] {
  if (!stats || !stats.available) {
    return [
      { label: 'Attack', labelAr: 'الهجوم', value: 0.5 },
      { label: 'Defense', labelAr: 'الدفاع', value: 0.5 },
      { label: 'Possession', labelAr: 'الاستحواذ', value: 0.5 },
      { label: 'Discipline', labelAr: 'الانضباط', value: 0.7 },
      { label: 'Form', labelAr: 'مستوى الأداء', value: formScore },
      { label: 'Squad Depth', labelAr: 'عمق القائمة', value: squadDepth },
    ];
  }

  const { shooting, standing, matchContext, misc } = stats;
  const mp = standing?.mp || matchContext?.completedCount || 1;

  // Attack: goals per match, normalized to 0-1 (2+ goals/match = 1.0)
  const goals = shooting?.goals ?? standing?.gf ?? 0;
  const attack = Math.min(1, (goals / Math.max(1, mp)) / 2);

  // Defense: inverse of goals against per match (0 GA/match = 1.0)
  const ga = standing?.ga ?? 0;
  const defense = Math.max(0, Math.min(1, 1 - (ga / Math.max(1, mp)) / 2));

  // Possession
  const possession = matchContext?.averagePossession
    ? matchContext.averagePossession / 100
    : 0.5;

  // Discipline: fewer cards = higher score
  const yellows = misc?.yellowCards ?? 0;
  const reds = misc?.redCards ?? 0;
  const cardPenalty = (yellows + reds * 3) / Math.max(1, mp * 5);
  const discipline = Math.max(0.15, Math.min(1, 1 - cardPenalty));

  return [
    { label: 'Attack', labelAr: 'الهجوم', value: attack },
    { label: 'Defense', labelAr: 'الدفاع', value: defense },
    { label: 'Possession', labelAr: 'الاستحواذ', value: possession },
    { label: 'Discipline', labelAr: 'الانضباط', value: discipline },
    { label: 'Form', labelAr: 'مستوى الأداء', value: formScore },
    { label: 'Squad Depth', labelAr: 'عمق القائمة', value: squadDepth },
  ];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarSVG({ metrics }: { metrics: RadarMetric[] }) {
  const cx = 150;
  const cy = 150;
  const maxR = 110;
  const n = metrics.length;
  const angleStep = 360 / n;

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data polygon points
  const dataPoints = metrics.map((m, i) => {
    const r = maxR * Math.max(0.08, m.value);
    return polarToCartesian(cx, cy, r, i * angleStep);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[320px] mx-auto drop-shadow-lg">
      {/* Grid rings */}
      {rings.map((ring) => {
        const r = maxR * ring;
        const pts = Array.from({ length: n }, (_, i) => polarToCartesian(cx, cy, r, i * angleStep));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={ring} d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}

      {/* Axis lines */}
      {metrics.map((_, i) => {
        const end = polarToCartesian(cx, cy, maxR, i * angleStep);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}

      {/* Data fill */}
      <defs>
        <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0FF0FC" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#00FF88" stopOpacity={0.15} />
        </linearGradient>
      </defs>
      <path
        d={dataPath}
        fill="url(#radarGrad)"
        stroke="#0FF0FC"
        strokeWidth={2.5}
        strokeLinejoin="round"
        className="transition-all duration-700"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#0FF0FC"
          stroke="#0a0a0a"
          strokeWidth={2}
          className="transition-all duration-500"
        />
      ))}

      {/* Labels */}
      {metrics.map((m, i) => {
        const labelR = maxR + 28;
        const pos = polarToCartesian(cx, cy, labelR, i * angleStep);
        const score = Math.round(m.value * 100);
        return (
          <g key={i}>
            <text
              x={pos.x}
              y={pos.y - 6}
              textAnchor="middle"
              className="fill-white text-[10px] font-black"
            >
              {m.labelAr}
            </text>
            <text
              x={pos.x}
              y={pos.y + 8}
              textAnchor="middle"
              className="fill-primary text-[10px] font-black"
            >
              {score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TeamRadarChart({ teamId, teamName, formScore, squadDepth }: TeamRadarChartProps) {
  const [stats, setStats] = useState<TeamFBRefStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/team-stats/${teamId}`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [teamId]);

  const form = typeof formScore === 'number' ? formScore : 0.5;
  const depth = typeof squadDepth === 'number' ? squadDepth : 0.5;
  const metrics = computeMetrics(stats, form, depth);

  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar size={18} className="text-primary" />
          <h3 className="text-lg font-black text-white">رادار الأداء</h3>
        </div>
        <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">
          {teamName}
        </span>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
          جاري تحليل بيانات أداء الفريق...
        </div>
      ) : (
        <RadarSVG metrics={metrics} />
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-white/5 bg-black/25 p-2">
            <div className="text-[10px] text-gray-500">{m.labelAr}</div>
            <div className="text-sm font-black text-white">{Math.round(m.value * 100)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
