// ============================================================
// lib/api/map-match-extras-to-insights.ts
// Maps a RawMatchExtrasSnapshot (from the API) to MatchInsightsInput.
// Applies safe number/string coercion and Arabic stat definitions.
// ============================================================
import type { RawMatchExtrasSnapshot } from './match-extras.types';
import type {
  MatchInsightsInput, ComparisonStat, MatchEvent,
  MomentumPoint, ShotPoint, XgFlowPoint,
} from '@/lib/analytics/match-analytics.types';

const STAT_DEFS: Array<{ key: string; label: string; suffix?: string; decimals?: number }> = [
  { key: 'possession',       label: 'الاستحواذ',            suffix: '%' },
  { key: 'xg',               label: 'الأهداف المتوقعة xG',  decimals: 2 },
  { key: 'npxg',             label: 'xG بدون جزاء',         decimals: 2 },
  { key: 'bigChances',       label: 'الفرص الكبيرة' },
  { key: 'shots',            label: 'التسديدات' },
  { key: 'shotsOnTarget',    label: 'على المرمى' },
  { key: 'shotsOffTarget',   label: 'خارج المرمى' },
  { key: 'blockedShots',     label: 'تسديدات محجوبة' },
  { key: 'shotsInsideBox',   label: 'تسديدات داخل المنطقة' },
  { key: 'shotsOutsideBox',  label: 'تسديدات خارج المنطقة' },
  { key: 'corners',          label: 'الركنيات' },
  { key: 'fouls',            label: 'الأخطاء' },
  { key: 'offsides',         label: 'التسللات' },
  { key: 'yellowCards',      label: 'بطاقات صفراء' },
  { key: 'redCards',         label: 'بطاقات حمراء' },
  { key: 'passes',           label: 'التمريرات' },
  { key: 'accuratePasses',   label: 'تمريرات دقيقة' },
  { key: 'tackles',          label: 'الإيقاعات' },
  { key: 'interceptions',    label: 'الاعتراضات' },
  { key: 'clearances',       label: 'الإبعادات' },
  { key: 'recoveries',       label: 'الاسترجاعات' },
  { key: 'saves',            label: 'التصديات' },
  { key: 'attacks',          label: 'الهجمات' },
  { key: 'dangerousAttacks', label: 'الهجمات الخطيرة' },
];

function num(v: unknown, fb = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fb;
}
function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb;
}

function mapStats(
  stats?: Record<string, { home?: number; away?: number } | undefined>,
): ComparisonStat[] {
  return STAT_DEFS.map((d) => ({
    key: d.key, label: d.label, suffix: d.suffix, decimals: d.decimals,
    home: num(stats?.[d.key]?.home),
    away: num(stats?.[d.key]?.away),
  }));
}

export function mapMatchExtrasToInsightsInput(
  raw: RawMatchExtrasSnapshot,
): MatchInsightsInput {
  const momentum: MomentumPoint[] = (raw.momentum ?? [])
    .map((p) => ({ minute: num(p.minute), home: num(p.home), away: num(p.away) }))
    .filter((p) => p.minute > 0);

  const events: MatchEvent[] = (raw.events ?? [])
    .map((e) => ({
      minute: num(e.minute),
      team: e.team === 'away' ? 'away' : ('home' as const),
      type: (['goal','yellow','red','substitution'].includes(
        String(e.type ?? '').toLowerCase()) ? String(e.type).toLowerCase() : 'substitution'
      ) as MatchEvent['type'],
      label: str(e.label ?? e.playerName ?? e.detail ?? e.type),
    }))
    .filter((e) => e.minute > 0);

  const xgFlow: XgFlowPoint[] = (raw.xgFlow ?? [])
    .map((p) => ({ minute: num(p.minute), homeXg: num(p.homeXg), awayXg: num(p.awayXg), label: p.label }))
    .filter((p) => p.minute > 0);

  const shots: ShotPoint[] = (raw.shots ?? [])
    .map((s, i) => ({
      id: str(s.id, `shot-${i}`),
      minute: num(s.minute),
      team: s.team === 'away' ? 'away' : ('home' as const),
      x: num(s.x), y: num(s.y), xg: num(s.xg),
      outcome: (['goal','onTarget','offTarget','blocked'].includes(String(s.outcome ?? ''))
        ? s.outcome : 'offTarget') as ShotPoint['outcome'],
      insideBox: Boolean(s.insideBox),
      player: s.player,
    }))
    .filter((s) => s.minute > 0);

  return {
    homeTeamName: str(raw.match?.homeTeam?.name, 'Home'),
    awayTeamName: str(raw.match?.awayTeam?.name, 'Away'),
    stats: mapStats(raw.stats),
    momentum, xgFlow, shots, events,
  };
}
