import Link from 'next/link';
import { CalendarDays, Database, ExternalLink, FileText, Goal, ListChecks, Newspaper, Shield, ShieldAlert, Sparkles, Target, Users, Zap } from 'lucide-react';
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

type CardTone = 'summary' | 'identity' | 'attack' | 'defense' | 'midfield' | 'setPieces' | 'players' | 'missing' | 'sources';

const AUTO_BASELINE_PROVIDERS = new Set(['MC_PRIME_AUTO']);
const AUTO_BASELINE_SOURCE_NAMES = new Set(['MC PRIME Auto Intelligence Baseline']);
const UNAVAILABLE = 'غير متوفر في المصادر';

const cardToneClass: Record<CardTone, string> = {
  summary: 'border-cyan-300/20 bg-[radial-gradient(circle_at_top_right,rgba(15,240,252,0.18),transparent_34%),linear-gradient(135deg,rgba(15,240,252,0.08),rgba(255,255,255,0.025))]',
  identity: 'border-violet-300/20 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.20),transparent_36%),linear-gradient(135deg,rgba(168,85,247,0.08),rgba(255,255,255,0.025))]',
  attack: 'border-red-300/20 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.20),transparent_36%),linear-gradient(135deg,rgba(248,113,113,0.08),rgba(255,255,255,0.025))]',
  defense: 'border-emerald-300/20 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.20),transparent_36%),linear-gradient(135deg,rgba(52,211,153,0.08),rgba(255,255,255,0.025))]',
  midfield: 'border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.20),transparent_36%),linear-gradient(135deg,rgba(251,191,36,0.08),rgba(255,255,255,0.025))]',
  setPieces: 'border-blue-300/20 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.20),transparent_36%),linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.025))]',
  players: 'border-fuchsia-300/20 bg-[radial-gradient(circle_at_top_right,rgba(232,121,249,0.20),transparent_36%),linear-gradient(135deg,rgba(232,121,249,0.08),rgba(255,255,255,0.025))]',
  missing: 'border-yellow-300/20 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.20),transparent_36%),linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.025))]',
  sources: 'border-slate-300/15 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_36%),linear-gradient(135deg,rgba(148,163,184,0.08),rgba(255,255,255,0.025))]',
};

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
      const colonIndex = block.indexOf(':');
      const possibleTitle = colonIndex > 0 ? block.slice(0, colonIndex).trim() : '';
      const hasReadableTitle = possibleTitle.length >= 3 && possibleTitle.length <= 70 && !/[.!؟]$/.test(possibleTitle);
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

function ThemedAnalysisCard({ tone, icon, eyebrow, title, children }: { tone: CardTone; icon: React.ReactNode; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] ${cardToneClass[tone]}`}>
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

function ReportBodySections({ body }: { body?: string | null }) {
  const sections = parseReportBody(body);
  if (!sections.length) return null;

  return (
    <div className="mt-4 grid gap-3">
      {sections.map((section, index) => (
        <section key={`${section.title}-${index}`} className="rounded-2xl border border-white/5 bg-black/25 p-4">
          <h5 className="mb-2 text-xs font-black text-primary">{section.title}</h5>
          <p className="whitespace-pre-line text-xs leading-6 text-gray-300"><HighlightedReportText text={section.content} /></p>
        </section>
      ))}
    </div>
  );
}

function IntelligenceReportCard({ report }: { report: TeamOverviewReport }) {
  const tacticalTags = report.tacticalTags || [];
  const strengths = report.strengths || [];
  const weaknesses = report.weaknesses || [];

  return (
    <article className="rounded-3xl border border-primary/10 bg-primary/[0.04] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
        <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-primary">{getConfidenceLabel(report.confidence)}</span>
        <span className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-gray-300">{report.sourceName}</span>
        <span className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-gray-400">{formatDate(report.publishedAt)}</span>
        {report.sourceUrl && <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-primary hover:text-white">فتح المصدر <ExternalLink size={12} /></a>}
      </div>
      <h4 className="text-lg font-black text-white">{report.title}</h4>
      <p className="mt-2 text-sm leading-7 text-gray-300">{report.summary}</p>
      <ReportBodySections body={report.body} />
      {!!(tacticalTags.length || strengths.length || weaknesses.length) && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {!!tacticalTags.length && <div><div className="mb-2 text-xs font-black text-primary">وسوم تكتيكية</div><div className="flex flex-wrap gap-2">{tacticalTags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">{tag}</span>)}</div></div>}
          {!!strengths.length && <div><div className="mb-2 text-xs font-black text-emerald-300">نقاط قوة موثقة</div><ul className="space-y-1 text-xs leading-5 text-gray-300">{strengths.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
          {!!weaknesses.length && <div><div className="mb-2 text-xs font-black text-red-300">نقاط تحتاج متابعة</div><ul className="space-y-1 text-xs leading-5 text-gray-300">{weaknesses.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
        </div>
      )}
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

function ThemedAnalysisGrid({ team, reports }: { team: TeamOverviewTeam; reports: TeamOverviewReport[] }) {
  const sections = getAllSections(reports);
  const latestReport = reports[0];
  const summary = latestReport?.summary || UNAVAILABLE;
  const identity = findSectionText(sections, ['بطاقة المنتخب', 'طريقة التأهل', 'المدرب'], `المنتخب: ${team.name}. المجموعة: ${team.group || UNAVAILABLE}. القارة: ${team.continent || UNAVAILABLE}.`);
  const attack = findSectionText(sections, ['قراءة هجومية', 'القوة الهجومية', 'الأهداف', 'xg']);
  const defense = findSectionText(sections, ['قراءة دفاعية', 'القوة الدفاعية', 'الأهداف المستقبلة', 'xga']);
  const midfield = findSectionText(sections, ['وسط الملعب', 'التحكم', 'الاستحواذ', 'دقة التمرير']);
  const setPieces = findSectionText(sections, ['الكرات الثابتة', 'ركلات ركنية', 'set pieces']);
  const players = findSectionText(sections, ['أسماء بارزة', 'القائمة', 'النجم الأبرز']);
  const missing = findSectionText(sections, ['معلومات غير متوفرة', 'غير متوفرة في المصادر', 'غير متوفر في المصادر']);

  return (
    <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ThemedAnalysisCard tone="summary" icon={<Sparkles size={15} />} eyebrow="ملخص" title="ملخص تنفيذي موثق">
        <HighlightedReportText text={summary} />
      </ThemedAnalysisCard>
      <ThemedAnalysisCard tone="identity" icon={<FileText size={15} />} eyebrow="بطاقة" title="بطاقة المنتخب">
        <HighlightedReportText text={identity} />
      </ThemedAnalysisCard>
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
      <ThemedAnalysisCard tone="players" icon={<Users size={15} />} eyebrow="قائمة" title="أسماء بارزة في القائمة">
        <HighlightedReportText text={players} />
      </ThemedAnalysisCard>
      <ThemedAnalysisCard tone="missing" icon={<ListChecks size={15} />} eyebrow="شفافية" title="معلومات غير متوفرة">
        <HighlightedReportText text={missing} />
      </ThemedAnalysisCard>
      <ThemedAnalysisCard tone="sources" icon={<Database size={15} />} eyebrow="مصادر" title="سجل المصادر">
        {reports.length ? (
          <ul className="space-y-2 text-xs leading-6">
            {reports.slice(0, 4).map((report) => (
              <li key={report.id} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{report.sourceName} — {getConfidenceLabel(report.confidence)}</span>
              </li>
            ))}
          </ul>
        ) : UNAVAILABLE}
      </ThemedAnalysisCard>
    </div>
  );
}

export default function TeamOverviewPanel({ team }: { team: TeamOverviewTeam }) {
  if (!team || team.type !== 'TEAM') return null;

  const reports = (team.intelligenceReports || []).filter((report) => {
    if (report.provider && AUTO_BASELINE_PROVIDERS.has(report.provider)) return false;
    if (AUTO_BASELINE_SOURCE_NAMES.has(report.sourceName)) return false;
    if (report.sourceName === 'MC PRIME Editorial Desk') return false;
    return true;
  });

  const matches = [...(team.homeMatches || []), ...(team.awayMatches || [])].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
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
                هذا التب مخصص للتحليل الكروي فقط. لا يتم عرض السعر، القيمة العادلة، فرق القيمة، أو توصيات التداول هنا. أي رقم غير موثق يظهر كـ “غير متوفر في المصادر”.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المجموعات</Link>
            <Link href="/matches" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">المباريات</Link>
          </div>
        </div>

        <ThemedAnalysisGrid team={team} reports={reports} />

        <div className="mb-5 rounded-3xl border border-primary/10 bg-black/25 p-5">
          <h3 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Newspaper size={20} className="text-primary" /> التقارير الفنية من المصادر</h3>
          <p className="mb-4 text-xs leading-6 text-gray-500">
            يعرض هذا القسم التقارير المنسوبة إلى Reuters أو المصادر الرسمية أو مصادر البيانات والتحليل المعتمدة. تم إخفاء تقارير baseline والتقديرات الداخلية من هذا التب.
          </p>
          {reports.length ? (
            <div className="grid gap-4 xl:grid-cols-2">{reports.map((report) => <IntelligenceReportCard key={report.id} report={report} />)}</div>
          ) : (
            <div className="rounded-2xl border border-dashed border-yellow-300/15 bg-yellow-300/[0.04] p-5 text-sm leading-7 text-yellow-100">
              لا توجد تقارير كروية موثقة لهذا المنتخب بعد. غير متوفر في المصادر.
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
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
              <p>المصادر المعتمدة للتحليل: الاتحادات الرسمية، Reuters، Opta/Opta Analyst، StatsBomb، Wyscout، FBref، Sofascore، WhoScored، Understat، Transfermarkt، CIES، The Athletic، Overlyzer عند توفر ترخيص أو رابط عام واضح.</p>
              <p>لا يتم استخدام أي رقم في هذا التب إلا إذا كان موثقًا داخل التقرير نفسه أو مرتبطًا بمصدر واضح.</p>
            </div>
            <div className="mt-4 rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.04] p-4 text-xs leading-6 text-yellow-100">
              <ShieldAlert size={15} className="ml-1 inline" /> البيانات المدفوعة أو المحمية لا تُنقل كجداول أو feeds كاملة إلا بعد الحصول على الترخيص المناسب.
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
