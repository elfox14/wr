import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, FileText, Goal, ListChecks, Scale, Shield, Sparkles, Trophy, Users, XCircle, Zap } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import FbrefStatsPanel from '@/components/team/FbrefStatsPanel';
import TeamGroupTable from '@/components/team/TeamGroupTable';
import TeamHeroSnapshot from '@/components/team/TeamHeroSnapshot';
import TeamRadarChart from '@/components/team/TeamRadarChart';
import { decimal, formatDate, formatNumber, isBlank, isLive, isSnapshot, list, matches, normalize, performance } from '@/components/team/teamData';
import type { TeamAsset, TeamMatch, TeamPerformanceStats, TeamReport } from '@/components/team/teamPageTypes';

type Section = { title: string; content: string; report: TeamReport };

const AUTO_PROVIDERS = new Set(['MC_PRIME_AUTO']);
const AUTO_SOURCES = new Set(['MC PRIME Auto Intelligence Baseline']);

function parseSections(report: TeamReport): Section[] {
  if (!report.body) return [];
  return report.body
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const heading = block.match(/^#{1,4}\s*(.+?)\n([\s\S]+)$/);
      if (heading) return { title: heading[1].trim(), content: heading[2].trim(), report };
      const colonIndex = block.indexOf(':');
      const title = colonIndex > 0 ? block.slice(0, colonIndex).replace(/^[-*#\s]+/, '').trim() : `فقرة ${index + 1}`;
      const content = colonIndex > 0 ? block.slice(colonIndex + 1).trim() : block;
      return { title, content, report };
    })
    .filter((section) => !isBlank(section.content));
}

function allSections(reports: TeamReport[]) {
  return reports.flatMap(parseSections);
}

function findSection(sections: Section[], keywords: string[]) {
  const keys = keywords.map(normalize);
  return sections.find((section) => keys.some((key) => normalize(`${section.title} ${section.content}`).includes(key)))?.content || '';
}

function rating(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const v = Math.max(1, Math.min(10, Math.round(value * 10) / 10));
  return `${v.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}/10`;
}

function ratingRows(stats: TeamPerformanceStats | null, team: TeamAsset) {
  const squadCount = team.players?.length || 0;
  return [
    { label: 'الهجوم', value: stats ? rating(4 + stats.avgGoalsFor * 1.8) : '—', note: stats ? `معدل التسجيل: ${decimal(stats.avgGoalsFor)} هدف/مباراة.` : 'بانتظار عينة مباريات أكبر.' },
    { label: 'الدفاع', value: stats ? rating(8.2 - stats.avgGoalsAgainst * 1.35 + (stats.cleanSheets / stats.sampleSize)) : '—', note: stats ? `استقبل ${formatNumber(stats.goalsAgainst)} هدفًا وخرج بشباك نظيفة ${formatNumber(stats.cleanSheets)} مرة.` : 'بانتظار عينة مباريات أكبر.' },
    { label: 'الزخم', value: stats ? rating(4 + stats.wins * 1.05 + stats.draws * 0.35 - stats.losses * 0.25) : '—', note: stats ? `${formatNumber(stats.wins)} فوز، ${formatNumber(stats.draws)} تعادل، ${formatNumber(stats.losses)} خسارة.` : 'بانتظار نتائج محدثة.' },
    { label: 'اكتمال القائمة', value: squadCount ? rating(4.5 + Math.min(squadCount, 26) / 26 * 4.5) : '—', note: squadCount ? `القائمة تضم ${formatNumber(squadCount)} لاعبًا داخل المنصة.` : 'بانتظار اكتمال القائمة.' },
  ];
}

function playerSummary(team: TeamAsset) {
  const players = (team.players || []).filter((player) => player.name).slice(0, 10);
  if (!players.length) return '';
  return `القائمة الحالية تضم ${formatNumber(team.players?.length || players.length)} لاعبًا. من الأسماء الظاهرة: ${players.map((player) => `${player.name}${player.position ? ` (${player.position})` : ''}`).join('، ')}.`;
}

function Card({ icon, eyebrow, title, children }: { icon: ReactNode; eyebrow: string; title: string; children: ReactNode }) {
  if (typeof children === 'string' && isBlank(children)) return null;
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
      <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-black text-white/75">{icon}{eyebrow}</div>
      <h4 className="mb-3 text-lg font-black text-white">{title}</h4>
      <div className="text-sm leading-8 text-slate-200">{children}</div>
    </article>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-[11px] font-black text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-white tabular-nums">{value}</div></div>;
}

function RatingReasonTable({ rows }: { rows: ReturnType<typeof ratingRows> }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full min-w-[620px] text-right text-xs">
        <thead className="bg-black/35 text-slate-400"><tr><th className="px-4 py-3 font-black">البند</th><th className="px-4 py-3 font-black">التقييم</th><th className="px-4 py-3 font-black">السبب</th></tr></thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => <tr key={row.label} className="bg-white/[0.02] align-top"><td className="px-4 py-3 font-black text-white">{row.label}</td><td className="px-4 py-3 font-black text-primary tabular-nums">{row.value}</td><td className="px-4 py-3 text-slate-300">{row.note}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function MatchCard({ match, teamId }: { match: TeamMatch; teamId: string }) {
  const home = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
  const opponent = home ? match.awayTeam : match.homeTeam;
  const finished = match.status === 'FINISHED';
  const live = isLive(match);
  const gf = home ? match.homeScore : match.awayScore;
  const ga = home ? match.awayScore : match.homeScore;
  return (
    <Link href="/matches" className="block rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-primary/30 hover:bg-white/[0.07]">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{formatDate(match.matchDate, true)}</span><span className={`rounded-lg px-2 py-1 font-black ${live ? 'bg-primary/10 text-primary' : finished ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/5 text-slate-400'}`}>{live ? 'مباشرة' : finished ? 'انتهت' : 'قادمة'}</span></div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><AssetImage image={opponent?.image || ''} type="TEAM" name={opponent?.name || 'Opponent'} width={38} height={38} className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-black text-white">ضد {opponent?.name || '-'}</div><div className="text-xs text-slate-500">{match.stage === 'group' ? 'دور المجموعات' : 'مرحلة إقصائية'}</div></div></div>
        {(finished || live) ? <div className="text-2xl font-black text-white tabular-nums">{gf ?? 0}-{ga ?? 0}</div> : null}
      </div>
    </Link>
  );
}

function Profile({ team, reports }: { team: TeamAsset; reports: TeamReport[] }) {
  const profileReports = reports.filter((report) => !isSnapshot(report));
  const snapshots = reports.filter(isSnapshot);
  const profileSections = allSections(profileReports);
  const all = allSections(reports);
  const snapshotSections = allSections(snapshots);
  const stats = performance(team);
  const intro = profileReports.find((report) => !isBlank(report.summary))?.summary || reports.find((report) => !isBlank(report.summary))?.summary || '';
  const history = findSection(profileSections, ['السجل التاريخي', 'تاريخ كأس العالم', 'historical record', 'المشاركات', 'أفضل إنجاز']);
  const qualifying = findSection(profileSections, ['طريق التأهل', 'التصفيات', 'qualification', 'qualifying path', 'الجاهزية']);
  const squad = findSection(all, ['القائمة الحالية', 'قائمة المنتخب', 'current squad', 'أسماء بارزة', 'اللاعبون']) || playerSummary(team);
  const tactics = findSection(profileSections, ['الهوية التكتيكية', 'التحليل التكتيكي', 'style of play', 'pressing', 'بناء اللعب', 'الضغط', 'التحولات']);
  const form = findSection(profileSections, ['آخر النتائج', 'النتائج الأخيرة', 'recent form', 'آخر 5', 'form']);
  const current = findSection(snapshotSections, ['وضع المنتخب في المجموعة', 'تحليل الأداء بالأرقام', 'بطاقة المنتخب', 'القوة الهجومية']);
  const attack = findSection(all, ['القوة الهجومية', 'الهجوم', 'xg', 'التسديدات']);
  const defense = findSection(all, ['القوة الدفاعية', 'الدفاع', 'xga', 'الأهداف المستقبلة']);
  const midfield = findSection(all, ['وسط الملعب', 'الاستحواذ', 'التمرير', 'possession', 'passing']);
  const strengths = list(profileReports.flatMap((report) => report.strengths || [])) || findSection(profileSections, ['نقاط القوة', 'مميزات', 'strengths']);
  const weaknesses = list(profileReports.flatMap((report) => report.weaknesses || [])) || findSection(profileSections, ['نقاط الضعف', 'ما يحتاج متابعة', 'weaknesses']);

  return (
    <div className="space-y-5">
      <TeamHeroSnapshot team={team} />
      <TeamGroupTable team={team} />
      <TeamRadarChart team={team} />
      <FbrefStatsPanel team={team} />

      {intro && <section className="rounded-3xl border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(15,240,252,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6"><div className="mb-4 flex flex-wrap items-center gap-2"><span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">TEAM PROFILE</span>{team.code && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{team.code}</span>}{team.group && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">المجموعة {team.group}</span>}{team.continent && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{team.continent}</span>}</div><h3 className="text-2xl font-black text-white md:text-3xl">ملف منتخب {team.name}</h3><p className="mt-3 max-w-5xl text-sm leading-8 text-slate-300">{intro}</p></section>}

      <section className="grid gap-4 lg:grid-cols-2"><Card icon={<Trophy size={15} />} eyebrow="تاريخ" title="السجل في كأس العالم">{history}</Card><Card icon={<ClipboardList size={15} />} eyebrow="جاهزية" title="طريق التأهل والجاهزية">{qualifying}</Card></section>
      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><Card icon={<Users size={15} />} eyebrow="قائمة" title="القائمة الحالية وبنية الفريق">{squad}</Card><Card icon={<Scale size={15} />} eyebrow="تكتيك" title="الهوية التكتيكية وأسلوب اللعب">{tactics}</Card></section>
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><Card icon={<BarChart3 size={15} />} eyebrow="فورمة" title="النتائج الأخيرة ومؤشرات الجاهزية"><div className="space-y-4">{form && <p>{form}</p>}{stats ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatTile label="العينة" value={`${formatNumber(stats.sampleSize)} مباريات`} /><StatTile label="النتائج" value={`${formatNumber(stats.wins)}ف / ${formatNumber(stats.draws)}ت / ${formatNumber(stats.losses)}خ`} /><StatTile label="الأهداف" value={`${formatNumber(stats.goalsFor)} له / ${formatNumber(stats.goalsAgainst)} عليه`} /><StatTile label="شباك نظيفة" value={formatNumber(stats.cleanSheets)} /></div> : null}</div></Card><Card icon={<Sparkles size={15} />} eyebrow="البطولة الحالية" title="لقطة حالية من البطولة">{current}</Card></section>
      <section className="grid gap-4 md:grid-cols-3"><Card icon={<Goal size={15} />} eyebrow="هجوم" title="القوة الهجومية">{attack}</Card><Card icon={<Shield size={15} />} eyebrow="دفاع" title="القوة الدفاعية">{defense}</Card><Card icon={<Zap size={15} />} eyebrow="وسط" title="وسط الملعب والتحكم">{midfield}</Card></section>
      <section className="grid gap-4 lg:grid-cols-2"><Card icon={<CheckCircle2 size={15} />} eyebrow="قوة" title="نقاط القوة">{strengths}</Card><Card icon={<XCircle size={15} />} eyebrow="متابعة" title="نقاط تحتاج متابعة">{weaknesses}</Card></section>
      <Card icon={<ListChecks size={15} />} eyebrow="أسباب" title="أسباب التقييم المبدئي"><div className="overflow-x-auto"><RatingReasonTable rows={ratingRows(stats, team)} /></div></Card>
    </div>
  );
}

export default function TeamOverviewPanel({ team }: { team: TeamAsset }) {
  if (!team || team.type !== 'TEAM') return null;
  const reports = (team.intelligenceReports || []).filter((report) => !(report.provider && AUTO_PROVIDERS.has(report.provider)) && !AUTO_SOURCES.has(report.sourceName));
  const allTeamMatches = matches(team).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const shownMatches = [...allTeamMatches.filter((m) => m.status === 'FINISHED').slice(-3), ...allTeamMatches.filter((m) => m.status !== 'FINISHED').slice(0, 4)].slice(0, 6);
  const news = team.marketNews || [];

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <Profile team={team} reports={reports} />
        {shownMatches.length > 0 && <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><CalendarDays size={20} className="text-primary" /> المباريات المرتبطة</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{shownMatches.map((match) => <MatchCard key={match.id} match={match} teamId={team.id} />)}</div></div>}
        {news.length > 0 && <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5"><h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><FileText size={20} className="text-primary" /> أخبار وتحليلات مرتبطة بالمنتخب</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{news.slice(0, 6).map((item) => <div key={item.id || item.title || item.titleAr} className="rounded-2xl border border-white/5 bg-white/5 p-4"><div className="mb-2 text-xs text-slate-500">{formatDate(item.publishedAt)}</div><h4 className="font-black text-white">{item.title || item.titleAr}</h4>{item.summary && <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.summary}</p>}</div>)}</div></div>}
      </div>
    </section>
  );
}
