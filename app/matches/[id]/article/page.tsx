import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const revalidate = 300;

const nf = new Intl.NumberFormat('ar-EG');
const pct = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

type TeamLite = { id: string; name: string; code: string | null; image: string | null };
type StatPair = { key: string; label: string; home: number | null; away: number | null; suffix?: string };
type PlayerArticleStat = {
  id: string;
  name: string;
  teamName: string;
  teamCode?: string | null;
  image?: string | null;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
};

type SnapshotLike = {
  homePossession?: number | null;
  awayPossession?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeShotsOnTarget?: number | null;
  awayShotsOnTarget?: number | null;
  homeShotsOffTarget?: number | null;
  awayShotsOffTarget?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeYellowCards?: number | null;
  awayYellowCards?: number | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  homeAttacks?: number | null;
  awayAttacks?: number | null;
  homeDangerousAttacks?: number | null;
  awayDangerousAttacks?: number | null;
  capturedAt?: Date | string | null;
  providerMatchId?: number | null;
  rawData?: unknown;
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value?: number | null, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? `${nf.format(value)}${suffix}` : 'غير متوفر';
}

function teamName(team: { name?: string | null; code?: string | null }) {
  return getArabicTeamName(team.code || null, team.name || '');
}

function flagUrl(team: TeamLite, width = 160) {
  return getTeamFlagUrl({ code: team.code, name: teamName(team), image: null }, width) || team.image || null;
}

function statusLabel(status?: string | null) {
  const raw = String(status || '').toUpperCase();
  if (FINISHED.includes(raw)) return 'انتهت';
  if (['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET'].includes(raw)) return 'مباشرة';
  return 'مجدولة';
}

function stageLabel(match: { stage?: string | null; groupPhase?: string | null }) {
  const raw = String(match.stage || match.groupPhase || '').toLowerCase();
  if (raw.includes('32')) return 'دور الـ٣٢';
  if (raw.includes('16')) return 'دور الـ١٦';
  if (raw.includes('quarter')) return 'ربع النهائي';
  if (raw.includes('semi')) return 'نصف النهائي';
  if (raw.includes('final')) return 'النهائي';
  if (match.groupPhase) return match.groupPhase.replace('GROUP_', 'المجموعة ');
  return 'دور المجموعات';
}

function matchTitle(match: { homeTeam: TeamLite; awayTeam: TeamLite; homeScore: number; awayScore: number }) {
  return `تحليل مباراة ${teamName(match.homeTeam)} و${teamName(match.awayTeam)}: ${fmt(match.homeScore)}-${fmt(match.awayScore)}`;
}

function winner(match: { homeTeam: TeamLite; awayTeam: TeamLite; homeScore: number; awayScore: number }) {
  if (match.homeScore > match.awayScore) return { team: match.homeTeam, side: 'home' as const, goalsFor: match.homeScore, goalsAgainst: match.awayScore };
  if (match.awayScore > match.homeScore) return { team: match.awayTeam, side: 'away' as const, goalsFor: match.awayScore, goalsAgainst: match.homeScore };
  return null;
}

function statPairs(snapshot: SnapshotLike | null): StatPair[] {
  if (!snapshot) return [];
  return [
    { key: 'possession', label: 'الاستحواذ', home: snapshot.homePossession ?? null, away: snapshot.awayPossession ?? null, suffix: '%' },
    { key: 'shots', label: 'التسديدات', home: snapshot.homeShots ?? null, away: snapshot.awayShots ?? null },
    { key: 'shotsOnTarget', label: 'على المرمى', home: snapshot.homeShotsOnTarget ?? null, away: snapshot.awayShotsOnTarget ?? null },
    { key: 'corners', label: 'الركنيات', home: snapshot.homeCorners ?? null, away: snapshot.awayCorners ?? null },
    { key: 'attacks', label: 'الهجمات', home: snapshot.homeAttacks ?? null, away: snapshot.awayAttacks ?? null },
    { key: 'dangerous', label: 'الهجمات الخطيرة', home: snapshot.homeDangerousAttacks ?? null, away: snapshot.awayDangerousAttacks ?? null },
    { key: 'yellow', label: 'البطاقات الصفراء', home: snapshot.homeYellowCards ?? null, away: snapshot.awayYellowCards ?? null },
    { key: 'red', label: 'البطاقات الحمراء', home: snapshot.homeRedCards ?? null, away: snapshot.awayRedCards ?? null },
  ].filter((item) => item.home !== null || item.away !== null);
}

function betterMetric(pairs: StatPair[], key: string, homeTeam: TeamLite, awayTeam: TeamLite) {
  const metric = pairs.find((item) => item.key === key);
  if (!metric || metric.home === null || metric.away === null || metric.home === metric.away) return null;
  const betterSide = metric.home > metric.away ? homeTeam : awayTeam;
  return `${teamName(betterSide)} تفوق في ${metric.label} بفارق ${fmt(Math.abs(metric.home - metric.away), metric.suffix || '')}.`;
}

function strongestStatLine(pairs: StatPair[], homeTeam: TeamLite, awayTeam: TeamLite) {
  const candidates = ['shotsOnTarget', 'shots', 'dangerous', 'possession'].map((key) => betterMetric(pairs, key, homeTeam, awayTeam)).filter(Boolean) as string[];
  return candidates[0] || 'الأرقام المتاحة لا تمنح أفضلية حاسمة في مؤشر واحد، لذلك يبقى السياق العام للأحداث مهمًا في قراءة المباراة.';
}

function readRawPlayerStats(snapshot: SnapshotLike | null): PlayerArticleStat[] {
  const raw = snapshot?.rawData as any;
  const rows = raw?.normalized?.playerStats || raw?.normalizedPreview?.playerStats || raw?.debug?.normalizedPreview?.playerStats || [];
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 40).map((row: any, index: number) => ({
    id: String(row.playerId || row.id || row.playerName || row.name || `raw-${index}`),
    name: String(row.playerName || row.name || 'لاعب'),
    teamName: String(row.teamName || row.team || 'غير متوفر'),
    teamCode: row.teamCode || null,
    image: row.image || null,
    minutes: num(row.minutes),
    goals: num(row.goals),
    assists: num(row.assists),
    shots: num(row.shots || row.shotsTotal),
    shotsOnTarget: num(row.shotsOnTarget),
    keyPasses: num(row.keyPasses || row.keypasses),
    tackles: num(row.tackles),
    interceptions: num(row.interceptions),
    saves: num(row.saves),
    yellowCards: num(row.yellowCards),
    redCards: num(row.redCards),
    rating: Number.isFinite(Number(row.rating || row.apiRating)) ? Number(row.rating || row.apiRating) : null,
  }));
}

function rankPlayers(players: PlayerArticleStat[]) {
  return [...players]
    .map((player) => ({
      ...player,
      score: (player.rating || 0) * 10 + player.goals * 12 + player.assists * 8 + player.shotsOnTarget * 3 + player.keyPasses * 2 + player.saves * 2 + player.tackles + player.interceptions,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function playerImpactText(player?: PlayerArticleStat | null) {
  if (!player) return 'غير متوفر في البيانات الحالية.';
  const parts = [];
  if (player.goals) parts.push(`${fmt(player.goals)} هدف`);
  if (player.assists) parts.push(`${fmt(player.assists)} أسيست`);
  if (player.shotsOnTarget) parts.push(`${fmt(player.shotsOnTarget)} تسديدة على المرمى`);
  if (player.keyPasses) parts.push(`${fmt(player.keyPasses)} تمريرة مفتاحية`);
  if (player.saves) parts.push(`${fmt(player.saves)} تصديات`);
  if (player.tackles || player.interceptions) parts.push(`${fmt(player.tackles + player.interceptions)} تدخل/اعتراض`);
  return parts.length ? parts.join(' · ') : 'أثره ظهر في دقائق المشاركة والتنظيم العام، مع نقص في الأرقام التفصيلية المتاحة.';
}

function eventTone(type?: string | null) {
  const raw = String(type || '').toLowerCase();
  if (raw.includes('goal')) return 'هدف';
  if (raw.includes('card')) return 'بطاقة';
  if (raw.includes('sub')) return 'تبديل';
  if (raw.includes('var')) return 'VAR';
  if (raw.includes('pen')) return 'ركلة جزاء';
  return 'حدث';
}

function analysisParagraphs(match: any, pairs: StatPair[], topPlayer?: PlayerArticleStat | null) {
  const home = teamName(match.homeTeam);
  const away = teamName(match.awayTeam);
  const win = winner(match);
  const score = `${fmt(match.homeScore)}-${fmt(match.awayScore)}`;
  const statLine = strongestStatLine(pairs, match.homeTeam, match.awayTeam);
  const opening = win
    ? `حسم ${teamName(win.team)} المباراة أمام ${win.side === 'home' ? away : home} بنتيجة ${score}، في مواجهة احتاجت إلى قراءة دقيقة للأحداث والأرقام معًا، وليس الاكتفاء بالنتيجة النهائية.`
    : `خرجت مباراة ${home} و${away} بنتيجة ${score}، وهي نتيجة تجعل قراءة التفاصيل الرقمية والأحداث أكثر أهمية لفهم من امتلك الأفضلية الفعلية.`;

  const control = pairs.length
    ? `${statLine} هذا المؤشر يساعد في تفسير شكل المباراة، لكنه لا يكفي وحده للحكم الكامل دون ربطه بالأهداف، توقيت الأحداث، وجودة قرارات اللاعبين.`
    : 'الإحصائيات التفصيلية غير مكتملة في البيانات الحالية، لذلك يعتمد التحليل هنا على النتيجة والأحداث المسجلة فقط.';

  const player = topPlayer
    ? `على مستوى الأفراد، برز ${topPlayer.name} من ${topPlayer.teamName} باعتباره أحد أكثر اللاعبين تأثيرًا في البيانات المتاحة: ${playerImpactText(topPlayer)}.`
    : 'على مستوى الأفراد، لا توجد بيانات أداء كافية لتحديد لاعب المباراة بصورة رقمية مؤكدة، لذلك لا يتم اختراع اسم أو تقييم غير موجود.';

  return [opening, control, player];
}

async function loadArticle(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, code: true, image: true } },
      awayTeam: { select: { id: true, name: true, code: true, image: true } },
    },
  });
  if (!match) return null;

  const latestSnapshot = await prisma.matchStatsSnapshot.findFirst({ where: { matchId: match.id }, orderBy: { capturedAt: 'desc' } });
  const providerIds = [match.animationMatchId, latestSnapshot?.providerMatchId].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const [events, playerPerformances] = await Promise.all([
    prisma.matchEvent.findMany({
      where: { matchId: match.id },
      orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
      take: 60,
    }),
    providerIds.length
      ? prisma.playerPerformance.findMany({
          where: { providerFixtureId: { in: providerIds } },
          select: {
            minutes: true,
            goals: true,
            assists: true,
            shotsTotal: true,
            shotsOnTarget: true,
            keyPasses: true,
            tackles: true,
            interceptions: true,
            saves: true,
            yellowCards: true,
            redCards: true,
            apiRating: true,
            internalRating: true,
            teamName: true,
            asset: { select: { id: true, name: true, code: true, image: true, team: { select: { name: true, code: true } } } },
          },
          orderBy: [{ apiRating: 'desc' }, { internalRating: 'desc' }],
          take: 80,
        })
      : [],
  ]);

  const performancePlayers: PlayerArticleStat[] = playerPerformances.map((row) => ({
    id: row.asset.id,
    name: row.asset.name,
    teamName: row.teamName || (row.asset.team ? teamName(row.asset.team) : 'غير متوفر'),
    teamCode: row.asset.team?.code || null,
    image: row.asset.image,
    minutes: num(row.minutes),
    goals: num(row.goals),
    assists: num(row.assists),
    shots: num(row.shotsTotal),
    shotsOnTarget: num(row.shotsOnTarget),
    keyPasses: num(row.keyPasses),
    tackles: num(row.tackles),
    interceptions: num(row.interceptions),
    saves: num(row.saves),
    yellowCards: num(row.yellowCards),
    redCards: num(row.redCards),
    rating: Number.isFinite(Number(row.apiRating ?? row.internalRating)) ? Number(row.apiRating ?? row.internalRating) : null,
  }));

  const rawPlayers = readRawPlayerStats(latestSnapshot as SnapshotLike | null);
  const players = performancePlayers.length ? performancePlayers : rawPlayers;
  const rankedPlayers = rankPlayers(players);
  const pairs = statPairs(latestSnapshot as SnapshotLike | null);

  return { match, events, latestSnapshot: latestSnapshot as SnapshotLike | null, players, rankedPlayers, pairs };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadArticle(id);
  if (!data) return { title: 'مقال المباراة غير متوفر' };
  const title = matchTitle(data.match);
  return {
    title: `${title} | تحليل وإحصائيات`,
    description: `مقال تحليلي لمباراة ${teamName(data.match.homeTeam)} و${teamName(data.match.awayTeam)} مع الأحداث والإحصائيات وأداء اللاعبين المتاح من قاعدة البيانات.`,
  };
}

function TeamHero({ team }: { team: TeamLite }) {
  const flag = flagUrl(team);
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <span className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/35 sm:h-24 sm:w-32">
        {flag ? <img src={flag} alt={`علم ${teamName(team)}`} className="h-full w-full object-cover" /> : <b className="text-[#FFD700]">{team.code || '---'}</b>}
      </span>
      <b className="team-name-full text-center text-sm font-black text-white sm:text-2xl">{teamName(team)}</b>
    </div>
  );
}

function MetricCard({ pair, homeTeam, awayTeam }: { pair: StatPair; homeTeam: TeamLite; awayTeam: TeamLite }) {
  const home = pair.home ?? 0;
  const away = pair.away ?? 0;
  const total = Math.max(1, home + away);
  const homeWidth = Math.max(8, Math.min(92, (home / total) * 100));
  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 grid grid-cols-[64px_1fr_64px] items-center gap-3 text-center">
        <b className="text-base font-black text-[#FFD700]">{fmt(pair.home, pair.suffix || '')}</b>
        <span className="text-xs font-black text-white">{pair.label}</span>
        <b className="text-base font-black text-[#18E58F]">{fmt(pair.away, pair.suffix || '')}</b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10" dir="ltr"><span className="block h-full rounded-full bg-[#FFD700]" style={{ width: `${homeWidth}%` }} /></div>
      <div className="mt-2 grid grid-cols-2 text-[10px] font-bold text-gray-500"><span>{teamName(homeTeam)}</span><span className="text-left">{teamName(awayTeam)}</span></div>
    </article>
  );
}

function PlayerCard({ player, index }: { player: PlayerArticleStat; index: number }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{nf.format(index + 1)}. {player.name}</p>
          <p className="mt-1 text-[11px] font-bold text-gray-500">{player.teamName}</p>
        </div>
        <b className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-1 text-xs font-black text-[#FFD700]">{player.rating ? pct.format(player.rating) : '—'}</b>
      </div>
      <p className="text-xs font-bold leading-6 text-gray-300">{playerImpactText(player)}</p>
    </article>
  );
}

export default async function MatchArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadArticle(id);
  if (!data) notFound();

  const { match, events, rankedPlayers, pairs, latestSnapshot } = data;
  const home = teamName(match.homeTeam);
  const away = teamName(match.awayTeam);
  const win = winner(match);
  const topPlayer = rankedPlayers[0] || null;
  const paragraphs = analysisParagraphs(match, pairs, topPlayer);
  const finished = FINISHED.includes(String(match.status || '').toUpperCase());
  const title = matchTitle(match);

  return (
    <main dir="rtl" className="min-h-screen bg-[#04110D] px-3 py-5 text-white sm:px-5 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.24))] p-4 text-center shadow-[0_24px_70px_rgba(0,0,0,.35)] sm:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-black">
            <span className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[#FFD700]">تحليل صفحة المباراة</span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-gray-300">{stageLabel(match)}</span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-gray-300">{statusLabel(match.status)}</span>
          </div>
          <h1 className="mx-auto max-w-4xl text-2xl font-black leading-tight text-white sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm font-bold leading-7 text-gray-400">مقال تحليلي مبني على البيانات المحفوظة للمباراة: الأحداث، الإحصائيات، وأداء اللاعبين المتاح. لا يتم اختراع أي رقم غير موجود.</p>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <TeamHero team={match.homeTeam} />
            <div className="rounded-3xl border border-white/10 bg-black/40 px-4 py-3 shadow-inner">
              <div className="flex items-center gap-3" dir="ltr"><b className="text-4xl font-black text-[#FFD700] sm:text-6xl">{fmt(match.homeScore)}</b><span className="text-3xl font-black text-white/60">-</span><b className="text-4xl font-black text-white sm:text-6xl">{fmt(match.awayScore)}</b></div>
              <p className="mt-2 text-[11px] font-bold text-gray-500">{new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(match.matchDate)}</p>
            </div>
            <TeamHero team={match.awayTeam} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/matches/${match.id}`} className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-2 text-xs font-black text-[#FFD700]">صفحة المباراة</Link>
            <Link href={`/live-animation/${match.id}`} className="rounded-2xl bg-[#18E58F] px-4 py-2 text-xs font-black text-black">الملعب التفاعلي</Link>
            <Link href="/statistics" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white">إحصائيات البطولة</Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="space-y-5">
            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
              <h2 className="text-xl font-black text-[#FFD700]">ملخص المحلل</h2>
              <div className="mt-4 space-y-4 text-sm font-bold leading-8 text-gray-200">
                {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">قصة المباراة</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><b className="text-[#FFD700]">البداية</b><p className="mt-2 text-sm font-bold leading-7 text-gray-300">دخل {home} و{away} المباراة في سياق {stageLabel(match)}، وكانت النتيجة النهائية {fmt(match.homeScore)}-{fmt(match.awayScore)} هي الإطار الأساسي لقراءة الأداء.</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><b className="text-[#18E58F]">نقطة التحول</b><p className="mt-2 text-sm font-bold leading-7 text-gray-300">{events.length ? `أبرز الأحداث المسجلة بدأت من الدقيقة ${fmt(events[0].minute)}، ومع تسلسل الأحداث ظهر تأثير التفاصيل الصغيرة على شكل المباراة.` : 'الأحداث التفصيلية غير متوفرة في قاعدة البيانات الحالية، لذلك لا يتم تحديد نقطة تحول غير مؤكدة.'}</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><b className="text-[#0FF0FC]">الخلاصة</b><p className="mt-2 text-sm font-bold leading-7 text-gray-300">{win ? `${teamName(win.team)} خرج بالأهم: النتيجة. أما تقييم جودة الأداء فيعتمد على مقارنة الأرقام المتاحة وسياق الأحداث.` : 'التعادل يجعل تحليل السيطرة والفرص أكثر أهمية من النتيجة وحدها.'}</p></div>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">أحداث المباراة دقيقة بدقيقة</h2>
              <div className="mt-4 space-y-3">
                {events.length ? events.map((event) => <article key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><b className="rounded-full bg-[#FFD700]/15 px-2 py-1 text-xs text-[#FFD700]">{event.minute !== null && event.minute !== undefined ? `${fmt(event.minute)}′` : '—'}</b><span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-black text-white">{eventTone(event.type)}</span>{event.playerName ? <span className="text-sm font-black text-white">{event.playerName}</span> : null}</div><p className="text-sm font-bold leading-7 text-gray-300">{event.detail}</p></article>) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-gray-500">غير متوفر في البيانات الحالية.</div>}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">مقارنة المنتخبين بالأرقام</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {pairs.length ? pairs.map((pair) => <MetricCard key={pair.key} pair={pair} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-gray-500 md:col-span-2">الإحصائيات التفصيلية غير متوفرة في آخر Snapshot.</div>}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">أداء اللاعبين</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-gray-400">يعرض هذا القسم أفضل اللاعبين حسب الأرقام المتاحة فقط: التقييم إن وجد، الأهداف، التمريرات الحاسمة، التسديدات على المرمى، التمريرات المفتاحية، والتأثير الدفاعي.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {rankedPlayers.length ? rankedPlayers.map((player, index) => <PlayerCard key={`${player.id}-${index}`} player={player} index={index} />) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-gray-500 md:col-span-2">غير متوفر في البيانات الحالية.</div>}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">ماذا تعني هذه النتيجة؟</h2>
              <p className="mt-4 text-sm font-bold leading-8 text-gray-300">{finished ? (win ? `النتيجة تمنح ${teamName(win.team)} أفضلية واضحة في سياق ${stageLabel(match)}، لكنها تحتاج إلى قراءة ترتيب المجموعة أو مسار البطولة لتحديد الأثر الكامل.` : `التعادل يبقي الحسابات مفتوحة، ويجعل تفاصيل فارق الأهداف وترتيب المجموعة أكثر أهمية في الجولة التالية.`) : 'المباراة لم تُحسم نهائيًا بعد في البيانات الحالية، لذلك لا يتم تقديم أثر نهائي على المجموعة أو المسار.'}</p>
            </section>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4">
              <h2 className="text-lg font-black text-white">Quick Insights</h2>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">رجل المباراة رقميًا</span><b className="mt-1 block text-sm font-black text-[#FFD700]">{topPlayer?.name || 'غير متوفر'}</b><p className="mt-1 text-xs font-bold text-gray-400">{topPlayer ? playerImpactText(topPlayer) : 'لا توجد بيانات لاعبين كافية.'}</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">أفضل مؤشر جماعي</span><b className="mt-1 block text-sm font-black text-[#18E58F]">{pairs.length ? strongestStatLine(pairs, match.homeTeam, match.awayTeam) : 'غير متوفر'}</b></div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">آخر تحديث بيانات</span><b className="mt-1 block text-sm font-black text-white">{latestSnapshot?.capturedAt ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(latestSnapshot.capturedAt)) : 'غير متوفر'}</b></div>
              </div>
            </section>
            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4">
              <h2 className="text-lg font-black text-white">روابط مرتبطة</h2>
              <div className="mt-4 grid gap-2 text-sm font-black">
                <Link href={`/matches/${match.id}`} className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-[#FFD700]">صفحة المباراة</Link>
                <Link href={`/live-animation/${match.id}`} className="rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-4 py-3 text-[#18E58F]">الملعب التفاعلي</Link>
                <Link href="/statistics" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white">إحصائيات البطولة</Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
