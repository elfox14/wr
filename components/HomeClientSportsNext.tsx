'use client';

import Link from 'next/link';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
};

type HomeMatch = {
  id?: string | number | null;
  matchDate?: string | Date | null;
  status?: string | null;
  stage?: string | null;
  group?: string | null;
  groupPhase?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
};

type Props = {
  initialAssets?: unknown[];
  upcomingMatches?: HomeMatch[];
  assetsCount?: number;
  playersCount?: number;
  teamsCount?: number;
  upcomingMatchesCount?: number;
  academyArticles?: unknown[];
};

const logoSrc = '/brand/worldcup-2026-logo.svg';

const heroActions = [
  ['مباريات اليوم', '/matches', 'primary'],
  ['جدول البطولة', '/matches'],
  ['المنتخبات', '/teams'],
  ['التحليلات', '/news'],
] as const;

const liveCenterRows = [
  ['تحديثات حية', 'حالة المباراة، النتيجة، والأحداث عند توفر البيانات الحية.'],
  ['تحليل فني', 'قراءة تكتيكية، نقاط قوة وضعف، وسياق كل مواجهة.'],
  ['إحصائيات', 'أرقام الفرق والمباريات واللاعبين في عرض واضح وسريع.'],
] as const;

const featureCards = [
  ['مركز المباريات', 'مواعيد، نتائج، مباريات اليوم، وحالة كل مباراة عند توفر البيانات الحية.', '/matches'],
  ['المجموعات', 'عرض مجموعات كأس العالم 2026 وترتيب المنتخبات داخل كل مجموعة.', '/groups'],
  ['دليل المنتخبات', 'صفحات خاصة لكل منتخب تشمل المعلومات الأساسية، الأداء، أبرز الأسماء، والتحليل المتاح.', '/teams'],
  ['الأخبار والتحليل', 'تقارير رياضية وتحليل فني منفصل عن أي جانب ترفيهي أو افتراضي.', '/news'],
  ['الإحصائيات', 'أرقام البطولة، المنتخبات، المباريات، والأداء عند توفر مصادر موثوقة.', '/players'],
  ['البث التفاعلي', 'متابعة تفاعلية للمباريات عند توفر البيانات الحية والرسوم الزمنية.', '/animation-live'],
  ['البورصة الافتراضية', 'تجربة ترفيهية مستوحاة من البطولة، بدون أموال حقيقية وبدون مراهنات.', '/market'],
] as const;

function formatCount(value?: number, fallback = 0) {
  return new Intl.NumberFormat('ar-EG').format(value && value > 0 ? value : fallback);
}

function formatMatchDate(value?: string | Date | null) {
  if (!value) return 'موعد غير متوفر';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'موعد غير متوفر';

  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function teamLabel(team?: Team | null) {
  return team?.name || team?.code || 'منتخب غير محدد';
}

function teamCode(team?: Team | null) {
  return team?.code || team?.name?.slice(0, 3) || '---';
}

function teamMark(team?: Team | null) {
  if (team?.image?.startsWith('http')) {
    return <img src={team.image} alt={teamLabel(team)} className="h-full w-full object-cover" />;
  }

  return <span className="text-lg font-black text-[#FFD700]">{team?.image || teamCode(team)}</span>;
}

function matchGroup(match: HomeMatch) {
  return match.groupPhase || match.group || match.stage || 'كأس العالم 2026';
}

function UpcomingMatchCard({ match }: { match: HomeMatch }) {
  const href = match.id ? `/matches/${match.id}` : '/matches';

  return (
    <Link href={href} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 transition hover:-translate-y-0.5 hover:border-[#0FF0FC]/35 hover:bg-white/[0.06] sm:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/60 to-transparent opacity-70" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]">{matchGroup(match)}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-gray-300">{formatMatchDate(match.matchDate)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-right">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07]">
            {teamMark(match.homeTeam)}
          </div>
          <h3 className="truncate text-base font-black text-white">{teamLabel(match.homeTeam)}</h3>
          <p className="mt-1 text-xs font-bold text-gray-500">{teamCode(match.homeTeam)}</p>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 text-sm font-black text-[#0FF0FC] shadow-[0_0_18px_rgba(15,240,252,0.08)]">
          ضد
        </div>

        <div className="min-w-0 text-left">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07]">
            {teamMark(match.awayTeam)}
          </div>
          <h3 className="truncate text-base font-black text-white">{teamLabel(match.awayTeam)}</h3>
          <p className="mt-1 text-xs font-bold text-gray-500">{teamCode(match.awayTeam)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="text-xs font-bold text-gray-400">تفاصيل وتوقيت المباراة</span>
        <span className="text-xs font-black text-[#0FF0FC] transition group-hover:translate-x-[-3px]">عرض المباراة ←</span>
      </div>
    </Link>
  );
}

function UpcomingMatchesStrip({ matches }: { matches: HomeMatch[] }) {
  const nextMatches = matches.slice(0, 2);

  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0FF0FC]">NEXT MATCHES</p>
          <h2 className="mt-1 text-xl font-black text-white">المباراتان القادمتان</h2>
        </div>
        <Link href="/matches" className="w-fit rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:border-[#FFD700]/40 hover:bg-white/[0.14]">
          عرض كل المباريات
        </Link>
      </div>

      {nextMatches.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {nextMatches.map((match, index) => (
            <UpcomingMatchCard key={match.id || index} match={match} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm font-bold leading-7 text-gray-400">
          لا توجد مباريات قادمة متاحة الآن. سيتم عرض أقرب مباراتين هنا عند تحديث مركز المباريات.
        </div>
      )}
    </section>
  );
}

export default function HomeClientSportsNext(props: Props) {
  const upcomingMatchesCount = props.upcomingMatchesCount ?? 0;

  const stats = [
    ['48', 'منتخب', 'أكبر نسخة من البطولة'],
    ['104', 'مباراة', 'من الافتتاح إلى النهائي'],
    ['3', 'دول مستضيفة', 'أمريكا، كندا، المكسيك'],
    [formatCount(upcomingMatchesCount), 'مباراة قريبة', 'داخل مركز المباريات'],
  ] as const;

  return (
    <main dir="rtl" className="relative overflow-hidden bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(15,240,252,0.15),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(255,215,0,0.12),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(0,128,96,0.12),transparent_28%)]" />

      <div className="relative mx-auto max-w-7xl">
        <UpcomingMatchesStrip matches={props.upcomingMatches ?? []} />

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#07111f] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#07111f] via-[#081826] to-black" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/70 to-transparent" />
          <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#0FF0FC]/15 blur-3xl" />
          <div className="absolute -left-24 bottom-8 h-72 w-72 rounded-full bg-[#FFD700]/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:42px_42px]" />

          <div className="relative z-10 grid gap-10 p-5 sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#0FF0FC]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00FF88]" />
                WORLD CUP 2026 LIVE CENTER
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.15] tracking-tight text-white md:text-6xl lg:text-7xl">
                كل شيء عن كأس العالم 2026 في مكان واحد
              </h1>

              <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-gray-300 md:text-xl md:leading-10">
                تابع البطولة لحظة بلحظة: مباريات اليوم، النتائج، الأخبار، التحليلات الفنية، الإحصائيات، المنتخبات، الملاعب، والمدن المستضيفة في تجربة رياضية واحدة.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {heroActions.map(([label, href, variant]) => (
                  <Link
                    key={href + label}
                    href={href}
                    className={
                      variant === 'primary'
                        ? 'rounded-2xl bg-[#0FF0FC] px-6 py-3 text-sm font-black text-black shadow-[0_0_28px_rgba(15,240,252,0.28)] transition hover:-translate-y-0.5 hover:bg-[#4AFAFF]'
                        : 'rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#FFD700]/40 hover:bg-white/[0.14]'
                    }
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map(([value, label, caption]) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur">
                    <div className="text-3xl font-black text-[#FFD700]">{value}</div>
                    <div className="mt-1 text-sm font-black text-white">{label}</div>
                    <div className="mt-1 text-xs font-bold leading-5 text-gray-400">{caption}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-8 rounded-full bg-[#FFD700]/10 blur-3xl" />
              <div className="relative mx-auto max-w-md rounded-[2.25rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <div className="rounded-[1.85rem] border border-white/10 bg-white p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]">
                  <img src={logoSrc} alt="World Cup 2026 platform logo" className="mx-auto aspect-square w-full max-w-[320px] object-contain" />
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD700]">LIVE MATCH HUB</p>
                      <h2 className="mt-2 text-2xl font-black text-white">مركز المباريات الحية</h2>
                    </div>
                    <span className="rounded-full bg-[#00FF88]/10 px-3 py-1 text-xs font-black text-[#00FF88]">جاهز للتحديث</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {liveCenterRows.map(([title, text]) => (
                      <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                        <div className="text-sm font-black text-white">{title}</div>
                        <div className="mt-1 text-xs font-bold leading-6 text-gray-400">{text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="worldcup-sections">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#0FF0FC]">أقسام المنصة</p>
              <h2 id="worldcup-sections" className="mt-2 text-2xl font-black text-white md:text-3xl">بوابة كاملة لمتابعة البطولة</h2>
            </div>
            <p className="max-w-xl text-sm font-bold leading-7 text-gray-400">
              التركيز الأساسي رياضي: مباريات، أخبار، تحليل، وإحصائيات. والجانب الافتراضي يبقى تجربة ترفيهية منفصلة.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(([title, text, href]) => (
              <Link
                key={title}
                href={href}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#0FF0FC]/35 hover:bg-white/[0.07]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0FF0FC]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-black text-white">{title}</h3>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-[#FFD700]">2026</span>
                </div>
                <p className="mt-3 text-sm font-bold leading-7 text-gray-400">{text}</p>
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-[#FFD700]/20 bg-[#FFD700]/[0.06] p-5 text-sm font-bold leading-7 text-gray-300">
            تنبيه هوية المنصة: الأخبار والتحليل والإحصائيات محتوى رياضي مستقل، أما البورصة الافتراضية فهي تجربة ترفيهية فقط بدون أموال حقيقية، بدون مراهنات، وبدون توصيات شراء أو بيع.
          </div>
        </section>
      </div>
    </main>
  );
}
