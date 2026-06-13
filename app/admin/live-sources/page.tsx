import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database, Radio, ShieldAlert } from 'lucide-react';
import prisma from '@/lib/prisma';
import { ensureStatsTable } from '@/lib/live-match-stats';
import { getProviderQuotaBlock } from '@/lib/provider-quota-guard';
import ManualSyncForm from './ManualSyncForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'حالة مصادر البث المباشر | الإدارة',
  description: 'مراقبة حالة iSports و football-data.org ومصدر بيانات الأنيميشن الداخلي.',
};

function toIso(value: any) {
  return value instanceof Date ? value.toISOString() : value || null;
}

async function loadStatus() {
  try {
    await ensureStatsTable();
    const isportsGuard = await getProviderQuotaBlock('ISPORTS');
    const latestSnapshots = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ON ("matchId") *
      FROM "MatchStatsSnapshot"
      ORDER BY "matchId", "capturedAt" DESC
      LIMIT 20
    `);
    const latestEvents = await prisma.matchEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        match: {
          select: {
            id: true,
            animationMatchId: true,
            status: true,
            homeScore: true,
            awayScore: true,
            homeTeam: { select: { name: true, code: true } },
            awayTeam: { select: { name: true, code: true } },
          },
        },
      },
    });
    const liveMatches = await prisma.match.findMany({
      where: { OR: [{ status: { in: ['IN_PLAY', 'LIVE', 'HT'] } }, { status: 'FINISHED', matchDate: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) } }] },
      orderBy: { matchDate: 'asc' },
      take: 12,
      select: {
        id: true,
        animationMatchId: true,
        status: true,
        matchDate: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
      },
    });

    return {
      ok: true,
      updatedAt: new Date().toISOString(),
      primaryProvider: isportsGuard ? 'FOOTBALL_DATA' : 'ISPORTS',
      fallbackProvider: 'FOOTBALL_DATA',
      isports: {
        status: isportsGuard ? 'blocked' : 'active',
        blockedUntil: toIso(isportsGuard?.blockedUntil),
        reason: isportsGuard?.reason || null,
      },
      footballData: {
        status: process.env.FOOTBALL_DATA_API_TOKEN ? 'configured' : 'missing_token',
        competition: process.env.FOOTBALL_DATA_COMPETITION || 'WC',
      },
      liveMatches: liveMatches.map((match) => ({
        id: match.id,
        animationMatchId: match.animationMatchId,
        status: match.status,
        matchDate: toIso(match.matchDate),
        score: `${match.homeScore ?? 0}-${match.awayScore ?? 0}`,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
      })),
      latestSnapshots: latestSnapshots.map((row) => ({
        id: row.id,
        matchId: row.matchId,
        provider: row.provider,
        providerMatchId: row.providerMatchId,
        minute: row.minute,
        score: `${row.homeScore ?? 0}-${row.awayScore ?? 0}`,
        hasStats: ['homePossession','awayPossession','homeDangerousAttacks','awayDangerousAttacks','homeShots','awayShots','homeCorners','awayCorners'].some((key) => row[key] !== null && row[key] !== undefined),
        capturedAt: toIso(row.capturedAt),
      })),
      latestEvents: latestEvents.map((event) => ({
        id: event.id,
        type: event.type,
        minute: event.minute,
        detail: event.detail,
        sourceName: event.sourceName,
        createdAt: toIso(event.createdAt),
        match: event.match ? {
          animationMatchId: event.match.animationMatchId,
          status: event.match.status,
          score: `${event.match.homeScore ?? 0}-${event.match.awayScore ?? 0}`,
          homeTeam: event.match.homeTeam,
          awayTeam: event.match.awayTeam,
        } : null,
      })),
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'تعذر تحميل حالة المصادر' };
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString('ar-EG');
}

function StatusBadge({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${active ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]'}`}>{active ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{children}</span>;
}

export default async function LiveSourcesAdminPage() {
  const data = await loadStatus();

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white lg:px-8">
      <section className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.13),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 shadow-card">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-[10px] font-black text-[#0FF0FC]"><Radio size={13} /> Live Sources Monitor</p>
          <h1 className="mt-3 text-2xl font-black md:text-4xl">حالة مصادر البث والأنيميشن</h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">متابعة iSports كمصدر أساسي، و football-data.org كخطة بديلة عند انتهاء الحد اليومي.</p>
        </div>

        <Panel title="مزامنة مباراة يدويًا">
          <ManualSyncForm />
        </Panel>

        {!data?.ok ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-red-200"><AlertTriangle className="mb-2" /> {data?.error || 'تعذر تحميل حالة المصادر'}</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-black">المصدر الأساسي</h2><Database className="text-[#0FF0FC]" /></div>
                <StatusBadge active={data.primaryProvider === 'ISPORTS'}>{data.primaryProvider}</StatusBadge>
                <p className="mt-3 text-xs leading-5 text-gray-400">آخر تحديث: {formatDate(data.updatedAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-black">iSports</h2><ShieldAlert className={data.isports?.status === 'active' ? 'text-emerald-300' : 'text-[#FFD700]'} /></div>
                <StatusBadge active={data.isports?.status === 'active'}>{data.isports?.status === 'active' ? 'متاح' : 'محظور مؤقتًا'}</StatusBadge>
                <p className="mt-3 text-xs leading-5 text-gray-400">ينتهي الحظر: {formatDate(data.isports?.blockedUntil)}</p>
                {data.isports?.reason ? <p className="mt-2 text-xs leading-5 text-[#FFD700]">{data.isports.reason}</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-black">football-data.org</h2><Clock className="text-[#FFD700]" /></div>
                <StatusBadge active={data.footballData?.status === 'configured'}>{data.footballData?.status === 'configured' ? 'مجهز' : 'Token غير موجود'}</StatusBadge>
                <p className="mt-3 text-xs leading-5 text-gray-400">المسابقة: {data.footballData?.competition || 'WC'}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="المباريات الحية/الحديثة">
                {data.liveMatches?.length ? data.liveMatches.map((match: any) => (
                  <div key={match.id} className="rounded-xl border border-white/8 bg-black/25 p-3 text-sm">
                    <div className="font-black text-white">{match.homeTeam?.name || 'Home'} × {match.awayTeam?.name || 'Away'}</div>
                    <div className="mt-1 text-xs text-gray-400">الحالة: {match.status} — النتيجة: {match.score} — iSports ID: {match.animationMatchId || '—'}</div>
                  </div>
                )) : <Empty text="لا توجد مباريات حية أو حديثة." />}
              </Panel>

              <Panel title="آخر لقطات الإحصائيات">
                {data.latestSnapshots?.length ? data.latestSnapshots.map((row: any) => (
                  <div key={row.id} className="rounded-xl border border-white/8 bg-black/25 p-3 text-sm">
                    <div className="font-black text-white">Provider: {row.provider} — Match: {row.providerMatchId}</div>
                    <div className="mt-1 text-xs text-gray-400">الدقيقة: {row.minute || '—'} — النتيجة: {row.score} — إحصائيات: {row.hasStats ? 'نعم' : 'لا'} — {formatDate(row.capturedAt)}</div>
                  </div>
                )) : <Empty text="لا توجد لقطات محفوظة بعد." />}
              </Panel>
            </div>

            <Panel title="آخر الأحداث المهمة">
              {data.latestEvents?.length ? data.latestEvents.map((event: any) => (
                <div key={event.id} className="rounded-xl border border-white/8 bg-black/25 p-3 text-sm">
                  <div className="font-black text-[#FFD700]">{event.type} {event.minute ? `— د${event.minute}` : ''}</div>
                  <div className="mt-1 text-white">{event.detail}</div>
                  <div className="mt-1 text-xs text-gray-500">المصدر: {event.sourceName || '—'} — {formatDate(event.createdAt)}</div>
                </div>
              )) : <Empty text="لا توجد أحداث محفوظة بعد." />}
            </Panel>
          </>
        )}
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><h2 className="mb-3 text-lg font-black text-white">{title}</h2><div className="space-y-2">{children}</div></section>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">{text}</div>;
}
