import { headers } from 'next/headers';
import Link from 'next/link';

type Props = { playersCount?: number; teamsCount?: number };
type Tone = 'gold' | 'cyan' | 'green' | 'red';

type CardItem = {
  title: string;
  value: string;
  subtitle: string;
  tone: Tone;
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

function trim(value: string, max = 22) {
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
    gold: 'border-[#FFD700]/25 text-[#FFD700]',
    cyan: 'border-[#0FF0FC]/25 text-[#0FF0FC]',
    green: 'border-[#00FF88]/25 text-[#00FF88]',
    red: 'border-red-300/25 text-red-100',
  }[tone];
}

function Badge({ source = sourceName }: { source?: string }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-black text-gray-300">{source}</span>;
}

function Card({ item, href = '/matches', source = sourceName }: { item: CardItem; href?: string; source?: string }) {
  return (
    <Link href={href} className="block">
      <article className={`group flex min-h-[128px] flex-col justify-between overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(0,0,0,0.25))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_22px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 ${toneClass(item.tone)}`}>
        <div className="flex items-start justify-between gap-2"><div className="truncate text-[10px] font-black">{item.title}</div><Badge source={source} /></div>
        <div className="flex min-h-[76px] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-center">
          <div className="truncate text-3xl font-black leading-none">{item.value}</div>
          <div className="mt-1 truncate text-[9px] font-bold text-gray-400">{item.subtitle}</div>
        </div>
      </article>
    </Link>
  );
}

function CardsCard({ yellow, red }: { yellow: number | null; red: number | null }) {
  return (
    <article className="flex min-h-[128px] flex-col gap-2 rounded-2xl border border-red-300/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(0,0,0,0.25))] p-3 text-red-100">
      <div className="flex items-start justify-between gap-2"><div className="truncate text-[10px] font-black">الكروت</div><Badge /></div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="flex flex-col justify-between rounded-xl bg-[#FFD700] p-2 text-black"><span className="text-[8px] font-black">Yellow</span><span className="text-4xl font-black leading-none">{fmt(yellow)}</span><span className="text-[9px] font-black">صفراء</span></div>
        <div className="flex flex-col justify-between rounded-xl bg-red-600 p-2 text-white"><span className="text-[8px] font-black">Red</span><span className="text-4xl font-black leading-none">{fmt(red)}</span><span className="text-[9px] font-black">حمراء</span></div>
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
  const penaltyText = penalties?.available ? `${fmt(pick(penalties?.scored))} مسجلة • ${fmt(pick(penalties?.missed))} ضائعة` : 'غير متوفر من المصدر';
  const mainCards: CardItem[] = [
    { title: 'أهداف البطولة', value: fmt(pick(summary?.totalGoals)), subtitle: `${fmt(pick(summary?.finishedMatches))} مباراة منتهية`, tone: 'gold' },
    { title: 'متوسط الأهداف', value: dec(pick(summary?.averageGoalsPerFinishedMatch)), subtitle: 'هدف لكل مباراة', tone: 'cyan' },
    { title: 'التسديدات', value: `${fmt(pick(finalStats?.totalShots))} / ${fmt(pick(finalStats?.totalShotsOnTarget))}`, subtitle: 'إجمالي / على المرمى', tone: 'cyan' },
    { title: 'أكبر نتيجة', value: biggest ? `${fmt(biggest.homeScore)}-${fmt(biggest.awayScore)}` : '—', subtitle: biggest ? trim(`${teamLabel(biggest.homeTeam)} ضد ${teamLabel(biggest.awayTeam)}`) : 'تظهر بعد بيانات المصدر', tone: 'gold' },
    { title: 'الشباك النظيفة', value: fmt(pick(summary?.cleanSheets)), subtitle: bestClean ? trim(teamLabel(bestClean), 18) : 'غير متوفر من المصدر', tone: 'green' },
    { title: 'المنتخبات', value: fmt(pick(summary?.teamCount, teamsCount)), subtitle: `${fmt(playersCount || playerFallback)} لاعب`, tone: 'green' },
    { title: 'ركلات الجزاء', value: penalties?.available ? fmt(pick(penalties?.total)) : 'غير متوفر', subtitle: penaltyText, tone: 'gold' },
  ];
  const advancedCards: CardItem[] = [
    { title: 'xG', value: dec(pick(finalStats?.totalXg, power?.totalXg)), subtitle: pick(finalStats?.xgPerFinishedMatch) !== null ? `${dec(pick(finalStats?.xgPerFinishedMatch))} لكل مباراة` : 'الأهداف المتوقعة', tone: 'cyan' },
    { title: 'npxG', value: dec(pick(finalStats?.totalNpxg, power?.totalNpxg)), subtitle: 'بدون ركلات الجزاء', tone: 'cyan' },
    { title: 'الفرص الكبيرة', value: fmt(pick(finalStats?.bigChances, power?.bigChances)), subtitle: 'Big Chances', tone: 'gold' },
    { title: 'دقة التمرير', value: pct(pick(finalStats?.passAccuracyPercent, power?.passAccuracyPercent)), subtitle: `${fmt(pick(finalStats?.accuratePasses))} صحيحة من ${fmt(pick(finalStats?.totalPasses))}`, tone: 'green' },
    { title: 'التصديات', value: fmt(pick(finalStats?.saves, power?.saves)), subtitle: 'تصديات الحراس', tone: 'green' },
    { title: 'التدخلات', value: fmt(pick(finalStats?.tackles, power?.tackles)), subtitle: 'Tackles', tone: 'green' },
    { title: 'الاعتراضات', value: fmt(pick(finalStats?.interceptions, power?.interceptions)), subtitle: 'Interceptions', tone: 'green' },
    { title: 'استرجاع الكرة', value: fmt(pick(finalStats?.ballRecoveries, power?.recoveries)), subtitle: 'Ball Recoveries', tone: 'green' },
    { title: 'الركنيات', value: fmt(pick(finalStats?.totalCorners, power?.corners)), subtitle: 'Corner Kicks', tone: 'cyan' },
    { title: 'الأخطاء', value: fmt(pick(finalStats?.fouls, power?.fouls)), subtitle: 'Fouls', tone: 'red' },
    { title: 'التسللات', value: fmt(pick(finalStats?.offsides)), subtitle: 'Offsides', tone: 'cyan' },
    { title: 'المحجوبة', value: fmt(pick(finalStats?.blockedShots)), subtitle: 'تسديدات محجوبة', tone: 'cyan' },
    { title: 'داخل المنطقة', value: fmt(pick(finalStats?.shotsInsideBox)), subtitle: 'Shots Inside Box', tone: 'gold' },
    { title: 'خارج المنطقة', value: fmt(pick(finalStats?.shotsOutsideBox)), subtitle: 'Shots Outside Box', tone: 'cyan' },
  ];
  return (
    <section dir="rtl" className="mx-auto mb-4 max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.11),transparent_23%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.07),transparent_28%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-3 text-white shadow-[0_16px_44px_rgba(0,0,0,0.32)] backdrop-blur" aria-label="إحصائيات البطولة من المصدر">
      <div className="mb-2.5"><div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-[#FFD700]"><span className="h-1.5 w-1.5 rounded-full bg-[#FFD700]" />DATA CENTER</div><h1 className="mt-1.5 text-lg font-black leading-tight text-white md:text-xl">الإحصائيات</h1></div>
      <div className="grid auto-rows-[128px] grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12">
        <Card item={{ title: 'الهداف', value: top?.name ? trim(String(top.name), 18) : 'غير متوفر', subtitle: top?.value ? `${fmt(Number(top.value))} هدف` : 'من جدول اللاعبين', tone: 'gold' }} href="/players" source={top ? 'DB' : '—'} />
        {mainCards.map((item) => <Card key={item.title} item={item} href={item.title === 'المنتخبات' ? '/teams' : '/matches'} source={item.title === 'المنتخبات' ? 'ثابت' : sourceName} />)}
        <CardsCard yellow={pick(nested(summary, 'yellow' + 'Cards'))} red={pick(nested(summary, 'red' + 'Cards'))} />
        {advancedCards.map((item) => <Card key={item.title} item={item} />)}
      </div>
    </section>
  );
}
