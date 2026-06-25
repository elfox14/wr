import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { withTeamDisplay } from '@/lib/teamDisplay';
import { formatEgyptDateTime } from '@/lib/match-page/egyptTime';
import WatchAutoRefresh from '@/components/watch/WatchAutoRefresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { params: Promise<{ matchId: string }> };
type WatchTeam = { id: string; name: string; code?: string | null; image?: string | null; originalName?: string | null; flagUrl?: string | null };
type WatchEmbedResult = { url: string } | null;

const LIVE_STATUSES = ['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'HALFTIME', 'HALF_TIME', 'ET', 'BREAK'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED'];

function statusKind(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (FINISHED_STATUSES.includes(raw)) return 'finished';
  if (raw === 'HT' || raw === 'HALFTIME' || raw === 'HALF_TIME' || raw === 'BREAK') return 'halftime';
  if (LIVE_STATUSES.includes(raw)) return 'live';
  return 'scheduled';
}

function statusLabel(status?: string | null) {
  const kind = statusKind(status);
  if (kind === 'live') return 'مباشر الآن';
  if (kind === 'halftime') return 'استراحة';
  if (kind === 'finished') return 'انتهت المباراة';
  return 'البث لم يبدأ بعد';
}

function scoreValue(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function flagUrl(team: any) {
  return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.flagUrl || team?.image }, 160) || team?.image || null;
}

function boolEnv(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function csvEnv(value?: string | null) {
  return String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function parseEmbedMap() {
  const raw = String(process.env.WATCH_EMBED_MAP_JSON || '').trim();
  if (!raw) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {} as Record<string, string>;
  }
}

function replaceTemplate(template: string, match: { id: string; homeTeam: WatchTeam; awayTeam: WatchTeam }) {
  const values: Record<string, string> = {
    matchId: match.id,
    homeId: match.homeTeam.id,
    awayId: match.awayTeam.id,
    homeCode: match.homeTeam.code || '',
    awayCode: match.awayTeam.code || '',
    homeName: match.homeTeam.originalName || match.homeTeam.name || '',
    awayName: match.awayTeam.originalName || match.awayTeam.name || '',
  };
  return template.replace(/\{(matchId|homeId|awayId|homeCode|awayCode|homeName|awayName)\}/g, (_, key) => encodeURIComponent(values[key] || ''));
}

function hostAllowed(hostname: string, allowedHosts: string[]) {
  const host = hostname.toLowerCase();
  return allowedHosts.some((allowed) => {
    const item = allowed.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!item) return false;
    if (item.startsWith('*.')) {
      const root = item.slice(2);
      return host === root || host.endsWith(`.${root}`);
    }
    return host === item;
  });
}

function resolveWatchEmbed(match: { id: string; homeTeam: WatchTeam; awayTeam: WatchTeam }): WatchEmbedResult {
  if (!boolEnv(process.env.WATCH_EMBED_ENABLED)) return null;
  const allowedHosts = csvEnv(process.env.WATCH_EMBED_ALLOWED_HOSTS);
  if (!allowedHosts.length) return null;
  const map = parseEmbedMap();
  const mapped = map[match.id] || map[match.homeTeam.code || ''] || map[`${match.homeTeam.code || ''}-${match.awayTeam.code || ''}`];
  const template = String(mapped || process.env.WATCH_EMBED_URL_TEMPLATE || '').trim();
  if (!template) return null;
  const candidate = replaceTemplate(template, match);
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null;
    if (!hostAllowed(url.hostname, allowedHosts)) return null;
    return { url: url.toString() };
  } catch {
    return null;
  }
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'live' | 'warn' | 'neutral' }) {
  const toneClass = tone === 'live'
    ? 'border-[#18E58F]/30 bg-[#18E58F]/10 text-[#18E58F]'
    : tone === 'warn'
      ? 'border-[#F8C846]/30 bg-[#F8C846]/10 text-[#F8C846]'
      : 'border-white/10 bg-white/[0.05] text-slate-300';
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClass}`}>{children}</span>;
}

async function getWatchData(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, image: true } },
      awayTeam: { select: { id: true, name: true, code: true, image: true } },
      statsSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
      events: { orderBy: [{ minute: 'desc' }, { createdAt: 'desc' }], take: 1 },
    },
  });
  if (!match) return null;
  const latestSnapshot = match.statsSnapshots?.[0] || null;
  const latestEvent = match.events?.[0] || null;
  const homeScore = latestSnapshot?.homeScore ?? match.homeScore;
  const awayScore = latestSnapshot?.awayScore ?? match.awayScore;
  const minute = latestSnapshot?.minute ?? latestEvent?.minute ?? null;
  const kind = statusKind(match.status);
  const homeTeam = withTeamDisplay(match.homeTeam);
  const awayTeam = withTeamDisplay(match.awayTeam);
  return {
    id: match.id,
    title: `${homeTeam.name} ضد ${awayTeam.name}`,
    matchDate: match.matchDate,
    status: match.status,
    kind,
    isLive: kind === 'live' || kind === 'halftime',
    isFinished: kind === 'finished',
    homeTeam,
    awayTeam,
    homeScore: scoreValue(homeScore),
    awayScore: scoreValue(awayScore),
    minute,
    latestEvent,
    latestSnapshotAt: latestSnapshot?.capturedAt || null,
  };
}

function PlayerFrame({ embed, title, matchId }: { embed: WatchEmbedResult; title: string; matchId: string }) {
  if (embed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 rounded-full border border-[#18E58F]/20 bg-[#18E58F]/10 px-4 py-2 text-xs font-black text-[#18E58F]">البث جاهز</div>
        <h2 className="team-name-full text-2xl font-black md:text-4xl">{title}</h2>
        <p className="mt-3 max-w-xl text-sm font-bold leading-7 text-slate-400">افتح البث في نافذة جديدة وسيبقى مركز المباراة هنا للمتابعة.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href={embed.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-[#18E58F] px-5 py-3 text-sm font-black text-black transition hover:bg-white">فتح البث الآن</a>
          <Link href={`/live-animation/${matchId}`} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-5 py-3 text-sm font-black text-[#F8C846] transition hover:bg-[#F8C846] hover:text-black">الملعب التفاعلي</Link>
          <Link href={`/match-center/${matchId}`} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-black">الإحصائيات الحية</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-slate-300">مشغل البث</div>
      <h2 className="team-name-full text-2xl font-black md:text-4xl">{title}</h2>
      <p className="mt-3 max-w-xl text-sm font-bold leading-7 text-slate-400">لم يتم تفعيل رابط البث لهذه المباراة بعد. عند تفعيله سيظهر زر المشاهدة هنا تلقائيًا.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href={`/live-animation/${matchId}`} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-5 py-3 text-sm font-black text-[#F8C846] transition hover:bg-[#F8C846] hover:text-black">الملعب التفاعلي</Link>
        <Link href={`/match-center/${matchId}`} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-[#18E58F]">افتح الإحصائيات الحية</Link>
      </div>
    </div>
  );
}

export default async function WatchPage({ params }: PageProps) {
  const { matchId } = await params;
  const data = await getWatchData(matchId);
  if (!data) notFound();
  const homeFlag = flagUrl(data.homeTeam);
  const awayFlag = flagUrl(data.awayTeam);
  const embed = resolveWatchEmbed(data);

  return (
    <main className="min-h-screen bg-[#020806] text-white" dir="rtl">
      <WatchAutoRefresh enabled={!data.isFinished} intervalMs={30000} />
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 md:px-6">
        <header className="flex flex-col gap-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Pill tone={data.isLive ? 'live' : data.isFinished ? 'neutral' : 'warn'}>{statusLabel(data.status)}</Pill>
              {data.minute !== null ? <Pill>الدقيقة {data.minute}</Pill> : null}
              {data.latestSnapshotAt ? <Pill>آخر تحديث: {formatEgyptDateTime(data.latestSnapshotAt)}</Pill> : null}
              {embed ? <Pill tone="live">البث جاهز</Pill> : null}
            </div>
            <h1 className="text-2xl font-black md:text-3xl">غرفة مشاهدة المباراة</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">صفحة بث خفيفة تتحدث تلقائيًا قبل وأثناء المباراة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/live-animation/${data.id}`} className="rounded-2xl border border-[#F8C846]/30 bg-[#F8C846]/10 px-4 py-2 text-sm font-black text-[#F8C846] transition hover:bg-[#F8C846] hover:text-black">الملعب التفاعلي</Link>
            <Link href={`/match-center/${data.id}`} className="rounded-2xl border border-[#18E58F]/30 bg-[#18E58F]/10 px-4 py-2 text-sm font-black text-[#18E58F] transition hover:bg-[#18E58F] hover:text-black">مركز المباراة والتحليل</Link>
            <Link href={`/match-center/${data.id}/advanced`} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-slate-200 transition hover:bg-white hover:text-black">xG وخريطة التسديدات</Link>
          </div>
        </header>
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/50"><div className="relative aspect-video w-full bg-[radial-gradient(circle_at_center,rgba(24,229,143,0.16),transparent_35%),linear-gradient(135deg,#06140F,#020806)]"><PlayerFrame embed={embed} title={data.title} matchId={data.id} /></div></div>
          <aside id="watch-status" className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-xl font-black">لوحة الحالة السريعة</h2>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-4"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div>{homeFlag ? <img src={homeFlag} alt={`علم ${data.homeTeam.name}`} className="mx-auto mb-2 h-10 w-14 rounded-lg border border-white/10 object-cover" /> : null}<p className="team-name-full text-sm font-black">{data.homeTeam.name}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-3xl font-black">{data.homeScore} - {data.awayScore}</div><div>{awayFlag ? <img src={awayFlag} alt={`علم ${data.awayTeam.name}`} className="mx-auto mb-2 h-10 w-14 rounded-lg border border-white/10 object-cover" /> : null}<p className="team-name-full text-sm font-black">{data.awayTeam.name}</p></div></div></div>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black text-slate-500">حالة المباراة</p><b className="mt-2 block text-lg text-white">{statusLabel(data.status)}</b><p className="mt-2 text-xs font-bold text-slate-400">{data.isFinished ? 'انتهت المباراة.' : 'سيتم تحديث هذه الصفحة تلقائيًا كل 30 ثانية.'}</p></div>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black text-slate-500">حالة المشغل</p><b className="mt-2 block text-sm text-white">{embed ? 'جاهز للمشاهدة' : 'لم يتم تفعيله بعد'}</b><p className="mt-2 text-xs font-bold leading-6 text-slate-400">إذا لم يظهر البث داخل الصفحة، استخدم زر فتح البث في نافذة خارجية عند ظهوره.</p></div>
            {data.latestEvent ? <div className="rounded-3xl border border-[#18E58F]/20 bg-[#18E58F]/10 p-4"><p className="text-xs font-black text-[#18E58F]">آخر حدث محفوظ</p><b className="mt-2 block text-sm leading-6 text-white">{data.latestEvent.detail}</b>{data.latestEvent.minute !== null ? <p className="mt-1 text-xs font-bold text-slate-300">الدقيقة {data.latestEvent.minute}</p> : null}</div> : null}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black text-slate-500">موعد المباراة</p><b className="mt-2 block text-sm text-white">{formatEgyptDateTime(data.matchDate)}</b></div>
          </aside>
        </section>
      </section>
    </main>
  );
}
