import Link from 'next/link';
import { Activity, BarChart3, CalendarDays, Flame, History, Newspaper, Shield, Sparkles, Target, Trophy, Users, Zap } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

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

function getAvgPlayerScore(players: any[]) {
  if (!players.length) return 0;
  return Math.round(players.reduce((sum, player) => sum + Number(player.score || 0), 0) / players.length);
}

function getLineStrength(players: any[], position: string) {
  const filtered = players.filter((player) => String(player.position || '').toUpperCase() === position);
  if (!filtered.length) return 0;
  return Math.round(filtered.reduce((sum, player) => sum + Number(player.score || 0), 0) / filtered.length);
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

function technicalInsights(team: any, players: any[]) {
  const insights: string[] = [];
  const avgScore = getAvgPlayerScore(players);
  const attack = getLineStrength(players, 'FWD');
  const midfield = getLineStrength(players, 'MID');
  const defense = getLineStrength(players, 'DEF');
  if ((team.fifaRank || 999) <= 10) insights.push('تصنيف FIFA قوي، ما يمنح المنتخب أساسًا فنيًا جيدًا قبل البطولة.');
  if (avgScore >= 75) insights.push('متوسط جودة اللاعبين جيد، والقائمة تملك عمقًا يساعد على تغيير شكل المباراة.');
  if (attack >= 75) insights.push('الخط الأمامي مرشح لصناعة الزخم عند تسجيل الأهداف أو صناعة الفرص.');
  if (midfield >= 75) insights.push('وسط الملعب يمنح المنتخب قدرة أفضل على التحكم وصناعة اللعب.');
  if (defense >= 75) insights.push('الدفاع مستقر نسبيًا، ما يرفع ثقة السوق في المباريات الصعبة.');
  if ((team.worldCupLegacy || 50) >= 80) insights.push('الإرث المونديالي يرفع ثقة المستخدمين حتى قبل النتائج.');
  if (insights.length === 0) insights.push('التحليل الفني يعتمد على قوة القائمة، الزخم، التصنيف، والإرث المتاح في قاعدة البيانات.');
  return insights.slice(0, 4);
}

function marketInsights(team: any, premiumDiscount: number) {
  const insights: string[] = [];
  if (premiumDiscount <= -5) insights.push('السعر أقل من القيمة العادلة، ما يجعله أصلًا مرشحًا للمراقبة.');
  else if (premiumDiscount >= 10) insights.push('المنتخب يتداول بعلاوة واضحة، لذلك يجب متابعة الأخبار والمباريات القادمة.');
  else insights.push('السعر قريب من القيمة العادلة، والزخم أو نتائج المباريات قد تحدد الاتجاه القادم.');
  if ((team.marketDemand || 50) >= 70) insights.push('الطلب السوقي مرتفع ويعكس اهتمامًا واضحًا من المستخدمين.');
  if ((team.momentum || 50) >= 70) insights.push('زخم المنتخب مرتفع وقد يتفاعل السعر بقوة مع أي فوز أو خبر إيجابي.');
  if (getVolatility(team) >= 70) insights.push('التقلب مرتفع؛ نتائج المنتخب قد تصنع حركة سعرية كبيرة.');
  return insights.slice(0, 4);
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

function MatchCard({ match, teamId }: { match: any; teamId: string }) {
  const isHome = match.homeTeamId === teamId || match.homeTeam?.id === teamId;
  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const isFinished = match.status === 'FINISHED';
  const isLive = ['IN_PLAY', 'LIVE'].includes(match.status);
  return (
    <Link href="/matches" className="block rounded-2xl border border-white/5 bg-white/5 p-4 hover:border-primary/30">
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
            <div className="text-xs text-gray-500">{match.stage === 'group' ? 'دور المجموعات' : 'مباراة مؤثرة'}</div>
          </div>
        </div>
        {(isFinished || isLive) ? <div className="text-xl font-black text-primary tabular-nums">{match.homeScore} - {match.awayScore}</div> : <div className="text-xs font-black text-gray-500">VS</div>}
      </div>
    </Link>
  );
}

export default function TeamOverviewPanel({ team }: { team: any }) {
  if (!team || team.type !== 'TEAM') return null;

  const players = team.players || [];
  const marketPrice = Number(team.marketPrice ?? team.current_price ?? 0);
  const fairValue = Number(team.fairValue ?? team.current_price ?? marketPrice);
  const premiumDiscount = getPremiumDiscount(team);
  const teamPower = getTeamPower(team);
  const avgPlayerScore = getAvgPlayerScore(players);
  const attackScore = getLineStrength(players, 'FWD') || Math.round(team.fundamental || team.score || 50);
  const midfieldScore = getLineStrength(players, 'MID') || Math.round(team.fundamental || team.score || 50);
  const defenseScore = getLineStrength(players, 'DEF') || Math.round(team.fundamental || team.score || 50);
  const goalkeeperScore = getLineStrength(players, 'GK') || Math.round(team.fundamental || team.score || 50);
  const technical = technicalInsights(team, players);
  const market = marketInsights(team, premiumDiscount);
  const matches = [...(team.homeMatches || []), ...(team.awayMatches || [])]
    .sort((a: any, b: any) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const upcomingMatches = matches.filter((m: any) => m.status !== 'FINISHED').slice(0, 3);
  const news = team.marketNews || [];

  return (
    <section className="mx-auto mb-4 w-full max-w-[1600px] px-4">
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
              <p className="mt-1 max-w-4xl text-sm leading-relaxed text-gray-400">{getTeamStyle(team)} هذا القسم يعرض التحليل الفني والسوقي فقط بدون تكرار قائمة اللاعبين.</p>
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
                <p className="mt-1 text-xs text-gray-500">قوة المنتخب، قوة الخطوط، القراءة الفنية، والمباريات المؤثرة.</p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-gray-300">SPORT</span>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <MetricCard label="قوة المنتخب" value={`${teamPower}/100`} hint="مزيج فني وسوقي" icon={<Trophy size={16} />} />
              <MetricCard label="متوسط اللاعبين" value={avgPlayerScore ? `${avgPlayerScore}/100` : '—'} hint="حسب القائمة" icon={<Users size={16} />} accent="text-accent" />
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

            <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><Sparkles size={16} className="text-primary" /> قراءة فنية</h4>
              <div className="space-y-3">
                {technical.map((insight, index) => (
                  <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
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
                {market.map((insight, index) => (
                  <div key={index} className="flex gap-3 text-sm leading-relaxed text-gray-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/5 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-black text-white"><CalendarDays size={16} className="text-primary" /> مباريات مؤثرة</h4>
              {upcomingMatches.length ? (
                <div className="space-y-3">
                  {upcomingMatches.map((match: any) => <MatchCard key={match.id} match={match} teamId={team.id} />)}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-gray-500">لا توجد مباريات قادمة مرتبطة حاليًا.</div>
              )}
            </div>
          </div>
        </div>

        {news.length > 0 && (
          <div className="mt-5 rounded-3xl border border-white/5 bg-black/25 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Newspaper size={20} className="text-primary" /> أخبار المنتخب المؤثرة</h3>
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
