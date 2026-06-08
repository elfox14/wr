import type { ReactNode } from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, ArrowRight, BarChart3, CalendarDays, Flame, Goal, History, Newspaper, Shield, Sparkles, Target, Trophy, Users, Zap } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type TeamAnalysisPanelProps = {
  team: any;
};

type PitchPlayer = {
  id: string;
  name: string;
  image?: string | null;
  position?: string | null;
  marketPrice?: number | null;
  current_price?: number | null;
  score?: number | null;
  lastPerformanceRating?: number | null;
};

function formatPrice(value: number | null | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()}¢`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPremiumDiscount(team: any) {
  const marketPrice = Number(team.marketPrice ?? team.current_price ?? 0);
  const fairValue = Number(team.fairValue ?? team.current_price ?? marketPrice);
  return fairValue > 0 ? ((marketPrice - fairValue) / fairValue) * 100 : 0;
}

function getTeamPower(team: any) {
  return Math.round(
    ((team.score ?? 50) * 0.3) +
    ((team.fundamental ?? 50) * 0.25) +
    ((team.worldCupLegacy ?? 50) * 0.2) +
    ((team.momentum ?? 50) * 0.15) +
    ((team.marketDemand ?? 50) * 0.1)
  );
}

function getVolatility(team: any) {
  if (team.volatilityScore !== null && team.volatilityScore !== undefined) return Number(team.volatilityScore);
  if (team.riskIndex !== null && team.riskIndex !== undefined) return Number(team.riskIndex) * 100;
  return 50;
}

function getTeamStyle(team: any) {
  const momentum = Number(team.momentum ?? 50);
  const volatility = getVolatility(team);
  const legacy = Number(team.worldCupLegacy ?? 50);

  if (momentum >= 70 && legacy >= 75) return 'منتخب هجومي بثقة عالية وخبرة مونديالية واضحة.';
  if (momentum >= 70) return 'منتخب في حالة زخم جيدة، مناسب للمتابعة قبل المباريات المهمة.';
  if (volatility >= 70) return 'منتخب عالي التقلب؛ نتائجه أو أخباره قد تسبب حركة سعرية قوية.';
  if (legacy >= 80) return 'منتخب صاحب إرث كبير، قيمته لا تعتمد فقط على المباراة القادمة بل على الثقة التاريخية.';
  return 'منتخب متوازن، يحتاج مراقبة الزخم والطلب قبل اتخاذ قرار التداول.';
}

function getAvgPlayerScore(players: any[]) {
  if (!players.length) return 0;
  return Math.round(players.reduce((sum, player) => sum + Number(player.score || 0), 0) / players.length);
}

function getSquadLineStrength(players: any[], position: string) {
  const filtered = players.filter((player) => player.position === position);
  if (!filtered.length) return 0;
  return Math.round(filtered.reduce((sum, player) => sum + Number(player.score || 0), 0) / filtered.length);
}

function getTechnicalInsights(team: any, players: any[]) {
  const insights: string[] = [];
  const avgPlayerScore = getAvgPlayerScore(players);
  const attack = getSquadLineStrength(players, 'FWD');
  const midfield = getSquadLineStrength(players, 'MID');
  const defense = getSquadLineStrength(players, 'DEF');

  if ((team.fifaRank || 999) <= 10) insights.push('تصنيف FIFA قوي، ما يمنح المنتخب أساسًا فنيًا جيدًا قبل البطولة.');
  if (avgPlayerScore >= 80) insights.push('جودة اللاعبين مرتفعة، والتشكيلة تملك عمقًا يسمح بتغيير شكل المباراة.');
  if (attack >= 80) insights.push('الخط الأمامي قوي، وقد يكون مصدر الزخم الأكبر في السوق عند تسجيل الأهداف.');
  if (midfield >= 80) insights.push('وسط الملعب هو نقطة قوة واضحة، ما يدعم السيطرة وصناعة الفرص.');
  if (defense >= 80) insights.push('الدفاع مستقر نسبيًا، وهذا يرفع ثقة المستخدمين في مباريات خروج المغلوب.');
  if ((team.worldCupLegacy || 50) >= 80) insights.push('الإرث المونديالي مرتفع، ويؤثر على ثقة الجمهور حتى قبل بداية النتائج.');
  if (insights.length === 0) insights.push('التحليل الفني يعتمد على جودة اللاعبين، تصنيف FIFA، الإرث، والزخم الحالي المتاح في قاعدة البيانات.');

  return insights.slice(0, 4);
}

function getMarketInsights(team: any, premiumDiscount: number) {
  const insights: string[] = [];

  if (premiumDiscount <= -5) insights.push('السعر أقل من القيمة العادلة، ما يجعله مرشحًا للمراقبة كأصل منتخب.');
  else if (premiumDiscount >= 10) insights.push('المنتخب يتداول بعلاوة واضحة، لذلك يجب متابعة الأخبار والمباريات القادمة.');
  else insights.push('السعر قريب من القيمة العادلة، والزخم أو نتائج المباريات قد تحدد الاتجاه القادم.');

  if ((team.marketDemand || 50) >= 70) insights.push('الطلب السوقي مرتفع، ويعكس اهتمامًا واضحًا من المستخدمين بهذا المنتخب.');
  if ((team.momentum || 50) >= 70) insights.push('زخم المنتخب مرتفع، وقد يتفاعل السعر بقوة مع أي فوز أو خبر إيجابي.');
  if (getVolatility(team) >= 70) insights.push('التقلب مرتفع؛ نتائج المنتخب قد تصنع حركة سعرية كبيرة.');
  if ((team.ownersCount || 0) > 0) insights.push(`يمتلك هذا الأصل ${team.ownersCount} مستخدمًا داخل المنصة، ما يعطيه نشاطًا سوقيًا أوضح.`);

  return insights.slice(0, 4);
}

function groupPlayersByPosition(players: PitchPlayer[]) {
  const byPosition = {
    GK: players.filter((p) => p.position === 'GK'),
    DEF: players.filter((p) => p.position === 'DEF'),
    MID: players.filter((p) => p.position === 'MID'),
    FWD: players.filter((p) => p.position === 'FWD'),
  };

  const sortBest = (items: PitchPlayer[]) => [...items].sort((a, b) => Number(b.score || b.marketPrice || b.current_price || 0) - Number(a.score || a.marketPrice || a.current_price || 0));

  const gk = sortBest(byPosition.GK).slice(0, 1);
  const def = sortBest(byPosition.DEF).slice(0, 4);
  const mid = sortBest(byPosition.MID).slice(0, 3);
  const fwd = sortBest(byPosition.FWD).slice(0, 3);

  const selectedIds = new Set([...gk, ...def, ...mid, ...fwd].map((p) => p.id));
  const rest = sortBest(players.filter((p) => !selectedIds.has(p.id))).slice(0, Math.max(0, 11 - selectedIds.size));
  const all = [...gk, ...def, ...mid, ...fwd, ...rest];

  return {
    GK: all.filter((p) => p.position === 'GK').slice(0, 1),
    DEF: all.filter((p) => p.position === 'DEF').slice(0, 4),
    MID: all.filter((p) => p.position === 'MID').slice(0, 3),
    FWD: all.filter((p) => p.position === 'FWD').slice(0, 3),
    OTHER: all.filter((p) => !['GK', 'DEF', 'MID', 'FWD'].includes(String(p.position))),
  };
}

function MetricCard({ label, value, hint, icon, accent = 'text-primary' }: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
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

function PillarBar({ label, value, color = 'bg-primary' }: { label: string; value: number; color?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-bold text-white">{label}</span>
        <span className="font-black text-gray-300 tabular-nums">{safeValue.toFixed(0)}/100</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/50">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function EmptyNotice({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-gray-400">
      <AlertCircle className="mb-2 text-gray-500" size={18} />
      {text}
    </div>
  );
}

function PitchPlayerCard({ player }: { player: PitchPlayer }) {
  return (
    <Link href={`/asset/${player.id}`} className="group flex min-w-[84px] flex-col items-center text-center">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/20 bg-black/70 shadow-lg transition group-hover:scale-110 group-hover:border-primary">
        <AssetImage image={player.image || ''} type="PLAYER" name={player.name} width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
        {player.lastPerformanceRating && (
          <span className="absolute -bottom-1 -left-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-black text-black">
            {Math.round(player.lastPerformanceRating)}
          </span>
        )}
      </div>
      <div className="mt-1 max-w-[86px] truncate text-[11px] font-black text-white group-hover:text-primary">{player.name}</div>
      <div className="text-[9px] text-gray-400">{formatPrice(player.marketPrice ?? player.current_price)}</div>
    </Link>
  );
}

function PitchLine({ players }: { players: PitchPlayer[] }) {
  if (players.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
      {players.map((player) => <PitchPlayerCard key={player.id} player={player} />)}
    </div>
  );
}

function TeamPitch({ players }: { players: PitchPlayer[] }) {
  const lines = groupPlayersByPosition(players);

  if (players.length === 0) {
    return <EmptyNotice text="لا توجد تشكيلة لاعبين مرتبطة بهذا المنتخب بعد." />;
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.28),rgba(2,44,34,0.88))] p-4 shadow-inner md:p-6">
      <div className="absolute inset-4 rounded-[1.5rem] border-2 border-white/15" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/15" />
      <div className="absolute left-1/2 top-0 h-20 w-40 -translate-x-1/2 rounded-b-full border-x-2 border-b-2 border-white/15" />
      <div className="absolute bottom-0 left-1/2 h-20 w-40 -translate-x-1/2 rounded-t-full border-x-2 border-t-2 border-white/15" />

      <div className="relative z-10 flex min-h-[540px] flex-col justify-between py-5">
        <PitchLine players={lines.FWD} />
        <PitchLine players={lines.MID} />
        <PitchLine players={lines.DEF} />
        <PitchLine players={lines.GK.length > 0 ? lines.GK : lines.OTHER.slice(0, 1)} />
      </div>
    </div>
  );
}

function MatchCard({ match, teamId }: { match: any; teamId: string }) {
  const isHome = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const isFinished = match.status === 'FINISHED';
  const isLive = ['IN_PLAY', 'LIVE'].includes(match.status);

  return (
    <Link href={`/matches/${match.id}`} className="block rounded-2xl border border-white/5 bg-white/5 p-4 hover:border-primary/30">
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
            <div className="text-xs text-gray-500">{match.stage === 'group' ? 'دور المجموعات' : 'التصفيات'}</div>
          </div>
        </div>
        {(isFinished || isLive) ? (
          <div className="text-xl font-black text-primary tabular-nums">{match.homeScore} - {match.awayScore}</div>
        ) : (
          <div className="text-xs font-black text-gray-500">VS</div>
        )}
      </div>
    </Link>
  );
}

export function TeamAnalysisPanel({ team }: TeamAnalysisPanelProps) {
  if (!team || team.type !== 'TEAM') return null;

  const players = [...(team.players || [])].sort((a: any, b: any) => Number(b.score || b.marketPrice || b.current_price || 0) - Number(a.score || a.marketPrice || a.current_price || 0));
  const marketPrice = Number(team.marketPrice ?? team.current_price ?? 0);
  const fairValue = Number(team.fairValue ?? team.current_price ?? marketPrice);
  const premiumDiscount = getPremiumDiscount(team);
  const teamPower = getTeamPower(team);
  const technicalInsights = getTechnicalInsights(team, players);
  const marketInsights = getMarketInsights(team, premiumDiscount);
  const matches = [...(team.homeMatches || []), ...(team.awayMatches || [])].sort((a: any, b: any) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const upcomingMatches = matches.filter((m: any) => m.status !== 'FINISHED').slice(0, 4);
  const latestMatches = matches.filter((m: any) => m.status === 'FINISHED').slice(-3).reverse();
  const news = team.marketNews || [];
  const avgPlayerScore = getAvgPlayerScore(players);
  const attackScore = getSquadLineStrength(players, 'FWD') || Math.round(team.fundamental || team.score || 50);
  const midfieldScore = getSquadLineStrength(players, 'MID') || Math.round(team.fundamental || team.score || 50);
  const defenseScore = getSquadLineStrength(players, 'DEF') || Math.round(team.fundamental || team.score || 50);
  const goalkeeperScore = getSquadLineStrength(players, 'GK') || Math.round(team.fundamental || team.score || 50);

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4 pt-4">
      <div className="rounded-3xl border border-primary/10 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <AssetImage image={team.image} type="TEAM" name={team.name} width={78} height={78} className="h-20 w-20 rounded-3xl border border-white/10 bg-black/30 object-cover" />
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">TEAM ANALYSIS CENTER</span>
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">FIFA #{team.fifaRank || '-'}</span>
                {team.group && <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">المجموعة {team.group}</span>}
              </div>
              <h2 className="text-2xl font-black text-white md:text-3xl">تحليل المنتخب: {team.name}</h2>
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-gray-400">
                {getTeamStyle(team)} الصفحة مقسومة إلى تحليل فني رياضي وتحليل سوقي لسهم المنتخب الافتراضي.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">المجموعات</Link>
            <Link href="/matches" className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary hover:bg-primary hover:text-black">المباريات</Link>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black text-white"><Trophy size={20} className="text-primary" /> التحليل الفني للمنتخب</h3>
                <p className="mt-1 text-xs text-gray-500">تصنيف، جودة لاعبين، قوة الخطوط، تشكيل، مباريات ونتائج.</p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">SPORT</span>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <MetricCard label="قوة المنتخب" value={`${teamPower}/100`} hint="مزيج فني وسوقي" icon={<Trophy size={16} />} />
              <MetricCard label="متوسط اللاعبين" value={avgPlayerScore ? `${avgPlayerScore}/100` : '—'} hint="حسب لاعبي القائمة" icon={<Users size={16} />} accent="text-accent" />
              <MetricCard label="تصنيف FIFA" value={team.fifaRank ? `#${team.fifaRank}` : '—'} hint={team.continent || 'غير متاح'} icon={<Target size={16} />} accent="text-yellow-300" />
              <MetricCard label="إرث كأس العالم" value={`${Math.round(team.worldCupLegacy || 50)}/100`} hint={`${team.participations || 0} مشاركات`} icon={<History size={16} />} accent="text-success" />
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-4 flex items-center gap-2 font-black text-white"><Activity size={16} className="text-primary" /> قوة الخطوط</h4>
              <div className="space-y-4">
                <PillarBar label="الهجوم" value={attackScore} color="bg-danger" />
                <PillarBar label="الوسط" value={midfieldScore} color="bg-primary" />
                <PillarBar label="الدفاع" value={defenseScore} color="bg-success" />
                <PillarBar label="حراسة المرمى" value={goalkeeperScore} color="bg-yellow-300" />
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><Sparkles size={16} className="text-primary" /> قراءة فنية</h4>
              <div className="space-y-3">
                {technicalInsights.map((insight, index) => (
                  <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 font-black text-white"><Goal size={16} className="text-emerald-300" /> التشكيلة على الملعب</h4>
                <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-gray-300">أفضل 11 حسب البيانات</span>
              </div>
              <TeamPitch players={players} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-black text-white"><BarChart3 size={20} className="text-accent" /> تحليل سهم المنتخب</h3>
                <p className="mt-1 text-xs text-gray-500">القيمة العادلة، الزخم، الطلب، الأخبار، والمخاطر السوقية.</p>
              </div>
              <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary">MARKET</span>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <MetricCard label="السعر الحالي" value={formatPrice(marketPrice)} hint="Market Price" icon={<BarChart3 size={16} />} accent="text-primary" />
              <MetricCard label="القيمة العادلة" value={formatPrice(fairValue)} hint="Fair Value" icon={<Target size={16} />} accent="text-accent" />
              <MetricCard label="خصم / علاوة" value={`${premiumDiscount > 0 ? '+' : ''}${premiumDiscount.toFixed(1)}%`} hint={premiumDiscount <= 0 ? 'أقل أو قريب من العادلة' : 'يتداول بعلاوة'} icon={<Zap size={16} />} accent={premiumDiscount <= 0 ? 'text-success' : 'text-danger'} />
              <MetricCard label="الملاك" value={team.ownersCount || 0} hint="عدد المالكين" icon={<Users size={16} />} accent="text-yellow-300" />
              <MetricCard label="زخم المنتخب" value={`${Math.round(team.momentum || 50)}/100`} hint="يتأثر بالأخبار والمباريات" icon={<Flame size={16} />} accent="text-success" />
              <MetricCard label="التقلب" value={`${Math.round(getVolatility(team))}/100`} hint="حساسية السعر للأحداث" icon={<Shield size={16} />} accent={getVolatility(team) >= 70 ? 'text-danger' : 'text-yellow-300'} />
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><Sparkles size={16} className="text-primary" /> قراءة سوقية</h4>
              <div className="space-y-3">
                {marketInsights.map((insight, index) => (
                  <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-4 flex items-center gap-2 font-black text-white"><Activity size={16} className="text-accent" /> أعمدة السهم</h4>
              <div className="space-y-4">
                <PillarBar label="القوة الفنية" value={team.fundamental || team.score || 50} color="bg-primary" />
                <PillarBar label="إرث كأس العالم" value={team.worldCupLegacy || 50} color="bg-accent" />
                <PillarBar label="الشعبية" value={team.popularity || 50} color="bg-yellow-300" />
                <PillarBar label="الطلب السوقي" value={team.marketDemand || 50} color="bg-success" />
                <PillarBar label="الزخم" value={team.momentum || 50} color="bg-danger" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-4 flex items-center gap-2 font-black text-white"><Newspaper size={16} className="text-primary" /> أخبار مؤثرة</h4>
              {news.length === 0 ? (
                <EmptyNotice text="لا توجد أخبار مؤثرة مرتبطة بهذا المنتخب حاليًا." />
              ) : (
                <div className="space-y-3">
                  {news.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-white/5 bg-black/25 p-4">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <h5 className="font-black text-white">{item.titleAr}</h5>
                        <span className={Number(item.changePercent || 0) >= 0 ? 'text-xs font-black text-success' : 'text-xs font-black text-danger'}>{Number(item.changePercent || 0) > 0 ? '+' : ''}{Number(item.changePercent || 0).toFixed(1)}%</span>
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-500">{item.bodyAr}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><CalendarDays size={18} className="text-primary" /> المباريات القادمة</h3>
            {upcomingMatches.length === 0 ? <EmptyNotice text="لا توجد مباريات قادمة مرتبطة بهذا المنتخب." /> : <div className="space-y-3">{upcomingMatches.map((match: any) => <MatchCard key={match.id} match={match} teamId={team.id} />)}</div>}
          </div>

          <div className="rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Shield size={18} className="text-success" /> آخر النتائج</h3>
            {latestMatches.length === 0 ? <EmptyNotice text="لا توجد نتائج فعلية بعد. النتائج تظهر فقط بعد انتهاء المباريات." /> : <div className="space-y-3">{latestMatches.map((match: any) => <MatchCard key={match.id} match={match} teamId={team.id} />)}</div>}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-black text-white"><Users size={18} className="text-primary" /> قائمة اللاعبين</h3>
            <span className="text-xs text-gray-500">اضغط على أي لاعب لفتح تحليله الكامل</span>
          </div>
          {players.length === 0 ? (
            <EmptyNotice text="لا توجد قائمة لاعبين مرتبطة بهذا المنتخب." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="w-full whitespace-nowrap text-right text-sm">
                <thead className="bg-white/5 text-gray-400">
                  <tr>
                    <th className="p-4">اللاعب</th>
                    <th className="p-4 text-center">المركز</th>
                    <th className="p-4 text-center">السعر</th>
                    <th className="p-4 text-center">تقييم</th>
                    <th className="p-4 text-center">آخر أداء</th>
                    <th className="p-4 text-center">زخم</th>
                    <th className="p-4 text-left">تحليل</th>
                  </tr>
                </thead>
                <tbody>
                  {players.slice(0, 18).map((player: any) => (
                    <tr key={player.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <AssetImage image={player.image} type="PLAYER" name={player.name} width={40} height={40} className="h-11 w-11 rounded-xl border border-white/10 object-cover" />
                          <div>
                            <div className="font-black text-white">{player.name}</div>
                            <div className="text-xs text-gray-500">{player.club || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center"><span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">{player.position || '-'}</span></td>
                      <td className="p-4 text-center font-black text-white">{formatPrice(player.marketPrice ?? player.current_price)}</td>
                      <td className="p-4 text-center font-bold text-accent">{Math.round(player.score || 0)}</td>
                      <td className="p-4 text-center font-bold text-primary">{player.lastPerformanceRating ? Math.round(player.lastPerformanceRating) : '—'}</td>
                      <td className="p-4 text-center font-bold text-success">{Math.round(player.momentum || 50)}</td>
                      <td className="p-4 text-left">
                        <Link href={`/asset/${player.id}`} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:bg-primary/20">فتح <ArrowRight size={14} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
