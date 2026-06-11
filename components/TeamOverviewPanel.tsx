import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, CalendarDays, Database, ExternalLink, FileCheck2, Goal, History, Newspaper, Shield, Sparkles, Target, Trophy, Users, Zap } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { buildTeamSourcedMetrics, getSourceBadge, getSourceByKey, TEAM_INTELLIGENCE_SOURCES, type SourceConfidence, type SourcedMetric } from '@/lib/teamIntelligenceSources';

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
  score?: number | null;
  fifaRank?: number | null;
  group?: string | null;
  continent?: string | null;
  momentum?: number | null;
  worldCupLegacy?: number | null;
  harmony?: number | null;
  injuries?: number | null;
  fundamental?: number | null;
  participations?: number | null;
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

function normalizeConfidence(value?: string | null): SourceConfidence {
  if (value === 'A' || value === 'B' || value === 'C' || value === 'D') return value;
  return 'D';
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getAvgPlayerScore(players: TeamOverviewPlayer[]) {
  if (!players.length) return 0;
  return Math.round(players.reduce((sum, player) => sum + Number(player.score || 0), 0) / players.length);
}

function getLinePlayers(players: TeamOverviewPlayer[], position: string) {
  return players.filter((player) => String(player.position || '').toUpperCase() === position);
}

function getLineStrength(players: TeamOverviewPlayer[], position: string) {
  const filtered = getLinePlayers(players, position);
  if (!filtered.length) return 0;
  return Math.round(filtered.reduce((sum, player) => sum + Number(player.score || 0), 0) / filtered.length);
}

function getTeamPower(team: TeamOverviewTeam, players: TeamOverviewPlayer[]) {
  const avgPlayerScore = getAvgPlayerScore(players) || Number(team.score || 50);
  return Math.round((Number(team.score || 50) * 0.35) + (avgPlayerScore * 0.30) + (Number(team.momentum ?? 50) * 0.20) + (Number(team.worldCupLegacy ?? 50) * 0.10) + (Number(team.harmony ?? 85) * 0.05));
}

function getTeamStyle(team: TeamOverviewTeam, players: TeamOverviewPlayer[]) {
  const attack = getLineStrength(players, 'FWD');
  const midfield = getLineStrength(players, 'MID');
  const defense = getLineStrength(players, 'DEF');
  const momentum = Number(team.momentum ?? 50);
  const legacy = Number(team.worldCupLegacy ?? 50);
  if (attack >= 75 && midfield >= 72) return 'منتخب يميل للسيطرة وصناعة الفرص، وقيمته الفنية تظهر أكثر عند امتلاك الكرة والضغط في نصف ملعب الخصم.';
  if (defense >= 75 && midfield >= 70) return 'منتخب متوازن دفاعيًا، يعتمد على التنظيم والتحولات ويملك قدرة جيدة على إدارة المباريات الصعبة.';
  if (momentum >= 70) return 'منتخب في حالة زخم جيدة، وأداؤه الأخير يجعله قابلًا للصعود فنيًا مع بداية البطولة.';
  if (legacy >= 80) return 'منتخب صاحب خبرة مونديالية كبيرة، عادةً يستفيد من شخصية البطولة حتى لو لم تكن كل المؤشرات الرقمية مثالية.';
  return 'منتخب يحتاج متابعة فنية دقيقة؛ جودة القائمة والزخم والمجموعة ستحدد سقف طموحه في البطولة.';
}

function technicalInsights(team: TeamOverviewTeam, players: TeamOverviewPlayer[]) {
  const insights: string[] = [];
  const avgScore = getAvgPlayerScore(players);
  const attack = getLineStrength(players, 'FWD');
  const midfield = getLineStrength(players, 'MID');
  const defense = getLineStrength(players, 'DEF');
  const goalkeeper = getLineStrength(players, 'GK');
  if ((team.fifaRank || 999) <= 10) insights.push('تصنيف FIFA ضمن النخبة يمنح المنتخب أرضية تنافسية قوية قبل البطولة.');
  if (avgScore >= 75) insights.push('متوسط جودة اللاعبين مرتفع، ما يعكس عمقًا جيدًا في القائمة وليس فقط اعتمادًا على نجم واحد.');
  if (attack >= 75) insights.push('الخط الأمامي قادر على صناعة فارق مباشر عبر التسجيل، التحركات خلف الدفاع، أو صناعة الفرص.');
  if (midfield >= 75) insights.push('وسط الملعب يمنح الفريق قدرة أفضل على التحكم في الإيقاع والخروج بالكرة تحت الضغط.');
  if (defense >= 75) insights.push('خط الدفاع يمنح المنتخب استقرارًا مهمًا في مباريات خروج المغلوب.');
  if (goalkeeper >= 75) insights.push('مركز حراسة المرمى نقطة قوة قد تصبح حاسمة في المباريات المتقاربة وركلات الترجيح.');
  if ((team.worldCupLegacy || 50) >= 80) insights.push('الإرث المونديالي والخبرة التاريخية عنصر مهم في إدارة الضغط واللحظات الكبيرة.');
  if (insights.length === 0) insights.push('القراءة الحالية مبنية على التصنيف، جودة القائمة، الزخم، والإحصائيات المتاحة داخل قاعدة البيانات.');
  return insights.slice(0, 5);
}

function getTacticalRisks(team: TeamOverviewTeam, players: TeamOverviewPlayer[]) {
  const risks: string[] = [];
  const attack = getLineStrength(players, 'FWD');
  const midfield = getLineStrength(players, 'MID');
  const defense = getLineStrength(players, 'DEF');
  const goalkeeper = getLineStrength(players, 'GK');
  const injuries = Number(team.injuries ?? 0);
  if (attack && attack < 60) risks.push('الإنتاج الهجومي يحتاج مراقبة؛ ضعف الحسم قد يقلل فرص المنتخب أمام دفاعات منظمة.');
  if (midfield && midfield < 60) risks.push('وسط الملعب قد يعاني أمام الضغط العالي أو المنتخبات التي تملك كثافة في العمق.');
  if (defense && defense < 60) risks.push('الخط الخلفي قد يكون نقطة استهداف خصوصًا أمام المنتخبات السريعة في التحولات.');
  if (goalkeeper && goalkeeper < 60) risks.push('مركز الحراسة يحتاج متابعة لأنه قد يؤثر بقوة على المباريات المتقاربة.');
  if (injuries > 0) risks.push('ملف الإصابات يحتاج تحديثًا مستمرًا لأنه قد يغير قوة التشكيل الأساسي.');
  if ((team.fifaRank || 50) > 35) risks.push('التصنيف العالمي خارج النخبة يجعل هامش الخطأ أقل أمام المنتخبات الأعلى جودة.');
  if (risks.length === 0) risks.push('لا توجد إشارة خطر كبيرة من البيانات الحالية، لكن يجب مراجعة الإصابات والقائمة الرسمية قبل كل مباراة.');
  return risks.slice(0, 4);
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
      const hasReadableTitle = possibleTitle.length >= 3 && possibleTitle.length <= 60 && !/[.!؟]$/.test(possibleTitle);
      return {
        title: hasReadableTitle ? possibleTitle : `ملاحظة تحليلية ${index + 1}`,
        content: hasReadableTitle ? block.slice(colonIndex + 1).trim() : block,
      };
    });
}

function HighlightedReportText({ text }: { text: string }) {
  const marker = 'غير متوفر في المصادر';
  const parts = text.split(marker);

  if (parts.length === 1) {
    return <>{text}</>;
  }

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

function MetricCard({ label, value, hint, icon, accent = 'text-primary', source }: { label: string; value: string | number; hint?: string; icon: ReactNode; accent?: string; source?: string; }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
      <div className={`mb-2 flex items-center gap-2 text-xs font-bold ${accent}`}>{icon}{label}</div>
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
      {source && <div className="mt-2 inline-flex rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-gray-400">المصدر: {source}</div>}
    </div>
  );
}

function PillarBar({ label, value, icon, source }: { label: string; value: number; icon: ReactNode; source?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-2 font-black text-white">{icon}{label}</span>
        <span className="font-black text-gray-300 tabular-nums">{safeValue.toFixed(0)}/100</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/50"><div className="h-full rounded-full bg-primary" style={{ width: `${safeValue}%` }} /></div>
      {source && <div className="mt-2 text-[10px] font-bold text-gray-500">{source}</div>}
    </div>
  );
}

function SourceMetricCard({ metric }: { metric: SourcedMetric }) {
  const source = getSourceByKey(metric.sourceKey);
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div><div className="text-xs font-black text-primary">{metric.label}</div><div className="mt-1 text-2xl font-black text-white tabular-nums">{metric.value}</div></div>
        <span className="shrink-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-black text-gray-300">{getSourceBadge(metric.confidence)}</span>
      </div>
      <p className="text-xs leading-5 text-gray-400">{metric.note}</p>
      {source && <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-gray-500"><Database size={13} /> {source.label}</div>}
    </div>
  );
}

function SourceRegistry() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {TEAM_INTELLIGENCE_SOURCES.map((source) => (
        <div key={source.key} className={`rounded-2xl border p-4 ${source.connected ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-yellow-400/15 bg-yellow-400/[0.04]'}`}>
          <div className="mb-2 flex items-start justify-between gap-2"><h4 className="text-sm font-black text-white">{source.label}</h4><span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${source.connected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-yellow-400/10 text-yellow-300'}`}>{source.connected ? 'متصل' : 'غير متصل'}</span></div>
          <p className="text-xs leading-5 text-gray-400">{source.description}</p>
          {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-primary hover:text-white">المصدر <ExternalLink size={12} /></a>}
        </div>
      ))}
    </div>
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
  const confidence = normalizeConfidence(report.confidence);
  const tacticalTags = report.tacticalTags || [];
  const strengths = report.strengths || [];
  const weaknesses = report.weaknesses || [];
  return (
    <article className="rounded-3xl border border-primary/10 bg-primary/[0.04] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
        <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-primary">{getSourceBadge(confidence)}</span>
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
          {!!strengths.length && <div><div className="mb-2 text-xs font-black text-emerald-300">نقاط قوة</div><ul className="space-y-1 text-xs leading-5 text-gray-300">{strengths.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
          {!!weaknesses.length && <div><div className="mb-2 text-xs font-black text-red-300">نقاط ضعف</div><ul className="space-y-1 text-xs leading-5 text-gray-300">{weaknesses.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}</ul></div>}
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
      <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="text-gray-500">{formatDate(match.matchDate)}</span><span className={`rounded-lg px-2 py-1 font-black ${isLive ? 'bg-primary/10 text-primary' : isFinished ? 'bg-success/10 text-success' : 'bg-white/5 text-gray-400'}`}>{isLive ? 'مباشرة' : isFinished ? 'انتهت' : 'قادمة'}</span></div>
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><AssetImage image={opponent?.image || ''} type="TEAM" name={opponent?.name || 'Opponent'} width={38} height={38} className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-black text-white">ضد {opponent?.name || '-'}</div><div className="text-xs text-gray-500">{match.stage === 'group' ? 'دور المجموعات' : 'مرحلة إقصائية / مؤثرة'}</div></div></div>{(isFinished || isLive) ? <div className="text-xl font-black text-primary tabular-nums">{gf} - {ga}</div> : <div className="text-xs font-black text-gray-500">VS</div>}</div>
    </Link>
  );
}

function PlayerCard({ player }: { player: TeamOverviewPlayer }) {
  return (
    <Link href={`/asset/${player.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4 transition hover:border-primary/30 hover:bg-white/[0.07]">
      <div className="flex min-w-0 items-center gap-3"><AssetImage image={player.image || ''} type="PLAYER" name={player.name} width={42} height={42} className="h-11 w-11 rounded-2xl object-cover" /><div className="min-w-0"><div className="truncate font-black text-white">{player.name}</div><div className="text-xs text-gray-500">{player.position || '—'} {player.age ? `• ${player.age} سنة` : ''}</div></div></div>
      <div className="text-left"><div className="text-lg font-black text-primary tabular-nums">{Math.round(player.score || 0)}</div><div className="text-[10px] font-bold text-gray-500">Score</div></div>
    </Link>
  );
}

export default function TeamOverviewPanel({ team }: { team: TeamOverviewTeam }) {
  if (!team || team.type !== 'TEAM') return null;

  const players = team.players || [];
  const reports = team.intelligenceReports || [];
  const teamPower = getTeamPower(team, players);
  const avgPlayerScore = getAvgPlayerScore(players);
  const attackScore = getLineStrength(players, 'FWD') || Math.round(team.fundamental || team.score || 50);
  const midfieldScore = getLineStrength(players, 'MID') || Math.round(team.fundamental || team.score || 50);
  const defenseScore = getLineStrength(players, 'DEF') || Math.round(team.fundamental || team.score || 50);
  const goalkeeperScore = getLineStrength(players, 'GK') || Math.round(team.fundamental || team.score || 50);
  const sourcedMetrics = buildTeamSourcedMetrics(team, players, { attack: attackScore, midfield: midfieldScore, defense: defenseScore, goalkeeper: goalkeeperScore, teamPower, avgPlayerScore });
  const technical = technicalInsights(team, players);
  const risks = getTacticalRisks(team, players);
  const topPlayers = [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 6);
  const matches = [...(team.homeMatches || []), ...(team.awayMatches || [])].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const upcomingMatches = matches.filter((m) => m.status !== 'FINISHED').slice(0, 4);
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED').slice(-3);
  const news = team.marketNews || [];

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4"><AssetImage image={team.image || ''} type="TEAM" name={team.name} width={78} height={78} className="h-20 w-20 rounded-3xl border border-white/10 bg-black/30 object-cover" /><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">SOURCED FOOTBALL INTELLIGENCE</span><span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">FIFA #{team.fifaRank || '-'}</span>{team.group && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">المجموعة {team.group}</span>}{team.continent && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{team.continent}</span>}</div><h2 className="text-2xl font-black text-white md:text-3xl">الملف الفني الموثق لمنتخب {team.name}</h2><p className="mt-1 max-w-4xl text-sm leading-relaxed text-gray-400">{getTeamStyle(team, players)} كل مؤشر في هذه الصفحة يحمل مصدرًا أو يوضح أنه تقدير داخلي عند غياب البيانات المرخصة.</p></div></div>
          <div className="flex flex-wrap gap-2"><Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المجموعات</Link><Link href="/matches" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">المباريات</Link></div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="القوة الفنية" value={`${teamPower}/100`} hint="نموذج داخلي مركب" source="MC PRIME Model" icon={<Trophy size={16} />} /><MetricCard label="متوسط اللاعبين" value={avgPlayerScore ? `${avgPlayerScore}/100` : '—'} hint="من اللاعبين المرتبطين" source={players.length ? 'API/DB Players' : 'غير مكتمل'} icon={<Users size={16} />} accent="text-accent" /><MetricCard label="تصنيف FIFA" value={team.fifaRank ? `#${team.fifaRank}` : '—'} hint="مؤشر رسمي" source="FIFA" icon={<Target size={16} />} accent="text-yellow-300" /><MetricCard label="الخبرة المونديالية" value={`${team.participations || 0}`} hint={`Legacy ${Math.round(team.worldCupLegacy || 50)}/100`} source="World Cup history" icon={<History size={16} />} accent="text-success" /></div>

        <div className="mb-5 rounded-3xl border border-primary/10 bg-black/25 p-5">
          <h3 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><Newspaper size={20} className="text-primary" /> التقارير الفنية الموثقة</h3>
          <p className="mb-4 text-xs leading-6 text-gray-500">هذا القسم يقرأ من جدول TeamIntelligenceReport، ويظهر فقط تقارير لها مصدر ودرجة ثقة. عند عدم وجود تقارير، تبقى الصفحة على مؤشرات قاعدة البيانات والنموذج الداخلي.</p>
          {reports.length ? <div className="grid gap-4 xl:grid-cols-2">{reports.map((report) => <IntelligenceReportCard key={report.id} report={report} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-gray-400">لا توجد تقارير موثقة مزروعة لهذا المنتخب بعد. أضف تقارير من FIFA/الاتحاد الرسمي/API/تحليل محرر داخل جدول TeamIntelligenceReport لتظهر هنا.</div>}
        </div>

        <div className="mb-5 rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Database size={20} className="text-primary" /> لوحة المصادر والثقة</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{sourcedMetrics.map((metric) => <SourceMetricCard key={metric.key} metric={metric} />)}</div></div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><div className="space-y-5"><div className="rounded-3xl border border-white/5 bg-black/25 p-5"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl font-black text-white"><Activity size={20} className="text-primary" /> قوة الخطوط</h3><p className="mt-1 text-xs text-gray-500">مصدرها اللاعبون المرتبطون ومراكزهم، أو النموذج الداخلي عند نقص البيانات.</p></div><span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{players.length ? 'API/DB' : 'ESTIMATE'}</span></div><div className="grid gap-3 md:grid-cols-2"><PillarBar label="الهجوم" value={attackScore} source={players.length ? 'Players by position' : 'Internal estimate'} icon={<Goal size={15} className="text-primary" />} /><PillarBar label="الوسط" value={midfieldScore} source={players.length ? 'Players by position' : 'Internal estimate'} icon={<Zap size={15} className="text-primary" />} /><PillarBar label="الدفاع" value={defenseScore} source={players.length ? 'Players by position' : 'Internal estimate'} icon={<Shield size={15} className="text-primary" />} /><PillarBar label="حراسة المرمى" value={goalkeeperScore} source={players.length ? 'Players by position' : 'Internal estimate'} icon={<FileCheck2 size={15} className="text-primary" />} /></div></div><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5"><h3 className="mb-4 flex items-center gap-2 text-lg font-black text-emerald-300"><Sparkles size={18} /> استنتاجات فنية</h3><div className="space-y-3">{technical.map((insight, index) => <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300" /><p>{insight}</p></div>)}</div><p className="mt-4 text-[11px] leading-5 text-gray-500">هذه استنتاجات مشتقة من البيانات المتاحة وليست اقتباسًا مباشرًا من Opta أو StatsBomb.</p></div><div className="rounded-3xl border border-red-400/10 bg-red-400/[0.04] p-5"><h3 className="mb-4 flex items-center gap-2 text-lg font-black text-red-300"><Shield size={18} /> مخاطر فنية</h3><div className="space-y-3">{risks.map((risk, index) => <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-300" /><p>{risk}</p></div>)}</div><p className="mt-4 text-[11px] leading-5 text-gray-500">ملف الإصابات والتشكيل الرسمي يحتاجان مصدرًا رسميًا متصلًا قبل اعتباره نهائيًا.</p></div></div></div><div className="space-y-5"><div className="rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Users size={20} className="text-primary" /> أسماء بارزة في القائمة</h3>{topPlayers.length ? <div className="space-y-3">{topPlayers.map((player) => <PlayerCard key={player.id} player={player} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-gray-500">لم يتم ربط قائمة لاعبين كافية بهذا المنتخب بعد.</div>}<p className="mt-3 text-[11px] leading-5 text-gray-500">مصدر القائمة: قاعدة البيانات بعد مزامنة مزود اللاعبين المتصل. لا تعني هذه القائمة اختيار نجم أبرز إلا عند وجود مصدر صريح.</p></div><div className="rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><CalendarDays size={20} className="text-primary" /> المباريات المؤثرة</h3>{(upcomingMatches.length || finishedMatches.length) ? <div className="space-y-3">{[...finishedMatches, ...upcomingMatches].slice(0, 5).map((match) => <MatchCard key={match.id} match={match} teamId={team.id} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-gray-500">لا توجد مباريات مرتبطة حاليًا بهذا المنتخب.</div>}<p className="mt-3 text-[11px] leading-5 text-gray-500">مصدر المباريات: football-data.org عند تشغيل مزامنة كأس العالم.</p></div></div></div>

        <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Database size={20} className="text-primary" /> سجل المصادر المتاحة وغير المتصلة</h3><SourceRegistry /></div>
        {news.length > 0 && <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Newspaper size={20} className="text-primary" /> أخبار وتحليلات مرتبطة بالمنتخب</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{news.slice(0, 6).map((item) => <div key={item.id || item.title || item.titleAr} className="rounded-2xl border border-white/5 bg-white/5 p-4"><div className="mb-2 text-xs text-gray-500">{formatDate(item.publishedAt)}</div><h4 className="font-black text-white">{item.title || item.titleAr}</h4>{item.summary && <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.summary}</p>}</div>)}</div></div>}
      </div>
    </section>
  );
}
