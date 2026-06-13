import Link from 'next/link';
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, Database, FileText, Goal, ListChecks, Scale, Shield, ShieldAlert, Sparkles, Target, Users, XCircle, Zap } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type TeamOverviewPlayer = {
  id: string;
  name: string;
  image?: string | null;
  position?: string | null;
  age?: number | null;
  score?: number | null;
};

type TeamOverviewOpponent = {
  id: string;
  name: string;
  image?: string | null;
};

type TeamOverviewMatch = {
  id: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: TeamOverviewOpponent | null;
  awayTeam?: TeamOverviewOpponent | null;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  stage?: string | null;
  matchDate: Date | string;
};

type TeamOverviewReport = {
  id: string;
  title: string;
  summary: string;
  body?: string | null;
  sourceName: string;
  sourceUrl?: string | null;
  provider?: string | null;
  confidence?: string | null;
  publishedAt?: Date | string | null;
  tacticalTags?: string[] | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
};

type TeamOverviewNewsItem = {
  id?: string | null;
  title?: string | null;
  titleAr?: string | null;
  summary?: string | null;
  bodyAr?: string | null;
  publishedAt?: Date | string | null;
};

type TeamOverviewTeam = {
  id: string;
  type: string;
  name: string;
  code?: string | null;
  image?: string | null;
  fifaRank?: number | null;
  group?: string | null;
  continent?: string | null;
  players?: TeamOverviewPlayer[] | null;
  intelligenceReports?: TeamOverviewReport[] | null;
  homeMatches?: TeamOverviewMatch[] | null;
  awayMatches?: TeamOverviewMatch[] | null;
  marketNews?: TeamOverviewNewsItem[] | null;
};

type ReportSection = {
  title: string;
  content: string;
};

type PerformanceStats = {
  sampleSize: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
};

type RatingRow = {
  label: string;
  rating: string;
  reason: string;
  source: string;
};

type CardTone = 'summary' | 'identity' | 'performance' | 'attack' | 'defense' | 'midfield' | 'setPieces' | 'players' | 'tactics' | 'strengths' | 'weaknesses' | 'rating' | 'missing' | 'sources';

const AUTO_BASELINE_PROVIDERS = new Set(['MC_PRIME_AUTO']);
const AUTO_BASELINE_SOURCE_NAMES = new Set(['MC PRIME Auto Intelligence Baseline']);
const UNAVAILABLE = 'غير متوفر في المصادر';

const cardToneClass: Record<CardTone, string> = {
  summary: 'border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_34%),linear-gradient(135deg,rgba(15,240,252,0.08),rgba(255,255,255,0.025))]',
  identity: 'border-violet-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.20),transparent_36%),linear-gradient(135deg,rgba(168,85,247,0.08),rgba(255,255,255,0.025))]',
  performance: 'border-sky-300/20 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.20),transparent_36%),linear-gradient(135deg,rgba(56,189,248,0.08),rgba(255,255,255,0.025))]',
  attack: 'border-red-300/20 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.20),transparent_36%),linear-gradient(135deg,rgba(248,113,113,0.08),rgba(255,255,255,0.025))]',
  defense: 'border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.20),transparent_36%),linear-gradient(135deg,rgba(52,211,153,0.08),rgba(255,255,255,0.025))]',
  midfield: 'border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.20),transparent_36%),linear-gradient(135deg,rgba(251,191,36,0.08),rgba(255,255,255,0.025))]',
  setPieces: 'border-blue-300/20 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.20),transparent_36%),linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.025))]',
  players: 'border-fuchsia-300/20 bg-[radial-gradient(circle_at_top_right,rgba(232,121,249,0.20),transparent_36%),linear-gradient(135deg,rgba(232,121,249,0.08),rgba(255,255,255,0.025))]',
  tactics: 'border-indigo-300/20 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.22),transparent_36%),linear-gradient(135deg,rgba(129,140,248,0.08),rgba(255,255,255,0.025))]',
  strengths: 'border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.20),transparent_36%),linear-gradient(135deg,rgba(52,211,153,0.08),rgba(255,255,255,0.025))]',
  weaknesses: 'border-orange-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.20),transparent_36%),linear-gradient(135deg,rgba(251,146,60,0.08),rgba(255,255,255,0.025))]',
  rating: 'border-lime-300/20 bg-[radial-gradient(circle_at_top_right,rgba(190,242,100,0.18),transparent_36%),linear-gradient(135deg,rgba(190,242,100,0.07),rgba(255,255,255,0.025))]',
  missing: 'border-yellow-300/20 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.20),transparent_36%),linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.025))]',
  sources: 'border-slate-300/15 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_36%),linear-gradient(135deg,rgba(148,163,184,0.08),rgba(255,255,255,0.025))]',
};

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatNumber(value?: number | null, fallback = UNAVAILABLE) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value.toLocaleString('ar-EG');
}

function formatDecimal(value?: number | null, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return UNAVAILABLE;
  return value.toLocaleString('ar-EG', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function getConfidenceLabel(value?: string | null) {
  if (value === 'A') return 'ثقة عالية';
  if (value === 'B') return 'ثقة جيدة';
  if (value === 'C') return 'ثقة متوسطة';
  return 'ثقة محدودة';
}

function parseReportBody(body?: string | null): ReportSection[] {
  if (!body) return [];

  return body
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const headingMatch = block.match(/^#{1,4}\s*(.+?)\n([\s\S]+)$/);
      if (headingMatch) return { title: headingMatch[1].trim(), content: headingMatch[2].trim() };

      const colonIndex = block.indexOf(':');
      const possibleTitle = colonIndex > 0 ? block.slice(0, colonIndex).replace(/^[-*#\s]+/, '').trim() : '';
      const hasReadableTitle = possibleTitle.length >= 3 && possibleTitle.length <= 80 && !/[.!؟]$/.test(possibleTitle);
      return {
        title: hasReadableTitle ? possibleTitle : `ملاحظة تحليلية ${index + 1}`,
        content: hasReadableTitle ? block.slice(colonIndex + 1).trim() : block,
      };
    });
}

function getAllSections(reports: TeamOverviewReport[]) {
  return reports.flatMap((report) => parseReportBody(report.body).map((section) => ({ ...section, report })));
}

function findSectionText(sections: Array<ReportSection & { report: TeamOverviewReport }>, keywords: string[], fallback = UNAVAILABLE) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const match = sections.find((section) => {
    const haystack = `${section.title} ${section.content}`.toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });

  return match?.content || fallback;
}

function joinReportList(items?: string[] | null) {
  const values = (items || []).map((item) => item.trim()).filter(Boolean);
  return values.length ? values.join(' — ') : UNAVAILABLE;
}

function HighlightedReportText({ text }: { text: string }) {
  const marker = UNAVAILABLE;
  const parts = text.split(marker);

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && (
            <span className="mx-1 inline-flex rounded-lg border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-[11px] font-black text-yellow-200">
              {marker}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

function ThemedAnalysisCard({ tone, icon, eyebrow, title, children, className = '' }: { tone: CardTone; icon: React.ReactNode; eyebrow: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] ${cardToneClass[tone]} ${className}`}>
      <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-black text-white/80">
            {icon}
            {eyebrow}
          </div>
        </div>
        <h4 className="mb-3 text-lg font-black text-white">{title}</h4>
        <div className="text-sm leading-7 text-gray-200">{children}</div>
      </div>
    </article>
  );
}

function MatchCard({ match, teamId }: { match: TeamOverviewMatch; teamId: string }) {
  const isHome = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const isFinished = match.status === 'FINISHED';
  const isLive = ['IN_PLAY', 'LIVE'].includes(match.status);
  const gf = isHome ? match.homeScore : match.awayScore;
  const ga = isHome ? match.awayScore : match.homeScore;

  return (
    <Link href="/matches" className="block rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-primary/30 hover:bg-white/[0.07]">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-gray-500">{formatDate(match.matchDate)}</span>
        <span className={`rounded-lg px-2 py-1 font-black ${isLive ? 'bg-primary/10 text-primary' : isFinished ? 'bg-success/10 text-success' : 'bg-white/5 text-gray-400'}`}>{isLive ? 'مباشرة' : isFinished ? 'انتهت' : 'قادمة'}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AssetImage image={opponent?.image || ''} type="TEAM" name={opponent?.name || 'Opponent'} width={38} height={38} className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <div className="font-black text-white">ضد {opponent?.name || '-'}</div>
            <div className="text-xs text-gray-500">{match.stage === 'group' ? 'دور المجموعات' : 'مرحلة إقصائية / مؤثرة'}</div>
          </div>
        </div>
        {(isFinished || isLive) ? <div className="text-xl font-black text-primary tabular-nums">{gf} - {ga}</div> : <div className="text-xs font-black text-gray-500">VS</div>}
      </div>
    </Link>
  );
}

function getAllMatches(team: TeamOverviewTeam) {
  return [...(team.homeMatches || []), ...(team.awayMatches || [])];
}

function hasUsableScore(match: TeamOverviewMatch) {
  return typeof match.homeScore === 'number' && typeof match.awayScore === 'number';
}

function getTeamScore(match: TeamOverviewMatch, teamId: string) {
  const isHome = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
  return {
    goalsFor: isHome ? Number(match.homeScore) : Number(match.awayScore),
    goalsAgainst: isHome ? Number(match.awayScore) : Number(match.homeScore),
  };
}

function buildPerformanceStats(team: TeamOverviewTeam): PerformanceStats | null {
  const finished = getAllMatches(team)
    .filter((match) => match.status === 'FINISHED' && hasUsableScore(match))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 5);

  if (!finished.length) return null;

  const totals = finished.reduce(
    (acc, match) => {
      const score = getTeamScore(match, team.id);
      acc.goalsFor += score.goalsFor;
      acc.goalsAgainst += score.goalsAgainst;
      if (score.goalsFor > score.goalsAgainst) acc.wins += 1;
      else if (score.goalsFor === score.goalsAgainst) acc.draws += 1;
      else acc.losses += 1;
      if (score.goalsAgainst === 0) acc.cleanSheets += 1;
      return acc;
    },
    { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 },
  );

  return {
    sampleSize: finished.length,
    ...totals,
    avgGoalsFor: totals.goalsFor / finished.length,
    avgGoalsAgainst: totals.goalsAgainst / finished.length,
  };
}

function getPlayersSummary(team: TeamOverviewTeam) {
  const players = (team.players || []).filter((player) => player.name).slice(0, 9);
  if (!players.length) return UNAVAILABLE;

  return `القائمة المتاحة في المنصة تضم ${formatNumber(team.players?.length || players.length)} لاعبًا. أسماء من القائمة: ${players.map((player) => `${player.name}${player.position ? ` (${player.position})` : ''}`).join('، ')}.`;
}

function clampRating(value: number) {
  return Math.max(1, Math.min(10, Math.round(value * 10) / 10));
}

function formatRating(value: number | null) {
  if (value === null || !Number.isFinite(value)) return UNAVAILABLE;
  return `${value.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}/10`;
}

function buildRatingRows(stats: PerformanceStats | null, team: TeamOverviewTeam): RatingRow[] {
  const source = stats ? `قاعدة بيانات المنصة — آخر ${formatNumber(stats.sampleSize)} مباريات موثقة` : UNAVAILABLE;
  const squadCount = team.players?.length || 0;

  return [
    {
      label: 'الهجوم',
      rating: stats ? formatRating(clampRating(4 + stats.avgGoalsFor * 1.8)) : UNAVAILABLE,
      reason: stats ? `معدل التسجيل: ${formatDecimal(stats.avgGoalsFor)} هدف/مباراة.` : UNAVAILABLE,
      source,
    },
    {
      label: 'الدفاع',
      rating: stats ? formatRating(clampRating(8.2 - stats.avgGoalsAgainst * 1.35 + (stats.cleanSheets / stats.sampleSize))) : UNAVAILABLE,
      reason: stats ? `استقبل ${formatNumber(stats.goalsAgainst)} هدفًا مع ${formatNumber(stats.cleanSheets)} شباك نظيفة.` : UNAVAILABLE,
      source,
    },
    {
      label: 'الزخم الأخير',
      rating: stats ? formatRating(clampRating(4 + stats.wins * 1.05 + stats.draws * 0.35 - stats.losses * 0.25)) : UNAVAILABLE,
      reason: stats ? `${formatNumber(stats.wins)} فوز، ${formatNumber(stats.draws)} تعادل، ${formatNumber(stats.losses)} خسارة.` : UNAVAILABLE,
      source,
    },
    {
      label: 'عمق القائمة',
      rating: squadCount ? formatRating(clampRating(4.5 + Math.min(squadCount, 26) / 26 * 4.5)) : UNAVAILABLE,
      reason: squadCount ? `عدد اللاعبين المرتبطين بالمنتخب داخل المنصة: ${formatNumber(squadCount)}.` : UNAVAILABLE,
      source: squadCount ? 'قاعدة بيانات المنصة — قائمة اللاعبين المرتبطة بالمنتخب' : UNAVAILABLE,
    },
  ];
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-[11px] font-black text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-white tabular-nums">{value}</div>
      {note && <div className="mt-1 text-[11px] leading-5 text-gray-500">{note}</div>}
    </div>
  );
}

function PerformanceStatsBlock({ stats }: { stats: PerformanceStats | null }) {
  if (!stats) return <HighlightedReportText text={UNAVAILABLE} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="العينة" value={`${formatNumber(stats.sampleSize)} مباريات`} note="آخر مباريات منتهية في المنصة" />
        <StatTile label="النتائج" value={`${formatNumber(stats.wins)}ف / ${formatNumber(stats.draws)}ت / ${formatNumber(stats.losses)}خ`} />
        <StatTile label="الأهداف" value={`${formatNumber(stats.goalsFor)} له / ${formatNumber(stats.goalsAgainst)} عليه`} />
        <StatTile label="شباك نظيفة" value={formatNumber(stats.cleanSheets)} />
      </div>
      <p className="text-xs leading-6 text-gray-400">مصدر الأرقام: قاعدة بيانات المنصة بعد مزامنة المباريات. إذا لم تكن المباراة أو النتيجة موثقة لا تدخل في الحساب.</p>
    </div>
  );
}

function RatingTable({ rows }: { rows: RatingRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full min-w-[680px] text-right text-xs">
        <thead className="bg-black/35 text-gray-400">
          <tr>
            <th className="px-4 py-3 font-black">البند</th>
            <th className="px-4 py-3 font-black">التقييم المبدئي</th>
            <th className="px-4 py-3 font-black">سبب التقييم</th>
            <th className="px-4 py-3 font-black">المصدر</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr key={row.label} className="bg-white/[0.02] align-top">
              <td className="px-4 py-3 font-black text-white">{row.label}</td>
              <td className="px-4 py-3 font-black text-primary tabular-nums">{row.rating}</td>
              <td className="px-4 py-3 text-gray-300"><HighlightedReportText text={row.reason} /></td>
              <td className="px-4 py-3 text-gray-400"><HighlightedReportText text={row.source} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourcesList({ reports }: { reports: TeamOverviewReport[] }) {
  if (!reports.length) return <HighlightedReportText text={UNAVAILABLE} />;

  return (
    <ul className="space-y-3 text-xs leading-6">
      {reports.slice(0, 8).map((report) => (
        <li key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 font-black text-primary">{getConfidenceLabel(report.confidence)}</span>
            <span className="font-black text-white">{report.sourceName || UNAVAILABLE}</span>
            {report.provider && <span className="text-gray-500">{report.provider}</span>}
          </div>
          <div className="mt-1 text-gray-400">{report.title}</div>
          {report.sourceUrl && (
            <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-primary hover:underline">
              فتح المصدر
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ThemedAnalysisGrid({ team, reports }: { team: TeamOverviewTeam; reports: TeamOverviewReport[] }) {
  const sections = getAllSections(reports);
  const latestReport = reports[0];
  const stats = buildPerformanceStats(team);
  const ratings = buildRatingRows(stats, team);

  const summary = latestReport?.summary || UNAVAILABLE;
  const identity = findSectionText(
    sections,
    ['بطاقة المنتخب', 'طريقة التأهل', 'المدرب', 'القارة', 'المجموعة'],
    `المنتخب: ${team.name}. المجموعة: ${team.group || UNAVAILABLE}. القارة: ${team.continent || UNAVAILABLE}. التصنيف: ${formatNumber(team.fifaRank, UNAVAILABLE)}.`,
  );
  const context = findSectionText(sections, ['وضع المنتخب', 'قبل البطولة', 'السياق', 'الجاهزية'], UNAVAILABLE);
  const performanceText = findSectionText(sections, ['تحليل الأداء بالأرقام', 'الأداء بالأرقام', 'آخر 5', 'آخر خمس', 'النتائج'], '');
  const attack = findSectionText(sections, ['قراءة هجومية', 'القوة الهجومية', 'الأهداف', 'xg'], UNAVAILABLE);
  const defense = findSectionText(sections, ['قراءة دفاعية', 'القوة الدفاعية', 'الأهداف المستقبلة', 'xga'], UNAVAILABLE);
  const midfield = findSectionText(sections, ['وسط الملعب', 'التحكم', 'الاستحواذ', 'دقة التمرير'], UNAVAILABLE);
  const setPieces = findSectionText(sections, ['الكرات الثابتة', 'ركلات ركنية', 'set pieces'], UNAVAILABLE);
  const players = findSectionText(sections, ['أسماء بارزة', 'القائمة', 'قائمة المنتخب', 'اللاعبون'], getPlayersSummary(team));
  const tactics = findSectionText(sections, ['التحليل التكتيكي', 'بناء اللعب', 'الضغط', 'التحولات', 'الرسم الخططي', 'تكتيكي'], UNAVAILABLE);
  const strengths = joinReportList(reports.flatMap((report) => report.strengths || [])) !== UNAVAILABLE
    ? joinReportList(reports.flatMap((report) => report.strengths || []))
    : findSectionText(sections, ['نقاط القوة', 'مميزات', 'القوة'], UNAVAILABLE);
  const weaknesses = joinReportList(reports.flatMap((report) => report.weaknesses || [])) !== UNAVAILABLE
    ? joinReportList(reports.flatMap((report) => report.weaknesses || []))
    : findSectionText(sections, ['نقاط الضعف', 'نقاط تحتاج متابعة', 'مخاطر فنية', 'الضعف'], UNAVAILABLE);
  const missing = findSectionText(
    sections,
    ['معلومات غير متوفرة', 'غير متوفرة في المصادر', 'غير متوفر في المصادر'],
    reports.length ? 'أي خانة لا يظهر لها مصدر واضح داخل هذا التقرير تُعامل كغير متوفر في المصادر.' : UNAVAILABLE,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ThemedAnalysisCard tone="summary" icon={<Sparkles size={15} />} eyebrow="ملخص" title="ملخص تنفيذي موثق">
          <HighlightedReportText text={summary} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="identity" icon={<FileText size={15} />} eyebrow="بطاقة" title="1) بطاقة المنتخب">
          <HighlightedReportText text={identity} />
        </ThemedAnalysisCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <ThemedAnalysisCard tone="performance" icon={<ClipboardList size={15} />} eyebrow="سياق" title="2) وضع المنتخب قبل البطولة">
          <HighlightedReportText text={context} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="performance" icon={<BarChart3 size={15} />} eyebrow="أرقام" title="3) تحليل الأداء بالأرقام">
          <div className="space-y-4">
            {performanceText && <p><HighlightedReportText text={performanceText} /></p>}
            <PerformanceStatsBlock stats={stats} />
          </div>
        </ThemedAnalysisCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ThemedAnalysisCard tone="attack" icon={<Goal size={15} />} eyebrow="هجوم" title="القوة الهجومية">
          <HighlightedReportText text={attack} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="defense" icon={<Shield size={15} />} eyebrow="دفاع" title="القوة الدفاعية">
          <HighlightedReportText text={defense} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="midfield" icon={<Zap size={15} />} eyebrow="وسط" title="وسط الملعب والتحكم">
          <HighlightedReportText text={midfield} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="setPieces" icon={<Target size={15} />} eyebrow="كرات ثابتة" title="الكرات الثابتة">
          <HighlightedReportText text={setPieces} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="players" icon={<Users size={15} />} eyebrow="قائمة" title="4) أسماء بارزة في القائمة">
          <HighlightedReportText text={players} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="tactics" icon={<Scale size={15} />} eyebrow="تكتيك" title="5) التحليل التكتيكي">
          <HighlightedReportText text={tactics} />
        </ThemedAnalysisCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ThemedAnalysisCard tone="strengths" icon={<CheckCircle2 size={15} />} eyebrow="قوة" title="6) نقاط القوة">
          <HighlightedReportText text={strengths} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="weaknesses" icon={<XCircle size={15} />} eyebrow="متابعة" title="7) نقاط الضعف / ما يحتاج متابعة">
          <HighlightedReportText text={weaknesses} />
        </ThemedAnalysisCard>
      </div>

      <ThemedAnalysisCard tone="rating" icon={<ListChecks size={15} />} eyebrow="تقييم" title="8) تقييم مبدئي مبني على البيانات المتاحة">
        <div className="space-y-3 overflow-x-auto">
          <RatingTable rows={ratings} />
          <p className="text-xs leading-6 text-gray-400">هذا الجدول تقييم تحريري مبدئي محسوب من بيانات المنصة المتاحة فقط، وليس توقعًا نهائيًا أو توصية تداول. أي بند بلا بيانات كافية يظهر كـ “غير متوفر في المصادر”.</p>
        </div>
      </ThemedAnalysisCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ThemedAnalysisCard tone="missing" icon={<ShieldAlert size={15} />} eyebrow="شفافية" title="معلومات غير متوفرة في المصادر">
          <HighlightedReportText text={missing} />
        </ThemedAnalysisCard>
        <ThemedAnalysisCard tone="sources" icon={<Database size={15} />} eyebrow="مصادر" title="9) سجل المصادر">
          <SourcesList reports={reports} />
        </ThemedAnalysisCard>
      </div>
    </div>
  );
}

export default function TeamOverviewPanel({ team }: { team: TeamOverviewTeam }) {
  if (!team || team.type !== 'TEAM') return null;

  const reports = (team.intelligenceReports || []).filter((report) => {
    if (report.provider && AUTO_BASELINE_PROVIDERS.has(report.provider)) return false;
    if (AUTO_BASELINE_SOURCE_NAMES.has(report.sourceName)) return false;
    return true;
  });

  const matches = getAllMatches(team).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const upcomingMatches = matches.filter((m) => m.status !== 'FINISHED').slice(0, 4);
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED').slice(-3);
  const news = team.marketNews || [];

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <AssetImage image={team.image || ''} type="TEAM" name={team.name} width={78} height={78} className="h-20 w-20 rounded-3xl border border-white/10 bg-black/30 object-cover" />
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">FOOTBALL SOURCE REPORT</span>
                {team.code && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{team.code}</span>}
                {team.group && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">المجموعة {team.group}</span>}
                {team.continent && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{team.continent}</span>}
              </div>
              <h2 className="text-2xl font-black text-white md:text-3xl">التحليل الكروي لمنتخب {team.name}</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-gray-400">
                هذا التب مخصص للتحليل الكروي فقط: بطاقة المنتخب، الأداء بالأرقام، القراءة التكتيكية، نقاط القوة والضعف، والتقييم المبدئي المبني على البيانات المتاحة. لا يتم عرض السعر أو القيمة العادلة أو توصيات التداول هنا.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المجموعات</Link>
            <Link href="/matches" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">المباريات</Link>
          </div>
        </div>

        <ThemedAnalysisGrid team={team} reports={reports} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><CalendarDays size={20} className="text-primary" /> المباريات المرتبطة</h3>
            {(upcomingMatches.length || finishedMatches.length) ? (
              <div className="space-y-3">{[...finishedMatches, ...upcomingMatches].slice(0, 5).map((match) => <MatchCard key={match.id} match={match} teamId={team.id} />)}</div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-gray-500">لا توجد مباريات موثقة مرتبطة حاليًا بهذا المنتخب.</div>
            )}
            <p className="mt-3 text-[11px] leading-5 text-gray-500">مصدر المباريات: قاعدة بيانات المنصة بعد مزامنة جدول البطولة. إذا لم تتوفر المباراة يكتب: غير متوفر في المصادر.</p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Database size={20} className="text-primary" /> سياسة المصادر</h3>
            <div className="space-y-3 text-sm leading-7 text-gray-300">
              <p>المصادر المعتمدة للتحليل: FIFA والاتحادات الرسمية، Reuters، Opta/Opta Analyst، StatsBomb، Wyscout، FBref، FotMob، Sofascore، WhoScored، Understat، Transfermarkt، CIES، The Athletic، وSports Reference / Stathead / FBref عند توفر رابط عام أو export مسموح من الاشتراك.</p>
              <p>لا يتم استخدام أي رقم في هذا التب إلا إذا كان موثقًا داخل التقرير نفسه، أو محسوبًا بوضوح من مباريات وقوائم موجودة داخل قاعدة بيانات المنصة.</p>
            </div>
            <div className="mt-4 rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.04] p-4 text-xs leading-6 text-yellow-100">
              <ShieldAlert size={15} className="ml-1 inline" /> البيانات المدفوعة أو المحمية لا تُنقل كجداول أو feeds كاملة إلا بعد الحصول على الترخيص المناسب أو export مسموح من الاشتراك.
            </div>
          </div>
        </div>

        {news.length > 0 && (
          <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><FileText size={20} className="text-primary" /> أخبار وتحليلات مرتبطة بالمنتخب</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {news.slice(0, 6).map((item) => (
                <div key={item.id || item.title || item.titleAr} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="mb-2 text-xs text-gray-500">{formatDate(item.publishedAt)}</div>
                  <h4 className="font-black text-white">{item.title || item.titleAr}</h4>
                  {item.summary && <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-emerald-300"><Sparkles size={18} /> الفصل التحريري</h3>
          <p className="text-sm leading-7 text-gray-300">التحليل الكروي في هذا التب منفصل عن التداول. أي قراءة سعرية أو طلب أو مخاطرة سوقية تظهر فقط في تب التداول.</p>
        </div>
      </div>
    </section>
  );
}
