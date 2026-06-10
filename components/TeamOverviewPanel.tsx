import Link from 'next/link';
import { Activity, CalendarDays, FileCheck2, Flame, Goal, History, Newspaper, Shield, Sparkles, Target, Trophy, Users, Zap } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAvgPlayerScore(players: any[]) {
  if (!players.length) return 0;
  return Math.round(players.reduce((sum, player) => sum + Number(player.score || 0), 0) / players.length);
}

function getLinePlayers(players: any[], position: string) {
  return players.filter((player) => String(player.position || '').toUpperCase() === position);
}

function getLineStrength(players: any[], position: string) {
  const filtered = getLinePlayers(players, position);
  if (!filtered.length) return 0;
  return Math.round(filtered.reduce((sum, player) => sum + Number(player.score || 0), 0) / filtered.length);
}

function getTeamPower(team: any, players: any[]) {
  const avgPlayerScore = getAvgPlayerScore(players) || Number(team.score || 50);
  return Math.round(
    (Number(team.score || 50) * 0.35) +
    (avgPlayerScore * 0.30) +
    (Number(team.momentum ?? 50) * 0.20) +
    (Number(team.worldCupLegacy ?? 50) * 0.10) +
    (Number(team.harmony ?? 85) * 0.05)
  );
}

function getTeamStyle(team: any, players: any[]) {
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

function technicalInsights(team: any, players: any[]) {
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

function getTacticalRisks(team: any, players: any[]) {
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

function MetricCard({ label, value, hint, icon, accent = 'text-primary' }: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
      <div className={`mb-2 flex items-center gap-2 text-xs font-bold ${accent}`}>{icon}{label}</div>
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function PillarBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-2 font-black text-white">{icon}{label}</span>
        <span className="font-black text-gray-300 tabular-nums">{safeValue.toFixed(0)}/100</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/50">
        <div className="h-full rounded-full bg-primary" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function MatchCard({ match, teamId }: { match: any; teamId: string }) {
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
        <span className={`rounded-lg px-2 py-1 font-black ${isLive ? 'bg-primary/10 text-primary' : isFinished ? 'bg-success/10 text-success' : 'bg-white/5 text-gray-400'}`}>
          {isLive ? 'مباشرة' : isFinished ? 'انتهت' : 'قادمة'}
        </span>
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

function PlayerCard({ player }: { player: any }) {
  return (
    <Link href={`/asset/${player.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4 transition hover:border-primary/30 hover:bg-white/[0.07]">
      <div className="flex min-w-0 items-center gap-3">
        <AssetImage image={player.image || ''} type="PLAYER" name={player.name} width={42} height={42} className="h-11 w-11 rounded-2xl object-cover" />
        <div className="min-w-0">
          <div className="truncate font-black text-white">{player.name}</div>
          <div className="text-xs text-gray-500">{player.position || '—'} {player.age ? `• ${player.age} سنة` : ''}</div>
        </div>
      </div>
      <div className="text-left">
        <div className="text-lg font-black text-primary tabular-nums">{Math.round(player.score || 0)}</div>
        <div className="text-[10px] font-bold text-gray-500">Score</div>
      </div>
    </Link>
  );
}

export default function TeamOverviewPanel({ team }: { team: any }) {
  if (!team || team.type !== 'TEAM') return null;

  const players = team.players || [];
  const teamPower = getTeamPower(team, players);
  const avgPlayerScore = getAvgPlayerScore(players);
  const attackScore = getLineStrength(players, 'FWD') || Math.round(team.fundamental || team.score || 50);
  const midfieldScore = getLineStrength(players, 'MID') || Math.round(team.fundamental || team.score || 50);
  const defenseScore = getLineStrength(players, 'DEF') || Math.round(team.fundamental || team.score || 50);
  const goalkeeperScore = getLineStrength(players, 'GK') || Math.round(team.fundamental || team.score || 50);
  const technical = technicalInsights(team, players);
  const risks = getTacticalRisks(team, players);
  const topPlayers = [...players].sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 6);
  const matches = [...(team.homeMatches || []), ...(team.awayMatches || [])]
    .sort((a: any, b: any) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const upcomingMatches = matches.filter((m: any) => m.status !== 'FINISHED').slice(0, 4);
  const finishedMatches = matches.filter((m: any) => m.status === 'FINISHED').slice(-3);
  const news = team.marketNews || [];

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <AssetImage image={team.image} type="TEAM" name={team.name} width={78} height={78} className="h-20 w-20 rounded-3xl border border-white/10 bg-black/30 object-cover" />
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">FOOTBALL ANALYSIS CENTER</span>
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">FIFA #{team.fifaRank || '-'}</span>
                {team.group && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">المجموعة {team.group}</span>}
                {team.continent && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">{team.continent}</span>}
              </div>
              <h2 className="text-2xl font-black text-white md:text-3xl">الملف الفني لمنتخب {team.name}</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-gray-400">{getTeamStyle(team, players)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المجموعات</Link>
            <Link href="/matches" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">المباريات</Link>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="القوة الفنية" value={`${teamPower}/100`} hint="قائمة + زخم + خبرة" icon={<Trophy size={16} />} />
          <MetricCard label="متوسط اللاعبين" value={avgPlayerScore ? `${avgPlayerScore}/100` : '—'} hint="متوسط القائمة المتاحة" icon={<Users size={16} />} accent="text-accent" />
          <MetricCard label="تصنيف FIFA" value={team.fifaRank ? `#${team.fifaRank}` : '—'} hint="مؤشر رسمي للقوة العامة" icon={<Target size={16} />} accent="text-yellow-300" />
          <MetricCard label="الخبرة المونديالية" value={`${team.participations || 0}`} hint={`Legacy ${Math.round(team.worldCupLegacy || 50)}/100`} icon={<History size={16} />} accent="text-success" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-black text-white"><Activity size={20} className="text-primary" /> قوة الخطوط</h3>
                  <p className="mt-1 text-xs text-gray-500">قراءة رقمية من اللاعبين المتاحين داخل قاعدة البيانات.</p>
                </div>
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">SPORT DATA</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <PillarBar label="الهجوم" value={attackScore} icon={<Goal size={15} className="text-primary" />} />
                <PillarBar label="الوسط" value={midfieldScore} icon={<Zap size={15} className="text-primary" />} />
                <PillarBar label="الدفاع" value={defenseScore} icon={<Shield size={15} className="text-primary" />} />
                <PillarBar label="حراسة المرمى" value={goalkeeperScore} icon={<FileCheck2 size={15} className="text-primary" />} />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-emerald-300"><Sparkles size={18} /> نقاط القوة الفنية</h3>
                <div className="space-y-3">
                  {technical.map((insight, index) => (
                    <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                      <p>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-red-400/10 bg-red-400/[0.04] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-red-300"><Shield size={18} /> مخاطر فنية تحتاج متابعة</h3>
                <div className="space-y-3">
                  {risks.map((risk, index) => (
                    <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-300" />
                      <p>{risk}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Users size={20} className="text-primary" /> اللاعبون المؤثرون</h3>
              {topPlayers.length ? (
                <div className="space-y-3">
                  {topPlayers.map((player: any) => <PlayerCard key={player.id} player={player} />)}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-gray-500">لم يتم ربط قائمة لاعبين كافية بهذا المنتخب بعد.</div>
              )}
            </div>

            <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><CalendarDays size={20} className="text-primary" /> المباريات المؤثرة</h3>
              {(upcomingMatches.length || finishedMatches.length) ? (
                <div className="space-y-3">
                  {[...finishedMatches, ...upcomingMatches].slice(0, 5).map((match: any) => <MatchCard key={match.id} match={match} teamId={team.id} />)}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-gray-500">لا توجد مباريات مرتبطة حاليًا بهذا المنتخب.</div>
              )}
            </div>
          </div>
        </div>

        {news.length > 0 && (
          <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Newspaper size={20} className="text-primary" /> أخبار وتحليلات مرتبطة بالمنتخب</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {news.slice(0, 6).map((item: any) => (
                <div key={item.id || item.title} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="mb-2 text-xs text-gray-500">{formatDate(item.publishedAt)}</div>
                  <h4 className="font-black text-white">{item.title}</h4>
                  {item.summary && <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
