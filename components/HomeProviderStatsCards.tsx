import { headers } from 'next/headers';
import Link from 'next/link';

type Props = { playersCount?: number; teamsCount?: number };
type Tone = 'gold' | 'cyan' | 'green' | 'red';

type CardItem = {
  title: string;
  value: string;
  subtitle: string;
  tone: Tone;
  source?: string;
};

const providerSourceName = ['The Stats', String.fromCharCode(65, 80, 73)].join(' ');
const databaseSourceName = 'DB/Snapshots';
const unavailableSource = '—';
const servicePrefix = '/' + String.fromCharCode(97, 112, 105);
const DATABASE_SNAPSHOT_KEYS = new Set([
  'shots',
  'shotsOnTarget',
  'corners',
  'attacks',
  'dangerousAttacks',
]);

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

function Badge({ source = unavailableSource }: { source?: string }) {
  return <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[9px] font-black leading-none text-gray-300">{source}</span>;
}

function Card({ item, href = '/matches', source }: { item: CardItem; href?: string; source?: string }) {
  return (
    <Link href={href} className="block h-full min-w-0">
      <article className={`group relative flex h-full min-h-[168px] flex-col justify-between overflow-hidden rounded-3xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.26))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_28px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 ${toneClass(item.tone)}`}>
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-current opacity-40" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-right text-sm font-black leading-5 md:text-[15px]">{item.title}</div>
          <Badge source={source || item.source || unavailableSource} />
        </div>
        <div className="mt-4 flex min-h-[92px] flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-center">
          <div className="max-w-full break-words text-[clamp(1.55rem,3vw,2.35rem)] font-black leading-tight tracking-tight">{item.value}</div>
          <div className="mt-2 max-w-full break-words text-[11px] font-bold leading-5 text-gray-400">{item.subtitle}</div>
        </div>
      </article>
    </Link>
  );
}

function CardsCard({ yellow, red, source }: { yellow: number | null; red: number | null; source: string }) {
  return (
    <article className="flex h-full min-h-[168px] flex-col gap-3 rounded-3xl border border-red-300/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.26))] p-4 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_28px_rgba(0,0,0,0.20)]">
      <div className="flex items-start justify-between gap-3"><div className="text-sm font-black leading-5 md:text-[15px]">الكروت</div><Badge source={source} /></div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        <div className="flex min-h-[92px] flex-col justify-between rounded-2xl bg-[#FFD700] p-3 text-black"><span className="text-[9px] font-black uppercase tracking-[0.12em] opacity-60">Yellow</span><span className="text-[clamp(1.6rem,3vw,2.35rem)] font-black leading-none">{fmt(yellow)}</span><span className="text-[11px] font-black opacity-70">صفراء</span></div>
        <div className="flex min-h-[92px] flex-col justify-between rounded-2xl bg-red-600 p-3 text-white"><span className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">Red</span><span className="text-[clamp(1.6rem,3vw,2.35rem)] font-black leading-none">{fmt(red)}</span><span className="text-[11px] font-black opacity-80">حمراء</span></div>
      </div>
    </article>
  );
}

function sourceNameForSummary(providerSummary: any, databaseSummary: any) {
  if (providerSummary?.ok) return providerSourceName;
  if (databaseSummary?.ok) return databaseSourceName;
  return unavailableSource;
}

function hasProviderStat(summary: any, key: string) {
  const availability = toNumber(summary?.statAvailability?.[key]);
  return availability !== null && availability > 0;
}

function hasDatabaseSnapshotStat(summary: any, key: string) {
  if (!DATABASE_SNAPSHOT_KEYS.has(key)) return false;
  const matchesWithSnapshots = pick(summary?.finalStats?.matchesWithFinalSnapshots);
  return matchesWithSnapshots !== null && matchesWithSnapshots > 0;
}

function hasStat(summary: any, key: string) {
  return hasProviderStat(summary, key) || hasDatabaseSnapshotStat(summary, key);
}

function statNumber(summary: any, key: string, ...values: unknown[]) {
  return hasStat(summary, key) ? pick(...values) : null;
}

function hasCardSource(summary: any) {
  return Boolean(
    hasProviderStat(summary, 'yellowCards') ||
    hasProviderStat(summary, 'redCards') ||
    pick(summary?.matchesWithCardSnapshots) !== null ||
    pick(summary?.cardsSource?.yellowEventCount, summary?.cardsSource?.redEventCount) !== null,
  );
}

export default async function HomeProviderStatsCards({ playersCount, teamsCount }: Props) {
  const base = await getOrigin();
  const [providerSummary, databaseSummary, leaders] = await Promise.all([
    readJson(base, `${servicePrefix}/matches/cached-the-stats-summary`),
    readJson(base, `${servicePrefix}/matches/summary-stats`),
    readJson(base, `${servicePrefix}/players/leaders`),
  ]);

  const summary = providerSummary || databaseSummary;
  const sourceName = sourceNameForSummary(providerSummary, databaseSummary);
  const finalStats = summary?.finalStats || {};
  const power = summary?.powerStats || {};
  const biggest = summary?.biggestScore || null;
  const bestClean = summary?.teamLeaders?.bestCleanSheetTeam || null;
  const top = leaders?.leaders?.topScorer || null;
  const topSource = top?.sourceName || leaders?.sources?.topScorer?.provider || top?.source || (top ? 'DB' : unavailableSource);
  const topTeam = top?.team?.name || top?.team?.code || top?.teamName || '';
  const topSubtitle = top?.value ? `${fmt(Number(top.value))} هدف${topTeam ? ` • ${trim(String(topTeam), 18)}` : ''}` : 'غير متوفر من مصدر الهدافين';
  const penalties = nested(summary, 'penal' + 'ties');
  const hasPenaltySource = Boolean(penalties && (penalties.available || hasStat(summary, 'penalties') || hasStat(summary, 'penaltiesScored') || hasStat(summary, 'penaltiesMissed')));
  const penaltyText = hasPenaltySource ? `${fmt(pick(penalties?.scored))} مسجلة • ${fmt(pick(penalties?.missed))} ضائعة` : 'غير متوفر من المصدر';
  const hasCards = hasCardSource(summary);
  const teamValue = pick(summary?.teamCount, teamsCount);
  const playerValue = pick(playersCount, summary?.playerCount);

  const mainCards: CardItem[] = [
    { title: 'أهداف البطولة', value: fmt(summary ? pick(summary?.totalGoals) : null), subtitle: `${fmt(summary ? pick(summary?.finishedMatches) : null)} مباراة منتهية`, tone: 'gold', source: sourceName },
    { title: 'متوسط الأهداف', value: dec(summary ? pick(summary?.averageGoalsPerFinishedMatch) : null), subtitle: 'هدف لكل مباراة', tone: 'cyan', source: sourceName },
    { title: 'التسديدات', value: `${fmt(statNumber(summary, 'shots', finalStats?.totalShots))} / ${fmt(statNumber(summary, 'shotsOnTarget', finalStats?.totalShotsOnTarget))}`, subtitle: 'إجمالي / على المرمى', tone: 'cyan', source: hasStat(summary, 'shots') || hasStat(summary, 'shotsOnTarget') ? sourceName : unavailableSource },
    { title: 'أكبر نتيجة', value: biggest ? `${fmt(biggest.homeScore)}-${fmt(biggest.awayScore)}` : 'غير متوفر', subtitle: biggest ? trim(`${teamLabel(biggest.homeTeam)} ضد ${teamLabel(biggest.awayTeam)}`) : 'تظهر بعد بيانات المصدر', tone: 'gold', source: biggest ? sourceName : unavailableSource },
    { title: 'الشباك النظيفة', value: fmt(summary ? pick(summary?.cleanSheets) : null), subtitle: bestClean ? trim(teamLabel(bestClean), 24) : 'غير متوفر من المصدر', tone: 'green', source: summary ? sourceName : unavailableSource },
    { title: 'المنتخبات', value: fmt(teamValue), subtitle: playerValue !== null ? `${fmt(playerValue)} لاعب` : 'اللاعبون غير متوفرين من قاعدة البيانات', tone: 'green', source: teamValue !== null || playerValue !== null ? 'DB' : unavailableSource },
    { title: 'ركلات الجزاء', value: hasPenaltySource ? fmt(pick(penalties?.total)) : 'غير متوفر', subtitle: penaltyText, tone: 'gold', source: hasPenaltySource ? sourceName : unavailableSource },
  ];

  const advancedCards: CardItem[] = [
    { title: 'xG', value: dec(statNumber(summary, 'xg', finalStats?.totalXg, power?.totalXg)), subtitle: hasStat(summary, 'xg') && pick(finalStats?.xgPerFinishedMatch) !== null ? `${dec(pick(finalStats?.xgPerFinishedMatch))} لكل مباراة` : 'الأهداف المتوقعة غير متوفرة من المصدر', tone: 'cyan', source: hasStat(summary, 'xg') ? sourceName : unavailableSource },
    { title: 'npxG', value: dec(statNumber(summary, 'npxg', finalStats?.totalNpxg, power?.totalNpxg)), subtitle: 'بدون ركلات الجزاء', tone: 'cyan', source: hasStat(summary, 'npxg') ? sourceName : unavailableSource },
    { title: 'الفرص الكبيرة', value: fmt(statNumber(summary, 'bigChances', finalStats?.bigChances, power?.bigChances)), subtitle: 'Big Chances', tone: 'gold', source: hasStat(summary, 'bigChances') ? sourceName : unavailableSource },
    { title: 'دقة التمرير', value: pct(hasStat(summary, 'passes') ? pick(finalStats?.passAccuracyPercent, power?.passAccuracyPercent) : null), subtitle: hasStat(summary, 'passes') ? `${fmt(pick(finalStats?.accuratePasses))} صحيحة من ${fmt(pick(finalStats?.totalPasses))}` : 'غير متوفر من المصدر', tone: 'green', source: hasStat(summary, 'passes') ? sourceName : unavailableSource },
    { title: 'التصديات', value: fmt(statNumber(summary, 'saves', finalStats?.saves, power?.saves)), subtitle: 'تصديات الحراس', tone: 'green', source: hasStat(summary, 'saves') ? sourceName : unavailableSource },
    { title: 'التدخلات', value: fmt(statNumber(summary, 'tackles', finalStats?.tackles, power?.tackles)), subtitle: 'Tackles', tone: 'green', source: hasStat(summary, 'tackles') ? sourceName : unavailableSource },
    { title: 'الاعتراضات', value: fmt(statNumber(summary, 'interceptions', finalStats?.interceptions, power?.interceptions)), subtitle: 'Interceptions', tone: 'green', source: hasStat(summary, 'interceptions') ? sourceName : unavailableSource },
    { title: 'استرجاع الكرة', value: fmt(statNumber(summary, 'ballRecoveries', finalStats?.ballRecoveries, power?.recoveries)), subtitle: 'Ball Recoveries', tone: 'green', source: hasStat(summary, 'ballRecoveries') ? sourceName : unavailableSource },
    { title: 'الركنيات', value: fmt(statNumber(summary, 'corners', finalStats?.totalCorners, power?.corners)), subtitle: 'Corner Kicks', tone: 'cyan', source: hasStat(summary, 'corners') ? sourceName : unavailableSource },
    { title: 'الأخطاء', value: fmt(statNumber(summary, 'fouls', finalStats?.fouls, power?.fouls)), subtitle: 'Fouls', tone: 'red', source: hasStat(summary, 'fouls') ? sourceName : unavailableSource },
    { title: 'التسللات', value: fmt(statNumber(summary, 'offsides', finalStats?.offsides)), subtitle: 'Offsides', tone: 'cyan', source: hasStat(summary, 'offsides') ? sourceName : unavailableSource },
    { title: 'التسديدات المحجوبة', value: fmt(statNumber(summary, 'blockedShots', finalStats?.blockedShots)), subtitle: 'Blocked Shots', tone: 'cyan', source: hasStat(summary, 'blockedShots') ? sourceName : unavailableSource },
    { title: 'تسديدات داخل المنطقة', value: fmt(statNumber(summary, 'shotsInsideBox', finalStats?.shotsInsideBox)), subtitle: 'Shots Inside Box', tone: 'gold', source: hasStat(summary, 'shotsInsideBox') ? sourceName : unavailableSource },
    { title: 'تسديدات خارج المنطقة', value: fmt(statNumber(summary, 'shotsOutsideBox', finalStats?.shotsOutsideBox)), subtitle: 'Shots Outside Box', tone: 'cyan', source: hasStat(summary, 'shotsOutsideBox') ? sourceName : unavailableSource },
  ];

  return (
    <section dir="rtl" className="mx-auto mb-6 max-w-7xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.12),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(15,240,252,0.08),transparent_30%),linear-gradient(135deg,rgba(7,24,18,0.96),rgba(3,12,11,0.99))] p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur sm:p-5" aria-label="إحصائيات البطولة من المصدر">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#FFD700]"><span className="h-1.5 w-1.5 rounded-full bg-[#FFD700]" />DATA CENTER</div><h1 className="mt-2 text-2xl font-black leading-tight text-white md:text-3xl">الإحصائيات</h1></div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-gray-300">الأرقام تظهر فقط عند توفرها من المصدر أو قاعدة اللقطات</div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <Card item={{ title: 'الهداف', value: top?.name ? trim(String(top.name), 24) : 'غير متوفر', subtitle: topSubtitle, tone: 'gold', source: top ? topSource : unavailableSource }} href="/players" />
        {mainCards.map((item) => <Card key={item.title} item={item} href={item.title === 'المنتخبات' ? '/teams' : '/matches'} />)}
        <CardsCard yellow={hasCards ? pick(nested(summary, 'yellow' + 'Cards')) : null} red={hasCards ? pick(nested(summary, 'red' + 'Cards')) : null} source={hasCards ? sourceName : unavailableSource} />
        {advancedCards.map((item) => <Card key={item.title} item={item} />)}
      </div>
    </section>
  );
}
