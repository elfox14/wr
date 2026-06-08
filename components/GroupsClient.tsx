'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore, Asset, Match } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Flame,
  LayoutGrid,
  LineChart,
  ListOrdered,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

type GroupStanding = {
  team: Asset;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type GroupKey = string;

function normalizeGroupKey(value?: string | null): string {
  if (!value) return 'غير محددة';
  return value
    .replace('Group', '')
    .replace('المجموعة', '')
    .trim()
    .toUpperCase();
}

function groupDisplayName(groupKey: string) {
  return groupKey === 'غير محددة' ? 'مجموعات غير محددة' : `المجموعة ${groupKey}`;
}

function formatPrice(asset?: Asset | null) {
  if (!asset) return '0¢';
  const price = Math.round(asset.marketPrice ?? asset.current_price ?? 0);
  return `${price.toLocaleString()}¢`;
}

function getPremiumDiscount(asset: Asset) {
  const marketPrice = Number(asset.marketPrice ?? asset.current_price ?? 0);
  const fairValue = Number(asset.fairValue ?? asset.current_price ?? marketPrice);
  return fairValue > 0 ? ((marketPrice - fairValue) / fairValue) * 100 : 0;
}

function getTeamPower(team: Asset) {
  return Math.round(
    ((team.score ?? 50) * 0.35) +
    ((team.momentum ?? 50) * 0.25) +
    ((team.marketDemand ?? 50) * 0.2) +
    ((team.worldCupLegacy ?? 50) * 0.2)
  );
}

function StatusBadge({ rank }: { rank: number }) {
  if (rank <= 2) return <span className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-xs font-black text-success">منطقة تأهل</span>;
  if (rank === 3) return <span className="rounded-lg border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-xs font-black text-orange-300">ينافس</span>;
  return <span className="rounded-lg border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-black text-danger">مهدد</span>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-surface/40 p-10 text-center">
      <AlertCircle size={36} className="mx-auto mb-4 text-gray-500" />
      <h3 className="mb-2 text-xl font-black text-white">{title}</h3>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

export default function GroupsClient() {
  const { assets, matches, fetchAssets, fetchMatches } = useStore();
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null);
  const [view, setView] = useState<'overview' | 'standings' | 'matches' | 'teams' | 'players'>('overview');

  useEffect(() => {
    Promise.all([
      assets.length === 0 ? fetchAssets() : Promise.resolve(),
      matches.length === 0 ? fetchMatches() : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [assets.length, matches.length, fetchAssets, fetchMatches]);

  const teams = useMemo(() => assets.filter((asset) => asset.type === 'TEAM'), [assets]);

  const groups = useMemo(() => {
    const map = teams.reduce((acc, team) => {
      const key = normalizeGroupKey(team.group);
      if (!acc[key]) acc[key] = [];
      acc[key].push(team);
      return acc;
    }, {} as Record<string, Asset[]>);

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => (a.fifaRank || 999) - (b.fifaRank || 999));
    });

    return map;
  }, [teams]);

  const groupKeys = useMemo(() => Object.keys(groups).sort((a, b) => a.localeCompare(b)), [groups]);

  useEffect(() => {
    if (!selectedGroup && groupKeys.length > 0) setSelectedGroup(groupKeys[0]);
  }, [groupKeys, selectedGroup]);

  const selectedTeams = selectedGroup ? groups[selectedGroup] || [] : [];
  const selectedTeamIds = new Set(selectedTeams.map((team) => team.id));

  const groupMatches = useMemo(() => matches.filter((match) => {
    const matchGroup = normalizeGroupKey(match.groupPhase);
    const sameGroupPhase = selectedGroup && matchGroup === selectedGroup;
    const sameTeams = selectedTeamIds.has(match.homeTeam?.id) || selectedTeamIds.has(match.awayTeam?.id);
    return sameGroupPhase || sameTeams;
  }).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()), [matches, selectedGroup, selectedTeamIds]);

  const standings = useMemo<GroupStanding[]>(() => {
    const table = selectedTeams.map((team) => ({
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }));

    const byId = new Map(table.map((row) => [row.team.id, row]));

    groupMatches.filter((match) => match.status === 'FINISHED').forEach((match) => {
      const home = byId.get(match.homeTeam.id);
      const away = byId.get(match.awayTeam.id);
      if (!home || !away) return;

      const homeScore = Number(match.homeScore || 0);
      const awayScore = Number(match.awayScore || 0);

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (homeScore < awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    });

    table.forEach((row) => {
      row.goalDifference = row.goalsFor - row.goalsAgainst;
    });

    return table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return getTeamPower(b.team) - getTeamPower(a.team);
    });
  }, [selectedTeams, groupMatches]);

  const finishedMatchesCount = groupMatches.filter((match) => match.status === 'FINISHED').length;
  const scheduledMatchesCount = groupMatches.filter((match) => match.status === 'SCHEDULED').length;
  const liveMatchesCount = groupMatches.filter((match) => ['IN_PLAY', 'LIVE'].includes(match.status)).length;

  const groupPlayers = useMemo(() => selectedTeams
    .flatMap((team) => (team.players || []).map((player) => ({ ...player, team })))
    .sort((a, b) => Number(b.marketPrice ?? b.current_price ?? 0) - Number(a.marketPrice ?? a.current_price ?? 0)), [selectedTeams]);

  const topPlayers = groupPlayers.slice(0, 8);
  const avgTeamScore = selectedTeams.length ? Math.round(selectedTeams.reduce((sum, team) => sum + (team.score || 0), 0) / selectedTeams.length) : 0;
  const avgMomentum = selectedTeams.length ? Math.round(selectedTeams.reduce((sum, team) => sum + (team.momentum || 50), 0) / selectedTeams.length) : 0;
  const highestDemandTeam = [...selectedTeams].sort((a, b) => (b.marketDemand || 0) - (a.marketDemand || 0))[0];
  const mostValuableTeam = [...selectedTeams].sort((a, b) => Number(b.marketPrice ?? b.current_price ?? 0) - Number(a.marketPrice ?? a.current_price ?? 0))[0];

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_30px_rgba(15,240,252,0.12)]">
            <LayoutGrid size={32} />
          </div>
          <h1 className="text-3xl font-black text-white md:text-5xl">المجموعات والتصفيات</h1>
          <p className="mx-auto mt-3 max-w-3xl text-gray-400 md:text-lg">اضغط على رقم المجموعة لعرض جدولها، مبارياتها، وإحصائيات منتخباتها ولاعبيها داخل MC PRIME Exchange.</p>
        </section>

        <section className="sticky top-16 z-40 mb-8 rounded-3xl border border-white/5 bg-background/90 p-4 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">اختر المجموعة</h2>
              <p className="text-xs text-gray-500">البيانات تظهر للمجموعة المحددة فقط.</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black text-primary">{selectedGroup ? groupDisplayName(selectedGroup) : '—'}</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {groupKeys.map((groupKey) => (
              <button
                key={groupKey}
                type="button"
                onClick={() => { setSelectedGroup(groupKey); setView('overview'); }}
                className={`min-w-14 rounded-2xl border px-5 py-3 text-lg font-black transition-all ${selectedGroup === groupKey ? 'border-primary bg-primary text-black shadow-[0_0_18px_rgba(15,240,252,0.35)]' : 'border-white/5 bg-surface text-gray-400 hover:text-white'}`}
              >
                {groupKey}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 size={16} /> },
              { id: 'standings', label: 'الجدول', icon: <ListOrdered size={16} /> },
              { id: 'matches', label: 'المباريات', icon: <CalendarDays size={16} /> },
              { id: 'teams', label: 'إحصائيات المنتخبات', icon: <ShieldCheck size={16} /> },
              { id: 'players', label: 'إحصائيات اللاعبين', icon: <Users size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id as typeof view)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-colors ${view === tab.id ? 'bg-white text-black' : 'bg-surface text-gray-400 hover:text-white'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </section>

        {selectedTeams.length === 0 ? (
          <EmptyState title="لا توجد منتخبات في هذه المجموعة" text="تأكد من ربط المنتخبات بحقل المجموعة داخل قاعدة البيانات." />
        ) : (
          <div className="space-y-8">
            {(view === 'overview') && (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary"><Trophy size={18} /> عدد المنتخبات</div>
                    <div className="text-3xl font-black text-white tabular-nums">{selectedTeams.length}</div>
                    <p className="mt-1 text-xs text-gray-500">داخل {selectedGroup && groupDisplayName(selectedGroup)}</p>
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent"><Target size={18} /> متوسط القوة</div>
                    <div className="text-3xl font-black text-white tabular-nums">{avgTeamScore}</div>
                    <p className="mt-1 text-xs text-gray-500">حسب تقييم المنتخبات الحالي</p>
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-success"><Flame size={18} /> متوسط الزخم</div>
                    <div className="text-3xl font-black text-white tabular-nums">{avgMomentum}</div>
                    <p className="mt-1 text-xs text-gray-500">من بيانات السوق الحالية</p>
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-yellow-300"><Users size={18} /> اللاعبون</div>
                    <div className="text-3xl font-black text-white tabular-nums">{groupPlayers.length}</div>
                    <p className="mt-1 text-xs text-gray-500">لاعبون مرتبطون بمنتخبات المجموعة</p>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-xl font-black text-white">ملخص المجموعة</h2>
                      <button onClick={() => setView('standings')} className="text-sm font-bold text-primary hover:text-primary/80">عرض الجدول</button>
                    </div>
                    <StandingsTable standings={standings} finishedMatchesCount={finishedMatchesCount} compact />
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-xl font-black text-white">حالة المباريات</h2>
                      <button onClick={() => setView('matches')} className="text-sm font-bold text-primary hover:text-primary/80">عرض المباريات</button>
                    </div>
                    <div className="mb-5 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl bg-white/5 p-4"><div className="text-xs text-gray-500">قادمة</div><div className="text-2xl font-black text-white">{scheduledMatchesCount}</div></div>
                      <div className="rounded-2xl bg-white/5 p-4"><div className="text-xs text-gray-500">مباشرة</div><div className="text-2xl font-black text-primary">{liveMatchesCount}</div></div>
                      <div className="rounded-2xl bg-white/5 p-4"><div className="text-xs text-gray-500">منتهية</div><div className="text-2xl font-black text-success">{finishedMatchesCount}</div></div>
                    </div>
                    {groupMatches.slice(0, 3).map((match) => <MatchCard key={match.id} match={match} />)}
                    {groupMatches.length === 0 && <EmptyState title="لا توجد مباريات" text="لم يتم ربط مباريات بهذه المجموعة حتى الآن." />}
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <HighlightCard title="أعلى طلب سوقي" asset={highestDemandTeam} metric={highestDemandTeam ? `${Math.round(highestDemandTeam.marketDemand || 0)}/100` : '—'} icon={<Zap size={18} />} />
                  <HighlightCard title="أعلى سعر سوقي" asset={mostValuableTeam} metric={mostValuableTeam ? formatPrice(mostValuableTeam) : '—'} icon={<LineChart size={18} />} />
                </section>
              </>
            )}

            {view === 'standings' && (
              <section className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-white">جدول {selectedGroup && groupDisplayName(selectedGroup)}</h2>
                    <p className="mt-1 text-sm text-gray-500">الجدول يعتمد على نتائج المباريات المنتهية. عند عدم وجود نتائج، تظهر المنتخبات مرتبة بالقوة السوقية فقط.</p>
                  </div>
                  {finishedMatchesCount === 0 && <span className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-300">لا توجد نتائج فعلية بعد</span>}
                </div>
                <StandingsTable standings={standings} finishedMatchesCount={finishedMatchesCount} />
              </section>
            )}

            {view === 'matches' && (
              <section className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
                <h2 className="mb-5 text-2xl font-black text-white">مباريات {selectedGroup && groupDisplayName(selectedGroup)}</h2>
                {groupMatches.length === 0 ? <EmptyState title="لا توجد مباريات للمجموعة" text="أضف مباريات المجموعة في قاعدة البيانات لتظهر هنا." /> : <div className="grid gap-4 lg:grid-cols-2">{groupMatches.map((match) => <MatchCard key={match.id} match={match} expanded />)}</div>}
              </section>
            )}

            {view === 'teams' && (
              <section className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
                <h2 className="mb-5 text-2xl font-black text-white">إحصائيات منتخبات {selectedGroup && groupDisplayName(selectedGroup)}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {selectedTeams.map((team) => <TeamStatsCard key={team.id} team={team} />)}
                </div>
              </section>
            )}

            {view === 'players' && (
              <section className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-white">إحصائيات لاعبي {selectedGroup && groupDisplayName(selectedGroup)}</h2>
                    <p className="mt-1 text-sm text-gray-500">أعلى اللاعبين سعرًا وزخمًا داخل منتخبات المجموعة.</p>
                  </div>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">{groupPlayers.length} لاعب</span>
                </div>
                {groupPlayers.length === 0 ? <EmptyState title="لا توجد بيانات لاعبين" text="تأكد من ربط اللاعبين بمنتخباتهم داخل قاعدة البيانات." /> : <PlayersTable players={topPlayers} />}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StandingsTable({ standings, finishedMatchesCount, compact = false }: { standings: GroupStanding[]; finishedMatchesCount: number; compact?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5">
      <table className="w-full whitespace-nowrap text-right text-sm">
        <thead className="bg-white/5 text-gray-400">
          <tr>
            <th className="p-3 text-center">#</th>
            <th className="p-3">المنتخب</th>
            {!compact && <><th className="p-3 text-center">لعب</th><th className="p-3 text-center">فاز</th><th className="p-3 text-center">تعادل</th><th className="p-3 text-center">خسر</th><th className="p-3 text-center">له</th><th className="p-3 text-center">عليه</th></>}
            <th className="p-3 text-center">فارق</th>
            <th className="p-3 text-center text-primary">نقاط</th>
            {!compact && <th className="p-3 text-center">الحالة</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr key={row.team.id} className="border-t border-white/5 hover:bg-white/5">
              <td className="p-3 text-center font-black text-gray-400">{index + 1}</td>
              <td className="p-3">
                <Link href={`/asset/${row.team.id}`} className="flex items-center gap-3 font-black text-white hover:text-primary">
                  <AssetImage image={row.team.image} type="TEAM" name={row.team.name} width={36} height={36} className="h-10 w-10 rounded-xl border border-white/10 object-cover" />
                  <div><div>{row.team.name}</div><div className="text-xs font-normal text-gray-500">FIFA #{row.team.fifaRank || '-'}</div></div>
                </Link>
              </td>
              {!compact && <><td className="p-3 text-center">{row.played}</td><td className="p-3 text-center">{row.won}</td><td className="p-3 text-center">{row.drawn}</td><td className="p-3 text-center">{row.lost}</td><td className="p-3 text-center">{row.goalsFor}</td><td className="p-3 text-center">{row.goalsAgainst}</td></>}
              <td className="p-3 text-center font-bold">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td className="p-3 text-center text-lg font-black text-primary">{finishedMatchesCount === 0 ? '—' : row.points}</td>
              {!compact && <td className="p-3 text-center"><StatusBadge rank={index + 1} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchCard({ match, expanded = false }: { match: Match; expanded?: boolean }) {
  const date = new Date(match.matchDate);
  const isLive = ['IN_PLAY', 'LIVE'].includes(match.status);
  const isFinished = match.status === 'FINISHED';
  return (
    <Link href={`/matches/${match.id}`} className="mb-3 block rounded-2xl border border-white/5 bg-background/40 p-4 transition-colors hover:border-primary/30">
      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
        <span>{date.toLocaleDateString('ar-EG')} · {date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className={`rounded-lg px-2 py-1 font-bold ${isLive ? 'bg-primary/10 text-primary' : isFinished ? 'bg-success/10 text-success' : 'bg-white/5 text-gray-400'}`}>{isLive ? 'مباشرة' : isFinished ? 'انتهت' : 'قادمة'}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamMini team={match.homeTeam} score={isFinished || isLive ? match.homeScore : undefined} />
        <div className="text-center text-xs font-black text-gray-500">VS</div>
        <TeamMini team={match.awayTeam} score={isFinished || isLive ? match.awayScore : undefined} align="left" />
      </div>
      {expanded && <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-white/5 p-3"><div className="text-gray-500">سعر {match.homeTeam.name}</div><div className="font-black text-white">{formatPrice(match.homeTeam)}</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-gray-500">سعر {match.awayTeam.name}</div><div className="font-black text-white">{formatPrice(match.awayTeam)}</div></div></div>}
    </Link>
  );
}

function TeamMini({ team, score, align = 'right' }: { team: Asset; score?: number; align?: 'right' | 'left' }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'left' ? 'justify-end text-left' : ''}`}>
      <AssetImage image={team.image} type="TEAM" name={team.name} width={34} height={34} className="h-10 w-10 rounded-xl border border-white/10 object-cover" />
      <div className="min-w-0">
        <div className="truncate font-black text-white">{team.name}</div>
        <div className="text-xs text-gray-500">{formatPrice(team)}</div>
      </div>
      {score !== undefined && <div className="text-2xl font-black text-primary">{score}</div>}
    </div>
  );
}

function HighlightCard({ title, asset, metric, icon }: { title: string; asset?: Asset; metric: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary">{icon}{title}</div>
      {asset ? <Link href={`/asset/${asset.id}`} className="flex items-center justify-between rounded-2xl bg-background/40 p-4 hover:bg-white/5"><div className="flex items-center gap-3"><AssetImage image={asset.image} type="TEAM" name={asset.name} width={46} height={46} className="h-12 w-12 rounded-xl object-cover" /><div><div className="font-black text-white">{asset.name}</div><div className="text-xs text-gray-500">{formatPrice(asset)}</div></div></div><div className="text-2xl font-black text-primary">{metric}</div></Link> : <p className="text-gray-500">لا توجد بيانات.</p>}
    </div>
  );
}

function TeamStatsCard({ team }: { team: Asset }) {
  const premiumDiscount = getPremiumDiscount(team);
  return (
    <Link href={`/asset/${team.id}`} className="rounded-3xl border border-white/5 bg-background/40 p-5 transition-colors hover:border-primary/30">
      <div className="mb-4 flex items-start justify-between gap-3"><AssetImage image={team.image} type="TEAM" name={team.name} width={54} height={54} className="h-14 w-14 rounded-2xl object-cover" /><span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">FIFA #{team.fifaRank || '-'}</span></div>
      <h3 className="mb-4 text-xl font-black text-white">{team.name}</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white/5 p-3"><div className="text-gray-500">السعر</div><div className="font-black text-white">{formatPrice(team)}</div></div>
        <div className="rounded-xl bg-white/5 p-3"><div className="text-gray-500">القوة</div><div className="font-black text-primary">{getTeamPower(team)}</div></div>
        <div className="rounded-xl bg-white/5 p-3"><div className="text-gray-500">الزخم</div><div className="font-black text-success">{Math.round(team.momentum || 50)}</div></div>
        <div className="rounded-xl bg-white/5 p-3"><div className="text-gray-500">خصم/علاوة</div><div className={premiumDiscount <= 0 ? 'font-black text-success' : 'font-black text-danger'}>{premiumDiscount > 0 ? '+' : ''}{premiumDiscount.toFixed(1)}%</div></div>
      </div>
    </Link>
  );
}

function PlayersTable({ players }: { players: (Asset & { team?: Asset })[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5">
      <table className="w-full whitespace-nowrap text-right text-sm">
        <thead className="bg-white/5 text-gray-400"><tr><th className="p-4">اللاعب</th><th className="p-4 text-center">المنتخب</th><th className="p-4 text-center">المركز</th><th className="p-4 text-center">السعر</th><th className="p-4 text-center">التقييم</th><th className="p-4 text-center">الزخم</th><th className="p-4 text-center">الطلب</th><th className="p-4 text-left">إجراء</th></tr></thead>
        <tbody>{players.map((player) => <tr key={player.id} className="border-t border-white/5 hover:bg-white/5"><td className="p-4"><div className="flex items-center gap-3"><AssetImage image={player.image} type="PLAYER" name={player.name} width={40} height={40} className="h-11 w-11 rounded-xl border border-white/10 object-cover" /><div><div className="font-black text-white">{player.name}</div><div className="text-xs text-gray-500">{player.code}</div></div></div></td><td className="p-4 text-center text-gray-300">{player.team?.name || '-'}</td><td className="p-4 text-center"><span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">{player.position || '-'}</span></td><td className="p-4 text-center font-black text-white">{formatPrice(player)}</td><td className="p-4 text-center font-bold text-accent">{Math.round(player.score || 0)}</td><td className="p-4 text-center font-bold text-success">{Math.round(player.momentum || 50)}</td><td className="p-4 text-center font-bold text-primary">{Math.round(player.marketDemand || 50)}</td><td className="p-4 text-left"><Link href={`/asset/${player.id}`} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:bg-primary/20">تحليل <ChevronRight size={14} /></Link></td></tr>)}</tbody>
      </table>
    </div>
  );
}
