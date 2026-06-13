import Link from 'next/link';
import { BarChart3, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Database, FileText, Goal, History, ListChecks, Scale, Shield, ShieldAlert, Sparkles, Target, Trophy, Users, XCircle, Zap } from 'lucide-react';
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
  sourceCategory?: string | null;
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

const UNAVAILABLE = 'غير متوفر في المصادر';
const AUTO_BASELINE_PROVIDERS = new Set(['MC_PRIME_AUTO']);
const AUTO_BASELINE_SOURCE_NAMES = new Set(['MC PRIME Auto Intelligence Baseline']);
const FBREF_PROVIDERS = new Set(['FBREF_STATHEAD_IMPORT', 'FBREF_STATHEAD_SNAPSHOT']);

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMatchDate(value?: Date | string | null) {
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

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getConfidenceLabel(value?: string | null) {
  if (value === 'A') return 'ثقة عالية';
  if (value === 'B') return 'ثقة جيدة';
  if (value === 'C') return 'ثقة متوسطة';
  return 'ثقة محدودة';
}

function isFbrefSnapshot(report: TeamOverviewReport) {
  const haystack = normalizeText(`${report.provider || ''} ${report.sourceName || ''} ${report.title || ''}`);
  return Boolean(report.provider && FBREF_PROVIDERS.has(report.provider)) || haystack.includes('fbref') || haystack.includes('stathead');
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
      const hasReadableTitle = possibleTitle.length >= 3 && possibleTitle.length <= 90 && !/[.!؟]$/.test(possibleTitle);
      return {
        title: hasReadableTitle ? possibleTitle : `ملاحظة تحليلية ${index + 1}`,
        content: hasReadableTitle ? block.slice(colonIndex + 1).trim() : block,
      };
    });
}

function getSections(reports: TeamOverviewReport[]) {
  return reports.flatMap((report) => parseReportBody(report.body).map((section) => ({ ...section, report })));
}

function findSectionText(sections: Array<ReportSection & { report: TeamOverviewReport }>, keywords: string[], fallback = UNAVAILABLE) {
  const normalizedKeywords = keywords.map(normalizeText);
  const match = sections.find((section) => {
    const haystack = normalizeText(`${section.title} ${section.content}`);
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });

  return match?.content || fallback;
}

function HighlightedReportText({ text }: { text: string }) {
  const parts = text.split(UNAVAILABLE);
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && <span className="mx-1 inline-flex rounded-lg border border-yellow-300/20 bg-yellow-300/10 px-2 py-0.5 text-[11px] font-black text-yellow-200">{UNAVAILABLE}</span>}
        </span>
      ))}
    </>
  );
}

function joinReportList(items?: string[] | null) {
  const values = (items || []).map((item) => item.trim()).filter(Boolean);
  return values.length ? values.join(' — ') : UNAVAILABLE;
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
    { label: 'الهجوم', rating: stats ? formatRating(clampRating(4 + stats.avgGoalsFor * 1.8)) : UNAVAILABLE, reason: stats ? `معدل التسجيل: ${formatDecimal(stats.avgGoalsFor)} هدف/مباراة.` : UNAVAILABLE, source },
    { label: 'الدفاع', rating: stats ? formatRating(clampRating(8.2 - stats.avgGoalsAgainst * 1.35 + (stats.cleanSheets / stats.sampleSize))) : UNAVAILABLE, reason: stats ? `استقبل ${formatNumber(stats.goalsAgainst)} هدفًا مع ${formatNumber(stats.cleanSheets)} شباك نظيفة.` : UNAVAILABLE, source },
    { label: 'الزخم الأخير', rating: stats ? formatRating(clampRating(4 + stats.wins * 1.05 + stats.draws * 0.35 - stats.losses * 0.25)) : UNAVAILABLE, reason: stats ? `${formatNumber(stats.wins)} فوز، ${formatNumber(stats.draws)} تعادل، ${formatNumber(stats.losses)} خسارة.` : UNAVAILABLE, source },
    { label: 'عمق القائمة', rating: squadCount ? formatRating(clampRating(4.5 + Math.min(squadCount, 26) / 26 * 4.5)) : UNAVAILABLE, reason: squadCount ? `عدد اللاعبين المرتبطين بالمنتخب داخل المنصة: ${formatNumber(squadCount)}.` : UNAVAILABLE, source: squadCount ? 'قاعدة بيانات المنصة — قائمة اللاعبين المرتبطة بالمنتخب' : UNAVAILABLE },
  ];
}

function getPlayersSummary(team: TeamOverviewTeam) {
  const players = (team.players || []).filter((player) => player.name).slice(0, 10);
  if (!players.length) return UNAVAILABLE;
  return `القائمة المتاحة في المنصة تضم ${formatNumber(team.players?.length || players.length)} لاعبًا. أسماء من القائمة: ${players.map((player) => `${player.name}${player.position ? ` (${player.position})` : ''}`).join('، ')}.`;
}

function SourceBadge({ label, ready }: { label: string; ready: boolean }) {
  return <span className={`rounded-xl border px-3 py-1 text-[11px] font-black ${ready ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-slate-300/10 bg-white/5 text-slate-400'}`}>{label}</span>;
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-[11px] font-black text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-white tabular-nums">{value}</div>
      {note && <div className="mt-1 text-[11px] leading-5 text-slate-500">{note}</div>}
    </div>
  );
}

function ProfileCard({ icon, eyebrow, title, children, className = '' }: { icon: React.ReactNode; eyebrow: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <article className={`rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ${className}`}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-black text-white/75">
        {icon}
        {eyebrow}
      </div>
      <h4 className="mb-3 text-lg font-black text-white">{title}</h4>
      <div className="text-sm leading-8 text-slate-200"><HighlightedReportText text={typeof children === 'string' ? children : ''} />{typeof children !== 'string' ? children : null}</div>
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
        <span className="text-slate-500">{formatMatchDate(match.matchDate)}</span>
        <span className={`rounded-lg px-2 py-1 font-black ${isLive ? 'bg-primary/10 text-primary' : isFinished ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/5 text-slate-400'}`}>{isLive ? 'مباشرة' : isFinished ? 'انتهت' : 'قادمة'}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AssetImage image={opponent?.image || ''} type="TEAM" name={opponent?.name || 'Opponent'} width={38} height={38} className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <div className="font-black text-white">ضد {opponent?.name || '-'}</div>
            <div className="text-xs text-slate-500">{match.stage === 'group' ? 'دور المجموعات' : 'مرحلة إقصائية / مؤثرة'}</div>
          </div>
        </div>
        {(isFinished || isLive) ? <div className="text-2xl font-black text-white tabular-nums">{gf ?? 0}-{ga ?? 0}</div> : null}
      </div>
    </Link>
  );
}

function RatingTable({ rows }: { rows: RatingRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full min-w-[680px] text-right text-xs">
        <thead className="bg-black/35 text-slate-400">
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
              <td className="px-4 py-3 font-black text-primary tabular-nums"><HighlightedReportText text={row.rating} /></td>
              <td className="px-4 py-3 text-slate-300"><HighlightedReportText text={row.reason} /></td>
              <td className="px-4 py-3 text-slate-400"><HighlightedReportText text={row.source} /></td>
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
      {reports.slice(0, 14).map((report) => (
        <li key={report.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 font-black text-primary">{getConfidenceLabel(report.confidence)}</span>
            <span className="font-black text-white">{report.sourceName || UNAVAILABLE}</span>
            {report.provider && <span className="text-slate-500">{report.provider}</span>}
          </div>
          <div className="mt-1 text-slate-400">{report.title}</div>
          {report.sourceUrl && <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-primary hover:underline">فتح المصدر</a>}
        </li>
      ))}
    </ul>
  );
}

function TeamProfileLayout({ team, reports }: { team: TeamOverviewTeam; reports: TeamOverviewReport[] }) {
  const profileReports = reports.filter((report) => !isFbrefSnapshot(report));
  const snapshotReports = reports.filter(isFbrefSnapshot);
  const profileSections = getSections(profileReports);
  const snapshotSections = getSections(snapshotReports);
  const allSections = getSections(reports);
  const stats = buildPerformanceStats(team);
  const ratings = buildRatingRows(stats, team);

  const sourceHaystack = normalizeText(reports.map((report) => `${report.sourceName} ${report.provider} ${report.title}`).join(' '));
  const hasOfficial = sourceHaystack.includes('fifa') || sourceHaystack.includes('federation') || sourceHaystack.includes('official') || sourceHaystack.includes('اتحاد');
  const hasHistorical = sourceHaystack.includes('rsssf') || sourceHaystack.includes('worldfootball') || sourceHaystack.includes('history') || sourceHaystack.includes('historical') || sourceHaystack.includes('تاريخ');
  const hasStats = sourceHaystack.includes('fbref') || sourceHaystack.includes('stathead') || sourceHaystack.includes('opta') || sourceHaystack.includes('statsbomb');
  const hasEditorial = sourceHaystack.includes('reuters') || sourceHaystack.includes('athletic') || sourceHaystack.includes('analyst') || sourceHaystack.includes('تحليل');

  const historicalRecord = findSectionText(profileSections, ['السجل التاريخي', 'تاريخ كأس العالم', 'world cup historical', 'historical record', 'المشاركات', 'أفضل إنجاز']);
  const qualificationPath = findSectionText(profileSections, ['طريق التأهل', 'التصفيات', 'qualification', 'qualifying path', 'الجاهزية']);
  const squadProfile = findSectionText(allSections, ['القائمة الحالية', 'قائمة المنتخب', 'current squad', 'أسماء بارزة', 'اللاعبون'], getPlayersSummary(team));
  const tacticalIdentity = findSectionText(profileSections, ['الهوية التكتيكية', 'التحليل التكتيكي', 'style of play', 'pressing', 'بناء اللعب', 'الضغط', 'التحولات']);
  const recentPerformance = findSectionText(profileSections, ['آخر النتائج', 'النتائج الأخيرة', 'recent form', 'آخر 5', 'form']);
  const currentSnapshot = findSectionText(snapshotSections, ['وضع المنتخب في المجموعة', 'تحليل الأداء بالأرقام', 'بطاقة المنتخب', 'القوة الهجومية'], snapshotReports[0]?.summary || UNAVAILABLE);
  const attack = findSectionText(allSections, ['القوة الهجومية', 'الهجوم', 'xg', 'التسديدات']);
  const defense = findSectionText(allSections, ['القوة الدفاعية', 'الدفاع', 'xga', 'الأهداف المستقبلة']);
  const midfield = findSectionText(allSections, ['وسط الملعب', 'الاستحواذ', 'التمرير', 'possession', 'passing']);
  const strengths = joinReportList(profileReports.flatMap((report) => report.strengths || [])) !== UNAVAILABLE
    ? joinReportList(profileReports.flatMap((report) => report.strengths || []))
    : findSectionText(profileSections, ['نقاط القوة', 'مميزات', 'strengths']);
  const weaknesses = joinReportList(profileReports.flatMap((report) => report.weaknesses || [])) !== UNAVAILABLE
    ? joinReportList(profileReports.flatMap((report) => report.weaknesses || []))
    : findSectionText(profileSections, ['نقاط الضعف', 'ما يحتاج متابعة', 'weaknesses']);
  const missing = findSectionText(allSections, ['معلومات غير متوفرة', 'غير متوفرة في المصادر', 'missing'], 'السجل التاريخي الكامل، طريق التأهل، المدرب، القائد، والأدوار التكتيكية التفصيلية يجب إدخالها من مصادر رسمية وتاريخية متعددة إذا لم تكن ظاهرة هنا.');

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(15,240,252,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">PROFESSIONAL TEAM PROFILE</span>
            {team.code && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{team.code}</span>}
            {team.group && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">المجموعة {team.group}</span>}
          </div>
          <h3 className="text-2xl font-black text-white md:text-3xl">ملف كروي تاريخي لمنتخب {team.name}</h3>
          <p className="mt-3 max-w-4xl text-sm leading-8 text-slate-300">
            هذه الصفحة مصممة كتقرير تاريخي وتحليلي متعدد المصادر. FBref/Stathead يظهر كـ “لقطة إحصائية حالية” فقط، ولا يُعامل كتقرير نهائي منفرد. أي معلومة غير موثقة تظهر بوضوح كـ {UNAVAILABLE}.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
          <h4 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Database size={18} className="text-primary" /> طبقات المصادر</h4>
          <div className="flex flex-wrap gap-2">
            <SourceBadge label="رسمي / FIFA" ready={hasOfficial} />
            <SourceBadge label="تاريخي" ready={hasHistorical} />
            <SourceBadge label="إحصائي" ready={hasStats} />
            <SourceBadge label="تحريري / تكتيكي" ready={hasEditorial} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <StatTile label="تقارير متعددة المصادر" value={formatNumber(profileReports.length, '0')} />
            <StatTile label="لقطات FBref" value={formatNumber(snapshotReports.length, '0')} />
          </div>
        </div>
      </section>

      {!profileReports.length && (
        <div className="rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-5 text-sm leading-7 text-yellow-50">
          <ShieldAlert size={16} className="ml-1 inline" /> لا يوجد حتى الآن تقرير تاريخي متعدد المصادر لهذا المنتخب. الموجود حاليًا قد يكون لقطة FBref فقط. المطلوب إدخال Source Pack تاريخي من FIFA/RSSSF/WorldFootball/Reuters/Opta أو مصادر معتمدة مماثلة.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <ProfileCard icon={<Trophy size={15} />} eyebrow="تاريخ" title="1) السجل التاريخي في كأس العالم">{historicalRecord}</ProfileCard>
        <ProfileCard icon={<ClipboardList size={15} />} eyebrow="تأهل" title="2) طريق التأهل والجاهزية">{qualificationPath}</ProfileCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ProfileCard icon={<Users size={15} />} eyebrow="قائمة" title="3) القائمة الحالية وبنية الفريق">{squadProfile}</ProfileCard>
        <ProfileCard icon={<Scale size={15} />} eyebrow="تكتيك" title="4) الهوية التكتيكية وأسلوب اللعب">{tacticalIdentity}</ProfileCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ProfileCard icon={<BarChart3 size={15} />} eyebrow="فورمة" title="5) النتائج الأخيرة ومؤشرات الجاهزية">
          <div className="space-y-4">
            <HighlightedReportText text={recentPerformance} />
            {stats ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="العينة" value={`${formatNumber(stats.sampleSize)} مباريات`} />
                <StatTile label="النتائج" value={`${formatNumber(stats.wins)}ف / ${formatNumber(stats.draws)}ت / ${formatNumber(stats.losses)}خ`} />
                <StatTile label="الأهداف" value={`${formatNumber(stats.goalsFor)} له / ${formatNumber(stats.goalsAgainst)} عليه`} />
                <StatTile label="شباك نظيفة" value={formatNumber(stats.cleanSheets)} />
              </div>
            ) : null}
          </div>
        </ProfileCard>
        <ProfileCard icon={<Sparkles size={15} />} eyebrow="2026" title="6) لقطة إحصائية حالية من البطولة">{currentSnapshot}</ProfileCard>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ProfileCard icon={<Goal size={15} />} eyebrow="هجوم" title="القوة الهجومية">{attack}</ProfileCard>
        <ProfileCard icon={<Shield size={15} />} eyebrow="دفاع" title="القوة الدفاعية">{defense}</ProfileCard>
        <ProfileCard icon={<Zap size={15} />} eyebrow="وسط" title="وسط الملعب والتحكم">{midfield}</ProfileCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ProfileCard icon={<CheckCircle2 size={15} />} eyebrow="قوة" title="7) نقاط القوة المدعومة بالمصادر">{strengths}</ProfileCard>
        <ProfileCard icon={<XCircle size={15} />} eyebrow="متابعة" title="8) نقاط الضعف وما يحتاج متابعة">{weaknesses}</ProfileCard>
      </section>

      <ProfileCard icon={<ListChecks size={15} />} eyebrow="تقييم" title="9) تقييم مبدئي مبني على البيانات المتاحة">
        <div className="space-y-3 overflow-x-auto">
          <RatingTable rows={ratings} />
          <p className="text-xs leading-6 text-slate-400">هذا الجدول تقييم تحريري مبدئي محسوب من بيانات المنصة المتاحة فقط، وليس توقعًا نهائيًا أو توصية تداول.</p>
        </div>
      </ProfileCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <ProfileCard icon={<ShieldAlert size={15} />} eyebrow="شفافية" title="معلومات غير متوفرة في المصادر">{missing}</ProfileCard>
        <ProfileCard icon={<Database size={15} />} eyebrow="مصادر" title="سجل المصادر المستخدم">
          <SourcesList reports={reports} />
        </ProfileCard>
      </section>
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
                <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">FOOTBALL HISTORICAL PROFILE</span>
                {team.code && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{team.code}</span>}
                {team.group && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">المجموعة {team.group}</span>}
                {team.continent && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{team.continent}</span>}
              </div>
              <h2 className="text-2xl font-black text-white md:text-3xl">الملف التاريخي والتحليل الكروي لمنتخب {team.name}</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-400">تقرير كروي متعدد المصادر: تاريخ كأس العالم، طريق التأهل، القائمة، الهوية التكتيكية، لقطة البطولة الحالية، ونقاط القوة والضعف. لا يتم عرض السعر أو توصيات التداول هنا.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/team-intelligence?teamId=${team.id}`} className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">إضافة تقرير تاريخي</Link>
            <Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المجموعات</Link>
            <Link href="/matches" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المباريات</Link>
          </div>
        </div>

        <TeamProfileLayout team={team} reports={reports} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><CalendarDays size={20} className="text-primary" /> المباريات المرتبطة</h3>
            {(upcomingMatches.length || finishedMatches.length) ? (
              <div className="space-y-3">{[...finishedMatches, ...upcomingMatches].slice(0, 5).map((match) => <MatchCard key={match.id} match={match} teamId={team.id} />)}</div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-500">لا توجد مباريات موثقة مرتبطة حاليًا بهذا المنتخب.</div>
            )}
            <p className="mt-3 text-[11px] leading-5 text-slate-500">مصدر المباريات: قاعدة بيانات المنصة بعد مزامنة جدول البطولة. إذا لم تتوفر المباراة يكتب: غير متوفر في المصادر.</p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><BookOpen size={20} className="text-primary" /> سياسة التقرير الاحترافي</h3>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>التقرير النهائي لا يعتمد على FBref وحده. FBref/Stathead يستخدم للطبقة الإحصائية الحالية، بينما التاريخ والهوية الرسمية يحتاجان FIFA، الاتحاد الرسمي، RSSSF، WorldFootball.net، ومصادر تحريرية موثوقة مثل Reuters وOpta Analyst وStatsBomb عند توفرها.</p>
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
                  <div className="mb-2 text-xs text-slate-500">{formatDate(item.publishedAt)}</div>
                  <h4 className="font-black text-white">{item.title || item.titleAr}</h4>
                  {item.summary && <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-emerald-300"><Sparkles size={18} /> الفصل التحريري</h3>
          <p className="text-sm leading-7 text-slate-300">التحليل الكروي في هذا التب منفصل عن التداول. أي قراءة سعرية أو طلب أو مخاطرة سوقية تظهر فقط في تب التداول.</p>
        </div>
      </div>
    </section>
  );
}
