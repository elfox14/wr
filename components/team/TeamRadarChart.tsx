import { Activity, Radar } from 'lucide-react';
import { decimal, formatNumber, getFbrefMetrics, performance } from './teamData';
import type { TeamAsset } from './teamPageTypes';

type Axis = {
  key: string;
  label: string;
  value: number | null;
  note: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function perMatch(total?: number | null, matches?: number | null) {
  if (typeof total !== 'number' || !Number.isFinite(total)) return null;
  if (typeof matches !== 'number' || !Number.isFinite(matches) || matches <= 0) return null;
  return total / matches;
}

function normalizePerMatch(value: number | null, max: number) {
  if (value === null) return null;
  return clamp((value / max) * 100);
}

function buildAxes(team: TeamAsset): Axis[] {
  const metrics = getFbrefMetrics(team.intelligenceReports);
  const stats = performance(team);
  const matchCount = metrics?.matchContext?.completedCount || metrics?.standing?.mp || stats?.sampleSize || null;
  const goalsPerMatch = perMatch(metrics?.shooting?.goals ?? metrics?.standing?.gf ?? stats?.goalsFor ?? null, matchCount);
  const shotsOnTargetPerMatch = perMatch(metrics?.shooting?.shotsOnTarget ?? null, matchCount);
  const goalsAgainstPerMatch = perMatch(metrics?.standing?.ga ?? stats?.goalsAgainst ?? null, matchCount);
  const standingPoints = typeof metrics?.standing?.pts === 'number' && typeof metrics?.standing?.mp === 'number' && metrics.standing.mp > 0
    ? (metrics.standing.pts / (metrics.standing.mp * 3)) * 100
    : null;
  const formFallback = stats ? ((stats.wins * 3 + stats.draws) / (stats.sampleSize * 3)) * 100 : null;
  const rosterCount = metrics?.roster?.count ?? team.players?.length ?? null;
  const tableAvailability = metrics?.tableAvailability || null;
  const availableTables = tableAvailability ? Object.values(tableAvailability).filter(Boolean).length : null;
  const totalTables = tableAvailability ? Object.keys(tableAvailability).length : null;

  const attackByShooting = shotsOnTargetPerMatch !== null ? clamp((shotsOnTargetPerMatch / 6) * 70 + (goalsPerMatch || 0) * 15) : null;
  const attackFallback = normalizePerMatch(goalsPerMatch, 3);
  const defenseByGoals = goalsAgainstPerMatch !== null ? clamp(100 - normalizePerMatch(goalsAgainstPerMatch, 3)!) : null;

  return [
    { key: 'attack', label: 'الهجوم', value: attackByShooting ?? attackFallback, note: metrics?.shooting ? 'من التسديدات والأهداف المستوردة' : 'من نتائج المباريات المخزنة عند غياب FBref' },
    { key: 'defense', label: 'الدفاع', value: defenseByGoals, note: 'عكسي حسب الأهداف المستقبلة في العينة المتاحة' },
    { key: 'control', label: 'التحكم', value: typeof metrics?.matchContext?.averagePossession === 'number' ? clamp(metrics.matchContext.averagePossession) : null, note: 'متوسط الاستحواذ من FBref/Stathead عند توفره' },
    { key: 'form', label: 'الفورمة', value: standingPoints ?? formFallback, note: metrics?.standing ? 'من نقاط المجموعة' : 'من آخر نتائج محفوظة' },
    { key: 'squad', label: 'القائمة', value: typeof rosterCount === 'number' ? clamp((Math.min(rosterCount, 26) / 26) * 100) : null, note: 'يقيس اكتمال بيانات القائمة وليس جودة العمق وحدها' },
    { key: 'data', label: 'عمق البيانات', value: availableTables !== null && totalTables ? clamp((availableTables / totalTables) * 100) : null, note: 'نسبة جداول FBref/Stathead المتاحة في التصدير' },
  ];
}

function point(index: number, total: number, value: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const radius = 82 * (value / 100);
  const x = 110 + radius * Math.cos(angle);
  const y = 110 + radius * Math.sin(angle);
  return `${x},${y}`;
}

function labelPoint(index: number, total: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  const x = 110 + 101 * Math.cos(angle);
  const y = 110 + 101 * Math.sin(angle);
  return { x, y };
}

export default function TeamRadarChart({ team }: { team: TeamAsset }) {
  const axes = buildAxes(team);
  const available = axes.filter((axis) => axis.value !== null).length;
  const polygon = axes.map((axis, index) => point(index, axes.length, axis.value ?? 0)).join(' ');

  return (
    <section className="rounded-3xl border border-white/10 bg-[#101217] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-black text-primary"><Radar size={15} /> RADAR</div>
          <h3 className="text-xl font-black text-white">تقييم مبدئي مبني على البيانات المتاحة</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-slate-400">{formatNumber(available)} / {formatNumber(axes.length)} محاور موثقة</div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <div className="mx-auto flex w-full max-w-[320px] items-center justify-center rounded-3xl border border-white/10 bg-black/25 p-4">
          <svg viewBox="0 0 220 220" className="h-[260px] w-[260px]" role="img" aria-label="Team radar chart">
            {[20, 40, 60, 80, 100].map((level) => <polygon key={level} points={axes.map((_, index) => point(index, axes.length, level)).join(' ')} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />)}
            {axes.map((_, index) => <line key={index} x1="110" y1="110" x2={point(index, axes.length, 100).split(',')[0]} y2={point(index, axes.length, 100).split(',')[1]} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />)}
            <polygon points={polygon} fill="rgba(15,240,252,0.26)" stroke="rgba(15,240,252,0.95)" strokeWidth="3" />
            {axes.map((axis, index) => {
              const dot = point(index, axes.length, axis.value ?? 0).split(',').map(Number);
              const label = labelPoint(index, axes.length);
              return <g key={axis.key}><circle cx={dot[0]} cy={dot[1]} r="4" fill={axis.value === null ? 'rgba(148,163,184,0.45)' : 'rgba(15,240,252,1)'} /><text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 text-[10px] font-black">{axis.label}</text></g>;
            })}
          </svg>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {axes.map((axis) => (
            <div key={axis.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-2 flex items-center justify-between gap-3"><span className="font-black text-white">{axis.label}</span><span className="rounded-full bg-black/30 px-2 py-1 text-xs font-black text-primary tabular-nums">{axis.value === null ? 'غير متوفر' : `${decimal(axis.value)}/100`}</span></div>
              <p className="text-xs leading-6 text-slate-400">{axis.note}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-6 text-slate-400"><Activity size={14} className="mt-1 text-primary" /> هذا الرسم يعرض مؤشرات داخلية مشتقة من بيانات موثقة، ولا يعرض xG أو PPDA إلا عند توفرها فعليًا في المصادر.</p>
    </section>
  );
}
