import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const revalidate = 300;

const nf = new Intl.NumberFormat('ar-EG');
const oneDecimal = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });
const FINISHED = ['FINISHED', 'FT', 'AET', 'PEN', 'COMPLETED', 'ENDED', 'FINAL_VERIFIED', 'FULL_TIME'];

type TeamLite = { id: string; name: string; code: string | null; image: string | null };
type MatchLite = { id: string; animationMatchId: number | null; matchDate: Date; status: string; homeScore: number; awayScore: number; groupPhase: string | null; stage: string | null; homeTeamId: string; awayTeamId: string; homeTeam: TeamLite; awayTeam: TeamLite };
type StatPair = { key: string; label: string; home: number | null; away: number | null; suffix?: string };
type StandingRow = { teamId: string; team: TeamLite; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number };
type PlayerArticleStat = { id: string; name: string; teamName: string; minutes: number; goals: number; assists: number; shots: number; shotsOnTarget: number; keyPasses: number; tackles: number; interceptions: number; saves: number; yellowCards: number; redCards: number; rating: number | null };
type SnapshotLike = { homePossession?: number | null; awayPossession?: number | null; homeShots?: number | null; awayShots?: number | null; homeShotsOnTarget?: number | null; awayShotsOnTarget?: number | null; homeCorners?: number | null; awayCorners?: number | null; homeYellowCards?: number | null; awayYellowCards?: number | null; homeRedCards?: number | null; awayRedCards?: number | null; homeAttacks?: number | null; awayAttacks?: number | null; homeDangerousAttacks?: number | null; awayDangerousAttacks?: number | null; capturedAt?: Date | string | null; providerMatchId?: number | null; rawData?: unknown };
type GroupContext = { label: string; before: StandingRow[]; after: StandingRow[]; homeAfter?: StandingRow; awayAfter?: StandingRow } | null;

function num(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function fmt(value?: number | null, suffix = '') { return typeof value === 'number' && Number.isFinite(value) ? `${nf.format(value)}${suffix}` : 'غير متوفر'; }
function pct(value?: number | null) { return typeof value === 'number' && Number.isFinite(value) ? `${oneDecimal.format(value)}%` : 'غير متوفر'; }
function isFinishedStatus(status?: string | null) { return FINISHED.includes(String(status || '').toUpperCase()); }
function teamName(team: { name?: string | null; code?: string | null }) { return getArabicTeamName(team.code || null, team.name || ''); }
function flagUrl(team: TeamLite, width = 160) { return getTeamFlagUrl({ code: team.code, name: teamName(team), image: null }, width) || team.image || null; }
function stageLabel(match: { stage?: string | null; groupPhase?: string | null }) { const raw = String(match.stage || match.groupPhase || '').toLowerCase(); if (raw.includes('32')) return 'دور الـ٣٢'; if (raw.includes('16')) return 'دور الـ١٦'; if (raw.includes('quarter')) return 'ربع النهائي'; if (raw.includes('semi')) return 'نصف النهائي'; if (raw.includes('final')) return 'النهائي'; return match.groupPhase ? match.groupPhase.replace('GROUP_', 'المجموعة ') : 'دور المجموعات'; }
function statusLabel(status?: string | null) { if (isFinishedStatus(status)) return 'انتهت'; if (['LIVE', 'IN_PLAY', '1H', '2H', 'HT', 'ET'].includes(String(status || '').toUpperCase())) return 'مباشرة'; return 'مجدولة'; }
function winner(match: MatchLite) { if (match.homeScore > match.awayScore) return { team: match.homeTeam, side: 'home' as const, goalsFor: match.homeScore }; if (match.awayScore > match.homeScore) return { team: match.awayTeam, side: 'away' as const, goalsFor: match.awayScore }; return null; }
function opponent(match: MatchLite, side: 'home' | 'away') { return side === 'home' ? match.awayTeam : match.homeTeam; }
function scoreLine(match: MatchLite) { return `${fmt(match.homeScore)}-${fmt(match.awayScore)}`; }

function statPairs(snapshot: SnapshotLike | null): StatPair[] {
  if (!snapshot) return [];
  return [
    { key: 'possession', label: 'الاستحواذ', home: snapshot.homePossession ?? null, away: snapshot.awayPossession ?? null, suffix: '%' },
    { key: 'shots', label: 'التسديدات', home: snapshot.homeShots ?? null, away: snapshot.awayShots ?? null },
    { key: 'shotsOnTarget', label: 'التسديدات على المرمى', home: snapshot.homeShotsOnTarget ?? null, away: snapshot.awayShotsOnTarget ?? null },
    { key: 'dangerous', label: 'الهجمات الخطيرة', home: snapshot.homeDangerousAttacks ?? null, away: snapshot.awayDangerousAttacks ?? null },
    { key: 'attacks', label: 'الهجمات', home: snapshot.homeAttacks ?? null, away: snapshot.awayAttacks ?? null },
    { key: 'corners', label: 'الركنيات', home: snapshot.homeCorners ?? null, away: snapshot.awayCorners ?? null },
    { key: 'yellow', label: 'البطاقات الصفراء', home: snapshot.homeYellowCards ?? null, away: snapshot.awayYellowCards ?? null },
    { key: 'red', label: 'البطاقات الحمراء', home: snapshot.homeRedCards ?? null, away: snapshot.awayRedCards ?? null },
  ].filter((item) => item.home !== null || item.away !== null);
}
function pair(pairs: StatPair[], key: string) { return pairs.find((item) => item.key === key) || null; }
function sideValue(metric: StatPair | null, side: 'home' | 'away') { return metric ? (side === 'home' ? metric.home : metric.away) : null; }
function conversionRate(goals: number, shots: number | null) { if (!shots || shots <= 0) return null; return (goals / shots) * 100; }

function addTeam(map: Map<string, StandingRow>, team: TeamLite) {
  if (!map.has(team.id)) map.set(team.id, { teamId: team.id, team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 });
  return map.get(team.id)!;
}
function calculateStandings(matches: MatchLite[]) {
  const table = new Map<string, StandingRow>();
  for (const match of matches) {
    if (!isFinishedStatus(match.status)) continue;
    const home = addTeam(table, match.homeTeam);
    const away = addTeam(table, match.awayTeam);
    home.played += 1; away.played += 1;
    home.goalsFor += match.homeScore; home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore; away.goalsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) { home.won += 1; away.lost += 1; home.points += 3; }
    else if (match.awayScore > match.homeScore) { away.won += 1; home.lost += 1; away.points += 3; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  }
  return Array.from(table.values()).map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || teamName(a.team).localeCompare(teamName(b.team), 'ar'));
}
function rankOf(table: StandingRow[], teamId: string) { const index = table.findIndex((row) => row.teamId === teamId); return index >= 0 ? index + 1 : null; }
function standingLine(row?: StandingRow | null) { if (!row) return 'غير متوفر'; return `${teamName(row.team)} — ${fmt(row.points)} نقطة، فارق ${fmt(row.goalDifference)}`; }
function movementText(before: StandingRow[], after: StandingRow[], teamId: string) { const b = rankOf(before, teamId); const a = rankOf(after, teamId); if (!a) return ''; if (!b) return `دخل جدول المجموعة في المركز ${fmt(a)} بعد هذه المباراة.`; if (a < b) return `تقدم من المركز ${fmt(b)} إلى المركز ${fmt(a)}.`; if (a > b) return `تراجع من المركز ${fmt(b)} إلى المركز ${fmt(a)}.`; return `حافظ على المركز ${fmt(a)}.`; }
function groupImpactText(group: GroupContext, match: MatchLite) { if (!group) return 'موقف المجموعة غير متوفر من البيانات الحالية.'; const home = movementText(group.before, group.after, match.homeTeamId); const away = movementText(group.before, group.after, match.awayTeamId); return `${teamName(match.homeTeam)}: ${home || standingLine(group.homeAfter)} ${teamName(match.awayTeam)}: ${away || standingLine(group.awayAfter)}`; }

function readRawPlayerStats(snapshot: SnapshotLike | null): PlayerArticleStat[] {
  const raw = snapshot?.rawData as any;
  const rows = raw?.normalized?.playerStats || raw?.normalizedPreview?.playerStats || raw?.debug?.normalizedPreview?.playerStats || [];
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 50).map((row: any, index: number) => ({
    id: String(row.playerId || row.id || row.playerName || row.name || `raw-${index}`),
    name: String(row.playerName || row.name || 'لاعب'),
    teamName: String(row.teamName || row.team || 'غير متوفر'),
    minutes: num(row.minutes), goals: num(row.goals), assists: num(row.assists), shots: num(row.shots || row.shotsTotal), shotsOnTarget: num(row.shotsOnTarget), keyPasses: num(row.keyPasses || row.keypasses), tackles: num(row.tackles), interceptions: num(row.interceptions), saves: num(row.saves), yellowCards: num(row.yellowCards), redCards: num(row.redCards), rating: Number.isFinite(Number(row.rating || row.apiRating)) ? Number(row.rating || row.apiRating) : null,
  }));
}
function rankPlayers(players: PlayerArticleStat[]) { return [...players].map((player) => ({ ...player, score: (player.rating || 0) * 10 + player.goals * 14 + player.assists * 9 + player.shotsOnTarget * 3 + player.keyPasses * 2 + player.saves * 2 + player.tackles + player.interceptions - player.redCards * 10 - player.yellowCards })).sort((a, b) => b.score - a.score).slice(0, 10); }
function playerImpactText(player?: PlayerArticleStat | null) { if (!player) return 'غير متوفر في البيانات الحالية.'; const parts = []; if (player.goals) parts.push(`${fmt(player.goals)} هدف`); if (player.assists) parts.push(`${fmt(player.assists)} أسيست`); if (player.shotsOnTarget) parts.push(`${fmt(player.shotsOnTarget)} تسديدة على المرمى`); if (player.keyPasses) parts.push(`${fmt(player.keyPasses)} تمريرة مفتاحية`); if (player.saves) parts.push(`${fmt(player.saves)} تصديات`); if (player.tackles || player.interceptions) parts.push(`${fmt(player.tackles + player.interceptions)} تدخل/اعتراض`); return parts.length ? parts.join(' · ') : 'شارك دون أرقام حاسمة كافية في البيانات المتاحة.'; }
function eventTone(type?: string | null) { const raw = String(type || '').toLowerCase(); if (raw.includes('goal')) return 'هدف'; if (raw.includes('card')) return 'بطاقة'; if (raw.includes('sub')) return 'تبديل'; if (raw.includes('var')) return 'VAR'; if (raw.includes('pen')) return 'ركلة جزاء'; return 'حدث'; }
function importantEvents(events: any[]) { const prioritized = events.filter((event) => /goal|card|red|pen|var|هدف|طرد|حمراء/i.test(`${event.type || ''} ${event.detail || ''}`)); return (prioritized.length ? prioritized : events).slice(0, 8); }
function turningPoint(events: any[], match: MatchLite) { const red = events.find((event) => /red|طرد|حمراء/i.test(`${event.type || ''} ${event.detail || ''}`)); if (red) return `لحظة الطرد عند الدقيقة ${fmt(red.minute)} غيّرت ميزان المباراة، لأنها أجبرت أحد الطرفين على تعديل تمركزه وإدارة المساحات بشكل مختلف.`; const goal = events.find((event) => /goal|هدف/i.test(`${event.type || ''} ${event.detail || ''}`)); if (goal) return `الهدف المسجل عند الدقيقة ${fmt(goal.minute)} كان نقطة التحول الأولى؛ بعده تغيرت حسابات الضغط، والمساحات، وإيقاع المخاطرة.`; const win = winner(match); return win ? `نقطة التحول لم تظهر كحدث منفرد في البيانات، لكنها انعكست في قدرة ${teamName(win.team)} على تحويل النتيجة إلى أفضلية نهائية.` : 'لا توجد لحظة تحول موثقة في الأحداث المتاحة، لذلك تبقى قراءة المباراة مرتبطة بسياق الأرقام العامة.'; }

function styleOfMatch(match: MatchLite, pairs: StatPair[]) {
  const win = winner(match);
  const shots = pair(pairs, 'shots');
  const onTarget = pair(pairs, 'shotsOnTarget');
  const possession = pair(pairs, 'possession');
  if (!win) {
    const leaderMetric = onTarget || shots || possession;
    if (leaderMetric?.home !== null && leaderMetric?.away !== null && leaderMetric?.home !== leaderMetric?.away) {
      const leader = leaderMetric.home! > leaderMetric.away! ? match.homeTeam : match.awayTeam;
      return `التعادل لا يلغي أن ${teamName(leader)} كان الطرف الأكثر ظهورًا في ${leaderMetric.label}، لكن غياب الحسم أبقى النتيجة متوازنة.`;
    }
    return 'المباراة جاءت متوازنة رقميًا، والتعادل يبدو أقرب لانعكاس عام لما توفر من بيانات.';
  }
  const side = win.side;
  const other = side === 'home' ? 'away' : 'home';
  const poss = sideValue(possession, side);
  const oppPoss = sideValue(possession, other);
  const s = sideValue(shots, side);
  const oppS = sideValue(shots, other);
  const ot = sideValue(onTarget, side);
  const oppOt = sideValue(onTarget, other);
  const conv = conversionRate(win.goalsFor, s);
  if (poss !== null && oppPoss !== null && poss < oppPoss && ot !== null && oppOt !== null && ot >= oppOt) return `${teamName(win.team)} لم يحتج إلى امتلاك الكرة طويلًا؛ امتلك فقط ${pct(poss)} من الاستحواذ، لكنه عوّض ذلك بانتقائية أوضح في الوصول للمرمى.`;
  if (s !== null && oppS !== null && s > oppS && ot !== null && oppOt !== null && ot > oppOt) return `${teamName(win.team)} لم يفز بالنتيجة فقط، بل دعم الفوز بتفوق في حجم المحاولات وجودتها: ${fmt(s)} تسديدة منها ${fmt(ot)} على المرمى.`;
  if (conv !== null && conv >= 25) return `${teamName(win.team)} صنع الفارق بالفاعلية: ${fmt(win.goalsFor)} أهداف من ${fmt(s)} تسديدة، بنسبة تحويل تقارب ${pct(conv)}.`;
  return `${teamName(win.team)} عرف كيف يدير تفاصيل المباراة حتى عندما لم تكن كل المؤشرات الرقمية تميل له بشكل واضح.`;
}
function articleHeadline(match: MatchLite, pairs: StatPair[], group: GroupContext) { const win = winner(match); const style = styleOfMatch(match, pairs); if (win) return `${teamName(win.team)} يحسم ${teamName(opponent(match, win.side))}: ${style.split('؛')[0]}`; if (group) return `تعادل يترك حسابات ${group.label} مفتوحة بين ${teamName(match.homeTeam)} و${teamName(match.awayTeam)}`; return `تعادل ${teamName(match.homeTeam)} و${teamName(match.awayTeam)}: أرقام تبحث عن حسم`; }
function analyticalLead(match: MatchLite, pairs: StatPair[], group: GroupContext, topPlayer: PlayerArticleStat | null) { const win = winner(match); const groupPhrase = group ? ` وغيّر معه شكل الحسابات في ${group.label}` : ''; const playerPhrase = topPlayer ? `، بينما جاء التأثير الفردي الأبرز من ${topPlayer.name}` : ''; return win ? `${teamName(win.team)} خرج من المباراة بانتصار ${scoreLine(match)}${groupPhrase}${playerPhrase}. لكن القصة لا تقف عند النتيجة؛ الأهم هو كيف جاءت الأفضلية، وأين ترجمت الأرقام إلى لحظات حاسمة.` : `تعادل ${teamName(match.homeTeam)} و${teamName(match.awayTeam)} بنتيجة ${scoreLine(match)}${groupPhrase}${playerPhrase}. قراءة المباراة هنا تحتاج إلى فصل واضح بين السيطرة الشكلية، جودة الفرص، وتأثير اللاعبين في اللحظات الحاسمة.`; }

async function loadArticle(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { homeTeam: { select: { id: true, name: true, code: true, image: true } }, awayTeam: { select: { id: true, name: true, code: true, image: true } } } });
  if (!match) return null;
  const typedMatch = match as MatchLite;
  const latestSnapshot = await prisma.matchStatsSnapshot.findFirst({ where: { matchId: typedMatch.id }, orderBy: { capturedAt: 'desc' } });
  const providerIds = [typedMatch.animationMatchId, latestSnapshot?.providerMatchId].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const groupMatchesPromise = typedMatch.groupPhase ? prisma.match.findMany({ where: { groupPhase: typedMatch.groupPhase, matchDate: { lte: typedMatch.matchDate }, status: { in: FINISHED } }, include: { homeTeam: { select: { id: true, name: true, code: true, image: true } }, awayTeam: { select: { id: true, name: true, code: true, image: true } } }, orderBy: { matchDate: 'asc' } }) : Promise.resolve([]);
  const [events, playerPerformances, groupMatchesRaw] = await Promise.all([
    prisma.matchEvent.findMany({ where: { matchId: typedMatch.id }, orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }], take: 80 }),
    providerIds.length ? prisma.playerPerformance.findMany({ where: { providerFixtureId: { in: providerIds } }, select: { minutes: true, goals: true, assists: true, shotsTotal: true, shotsOnTarget: true, keyPasses: true, tackles: true, interceptions: true, saves: true, yellowCards: true, redCards: true, apiRating: true, internalRating: true, teamName: true, asset: { select: { id: true, name: true, code: true, image: true, team: { select: { name: true, code: true } } } } }, orderBy: [{ apiRating: 'desc' }, { internalRating: 'desc' }], take: 80 }) : [],
    groupMatchesPromise,
  ]);
  const groupMatches = groupMatchesRaw as MatchLite[];
  const beforeMatches = groupMatches.filter((row) => row.id !== typedMatch.id && new Date(row.matchDate).getTime() < new Date(typedMatch.matchDate).getTime());
  const before = calculateStandings(beforeMatches);
  const after = calculateStandings(groupMatches);
  const groupContext: GroupContext = typedMatch.groupPhase && after.length ? { label: typedMatch.groupPhase.replace('GROUP_', 'المجموعة '), before, after, homeAfter: after.find((row) => row.teamId === typedMatch.homeTeamId), awayAfter: after.find((row) => row.teamId === typedMatch.awayTeamId) } : null;
  const performancePlayers: PlayerArticleStat[] = playerPerformances.map((row) => ({ id: row.asset.id, name: row.asset.name, teamName: row.teamName || (row.asset.team ? teamName(row.asset.team) : 'غير متوفر'), minutes: num(row.minutes), goals: num(row.goals), assists: num(row.assists), shots: num(row.shotsTotal), shotsOnTarget: num(row.shotsOnTarget), keyPasses: num(row.keyPasses), tackles: num(row.tackles), interceptions: num(row.interceptions), saves: num(row.saves), yellowCards: num(row.yellowCards), redCards: num(row.redCards), rating: Number.isFinite(Number(row.apiRating ?? row.internalRating)) ? Number(row.apiRating ?? row.internalRating) : null }));
  const rawPlayers = readRawPlayerStats(latestSnapshot as SnapshotLike | null);
  const rankedPlayers = rankPlayers(performancePlayers.length ? performancePlayers : rawPlayers);
  const pairs = statPairs(latestSnapshot as SnapshotLike | null);
  return { match: typedMatch, events, latestSnapshot: latestSnapshot as SnapshotLike | null, rankedPlayers, pairs, groupContext };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadArticle(id);
  if (!data) return { title: 'مقال المباراة غير متوفر' };
  const headline = articleHeadline(data.match, data.pairs, data.groupContext);
  return { title: `${headline} | تحليل وإحصائيات`, description: analyticalLead(data.match, data.pairs, data.groupContext, data.rankedPlayers[0] || null) };
}

function TeamHero({ team }: { team: TeamLite }) { const flag = flagUrl(team); return <div className="flex min-w-0 flex-col items-center gap-2"><span className="flex h-16 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/35 sm:h-24 sm:w-32">{flag ? <img src={flag} alt={`علم ${teamName(team)}`} className="h-full w-full object-cover" /> : <b className="text-[#FFD700]">{team.code || '---'}</b>}</span><b className="team-name-full text-center text-sm font-black text-white sm:text-2xl">{teamName(team)}</b></div>; }
function MetricCard({ item, homeTeam, awayTeam }: { item: StatPair; homeTeam: TeamLite; awayTeam: TeamLite }) { const home = item.home ?? 0; const away = item.away ?? 0; const total = Math.max(1, home + away); const homeWidth = Math.max(8, Math.min(92, (home / total) * 100)); return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-2 grid grid-cols-[68px_1fr_68px] items-center gap-3 text-center"><b className="text-base font-black text-[#FFD700]">{fmt(item.home, item.suffix || '')}</b><span className="text-xs font-black text-white">{item.label}</span><b className="text-base font-black text-[#18E58F]">{fmt(item.away, item.suffix || '')}</b></div><div className="h-2 overflow-hidden rounded-full bg-white/10" dir="ltr"><span className="block h-full rounded-full bg-[#FFD700]" style={{ width: `${homeWidth}%` }} /></div><div className="mt-2 grid grid-cols-2 text-[10px] font-bold text-gray-500"><span>{teamName(homeTeam)}</span><span className="text-left">{teamName(awayTeam)}</span></div></article>; }
function PlayerCard({ player, index }: { player: PlayerArticleStat; index: number }) { return <article className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-3 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-black text-white">{nf.format(index + 1)}. {player.name}</p><p className="mt-1 text-[11px] font-bold text-gray-500">{player.teamName}</p></div><b className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2 py-1 text-xs font-black text-[#FFD700]">{player.rating ? oneDecimal.format(player.rating) : '—'}</b></div><p className="text-xs font-bold leading-6 text-gray-300">{playerImpactText(player)}</p></article>; }
function StandingMiniTable({ context, homeId, awayId }: { context: GroupContext; homeId: string; awayId: string }) { if (!context) return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm font-bold text-gray-500">موقف المجموعة غير متوفر.</div>; return <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"><div className="grid grid-cols-[32px_minmax(0,1fr)_44px_44px_44px] gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black text-gray-400"><span>#</span><span>المنتخب</span><span>لعب</span><span>فارق</span><span>نقاط</span></div>{context.after.map((row, index) => <div key={row.teamId} className={`grid grid-cols-[32px_minmax(0,1fr)_44px_44px_44px] gap-2 px-3 py-2 text-xs font-bold ${row.teamId === homeId || row.teamId === awayId ? 'bg-[#FFD700]/10 text-white' : 'text-gray-300'}`}><span>{fmt(index + 1)}</span><span className="truncate font-black">{teamName(row.team)}</span><span>{fmt(row.played)}</span><span>{fmt(row.goalDifference)}</span><span className="text-[#FFD700]">{fmt(row.points)}</span></div>)}</div>; }

export default async function MatchArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadArticle(id);
  if (!data) notFound();
  const { match, events, rankedPlayers, pairs, latestSnapshot, groupContext } = data;
  const topPlayer = rankedPlayers[0] || null;
  const headline = articleHeadline(match, pairs, groupContext);
  const lead = analyticalLead(match, pairs, groupContext, topPlayer);
  const win = winner(match);
  const shots = pair(pairs, 'shots');
  const onTarget = pair(pairs, 'shotsOnTarget');
  const possession = pair(pairs, 'possession');
  const homeConversion = conversionRate(match.homeScore, sideValue(shots, 'home'));
  const awayConversion = conversionRate(match.awayScore, sideValue(shots, 'away'));
  const keyEvents = importantEvents(events);
  const finished = isFinishedStatus(match.status);

  return <main dir="rtl" className="min-h-screen bg-[#04110D] px-3 py-5 text-white sm:px-5 lg:px-8"><div className="mx-auto max-w-7xl space-y-5">
    <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.14),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.26))] p-4 text-center shadow-[0_24px_70px_rgba(0,0,0,.35)] sm:p-7"><div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-black"><span className="rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-3 py-1 text-[#FFD700]">مقال تحليل رياضي</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-gray-300">{stageLabel(match)}</span><span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-gray-300">{statusLabel(match.status)}</span>{groupContext ? <span className="rounded-full border border-[#18E58F]/25 bg-[#18E58F]/10 px-3 py-1 text-[#18E58F]">{groupContext.label}</span> : null}</div><h1 className="mx-auto max-w-5xl text-2xl font-black leading-tight text-white sm:text-4xl">{headline}</h1><p className="mx-auto mt-3 max-w-4xl text-sm font-bold leading-8 text-gray-300 sm:text-base">{lead}</p><div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"><TeamHero team={match.homeTeam} /><div className="rounded-3xl border border-white/10 bg-black/40 px-4 py-3 shadow-inner"><div className="flex items-center gap-3" dir="ltr"><b className="text-4xl font-black text-[#FFD700] sm:text-6xl">{fmt(match.homeScore)}</b><span className="text-3xl font-black text-white/60">-</span><b className="text-4xl font-black text-white sm:text-6xl">{fmt(match.awayScore)}</b></div><p className="mt-2 text-[11px] font-bold text-gray-500">{new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(match.matchDate)}</p></div><TeamHero team={match.awayTeam} /></div><div className="mt-6 flex flex-wrap justify-center gap-2"><Link href={`/matches/${match.id}`} className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-2 text-xs font-black text-[#FFD700]">صفحة المباراة</Link><Link href={`/live-animation/${match.id}`} className="rounded-2xl bg-[#18E58F] px-4 py-2 text-xs font-black text-black">الملعب التفاعلي</Link><Link href="/statistics" className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white">إحصائيات البطولة</Link></div></header>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px]"><article className="space-y-5">
      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6"><h2 className="text-xl font-black text-[#FFD700]">قراءة المحلل: لماذا خرجت المباراة بهذا الشكل؟</h2><div className="mt-4 space-y-4 text-sm font-bold leading-8 text-gray-200"><p>{styleOfMatch(match, pairs)}</p><p>{turningPoint(events, match)}</p><p>{groupContext ? `على مستوى المجموعة، لم تكن المباراة معزولة عن الحسابات: ${groupImpactText(groupContext, match)}` : 'لا توجد بيانات مجموعة كافية لربط النتيجة بحسابات التأهل بصورة دقيقة.'}</p>{topPlayer ? <p>فرديًا، لم يكن تأثير {topPlayer.name} رقمًا عابرًا؛ مساهمته الأوضح جاءت عبر: {playerImpactText(topPlayer)}، ولذلك يظهر كأبرز اسم في قراءة الأداء المتاحة.</p> : <p>بيانات اللاعبين غير كافية لاختيار نجم المباراة بثقة، لذلك لا يتم فرض اسم غير مدعوم بالأرقام.</p>}</div></section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6"><h2 className="text-xl font-black text-white">الأرقام التي صنعت القصة</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><b className="text-[#FFD700]">السيطرة</b><p className="mt-2 text-sm font-bold leading-7 text-gray-300">{possession ? `${teamName(match.homeTeam)} ${pct(possession.home)} مقابل ${pct(possession.away)} لـ${teamName(match.awayTeam)}. الأهم هنا ليس امتلاك الكرة فقط، بل ماذا حدث بعدها.` : 'الاستحواذ غير متوفر في البيانات الحالية.'}</p></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><b className="text-[#18E58F]">جودة التهديد</b><p className="mt-2 text-sm font-bold leading-7 text-gray-300">{onTarget ? `${teamName(match.homeTeam)} وصل للمرمى ${fmt(onTarget.home)} مرة، مقابل ${fmt(onTarget.away)} لـ${teamName(match.awayTeam)}. هذا هو المؤشر الأقرب لقياس الخطورة المباشرة.` : 'التسديدات على المرمى غير متوفرة.'}</p></div><div className="rounded-2xl border border-white/10 bg-black/25 p-4"><b className="text-[#0FF0FC]">الفاعلية</b><p className="mt-2 text-sm font-bold leading-7 text-gray-300">{shots ? `${teamName(match.homeTeam)} حوّل محاولاته بنسبة ${homeConversion === null ? 'غير متوفر' : pct(homeConversion)}، بينما جاءت فاعلية ${teamName(match.awayTeam)} عند ${awayConversion === null ? 'غير متوفر' : pct(awayConversion)}.` : 'لا يمكن حساب الفاعلية دون عدد التسديدات.'}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{pairs.length ? pairs.map((item) => <MetricCard key={item.key} item={item} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-gray-500 md:col-span-2">الإحصائيات التفصيلية غير متوفرة في آخر Snapshot.</div>}</div></section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6"><h2 className="text-xl font-black text-white">موقف المجموعة وقت المباراة</h2><p className="mt-2 text-sm font-bold leading-7 text-gray-400">{groupContext ? `هذا هو ترتيب ${groupContext.label} بعد احتساب المباريات المنتهية حتى توقيت هذه المباراة، وليس ترتيبًا عامًا مفتوحًا على نتائج لاحقة.` : 'لا يمكن حساب موقف المجموعة لأن بيانات المجموعة غير مكتملة لهذه المباراة.'}</p><div className="mt-4"><StandingMiniTable context={groupContext} homeId={match.homeTeamId} awayId={match.awayTeamId} /></div>{groupContext ? <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#FFD700]/15 bg-[#FFD700]/10 p-3 text-sm font-bold leading-7 text-gray-200"><b className="text-[#FFD700]">{teamName(match.homeTeam)}</b><p>{standingLine(groupContext.homeAfter)}. {movementText(groupContext.before, groupContext.after, match.homeTeamId)}</p></div><div className="rounded-2xl border border-[#18E58F]/15 bg-[#18E58F]/10 p-3 text-sm font-bold leading-7 text-gray-200"><b className="text-[#18E58F]">{teamName(match.awayTeam)}</b><p>{standingLine(groupContext.awayAfter)}. {movementText(groupContext.before, groupContext.after, match.awayTeamId)}</p></div></div> : null}</section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6"><h2 className="text-xl font-black text-white">لحظات المباراة التي تستحق القراءة</h2><div className="mt-4 space-y-3">{keyEvents.length ? keyEvents.map((event) => <article key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="mb-1 flex flex-wrap items-center gap-2"><b className="rounded-full bg-[#FFD700]/15 px-2 py-1 text-xs text-[#FFD700]">{event.minute !== null && event.minute !== undefined ? `${fmt(event.minute)}′` : '—'}</b><span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-black text-white">{eventTone(event.type)}</span>{event.playerName ? <span className="text-sm font-black text-white">{event.playerName}</span> : null}</div><p className="text-sm font-bold leading-7 text-gray-300">{event.detail}</p></article>) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-gray-500">الأحداث التفصيلية غير متوفرة في البيانات الحالية.</div>}</div></section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6"><h2 className="text-xl font-black text-white">أداء اللاعبين داخل سياق المباراة</h2><p className="mt-2 text-sm font-bold leading-7 text-gray-400">الترتيب هنا ليس قائمة أسماء فقط؛ هو محاولة لربط مساهمة اللاعب بما ظهر في النتيجة والأرقام: أهداف، أسيست، تسديدات على المرمى، تمريرات مفتاحية، تصديات، وتدخلات دفاعية.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{rankedPlayers.length ? rankedPlayers.slice(0, 8).map((player, index) => <PlayerCard key={`${player.id}-${index}`} player={player} index={index} />) : <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm font-bold text-gray-500 md:col-span-2">غير متوفر في البيانات الحالية.</div>}</div></section>

      <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 sm:p-6"><h2 className="text-xl font-black text-white">الخلاصة الفنية</h2><p className="mt-4 text-sm font-bold leading-8 text-gray-300">{finished ? (win ? `هذه ليست نتيجة تُقرأ من لوحة التسجيل فقط. ${teamName(win.team)} خرج بفوز له قيمة رقمية وتنافسية، لكن قيمة الفوز الحقيقية تظهر عند جمع ثلاثة عناصر: طريقة صناعة التهديد، توقيت الأحداث، وموقع المنتخب في المجموعة بعد المباراة.` : `التعادل أبقى الحسابات مفتوحة، وجعل قراءة التفاصيل أكثر أهمية من النتيجة نفسها: من هدد أكثر؟ من كان أكثر فاعلية؟ ومن خرج بموقف أفضل في المجموعة؟`) : 'المباراة لم تُحسم نهائيًا في البيانات الحالية، لذلك تبقى هذه القراءة مؤقتة حتى اكتمال الإحصائيات النهائية.'}</p></section>
    </article>

    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start"><section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4"><h2 className="text-lg font-black text-white">مفاتيح التحليل</h2><div className="mt-4 grid gap-3"><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">القراءة الأهم</span><b className="mt-1 block text-sm font-black text-[#FFD700]">{styleOfMatch(match, pairs)}</b></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">نقطة التحول</span><b className="mt-1 block text-sm font-black text-[#18E58F]">{turningPoint(events, match)}</b></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">أفضل لاعب رقميًا</span><b className="mt-1 block text-sm font-black text-white">{topPlayer?.name || 'غير متوفر'}</b><p className="mt-1 text-xs font-bold text-gray-400">{topPlayer ? playerImpactText(topPlayer) : 'لا توجد بيانات لاعبين كافية.'}</p></div><div className="rounded-2xl border border-white/10 bg-black/25 p-3"><span className="text-[11px] font-black text-gray-500">آخر تحديث بيانات</span><b className="mt-1 block text-sm font-black text-white">{latestSnapshot?.capturedAt ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(latestSnapshot.capturedAt)) : 'غير متوفر'}</b></div></div></section><section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4"><h2 className="text-lg font-black text-white">روابط مرتبطة</h2><div className="mt-4 grid gap-2 text-sm font-black"><Link href={`/matches/${match.id}`} className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-[#FFD700]">صفحة المباراة</Link><Link href={`/live-animation/${match.id}`} className="rounded-2xl border border-[#18E58F]/25 bg-[#18E58F]/10 px-4 py-3 text-[#18E58F]">الملعب التفاعلي</Link><Link href="/statistics" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white">إحصائيات البطولة</Link><Link href="/groups" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white">ترتيب المجموعات</Link></div></section></aside>
    </section>
  </div></main>;
}
