import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Building2, CalendarDays, Shield, Target, Trophy, User } from 'lucide-react';
import prisma from '@/lib/prisma';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

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

function InfoCard({ title, value, icon }: { title: string; value: string | number | null | undefined; icon: ReactNode }) {
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
  const latest = performances[0];
  const avgRating = performances.length
    ? performances.reduce((sum, row) => sum + safeNumber(row.internalRating || row.apiRating), 0) / performances.length
    : null;
  const goals = performances.reduce((sum, row) => sum + safeNumber(row.goals), 0);
  const assists = performances.reduce((sum, row) => sum + safeNumber(row.assists), 0);
  const minutes = performances.reduce((sum, row) => sum + safeNumber(row.minutes), 0);
  const rawClub = latest?.rawData ? clubFromRawData(latest.rawData) : '';
  const rawSource = latest?.rawData ? sourceUrlFromRawData(latest.rawData) : '';
  const imageUsable = hasUsablePlayerImage(player.image);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <Link href="/players" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-gray-300 transition hover:border-[#0FF0FC]/40 hover:text-white"><ArrowRight size={16} /> كل اللاعبين</Link>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-6 shadow-card sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
            <div className="mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black/35">
              {imageUsable ? <img src={player.image || ''} alt={player.name} className="h-full w-full object-cover" /> : <User size={72} className="text-gray-600" />}
            </div>
            <div>
              <span className="inline-flex rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC]">ملف لاعب</span>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">{player.name}</h1>
              <p className="mt-3 text-sm font-bold text-gray-400">{player.position || 'مركز غير متوفر'} · {teamName(player.team)} · {rawClub || player.club || 'النادي غير متوفر'}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard title="المنتخب" value={teamName(player.team)} icon={<Shield size={15} />} />
                <InfoCard title="المجموعة" value={player.team?.group} icon={<Trophy size={15} />} />
                <InfoCard title="العمر" value={player.age} icon={<CalendarDays size={15} />} />
                <InfoCard title="النادي" value={rawClub || player.club} icon={<Building2 size={15} />} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricBox title="تقييم عام" value={player.score} accent />
          <MetricBox title="متوسط آخر تقييم" value={avgRating ? Number(avgRating.toFixed(1)) : null} />
          <MetricBox title="أهداف" value={goals} />
          <MetricBox title="أسيست" value={assists} />
          <MetricBox title="دقائق" value={minutes} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">آخر الأداءات المسجلة</h2>
              <p className="mt-1 text-sm text-gray-500">مصدر البيانات: {latest?.provider || 'غير متوفر'} · آخر تحديث {formatDate(player.lastPerformanceSyncAt)}</p>
            </div>
            {rawSource ? <a href={rawSource} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-black text-[#0FF0FC]">فتح المصدر</a> : null}
          </div>

          {performances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-gray-500">لا توجد إحصائيات أداء محفوظة لهذا اللاعب بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 text-right">التاريخ</th>
                    <th className="px-3 py-3 text-right">المنافس</th>
                    <th className="px-3 py-3 text-center">دقائق</th>
                    <th className="px-3 py-3 text-center">أهداف</th>
                    <th className="px-3 py-3 text-center">أسيست</th>
                    <th className="px-3 py-3 text-center">تقييم</th>
                  </tr>
                </thead>
                <tbody>
                  {performances.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-3 text-gray-300">{formatDate(row.matchDate)}</td>
                      <td className="px-3 py-3 font-bold text-white">{row.opponentName || 'غير متوفر'}</td>
                      <td className="px-3 py-3 text-center text-gray-300">{formatCount(row.minutes)}</td>
                      <td className="px-3 py-3 text-center text-gray-300">{formatCount(row.goals)}</td>
                      <td className="px-3 py-3 text-center text-gray-300">{formatCount(row.assists)}</td>
                      <td className="px-3 py-3 text-center font-black text-[#FFD700]">{formatDecimal(row.internalRating || row.apiRating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Target size={18} className="text-[#0FF0FC]" /> ملاحظات جودة البيانات</h2>
          <ul className="space-y-2 text-sm leading-7 text-gray-400">
            <li>• صورة اللاعب تُعرض فقط إذا كانت صالحة وليست صورة وهمية أو Placeholder.</li>
            <li>• النادي قد يأتي من حقل اللاعب أو من آخر Raw Data محفوظة حسب المصدر.</li>
            <li>• إذا لم تظهر أرقام، فهذا يعني أن مصدر الأداء لم يتم ربطه أو مزامنته لهذا اللاعب بعد.</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
