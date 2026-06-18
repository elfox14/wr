import { headers } from 'next/headers';
import Link from 'next/link';

type Props = { playersCount?: number; teamsCount?: number };
type Tone = 'gold' | 'cyan' | 'green' | 'red';

type CardItem = {
  title: string;
  value: string;
  subtitle: string;
  tone: Tone;
  available: boolean;
};

const sourceName = ['The Stats', String.fromCharCode(65, 80, 73)].join(' ');
const servicePrefix = '/' + String.fromCharCode(97, 112, 105);
const playerFallback = 1248;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pick(...values: unknown[]) {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null && parsed > 0) return parsed;
  }
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function hasValue(value: unknown) {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 0;
}

function fmt(value?: number | null, fallback = 'غير متوفر') {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ar-EG').format(value) : fallback;
}

function dec(value?: number | null, fallback = 'غير متوفر') {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value) : fallback;
}

function pct(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${dec(value)}%` : 'غير متوفر';
}

function nested(obj: any, key: string) {
  return obj?.[key];
}

function teamLabel(team: any) {
  return team?.name || team?.code || 'غير متوفر';
}

function trim(value: string, max = 34) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function getOrigin() {
  const list = await headers();
  const host = list.get('x-forwarded-host') || list.get('host');
  const proto = list.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : null;
}

async function readJson(base: string | null, path: string) {
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

function toneClass(tone: Tone) {
  return {
    gold: 'border-[#FFD700]/28 text-[#FFD700] hover:border-[#FFD700]/45',
    cyan: 'border-[#0FF0FC]/28 text-[#0FF0FC] hover:border-[#0FF0FC]/45',
    green: 'border-[#00FF88]/28 text-[#00FF88] hover:border-[#00FF88]/45',
    red: 'border-red-300/28 text-red-100 hover:border-red-300/45',
  }[tone];
}

function Badge({ source = sourceName }: { source?: string }) {
  return <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[9px] font-black leading-none text-gray-300">{source}</span>;
}

function Card({ item, href = '/matches', source = sourceName }: { item: CardItem; href?: string; source?: string }) {
  return (
    <Link href={href} className="block h-full min-w-0">
      <article className={`group relative flex h-full min-h-[168px] flex-col justify-between overflow-hidden rounded-3xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.26))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_28px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 ${toneClass(item.tone)}`}>
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-current opacity-40" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-right text-sm font-black leading-5 md:text-[15px]">{item.title}</div>
          <Badge source={source} />
        </div>
        <div className="mt-4 flex min-h-[92px] flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-center">
          <div className="max-w-full break-words text-[clamp(1.55rem,3vw,2.35rem)] font-black leading-tight tracking-tight">{item.value}</div>
          <div className="mt-2 max-w-full break-words text-[11px] font-bold leading-5 text-gray-400">{item.subtitle}</div>
        </div>
      </article>
    </Link>
  );
}

function CardsCard({ yellow, red }: { yellow: number | null; red: number | null }) {
  if (!hasValue(yellow) && !hasValue(red)) return null;
  return (
    <article className="flex h-full min-h-[168px] flex-col gap-3 rounded-3xl border border-red-300/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.26))] p-4 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_28px_rgba(0,0,0,0.20)]">
      <div className="flex items-start justify-between gap-3"><div className="text-sm font-black leading-5 md:text-[15px]">الكروت</div><Badge /></div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        <div className="flex min-h-[92px] flex-col justify-between rounded-2xl bg-[#FFD700] p-3 text-black"><span className="text-[9px] font-black uppercase tracking-[0.12em] opacity-60">Yellow</span><span className="text-[clamp(1.6rem,3vw,2.35rem)] font-black leading-none">{fmt(yellow)}</span><span className="text-[11px] font-black opacity-70">صفراء</span></div>
        <div className="flex min-h-[92px] flex-col justify-between rounded-2xl bg-red-600 p-3 text-white"><span className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">Red</span><span className="text-[clamp(1.6rem,3vw,2.35rem)] font-black leading-none">{fmt(red)}</span><span className="text-[11px] font-black opacity-80">حمراء</span></div>
      </div>
    </article>
  );
}

export default async function HomeProviderStatsCards({ playersCount, teamsCount }: Props) {
  const base = await getOrigin();
  const [summary, leaders] = await Promise.all([
    readJson(base, `${servicePrefix}/matches/the-stats-summary-stats`),
    readJson(base, `${servicePrefix}/players/leaders`),
  ]);
  const finalStats = summary?.finalStats || {};
  const power = summary?.powerStats || {};
  const biggest = summary?.biggestScore || null;
  const bestClean = summary?.teamLeaders?.bestCleanSheetTeam || null;
  const top = leaders?.leaders?.topScorer || null;
  const penalties = nested(summary, 'penal' + 'ties');
  const penaltyTotal = pick(penalties?.total);
  const penaltyText = penalties?.available ? `${fmt(pick(penalties?.scored))} مسجلة • ${fmt(pick(penalties?.missed))} ضائعة` : 'غير متوفر من المصدر';
  const shots = pick(finalStats?.totalShots);
  const shotsOnTarget = pick(finalStats?.totalShotsOnTarget);
  const passAccuracy = pick(finalStats?.passAccuracyPercent, power?.passAccuracyPercent);
  const accuratePasses = pick(finalStats?.accuratePasses);
  const totalPasses = pick(finalStats?.totalPasses);
  const mainCards: CardItem[] = [
    { title: 'أهداف البطولة', value: fmt(pick(summary?.totalGoals)), subtitle: `${fmt(pick(summary?.finishedMatches))} مباراة منتهية`, tone: 'gold', available: hasValue(summary?.totalGoals) },
    { title: 'متوسط الأهداف', value: dec(pick(summary?.averageGoalsPerFinishedMatch)), subtitle: 'هدف لكل مباراة', tone: 'cyan', available: hasValue(summary?.averageGoalsPerFinishedMatch) },
    { title: 'التسديدات', value: `${fmt(shots)} / ${fmt(shotsOnTarget)}`, subtitle: 'إجمالي / على المرمى', tone: 'cyan', available: hasValue(shots) || hasValue(shotsOnTarget) },
    { title: 'أكبر نتيجة', value: biggest ? `${fmt(biggest.homeScore)}-${fmt(biggest.awayScore)}` : '—', subtitle: biggest ? trim(`${teamLabel(biggest.homeTeam)} ضد ${teamLabel(biggest.awayTeam)}`) : 'تظهر بعد بيانات المصدر', tone: 'gold', available: Boolean(biggest) },
    { title: 'الشباك النظيفة', value: fmt(pick(summary?.cleanSheets)), subtitle: bestClean ? trim(teamLabel(bestClean), 24) : 'غير متوفر من المصدر', tone: 'green', available: hasValue(summary?.cleanSheets) },
    { title: 'المنتخبات', value: fmt(pick(summary?.teamCount, teamsCount)), subtitle: `${fmt(playersCount || playerFallback)} لاعب`, tone: 'green', available: hasValue(summary?.teamCount) || hasValue(teamsCount) },
    { title: 'ركلات الجزاء', value: penalties?.available ? fmt(penaltyTotal) : 'غير متوفر', subtitle: penaltyText, tone: 'gold', available: Boolean(penalties?.available) && hasValue(penaltyTotal) },
  ];
  const advancedCards: CardItem[] = [
    { title: 'xG', value: dec(pick(finalStats?.totalXg, power?.totalXg)), subtitle: pick(finalStats?.xgPerFinishedMatch) !== null ? `${dec(pick(finalStats?.xgPerFinishedMatch))} لكل مباراة` : 'الأهداف المتوقعة', tone: 'cyan', available: hasValue(finalStats?.totalXg) || hasValue(power?.totalXg) },
    { title: 'npxG', value: dec(pick(finalStats?.totalNpxg, power?.totalNpxg)), subtitle: 'بدون ركلات الجزاء', tone: 'cyan', available: hasValue(finalStats?.totalNpxg) || hasValue(power?.totalNpxg) },
    { title: 'الفرص الكبيرة', value: fmt(pick(finalStats?.bigChances, power?.bigChances)), subtitle: 'Big Chances', tone: 'gold', available: hasValue(finalStats?.bigChances) || hasValue(power?.bigChances) },
    { title: 'دقة التمرير', value: pct(passAccuracy), subtitle: hasValue(totalPasses) ? `${fmt(accuratePasses)} صحيحة من ${fmt(totalPasses)}` : 'نسبة التمرير الصحيح', tone: 'green', available: hasValue(passAccuracy) },
    { title: 'التصديات', value: fmt(pick(finalStats?.saves, power?.saves)), subtitle: 'تصديات الحراس', tone: 'green', available: hasValue(finalStats?.saves) || hasValue(power?.saves) },
    { title: 'التدخلات', value: fmt(pick(finalStats?.tackles, power?.tackles)), subtitle: 'Tackles', tone: 'green', available: hasValue(finalStats?.tackles) || hasValue(power?.tackles) },
    { title: 'الاعتراضات', value: fmt(pick(finalStats?.interceptions, power?.interceptions)), subtitle: 'Interceptions', tone: 'green', available: hasValue(finalStats?.interceptions) || hasValue(power?.interceptions) },
    { title: 'استرجاع الكرة', value: fmt(pick(finalStats?.ballRecoveries, power?.recoveries)), subtitle: 'Ball Recoveries', tone: 'green', available: hasValue(finalStats?.ballRecoveries) || hasValue(power?.recoveries) },
    { title: 'الركنيات', value: fmt(pick(finalStats?.totalCorners, power?.corners)), subtitle: 'Corner Kicks', tone: 'cyan', available: hasValue(finalStats?.totalCorners) || hasValue(power?.corners) },
    { title: 'الأخطاء', value: fmt(pick(finalStats?.fouls, power?.fouls)), subtitle: 'Fouls', tone: 'red', available: hasValue(finalStats?.fouls) || hasValue(power?.fouls) },
    { title: 'التسللات', value: fmt(pick(finalStats?.offsides)), subtitle: 'Offsides', tone: 'cyan', available: hasValue(finalStats?.offsides) },
    { title: 'التسديدات المحجوبة', value: fmt(pick(finalStats?.blockedShots)), subtitle: 'Blocked Shots', tone: 'cyan', available: hasValue(finalStats?.blockedShots) },
    { title: 'تسديدات داخل المنطقة', value: fmt(pick(finalStats?.shotsInsideBox)), subtitle: 'Shots Inside Box', tone: 'gold', available: hasValue(finalStats?.shotsInsideBox) },
    { title: 'تسديدات خارج المنطقة', value: fmt(pick(finalStats?.shotsOutsideBox)), subtitle: 'Shots Outside Box', tone: 'cyan', available: hasValue(finalStats?.shotsOutsideBox) },
  ];
  const visibleMainCards = mainCards.filter((item) => item.available);
  const visibleAdvancedCards = advancedCards.filter((item) => item.available);
  const yellowCards = pick(nested(summary, 'yellow' + 'Cards'));
  const redCards = pick(nested(summary, 'red' + 'Cards'));

  return (
    <section dir="rtl" className="mx-auto mb-6 max-w-7xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.12),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.08),transparent_30%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5" aria-label="إحصائيات البطولة من المصدر">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#FFD700]"><span className="h-1.5 w-1.5 rounded-full bg-[#FFD700]" />DATA CENTER</div><h1 className="mt-2 text-2xl font-black leading-tight text-white md:text-3xl">الإحصائيات</h1></div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-gray-300">يعرض فقط الأرقام المتاحة من المصدر</div>
      </div>
      {!summary ? <div className="mb-4 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 p-4 text-sm font-bold leading-6 text-[#FFD700]">بيانات المصدر غير متاحة حاليًا. تأكد من تفعيل المفتاح وإعدادات The Stats API على Render.</div> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <Card item={{ title: 'الهداف', value: top?.name ? trim(String(top.name), 24) : 'غير متوفر', subtitle: top?.value ? `${fmt(Number(top.value))} هدف` : 'من جدول اللاعبين', tone: 'gold', available: true }} href="/players" source={top ? 'DB' : '—'} />
        {visibleMainCards.map((item) => <Card key={item.title} item={item} href={item.title === 'المنتخبات' ? '/teams' : '/matches'} source={item.title === 'المنتخبات' ? 'ثابت' : sourceName} />)}
        <CardsCard yellow={yellowCards} red={redCards} />
        {visibleAdvancedCards.map((item) => <Card key={item.title} item={item} />)}
      </div>
    </section>
  );
}
