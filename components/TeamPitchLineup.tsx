import Link from 'next/link';
import { AlertCircle, BadgeCheck, CircleDot, ShieldCheck, Users } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type PlayerAsset = {
  id: string;
  name: string;
  image?: string | null;
  position?: string | null;
  score?: number | null;
  marketPrice?: number | null;
  current_price?: number | null;
  apiFootballId?: number | null;
  lastPerformanceRating?: number | null;
};

type OfficialLineup = {
  source: 'API_FOOTBALL' | 'ISPORTS' | 'PREDICTED' | 'UNAVAILABLE';
  fixtureId?: number | string | null;
  formation?: string | null;
  matchLabel?: string | null;
  starters?: number[];
  substitutes?: number[];
};

function priceOf(player: PlayerAsset) {
  return Math.round(Number(player.marketPrice ?? player.current_price ?? 0)).toLocaleString();
}

function scoreOf(player: PlayerAsset) {
  return Math.round(Number(player.score ?? player.lastPerformanceRating ?? 50));
}

function normalizePosition(position?: string | null) {
  const value = String(position || '').toUpperCase();
  if (['G', 'GK', 'GOALKEEPER'].includes(value)) return 'GK';
  if (['D', 'DEF', 'DEFENDER'].includes(value)) return 'DEF';
  if (['M', 'MID', 'MIDFIELDER'].includes(value)) return 'MID';
  if (['F', 'FW', 'FWD', 'ATTACKER', 'FORWARD'].includes(value)) return 'FWD';
  return value || 'MID';
}

function sortBest(players: PlayerAsset[]) {
  return [...players].sort((a, b) => {
    const bScore = Number(b.score ?? b.lastPerformanceRating ?? b.marketPrice ?? b.current_price ?? 0);
    const aScore = Number(a.score ?? a.lastPerformanceRating ?? a.marketPrice ?? a.current_price ?? 0);
    return bScore - aScore;
  });
}

function buildPredictedStarters(players: PlayerAsset[]) {
  const normalized = players.map((player) => ({ ...player, position: normalizePosition(player.position) }));
  const gk = sortBest(normalized.filter((p) => p.position === 'GK')).slice(0, 1);
  const def = sortBest(normalized.filter((p) => p.position === 'DEF')).slice(0, 4);
  const mid = sortBest(normalized.filter((p) => p.position === 'MID')).slice(0, 3);
  const fwd = sortBest(normalized.filter((p) => p.position === 'FWD')).slice(0, 3);
  const selectedIds = new Set([...gk, ...def, ...mid, ...fwd].map((p) => p.id));
  const rest = sortBest(normalized.filter((p) => !selectedIds.has(p.id))).slice(0, Math.max(0, 11 - selectedIds.size));
  return [...gk, ...def, ...mid, ...fwd, ...rest].slice(0, 11);
}

function mapOfficialPlayers(players: PlayerAsset[], providerIds: number[] = []) {
  const byProviderId = new Map(players.filter((p) => p.apiFootballId).map((p) => [Number(p.apiFootballId), p]));
  const mapped = providerIds.map((id) => byProviderId.get(Number(id))).filter(Boolean) as PlayerAsset[];
  return mapped.map((player) => ({ ...player, position: normalizePosition(player.position) }));
}

function splitLines(starters: PlayerAsset[]) {
  const normalized = starters.map((player) => ({ ...player, position: normalizePosition(player.position) }));
  return {
    FWD: normalized.filter((p) => p.position === 'FWD'),
    MID: normalized.filter((p) => p.position === 'MID'),
    DEF: normalized.filter((p) => p.position === 'DEF'),
    GK: normalized.filter((p) => p.position === 'GK'),
    OTHER: normalized.filter((p) => !['GK', 'DEF', 'MID', 'FWD'].includes(String(p.position))),
  };
}

function PlayerDot({ player, small = false }: { player: PlayerAsset; small?: boolean }) {
  return (
    <Link href={`/asset/${player.id}`} className="group flex min-w-[78px] flex-col items-center text-center">
      <div className={`${small ? 'h-10 w-10' : 'h-14 w-14'} relative flex items-center justify-center rounded-full border-2 border-white/25 bg-black/75 shadow-xl transition group-hover:scale-110 group-hover:border-[#0FF0FC]`}>
        <AssetImage image={player.image || ''} type="PLAYER" name={player.name} width={small ? 38 : 52} height={small ? 38 : 52} className={`${small ? 'h-9 w-9' : 'h-13 w-13'} rounded-full object-cover`} />
        <span className="absolute -bottom-1 -left-1 rounded-full bg-[#0FF0FC] px-1.5 py-0.5 text-[9px] font-black text-black">{scoreOf(player)}</span>
      </div>
      <p className="mt-1 max-w-[86px] truncate text-[11px] font-black text-white group-hover:text-[#0FF0FC]">{player.name}</p>
      <p className="text-[9px] text-gray-400">{priceOf(player)}¢</p>
    </Link>
  );
}

function Line({ players }: { players: PlayerAsset[] }) {
  if (!players.length) return null;
  return <div className="flex flex-wrap items-center justify-center gap-3 md:gap-7">{players.map((player) => <PlayerDot key={player.id} player={player} />)}</div>;
}

function SubstituteCard({ player }: { player: PlayerAsset }) {
  return (
    <Link href={`/asset/${player.id}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 p-2 transition hover:border-[#FFD700]/35 hover:bg-[#FFD700]/10">
      <AssetImage image={player.image || ''} type="PLAYER" name={player.name} width={30} height={30} className="h-8 w-8 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-white">{player.name}</p>
        <p className="text-[10px] text-gray-400">{normalizePosition(player.position)} • {priceOf(player)}¢</p>
      </div>
      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-gray-300">{scoreOf(player)}</span>
    </Link>
  );
}

export default function TeamPitchLineup({ team }: { team: any }) {
  const players: PlayerAsset[] = Array.isArray(team?.players) ? team.players : [];
  const officialLineup: OfficialLineup | null = team?.officialLineup || null;

  if (!team || team.type !== 'TEAM') return null;

  const officialStarters = mapOfficialPlayers(players, officialLineup?.starters || []);
  const officialSubstitutes = mapOfficialPlayers(players, officialLineup?.substitutes || []);
  const hasOfficialLineup = officialStarters.length >= 7;
  const starters = hasOfficialLineup ? officialStarters.slice(0, 11) : buildPredictedStarters(players);
  const starterIds = new Set(starters.map((player) => player.id));
  const officialSubIds = new Set(officialSubstitutes.map((player) => player.id));
  const substitutes = hasOfficialLineup
    ? [...officialSubstitutes, ...sortBest(players.filter((player) => !starterIds.has(player.id) && !officialSubIds.has(player.id))).slice(0, 12)]
    : sortBest(players.filter((player) => !starterIds.has(player.id))).slice(0, 18);
  const lines = splitLines(starters);
  const statusLabel = hasOfficialLineup ? 'تشكيل رسمي من API' : 'تشكيل متوقع حسب البيانات';
  const sourceHint = hasOfficialLineup
    ? `مصدر التشكيل: ${officialLineup?.source || 'API'}${officialLineup?.fixtureId ? ` • Fixture ${officialLineup.fixtureId}` : ''}`
    : 'لم يتوفر Lineup رسمي بعد؛ تم ترتيب الأساسيين حسب المركز، التقييم، والسعر الافتراضي.';

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4">
      <div className="rounded-3xl border border-emerald-400/15 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300"><ShieldCheck size={14} /> قائمة الفريق</span>
              <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-black ${hasOfficialLineup ? 'border-[#0FF0FC]/30 bg-[#0FF0FC]/10 text-[#0FF0FC]' : 'border-[#FFD700]/30 bg-[#FFD700]/10 text-[#FFD700]'}`}>
                {hasOfficialLineup ? <BadgeCheck size={14} /> : <AlertCircle size={14} />}{statusLabel}
              </span>
              {officialLineup?.formation && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">الخطة {officialLineup.formation}</span>}
            </div>
            <h2 className="text-2xl font-black text-white md:text-3xl">قائمة الفريق</h2>
            <p className="mt-1 max-w-4xl text-sm leading-7 text-gray-400">الأساسيون يظهرون داخل الملعب، وباقي لاعبي القائمة يظهرون كاحتياطيين حول الملعب. {sourceHint}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><p className="text-gray-500">الأساسيون</p><p className="text-xl font-black text-white">{starters.length}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><p className="text-gray-500">الاحتياطيون</p><p className="text-xl font-black text-white">{substitutes.length}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><p className="text-gray-500">القائمة</p><p className="text-xl font-black text-white">{players.length}</p></div>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-gray-400">
            لا توجد قائمة لاعبين مرتبطة بهذا المنتخب بعد. بعد جلب لاعبي المنتخب سيظهر الملعب والبدلاء هنا.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.30),rgba(2,44,34,0.92))] p-4 shadow-inner md:p-6">
              <div className="absolute inset-4 rounded-[1.5rem] border-2 border-white/15" />
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/15" />
              <div className="absolute left-1/2 top-1/2 h-px w-[calc(100%-2rem)] -translate-x-1/2 bg-white/15" />
              <div className="absolute left-1/2 top-0 h-20 w-44 -translate-x-1/2 rounded-b-full border-x-2 border-b-2 border-white/15" />
              <div className="absolute bottom-0 left-1/2 h-20 w-44 -translate-x-1/2 rounded-t-full border-x-2 border-t-2 border-white/15" />
              <div className="relative z-10 flex min-h-[560px] flex-col justify-between py-6">
                <Line players={lines.FWD.length ? lines.FWD : lines.OTHER.slice(0, 3)} />
                <Line players={lines.MID} />
                <Line players={lines.DEF} />
                <Line players={lines.GK.length ? lines.GK : lines.OTHER.slice(3, 4)} />
              </div>
            </div>

            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-black text-white"><Users size={18} className="text-[#FFD700]" /> الاحتياطيون حول الملعب</h3>
                <span className="rounded-full bg-[#FFD700]/10 px-2 py-1 text-[10px] font-black text-[#FFD700]">Bench</span>
              </div>
              {substitutes.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-400">لا يوجد لاعبون احتياطيون ظاهرون حاليًا.</p>
              ) : (
                <div className="max-h-[590px] space-y-2 overflow-auto pr-1">
                  {substitutes.map((player) => <SubstituteCard key={player.id} player={player} />)}
                </div>
              )}
            </aside>
          </div>
        )}

        <div className="mt-4 grid gap-3 text-xs text-gray-400 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><CircleDot size={14} className="mb-2 text-[#0FF0FC]" /> اضغط على أي لاعب لفتح صفحة تحليله وسهمه الافتراضي.</div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><Users size={14} className="mb-2 text-[#FFD700]" /> الاحتياطيون يظهرون حسب Lineup الرسمي أو بقية القائمة عند عدم توفره.</div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><ShieldCheck size={14} className="mb-2 text-emerald-300" /> عند عدم توفر التشكيل الرسمي، يتم تمييزه بوضوح كتشكيل متوقع.</div>
        </div>
      </div>
    </section>
  );
}
