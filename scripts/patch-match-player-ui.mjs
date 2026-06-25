import fs from 'fs';

const path = 'components/match-page/ProfessionalMatchPageClient.tsx';
const content = fs.readFileSync(path, 'utf8');
const start = content.indexOf('function lineupRows(');
const end = content.indexOf('\nfunction StatMini(', start);

if (start === -1 || end === -1) {
  console.log('[patch-match-player-ui] target block not found; skipping');
  process.exit(0);
}

const replacement = String.raw`
function statBelongsToTeam(stat: MatchPlayerStatItem, team: MatchPageData['homeTeam'], localPlayers: MatchPlayerLite[]) {
  const teamId = String(stat.teamId || '').trim();
  if (teamId && (teamId === team.id || teamId === team.code)) return true;
  const statTeam = normalizeName(stat.teamName);
  const teamKey = normalizeName(team.name);
  const codeKey = normalizeName(team.code);
  if (statTeam && ((teamKey && (statTeam === teamKey || statTeam.includes(teamKey) || teamKey.includes(statTeam))) || (codeKey && statTeam === codeKey))) return true;
  const playerName = normalizeName(stat.playerName);
  return Boolean(playerName && localPlayers.some((player) => {
    const localName = normalizeName(player.name);
    return localName && (localName === playerName || localName.includes(playerName) || playerName.includes(localName));
  }));
}
function statAsPlayer(stat: MatchPlayerStatItem, localPlayers: MatchPlayerLite[]): PitchPlayer {
  const base: PitchPlayer = { id: stat.playerId || stat.playerName || 'player', name: stat.playerName || 'لاعب غير معروف', image: (stat as any).image || (stat as any).photo || null, position: stat.position || null };
  return playerWithRealImage(base, localPlayers);
}
function statHasSubSignal(stat: MatchPlayerStatItem | null | undefined) { return Boolean(stat?.playerSubbedOn || stat?.playerSubbedOff || playedStat(stat)); }
function uniqueRows(rows: PlayerStatRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = normalizeName(String(playerId(row.player) || row.player.name || row.stat?.playerName || row.index));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function lineupRows(team: OfficialLineupTeam | null | undefined, localPlayers: MatchPlayerLite[], stats: MatchPlayerStatItem[]) {
  const starters = (team?.startingXi || []).map((player, index) => {
    const stat = playerStatFor(player, stats);
    return { player: playerWithRealImage(player, localPlayers), stat, role: 'starter' as PlayerRole, index };
  });
  const starterKeys = new Set(starters.map((row) => normalizeName(String(playerId(row.player) || row.player.name))));
  const usedSubstitutes = (team?.substitutes || []).map((player, index) => {
    const stat = playerStatFor(player, stats);
    return { player: playerWithRealImage(player, localPlayers), stat, role: 'substitute' as PlayerRole, index };
  }).filter((row) => statHasSubSignal(row.stat));
  const statOnlyRows = !team?.startingXi?.length
    ? stats.filter((stat) => playedStat(stat)).map((stat, index) => ({ player: statAsPlayer(stat, localPlayers), stat, role: stat.started ? 'starter' as PlayerRole : 'substitute' as PlayerRole, index }))
    : stats.filter((stat) => playedStat(stat) && !starterKeys.has(normalizeName(String(stat.playerId || stat.playerName)))).map((stat, index) => ({ player: statAsPlayer(stat, localPlayers), stat, role: stat.started ? 'starter' as PlayerRole : 'substitute' as PlayerRole, index: index + 1000 }));
  const extraStarters = statOnlyRows.filter((row) => row.role === 'starter' && !starters.some((starter) => normalizeName(starter.player.name) === normalizeName(row.player.name)));
  const extraSubs = statOnlyRows.filter((row) => row.role !== 'starter');
  const finalStarters = uniqueRows([...starters, ...extraStarters]);
  const finalUsedSubstitutes = uniqueRows([...usedSubstitutes, ...extraSubs]).filter((row) => !finalStarters.some((starter) => normalizeName(starter.player.name) === normalizeName(row.player.name)));
  return { starters: finalStarters, usedSubstitutes: finalUsedSubstitutes, total: finalStarters.length + finalUsedSubstitutes.length, withStats: [...finalStarters, ...finalUsedSubstitutes].filter((row) => row.stat).length };
}
function PlayerAvatar({ player, accent }: { player: PitchPlayer; accent: 'home' | 'away' }) { const number = playerNumber(player); const border = accent === 'home' ? 'border-[#F8C846]' : 'border-[#18E58F]'; return <div className={\`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 \${border} bg-black/45 shadow-lg sm:h-14 sm:w-14\`}>{player.image ? <img src={player.image} alt={player.name} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[11px] font-black text-white">{initials(player.name)}</span>}{number ? <b className="absolute -bottom-1 -right-1 rounded-full bg-black px-1.5 py-0.5 text-[9px] text-white ring-1 ring-white/20">{number}</b> : null}</div>; }
const PLAYER_STAT_DEFS: Array<[keyof MatchPlayerStatItem | string, string, string?]> = [
  ['rating', 'تقييم'], ['minutes', 'دقائق'], ['goals', 'أهداف'], ['assists', 'أسيست'], ['shots', 'تسديد'], ['shotsOnTarget', 'على المرمى'], ['shotsOffTarget', 'خارج المرمى'], ['blockedShots', 'محجوبة'], ['expectedGoals', 'xG'], ['npExpectedGoals', 'npxG'], ['expectedAssists', 'xA'], ['bigChancesCreated', 'فرص خلقها'], ['passes', 'تمرير'], ['accuratePasses', 'تمرير صحيح'], ['keyPasses', 'تمرير مفتاحي'], ['crosses', 'عرضيات'], ['accurateCrosses', 'عرضيات صحيحة'], ['longBalls', 'طولية'], ['accurateLongBalls', 'طولية صحيحة'], ['touches', 'لمسات'], ['tackles', 'تدخلات'], ['interceptions', 'اعتراضات'], ['clearances', 'تشتيت'], ['duelWon', 'التحامات فاز'], ['duelLost', 'التحامات خسر'], ['aerialWon', 'هوائيات'], ['challengeLost', 'مراوغات عليه'], ['wonContest', 'مراوغات ناجحة'], ['dispossessed', 'فقد تحت ضغط'], ['possessionLost', 'فقد استحواذ'], ['foulsCommitted', 'أخطاء عليه'], ['foulsWon', 'أخطاء حصل عليها'], ['offsides', 'تسلل'], ['yellowCards', 'صفراء'], ['redCards', 'حمراء'], ['saves', 'تصديات']
];
function playerStatItems(stat: MatchPlayerStatItem | null) {
  if (!stat) return [];
  return PLAYER_STAT_DEFS.map(([key, label]) => ({ key: String(key), label, value: (stat as any)[key] })).filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
}
function PlayerStatChip({ label, value }: { label: string; value: any }) { return <span className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5 text-center"><b className="block text-sm font-black text-white tabular-nums">{fmt(Number(value))}</b><small className="mt-0.5 block text-[9px] font-black text-slate-500">{label}</small></span>; }
function PlayerStatLine({ row, accent }: { row: PlayerStatRow; accent: 'home' | 'away' }) {
  const stat = row.stat;
  const player = row.player;
  const items = playerStatItems(stat);
  return <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"><div className="flex items-start gap-3"><PlayerAvatar player={player} accent={accent} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="truncate text-sm font-black text-white sm:text-base">{player.name}</p>{playerCaptain(player) ? <span className="rounded-full bg-[#F8C846] px-1.5 py-0.5 text-[9px] font-black text-black">C</span> : null}<span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[9px] font-black text-slate-300">{row.role === 'starter' ? 'أساسي' : 'بديل شارك'}</span></div><p className="mt-1 text-[10px] font-bold text-slate-400">#{playerNumber(player) || '—'} · {player.position || stat?.position || '—'}{stat?.playerSubbedOn ? ' · دخل بدل ' + stat.playerSubbedOn : ''}{stat?.playerSubbedOff ? ' · خرج وبدله ' + stat.playerSubbedOff : ''}</p>{items.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{items.map((item) => <PlayerStatChip key={item.key} label={item.label} value={item.value} />)}</div> : <p className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-400">لا توجد إحصائيات تفصيلية لهذا اللاعب حتى الآن.</p>}</div></div></article>;
}
function PlayerGroup({ title, rows, accent }: { title: string; rows: PlayerStatRow[]; accent: 'home' | 'away' }) { if (!rows.length) return null; return <div><h4 className="mb-2 text-xs font-black text-[#F8C846]">{title}</h4><div className="grid gap-2">{rows.map((row) => <PlayerStatLine key={\`\${title}-\${row.player.name}-\${row.index}\`} row={row} accent={accent} />)}</div></div>; }
function TeamPlayerStatsCard({ team, lineup, localPlayers, stats, accent }: { team: MatchPageData['homeTeam']; lineup: OfficialLineupTeam | null | undefined; localPlayers: MatchPlayerLite[]; stats: MatchPlayerStatItem[]; accent: 'home' | 'away' }) { const teamStats = stats.filter((stat) => statBelongsToTeam(stat, team, localPlayers)); const rows = lineupRows(lineup, localPlayers, teamStats); const color = accent === 'home' ? 'text-[#F8C846] border-[#F8C846]/25 bg-[#F8C846]/10' : 'text-[#18E58F] border-[#18E58F]/25 bg-[#18E58F]/10'; return <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FlagImg team={team} small /><div className="min-w-0"><h3 className="truncate text-lg font-black text-white">{team.name}</h3><p className="mt-1 text-[10px] font-bold text-slate-500">{lineup?.formation ? 'الخطة ' + lineup.formation : 'لاعبو المنتخب المشاركون'}</p></div></div><span className={\`rounded-full border px-3 py-1 text-[10px] font-black \${color}\`}>{ar.format(rows.withStats)} / {ar.format(rows.total)} لاعب</span></div><div className="space-y-5"><PlayerGroup title="الأساسيون فقط" rows={rows.starters} accent={accent} /><PlayerGroup title="البدلاء الذين شاركوا فقط" rows={rows.usedSubstitutes} accent={accent} />{!rows.total ? <Empty title="جاري جلب إحصائيات اللاعبين" body="لم تصل إحصائيات اللاعبين بعد. ستظهر هنا تلقائيًا فور حفظ بيانات ما بعد المباراة." /> : null}</div></div>; }
function PlayerStatsCard({ data }: { data: MatchPageData }) { const stats = data.advanced.playerStats || []; const official = data.officialLineup; return <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/15 p-3"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-black text-white">إحصائيات اللاعبين</h3><p className="mt-1 text-xs font-bold text-slate-400">كل منتخب بلاعبيه: الأساسيون فقط + البدلاء الذين شاركوا. كل لاعب تظهر أمامه كل الإحصائيات المتاحة من TheStats.</p></div><span className="rounded-full border border-[#F8C846]/30 bg-[#F8C846]/10 px-3 py-1 text-xs font-black text-[#F8C846]">{stats.length ? ar.format(stats.length) + ' سجل خام من TheStats' : 'جاري جلب إحصائيات اللاعبين'}</span></div><div className="grid gap-4"><TeamPlayerStatsCard team={data.homeTeam} lineup={official?.home} localPlayers={data.homePlayers} stats={stats} accent="home" /><TeamPlayerStatsCard team={data.awayTeam} lineup={official?.away} localPlayers={data.awayPlayers} stats={stats} accent="away" /></div></div>; }
function LineupsPanel({ data }: { data: MatchPageData }) { const official = data.officialLineup; return <Section id="lineups" title="التشكيل الرسمي وإحصائيات اللاعبين" icon={<Users size={22} />} hint={official ? 'الأساسيون ومن شاركوا فقط · لا نعرض كل دكة البدلاء' : 'سيتم جلب التشكيل الرسمي تلقائيًا عند توفره'}><OfficialPitch data={data} /><PlayerStatsCard data={data} /></Section>; }
`;

const patched = content.slice(0, start) + replacement + content.slice(end);
if (patched === content) {
  console.log('[patch-match-player-ui] no changes applied');
  process.exit(0);
}
fs.writeFileSync(path, patched);
console.log('[patch-match-player-ui] patched ProfessionalMatchPageClient player UI');
