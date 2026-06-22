import Link from 'next/link';
import prisma from '@/lib/prisma';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';
import { Search, User, Trophy, Shield, ChevronLeft, MapPin, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PAGE_SIZE = 120;

type PlayersSearchParams = Promise<{
  q?: string | string[];
  team?: string | string[];
  position?: string | string[];
  group?: string | string[];
  image?: string | string[];
}>;

type Props = { searchParams?: PlayersSearchParams };

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
    team: { id: string; name: string; code: string | null; image: string | null; group: string | null } | null;
  };
};

type TopPlayerMetric = {
  player: {
    id: string;
    name: string;
    code: string | null;
    image: string | null;
    teamId: string | null;
    team: { id: string; name: string; code: string | null; image: string | null } | null;
  };
  value: number;
} | null;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanParam(value?: string) {
  return String(value || '').trim();
}

function formatCount(value?: number | null, fallback = '٠') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG') : fallback;
}

function imageFilter(value: string) {
  if (value === 'with-image') return { image: { startsWith: 'https://' } };
  if (value === 'missing-image') return { OR: [{ image: null }, { image: '' }, { image: '👤' }] };
  return null;
}

function buildPlayerWhere({ query, selectedTeam, selectedPosition, selectedGroup, selectedImage }: { query: string; selectedTeam: string; selectedPosition: string; selectedGroup: string; selectedImage: string }) {
  const AND: any[] = [{ type: 'PLAYER' }, { isAvailable: true }, { teamId: { not: null } }];
  if (selectedTeam) AND.push({ teamId: selectedTeam });
  if (selectedPosition) AND.push({ position: selectedPosition });
  if (selectedGroup) AND.push({ team: { is: { group: selectedGroup } } });
  const img = imageFilter(selectedImage);
  if (img) AND.push(img);
  if (query) {
    AND.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { code: { contains: query, mode: 'insensitive' } },
        { position: { contains: query, mode: 'insensitive' } },
        { club: { contains: query, mode: 'insensitive' } },
        { team: { is: { name: { contains: query, mode: 'insensitive' } } } },
        { team: { is: { code: { contains: query, mode: 'insensitive' } } } },
        { team: { is: { group: { contains: query, mode: 'insensitive' } } } },
      ],
    });
  }
  return { AND };
}

function TopMetricCard({ metric, title, label, tone = 'gold' }: { metric: TopPlayerMetric; title: string; label: string; tone?: 'gold' | 'cyan' }) {
  const accent = tone === 'cyan' ? 'text-[#0FF0FC]' : 'text-[#FFD700]';
  const card = tone === 'cyan' ? 'border-[#0FF0FC]/20 bg-[#0FF0FC]/10' : 'border-[#FFD700]/20 bg-[#FFD700]/10';
  return (
    <div className={`rounded-3xl border p-5 ${card}`}>
      <div className={`mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] ${accent}`}><Trophy size={15} /> {title}</div>
      {metric?.player ? (
        <Link href={`/players/${encodeURIComponent(metric.player.id)}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-black/45">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/50">
            {hasUsablePlayerImage(metric.player.image) ? <img src={metric.player.image as string} alt={metric.player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-lg font-black text-white/60">{metric.player.code || metric.player.name.slice(0, 2)}</span>}
          </span>
          <span className="min-w-0 flex-1"><span className="block truncate text-lg font-black text-white">{metric.player.name}</span><span className="mt-1 block truncate text-xs font-bold text-gray-400">{metric.player.team?.name || 'غير متوفر'}</span></span>
          <span className="text-left"><span className={`block text-3xl font-black ${accent}`}>{formatCount(metric.value)}</span><span className="text-[10px] font-bold text-gray-500">{label}</span></span>
        </Link>
      ) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-sm font-bold text-gray-400">لا توجد بيانات موثقة بعد.</div>}
    </div>
  );
}

function PlayerCard({ player }: PlayerCardProps) {
  const initials = player.code || player.name.slice(0, 2);
  const hasImage = hasUsablePlayerImage(player.image);
  return (
    <Link className="relative group block overflow-hidden rounded-2xl border border-white/10 bg-[#111111]/80 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#0FF0FC]/30" href={`/players/${encodeURIComponent(player.id)}`}>
      <div className="relative z-10 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-tr from-white/5 to-white/10 p-0.5 shadow-xl">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-[#0a0a0a]">
            {hasImage ? <img src={player.image as string} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-lg font-black text-white/50">{initials}</span>}
          </div>
          {player.team?.image && <img src={player.team.image} alt={player.team.name} className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border-2 border-[#111] bg-black object-cover" loading="lazy" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-black text-white group-hover:text-[#0FF0FC]">{player.name}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-gray-400">
            <span className="flex items-center gap-1"><Shield size={12} className="text-[#0FF0FC]/70"/> {player.position || 'غير متوفر'}</span>
            <span className="text-white/20">•</span>
            <span className="font-mono text-white/60">{player.code || 'N/A'}</span>
          </div>
        </div>
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><Trophy size={12}/> المنتخب</p><p className="mt-1.5 truncate text-sm font-black text-white/90">{player.team?.name || 'غير متوفر'}</p></div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><User size={12}/> العمر</p><p className="mt-1.5 text-sm font-black text-white/90">{player.age ?? 'غير متوفر'}</p></div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><Filter size={12}/> المجموعة</p><p className="mt-1.5 truncate text-sm font-bold text-white/80">{player.team?.group || 'غير متوفر'}</p></div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"><MapPin size={12}/> النادي الحالي</p><p className="mt-1.5 truncate text-sm font-bold text-white/80">{player.club || 'غير متوفر'}</p></div>
      </div>
      <div className="relative z-10 mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-[13px] font-black"><span className="text-gray-400 group-hover:text-[#0FF0FC]">عرض صفحة اللاعب</span><ChevronLeft size={16} className="text-gray-500" /></div>
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
  const where = buildPlayerWhere({ query, selectedTeam, selectedPosition, selectedGroup, selectedImage });

  const [players, totalMatching, teams, positionRows, performanceRows] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ team: { name: 'asc' } }, { position: 'asc' }, { name: 'asc' }],
      take: PAGE_SIZE,
      select: { id: true, name: true, code: true, image: true, position: true, age: true, club: true, teamId: true, team: { select: { id: true, name: true, code: true, image: true, group: true } } },
    }),
    prisma.asset.count({ where }),
    prisma.asset.findMany({ where: { type: 'TEAM' }, orderBy: [{ group: 'asc' }, { name: 'asc' }], select: { id: true, name: true, code: true, group: true } }),
    prisma.asset.findMany({ where: { type: 'PLAYER', position: { not: null } }, select: { position: true }, distinct: ['position'], orderBy: { position: 'asc' }, take: 80 }),
    prisma.playerPerformance.findMany({
      where: { OR: [{ goals: { gt: 0 } }, { assists: { gt: 0 } }] },
      select: { goals: true, assists: true, asset: { select: { id: true, name: true, code: true, image: true, teamId: true, team: { select: { id: true, name: true, code: true, image: true } } } } },
      take: 300,
    }),
  ]);

  const scorerMap = new Map<string, { player: NonNullable<TopPlayerMetric>['player']; value: number }>();
  const assistMap = new Map<string, { player: NonNullable<TopPlayerMetric>['player']; value: number }>();
  performanceRows.forEach((row) => {
    if (!row.asset?.id) return;
    const goals = Number(row.goals || 0);
    const assists = Number(row.assists || 0);
    if (goals > 0) { const current = scorerMap.get(row.asset.id) || { player: row.asset, value: 0 }; current.value += goals; scorerMap.set(row.asset.id, current); }
    if (assists > 0) { const current = assistMap.get(row.asset.id) || { player: row.asset, value: 0 }; current.value += assists; assistMap.set(row.asset.id, current); }
  });

  const sortMetrics = (a: NonNullable<TopPlayerMetric>, b: NonNullable<TopPlayerMetric>) => b.value - a.value || a.player.name.localeCompare(b.player.name, 'ar');
  const topScorer = Array.from(scorerMap.values()).sort(sortMetrics)[0] || null;
  const topAssister = Array.from(assistMap.values()).sort(sortMetrics)[0] || null;
  const positions = positionRows.map((row) => row.position).filter((value): value is string => Boolean(value));
  const groups = Array.from(new Set(teams.map((team) => team.group).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'ar'));
  const hasActiveFilters = Boolean(query || selectedTeam || selectedPosition || selectedGroup || selectedImage);
  const limited = totalMatching > players.length;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 xl:py-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] px-6 py-10 shadow-2xl sm:px-12 sm:py-12">
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/30 bg-[#0FF0FC]/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-[#0FF0FC]">Official World Cup Squads</div>
            <h1 className="mt-5 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">دليل اللاعبين <span className="bg-gradient-to-r from-[#0FF0FC] to-blue-400 bg-clip-text text-transparent">الرسمي</span></h1>
            <p className="mt-3 text-sm font-bold text-gray-400">يعرض أول {formatCount(players.length)} نتيجة من أصل {formatCount(totalMatching)} لتقليل الضغط وتسريع الصفحة.</p>
          </div>
          <div className="grid w-full gap-4 md:grid-cols-2 xl:w-[760px]"><TopMetricCard metric={topScorer} title="الأكثر تهديفًا" label="هدف" /><TopMetricCard metric={topAssister} title="الأكثر صناعة للأهداف" label="أسيست" tone="cyan" /></div>
        </div>
      </section>

      <section className="sticky top-4 z-40 mt-8 rounded-3xl border border-white/10 bg-[#111111]/60 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <form className="grid gap-4 md:grid-cols-[1fr_180px_170px_150px_170px_auto]" method="GET">
          <div className="group relative"><div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500"><Search size={18} /></div><input className="w-full rounded-2xl border border-white/10 bg-black/50 py-3.5 pr-12 pl-4 text-sm font-bold text-white outline-none placeholder:text-gray-600 focus:border-[#0FF0FC]/50" defaultValue={query} name="q" placeholder="ابحث بالاسم، المنتخب، النادي..." type="search" /></div>
          <select className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm font-bold text-white outline-none" defaultValue={selectedTeam} name="team"><option value="">🌍 كل المنتخبات</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.code ? ` (${team.code})` : ''}</option>)}</select>
          <select className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm font-bold text-white outline-none" defaultValue={selectedPosition} name="position"><option value="">🎯 كل المراكز</option>{positions.map((position) => <option key={position} value={position}>{position}</option>)}</select>
          <select className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm font-bold text-white outline-none" defaultValue={selectedGroup} name="group"><option value="">🏆 كل المجموعات</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select>
          <select className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3.5 text-sm font-bold text-white outline-none" defaultValue={selectedImage} name="image"><option value="">🖼️ كل الصور</option><option value="with-image">بصور فقط</option><option value="missing-image">بدون صورة</option></select>
          <div className="flex items-center gap-3"><button className="h-[52px] rounded-2xl bg-gradient-to-r from-[#0FF0FC] to-[#00D4FF] px-7 text-sm font-black text-black" type="submit">تطبيق</button>{hasActiveFilters && <Link className="flex h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-black text-white" href="/players">إلغاء</Link>}</div>
        </form>
      </section>

      {limited && <div className="mt-5 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-5 py-3 text-sm font-bold text-[#FFD700]">تم تحديد العرض لأول {formatCount(PAGE_SIZE)} نتيجة لتسريع الصفحة. استخدم البحث أو الفلاتر للوصول للاعب محدد.</div>}

      {players.length > 0 ? <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{players.map((player) => <PlayerCard key={player.id} player={player} />)}</section> : <section className="mt-12 rounded-[2rem] border border-dashed border-white/10 bg-black/20 px-4 py-20 text-center"><Search size={48} className="mx-auto text-gray-500" /><h2 className="mt-6 text-3xl font-black text-white">لم يتم العثور على نتائج</h2><p className="mt-4 text-gray-400">جرب كلمات مختلفة أو أزل بعض الفلاتر.</p></section>}
    </main>
  );
}
