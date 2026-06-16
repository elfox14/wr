import Link from 'next/link';
import prisma from '@/lib/prisma';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';
import { Search, User, Trophy, Shield, ChevronLeft, MapPin, Image as ImageIcon, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';

type PlayersSearchParams = Promise<{
  q?: string | string[];
  team?: string | string[];
  position?: string | string[];
  group?: string | string[];
  image?: string | string[];
}>;

type Props = {
  searchParams?: PlayersSearchParams;
};

type PlayerCardProps = {
  player: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    position: string | null;
    age: number | null;
    club: string | null;
    teamId: string | null;
    team: {
      id: string;
      name: string;
      code: string | null;
      image: string | null;
      group: string | null;
    } | null;
  };
};

type TopPlayerMetric = {
  player: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    teamId: string | null;
    team: {
      id: string;
      name: string;
      code: string | null;
      image: string | null;
    } | null;
  };
  value: number;
} | null;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanParam(value?: string) {
  return String(value || '').trim();
}

function toSearchable(value?: string | null) {
  return String(value || '').toLowerCase();
}

function formatCount(value?: number | null, fallback = '٠') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG') : fallback;
}

function TopMetricCard({ metric, title, label, tone = 'gold' }: { metric: TopPlayerMetric; title: string; label: string; tone?: 'gold' | 'cyan' }) {
  const styles = tone === 'cyan'
    ? {
        card: 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10 shadow-[0_0_25px_rgba(15,240,252,0.08)]',
        accent: 'text-[#0FF0FC]',
        hover: 'hover:border-[#0FF0FC]/40',
        empty: 'border-[#0FF0FC]/20',
      }
    : {
        card: 'border-[#FFD700]/20 bg-[#FFD700]/10 shadow-[0_0_25px_rgba(255,215,0,0.08)]',
        accent: 'text-[#FFD700]',
        hover: 'hover:border-[#FFD700]/40',
        empty: 'border-[#FFD700]/20',
      };

  return (
    <div className={`rounded-3xl border p-5 ${styles.card}`}>
      <div className={`mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] ${styles.accent}`}>
        <Trophy size={15} /> {title}
      </div>
      {metric?.player ? (
        <Link href={metric.player.teamId ? `/teams/${metric.player.teamId}?player=${metric.player.id}` : '/players'} className={`flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 transition ${styles.hover} hover:bg-black/45`}>
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50">
            {hasUsablePlayerImage(metric.player.image) ? <img src={metric.player.image as string} alt={metric.player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-lg font-black text-white/60">{metric.player.code || metric.player.name.slice(0, 2)}</span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-black text-white">{metric.player.name}</span>
            <span className="mt-1 block truncate text-xs font-bold text-gray-400">{metric.player.team?.name || 'غير متوفر'}</span>
          </span>
          <span className="text-left">
            <span className={`block text-3xl font-black ${styles.accent}`}>{formatCount(metric.value)}</span>
            <span className="text-[10px] font-bold text-gray-500">{label}</span>
          </span>
        </Link>
      ) : (
        <div className={`rounded-2xl border border-dashed bg-black/25 p-4 text-sm font-bold text-gray-400 ${styles.empty}`}>لا توجد بيانات موثقة بعد.</div>
      )}
    </div>
  );
}

function PlayerCard({ player }: PlayerCardProps) {
  const initials = player.code || player.name.slice(0, 2);
  const hasImage = hasUsablePlayerImage(player.image);
  const content = (
    <>
      <div className="relative flex items-center gap-4 z-10">
        <div className="relative h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-tr from-white/5 to-white/10 p-0.5 shadow-xl transition-transform duration-300 group-hover:scale-105 group-hover:shadow-[#0FF0FC]/20">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-[#0a0a0a]">
            {hasImage ? (
              <img src={player.image as string} alt={player.name} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-lg font-black text-white/50">{initials}</span>
            )}
          </div>
          {player.team?.image && (
            <img
              src={player.team.image}
              alt={player.team.name}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-[#111] bg-black object-cover"
              loading="lazy"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">
              قائمة رسمية
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${hasImage ? 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>
              {hasImage ? 'صورة متاحة' : 'صورة غير متاحة'}
            </span>
          </div>
          <h2 className="truncate text-lg font-black text-white transition-colors duration-300 group-hover:text-[#0FF0FC] drop-shadow-sm">{player.name}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-gray-400">
            <span className="flex items-center gap-1"><Shield size={12} className="text-[#0FF0FC]/70"/> {player.position || 'غير متوفر'}</span>
            <span className="text-white/20">•</span>
            <span className="font-mono text-white/60">{player.code || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 z-10 relative">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent p-3 backdrop-blur-sm transition-colors duration-300 group-hover:border-white/10 group-hover:bg-white/[0.05]">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><Trophy size={12}/> المنتخب</p>
          <p className="mt-1.5 truncate text-sm font-black text-white/90">{player.team?.name || 'غير متوفر'}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent p-3 backdrop-blur-sm transition-colors duration-300 group-hover:border-white/10 group-hover:bg-white/[0.05]">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><User size={12}/> العمر</p>
          <p className="mt-1.5 text-sm font-black text-white/90">{player.age ?? 'غير متوفر'}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 z-10 relative">
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent p-3 backdrop-blur-sm transition-colors duration-300 group-hover:border-white/10 group-hover:bg-white/[0.05]">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><Filter size={12}/> المجموعة</p>
          <p className="mt-1.5 truncate text-sm font-bold text-white/80">{player.team?.group || 'غير متوفر'}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent p-3 backdrop-blur-sm transition-colors duration-300 group-hover:border-white/10 group-hover:bg-white/[0.05]">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><ImageIcon size={12}/> الصورة</p>
          <p className="mt-1.5 truncate text-sm font-bold text-white/80">{hasImage ? 'حقيقية/رابط متاح' : 'غير متوفرة'}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent p-3 backdrop-blur-sm transition-colors duration-300 group-hover:border-white/10 group-hover:bg-white/[0.05] z-10 relative">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><MapPin size={12}/> النادي الحالي</p>
        <p className="mt-1.5 truncate text-sm font-bold text-white/80">{player.club || 'غير متوفر'}</p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-[13px] font-black transition-colors duration-300 z-10 relative">
        <span className={player.teamId ? 'text-gray-400 group-hover:text-[#0FF0FC]' : 'text-gray-600'}>
          {player.teamId ? 'عرض صفحة المنتخب' : 'غير مرتبط بمنتخب'}
        </span>
        {player.teamId && (
          <ChevronLeft size={16} className="text-gray-500 transition-all duration-300 group-hover:-translate-x-1 group-hover:text-[#0FF0FC]" />
        )}
      </div>

      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0FF0FC]/0 via-transparent to-[#0FF0FC]/0 opacity-0 transition-opacity duration-500 group-hover:from-[#0FF0FC]/[0.03] group-hover:to-transparent group-hover:opacity-100 rounded-2xl pointer-events-none" />
    </>
  );

  const baseClasses = 'relative group block overflow-hidden rounded-2xl border border-white/10 bg-[#111111]/80 p-5 backdrop-blur-md transition-all duration-300';

  if (!player.teamId) {
    return <article className={`${baseClasses} opacity-80 grayscale-[30%]`}>{content}</article>;
  }

  return (
    <Link
      className={`${baseClasses} hover:-translate-y-1.5 hover:border-[#0FF0FC]/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[#0FF0FC]/10`}
      href={`/teams/${player.teamId}?player=${player.id}`}
    >
      {content}
    </Link>
  );
}

export default async function PlayersPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = cleanParam(firstParam(resolvedSearchParams.q));
  const selectedTeam = cleanParam(firstParam(resolvedSearchParams.team));
  const selectedPosition = cleanParam(firstParam(resolvedSearchParams.position));
  const selectedGroup = cleanParam(firstParam(resolvedSearchParams.group));
  const selectedImage = cleanParam(firstParam(resolvedSearchParams.image));

  const [allPlayers, performanceRows] = await Promise.all([
    prisma.asset.findMany({
      where: {
        type: 'PLAYER',
        isAvailable: true,
        teamId: { not: null },
      },
      orderBy: [{ team: { name: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        image: true,
        position: true,
        age: true,
        club: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
            group: true,
          },
        },
      },
    }),
    prisma.playerPerformance.findMany({
      where: { OR: [{ goals: { gt: 0 } }, { assists: { gt: 0 } }] },
      select: {
        goals: true,
        assists: true,
        asset: {
          select: {
            id: true,
            name: true,
            code: true,
            image: true,
            teamId: true,
            team: { select: { id: true, name: true, code: true, image: true } },
          },
        },
      },
    }),
  ]);

  const scorerMap = new Map<string, { player: NonNullable<TopPlayerMetric>['player']; value: number }>();
  const assistMap = new Map<string, { player: NonNullable<TopPlayerMetric>['player']; value: number }>();

  performanceRows.forEach((row) => {
    if (!row.asset?.id) return;
    const goals = Number(row.goals || 0);
    const assists = Number(row.assists || 0);

    if (goals > 0) {
      const current = scorerMap.get(row.asset.id) || { player: row.asset, value: 0 };
      current.value += goals;
      scorerMap.set(row.asset.id, current);
    }

    if (assists > 0) {
      const current = assistMap.get(row.asset.id) || { player: row.asset, value: 0 };
      current.value += assists;
      assistMap.set(row.asset.id, current);
    }
  });

  const sortMetrics = (a: NonNullable<TopPlayerMetric>, b: NonNullable<TopPlayerMetric>) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'ar');
  const topScorer = Array.from(scorerMap.values()).sort(sortMetrics)[0] || null;
  const topAssister = Array.from(assistMap.values()).sort(sortMetrics)[0] || null;

  const teams = Array.from(
    new Map(
      allPlayers
        .filter((player) => player.team)
        .map((player) => [player.team!.id, { id: player.team!.id, name: player.team!.name, code: player.team!.code, group: player.team!.group }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const positions = Array.from(
    new Set(allPlayers.map((player) => player.position).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const groups = Array.from(
    new Set(allPlayers.map((player) => player.team?.group).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const normalizedQuery = query.toLowerCase();
  const players = allPlayers.filter((player) => {
    const hasImage = hasUsablePlayerImage(player.image);
    const matchesQuery =
      !normalizedQuery ||
      [player.name, player.code, player.position, player.club, player.team?.name, player.team?.code, player.team?.group].some((value) =>
        toSearchable(value).includes(normalizedQuery),
      );

    const matchesTeam = !selectedTeam || player.teamId === selectedTeam;
    const matchesPosition = !selectedPosition || player.position === selectedPosition;
    const matchesGroup = !selectedGroup || player.team?.group === selectedGroup;
    const matchesImage =
      !selectedImage ||
      selectedImage === 'all' ||
      (selectedImage === 'with-image' && hasImage) ||
      (selectedImage === 'missing-image' && !hasImage);

    return matchesQuery && matchesTeam && matchesPosition && matchesGroup && matchesImage;
  });

  const hasActiveFilters = Boolean(query || selectedTeam || selectedPosition || selectedGroup || selectedImage);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 xl:py-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] px-6 py-10 shadow-2xl sm:px-12 sm:py-12">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#0FF0FC]/10 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/30 bg-[#0FF0FC]/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-[#0FF0FC] shadow-[0_0_15px_rgba(15,240,252,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0FF0FC] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0FF0FC]"></span>
              </span>
              Official World Cup Squads
            </div>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
              دليل اللاعبين <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0FF0FC] to-blue-400">الرسمي</span>
            </h1>
          </div>

          <div className="grid w-full gap-4 xl:w-[760px] md:grid-cols-2">
            <TopMetricCard metric={topScorer} title="الأكثر تهديفًا" label="هدف" />
            <TopMetricCard metric={topAssister} title="الأكثر صناعة للأهداف" label="أسيست" tone="cyan" />
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-[#111111]/60 p-5 backdrop-blur-xl sticky top-4 z-40 shadow-2xl shadow-black/50">
        <form className="grid gap-4 md:grid-cols-[1fr_180px_170px_150px_170px_auto]" method="GET">
          <div className="relative group">
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-[#0FF0FC] transition-colors">
              <Search size={18} />
            </div>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/50 py-3.5 pr-12 pl-4 text-sm font-bold text-white outline-none placeholder:text-gray-600 focus:border-[#0FF0FC]/50 focus:bg-black focus:ring-2 focus:ring-[#0FF0FC]/20 transition-all"
              defaultValue={query}
              name="q"
              placeholder="ابحث بالاسم، المنتخب، النادي، أو المجموعة..."
              type="search"
            />
          </div>

          <select
            className="w-full appearance-none rounded-2xl border border-white/10 bg-black/50 py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50 focus:bg-black focus:ring-2 focus:ring-[#0FF0FC]/20 transition-all cursor-pointer"
            defaultValue={selectedTeam}
            name="team"
          >
            <option value="">🌍 كل المنتخبات</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}{team.code ? ` (${team.code})` : ''}
              </option>
            ))}
          </select>

          <select
            className="w-full appearance-none rounded-2xl border border-white/10 bg-black/50 py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50 focus:bg-black focus:ring-2 focus:ring-[#0FF0FC]/20 transition-all cursor-pointer"
            defaultValue={selectedPosition}
            name="position"
          >
            <option value="">🎯 كل المراكز</option>
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>

          <select
            className="w-full appearance-none rounded-2xl border border-white/10 bg-black/50 py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50 focus:bg-black focus:ring-2 focus:ring-[#0FF0FC]/20 transition-all cursor-pointer"
            defaultValue={selectedGroup}
            name="group"
          >
            <option value="">🏆 كل المجموعات</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>

          <select
            className="w-full appearance-none rounded-2xl border border-white/10 bg-black/50 py-3.5 px-4 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50 focus:bg-black focus:ring-2 focus:ring-[#0FF0FC]/20 transition-all cursor-pointer"
            defaultValue={selectedImage}
            name="image"
          >
            <option value="">🖼️ كل الصور</option>
            <option value="with-image">بصور فقط</option>
            <option value="missing-image">بدون صورة</option>
          </select>

          <div className="flex items-center gap-3">
            <button className="h-[52px] rounded-2xl bg-gradient-to-r from-[#0FF0FC] to-[#00D4FF] px-7 text-sm font-black text-black shadow-[0_0_20px_rgba(15,240,252,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(15,240,252,0.5)] active:scale-95" type="submit">
              تطبيق
            </button>
            {hasActiveFilters && (
              <Link className="flex h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-white hover:bg-white/10 hover:text-red-400 hover:border-red-500/30 transition-all" href="/players">
                إلغاء
              </Link>
            )}
          </div>
        </form>
      </section>

      {players.length > 0 ? (
        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </section>
      ) : (
        <section className="mt-12 flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-black/20 px-4 py-20 text-center backdrop-blur-sm">
          <div className="rounded-full bg-white/5 p-6 mb-6 border border-white/10">
            <Search size={48} className="text-gray-500" />
          </div>
          <h2 className="text-3xl font-black text-white">لم يتم العثور على نتائج</h2>
          <p className="mt-4 max-w-md text-gray-400 leading-relaxed">
            لم نتمكن من العثور على أي لاعب يطابق معايير البحث الحالية. جرب استخدام كلمات مفتاحية مختلفة أو إزالة بعض الفلاتر.
          </p>
          <Link className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-black text-black transition-transform hover:scale-105 active:scale-95" href="/players">
            عرض كل اللاعبين
          </Link>
        </section>
      )}
    </main>
  );
}
