import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Building2, CalendarDays, Shield, Target, Trophy, User } from 'lucide-react';
import prisma from '@/lib/prisma';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> | { id: string } };

function formatCount(value?: number | null, fallback = '٠') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG') : fallback;
}

function formatDecimal(value?: number | null, fallback = 'غير متوفر') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : fallback;
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'غير متوفر';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير متوفر';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: '2-digit' });
}

function safeNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanText(value: unknown) {
  const text = String(value || '').trim();
  return text && text !== 'null' && text !== 'undefined' ? text : '';
}

function getPath(obj: any, path: string) {
  return path.split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function clubFromRawData(rawData: any) {
  const candidates = [
    getPath(rawData, 'roster.club'),
    getPath(rawData, 'player.club'),
    getPath(rawData, 'profile.club'),
    rawData?.club,
    rawData?.currentClub,
    rawData?.current_club,
  ];
  return candidates.map(cleanText).find(Boolean) || '';
}

function sourceUrlFromRawData(rawData: any) {
  return cleanText(rawData?.sourceUrl || rawData?.source_url || rawData?.url || rawData?.source?.url);
}

function teamName(team?: { name?: string | null; code?: string | null } | null) {
  return team?.name || team?.code || 'غير متوفر';
}

function InfoCard({ title, value, icon }: { title: string; value: string | number | null | undefined; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-gray-500">{icon}{title}</div>
      <div className="truncate text-lg font-black text-white">{value || 'غير متوفر'}</div>
    </div>
  );
}

function MetricBox({ title, value, accent = false }: { title: string; value: number | null | undefined; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${accent ? 'border-[#FFD700]/20 bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 bg-white/[0.04] text-white'}`}>
      <div className="text-2xl font-black leading-none">{formatCount(value)}</div>
      <div className="mt-1 text-[10px] font-bold text-gray-400">{title}</div>
    </div>
  );
}

export default async function PlayerDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const playerId = decodeURIComponent(resolvedParams.id);

  const player = await prisma.asset.findFirst({
    where: { id: playerId, type: 'PLAYER' },
    select: {
      id: true,
      name: true,
      code: true,
      image: true,
      position: true,
      age: true,
      club: true,
      teamId: true,
      score: true,
      lastPerformanceRating: true,
      lastPerformanceSyncAt: true,
      team: { select: { id: true, name: true, code: true, image: true, group: true, continent: true, fifaRank: true } },
      performances: {
        orderBy: [{ matchDate: 'desc' }, { updatedAt: 'desc' }],
        take: 25,
        select: {
          id: true,
          provider: true,
          season: true,
          competition: true,
          opponentName: true,
          minutes: true,
          started: true,
          goals: true,
          assists: true,
          shotsTotal: true,
          shotsOnTarget: true,
          passes: true,
          keyPasses: true,
          tackles: true,
          interceptions: true,
          saves: true,
          yellowCards: true,
          redCards: true,
          apiRating: true,
          internalRating: true,
          rawData: true,
          matchDate: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!player) notFound();

  const performances = player.performances || [];
  const totals = performances.reduce((acc, row) => {
    acc.minutes += safeNumber(row.minutes);
    acc.starts += row.started ? 1 : 0;
    acc.goals += safeNumber(row.goals);
    acc.assists += safeNumber(row.assists);
    acc.shots += safeNumber(row.shotsTotal);
    acc.shotsOnTarget += safeNumber(row.shotsOnTarget);
    acc.passes += safeNumber(row.passes);
    acc.keyPasses += safeNumber(row.keyPasses);
    acc.tackles += safeNumber(row.tackles);
    acc.interceptions += safeNumber(row.interceptions);
    acc.saves += safeNumber(row.saves);
    acc.yellowCards += safeNumber(row.yellowCards);
    acc.redCards += safeNumber(row.redCards);
    return acc;
  }, { minutes: 0, starts: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, passes: 0, keyPasses: 0, tackles: 0, interceptions: 0, saves: 0, yellowCards: 0, redCards: 0 });

  const inferredClub = cleanText(player.club) || performances.map((row) => clubFromRawData(row.rawData)).find(Boolean) || '';
  const hasImage = hasUsablePlayerImage(player.image);
  const initials = player.code || player.name.slice(0, 2);
  const sourceRows = performances
    .map((row) => ({ provider: cleanText(row.provider), sourceUrl: sourceUrlFromRawData(row.rawData), updatedAt: row.updatedAt }))
    .filter((row, index, list) => (row.provider || row.sourceUrl) && list.findIndex((item) => item.provider === row.provider && item.sourceUrl === row.sourceUrl) === index)
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/players" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-gray-200 transition hover:border-[#0FF0FC]/30 hover:bg-white/[0.07] hover:text-white">
          <ArrowRight size={16} /> العودة للاعبين
        </Link>
        {player.teamId ? <Link href={`/teams/${encodeURIComponent(player.teamId)}`} className="rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-2 text-sm font-black text-[#0FF0FC]">صفحة المنتخب</Link> : null}
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#0FF0FC]/10 blur-[120px]" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-[1.7rem] border border-white/10 bg-black/35 p-5 text-center">
            <div className="mx-auto flex h-52 w-52 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[#111]">
              {hasImage ? <img src={player.image as string} alt={player.name} className="h-full w-full object-cover" /> : <span className="text-5xl font-black text-white/35">{initials}</span>}
            </div>
            <h1 className="mt-5 text-3xl font-black text-white">{player.name}</h1>
            <p className="mt-2 text-sm font-bold text-gray-400">{player.position || 'غير متوفر'} • {teamName(player.team)}</p>
          </div>

          <div className="flex flex-col justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FFD700]">Player Profile</div>
              <h2 className="mt-4 text-2xl font-black text-white sm:text-4xl">صفحة اللاعب</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">تعرض هذه الصفحة البيانات المتاحة حاليًا في قاعدة بيانات المنصة ومصادر الأداء المخزنة. أي خانة غير موجودة تظهر كـ “غير متوفر”.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard title="المنتخب" value={teamName(player.team)} icon={<Trophy size={13} />} />
              <InfoCard title="المركز" value={player.position || 'غير متوفر'} icon={<Shield size={13} />} />
              <InfoCard title="العمر" value={player.age ?? 'غير متوفر'} icon={<User size={13} />} />
              <InfoCard title="النادي الحالي" value={inferredClub || 'غير متوفر في المصادر'} icon={<Building2 size={13} />} />
              <InfoCard title="المجموعة" value={player.team?.group || 'غير متوفر'} icon={<Target size={13} />} />
              <InfoCard title="كود اللاعب" value={player.code || 'غير متوفر'} icon={<Shield size={13} />} />
              <InfoCard title="آخر تحديث أداء" value={formatDate(player.lastPerformanceSyncAt || performances[0]?.updatedAt)} icon={<CalendarDays size={13} />} />
              <InfoCard title="تقييم داخلي" value={formatDecimal(player.lastPerformanceRating ?? player.score)} icon={<Target size={13} />} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#111111]/70 p-5 backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Trophy className="text-[#FFD700]" size={20} /> ملخص الأداء المتاح</div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          <MetricBox title="سجلات" value={performances.length} />
          <MetricBox title="دقائق" value={totals.minutes} />
          <MetricBox title="أساسي" value={totals.starts} />
          <MetricBox title="أهداف" value={totals.goals} accent />
          <MetricBox title="أسيست" value={totals.assists} />
          <MetricBox title="تسديدات" value={totals.shots} />
          <MetricBox title="على المرمى" value={totals.shotsOnTarget} accent />
          <MetricBox title="تمريرات" value={totals.passes} />
          <MetricBox title="مفتاحية" value={totals.keyPasses} />
          <MetricBox title="افتكاكات" value={totals.tackles} />
          <MetricBox title="اعتراضات" value={totals.interceptions} />
          <MetricBox title="تصديات" value={totals.saves} />
          <MetricBox title="صفراء" value={totals.yellowCards} accent />
          <MetricBox title="حمراء" value={totals.redCards} />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#111111]/70 p-5 backdrop-blur-xl sm:p-6">
          <h2 className="mb-4 text-lg font-black text-white">سجلات الأداء</h2>
          {performances.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-right text-sm">
                <thead className="text-xs text-gray-500"><tr className="border-b border-white/10"><th className="py-3 pl-3">المصدر</th><th className="py-3 pl-3">البطولة</th><th className="py-3 pl-3">الخصم</th><th className="py-3 pl-3">دقائق</th><th className="py-3 pl-3">أهداف</th><th className="py-3 pl-3">أسيست</th><th className="py-3 pl-3">تقييم</th><th className="py-3">تاريخ</th></tr></thead>
                <tbody>
                  {performances.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 text-gray-300">
                      <td className="py-3 pl-3 font-bold text-[#0FF0FC]">{row.provider || 'DB'}</td>
                      <td className="py-3 pl-3">{row.competition || 'غير متوفر'}</td>
                      <td className="py-3 pl-3">{row.opponentName || 'غير متوفر'}</td>
                      <td className="py-3 pl-3 font-black text-white">{formatCount(row.minutes)}</td>
                      <td className="py-3 pl-3 font-black text-[#FFD700]">{formatCount(row.goals)}</td>
                      <td className="py-3 pl-3 font-black text-[#0FF0FC]">{formatCount(row.assists)}</td>
                      <td className="py-3 pl-3">{formatDecimal(row.apiRating ?? row.internalRating)}</td>
                      <td className="py-3">{formatDate(row.matchDate || row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-400">لا توجد سجلات أداء موثقة لهذا اللاعب حتى الآن.</div>}
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-[#111111]/70 p-5 backdrop-blur-xl sm:p-6">
          <h2 className="mb-4 text-lg font-black text-white">مصادر البيانات المتاحة</h2>
          {sourceRows.length ? <div className="space-y-3">{sourceRows.map((source, index) => <div key={`${source.provider}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-xs font-black text-[#FFD700]">{source.provider || 'مصدر محفوظ'}</div>{source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs font-bold text-[#0FF0FC] hover:underline">فتح المصدر</a> : <div className="mt-2 text-xs font-bold text-gray-500">رابط المصدر غير متوفر</div>}<div className="mt-2 text-[10px] font-bold text-gray-600">آخر تحديث: {formatDate(source.updatedAt)}</div></div>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold text-gray-400">غير متوفر في المصادر.</div>}
        </aside>
      </section>
    </main>
  );
}
