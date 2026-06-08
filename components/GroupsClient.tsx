'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useStore, Asset, Match } from '@/lib/store';
import { AssetImage } from '@/components/ui/AssetImage';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Flame,
  LayoutGrid,
  LineChart,
  ListOrdered,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

type StandingRow = {
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

type GroupData = {
  key: string;
  name: string;
  teams: Asset[];
  matches: Match[];
  standings: StandingRow[];
  players: (Asset & { team?: Asset })[];
  finishedMatches: number;
  scheduledMatches: number;
  liveMatches: number;
  avgScore: number;
  avgMomentum: number;
  highestDemandTeam?: Asset;
  mostValuableTeam?: Asset;
};

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

function groupDomId(groupKey: string) {
  return `group-${encodeURIComponent(groupKey)}`;
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-surface/40 p-8 text-center">
      <AlertCircle size={32} className="mx-auto mb-3 text-gray-500" />
      <h3 className="mb-2 text-lg font-black text-white">{title}</h3>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function buildStandings(teams: Asset[], matches: Match[]): StandingRow[] {
  const table = teams.map((team) => ({
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

  matches.filter((match) => match.status === 'FINISHED').forEach((match) => {
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
    const aRank = a.team.fifaRank || 999;
    const bRank = b.team.fifaRank || 999;
    if (aRank !== bRank) return aRank - bRank;
    return getTeamPower(b.team) - getTeamPower(a.team);
  });
}

export default function GroupsClient() {
  const { assets, matches, fetchAssets, fetchMatches } = useStore();
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    Promise.all([
      assets.length === 0 ? fetchAssets() : Promise.resolve(),
      matches.length === 0 ? fetchMatches() : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [assets.length, matches.length, fetchAssets, fetchMatches]);

  const groupData = useMemo<GroupData[]>(() => {
    const teams = assets.filter((asset) => asset.type === 'TEAM');
    const groups = teams.reduce((acc, team) => {
      const key = normalizeGroupKey(team.group);
      if (!acc[key]) acc[key] = [];
      acc[key].push(team);
      return acc;
    }, {} as Record<string, Asset[]>);

    return Object.keys(groups).sort((a, b) => a.localeCompare(b)).map((key) => {
      const groupTeams = [...groups[key]].sort((a, b) => (a.fifaRank || 999) - (b.fifaRank || 999));
      const teamIds = new Set(groupTeams.map((team) => team.id));
      const groupMatches = matches
        .filter((match) => {
          const sameGroup = normalizeGroupKey(match.groupPhase) === key;
          const sameTeams = teamIds.has(match.homeTeam?.id) || teamIds.has(match.awayTeam?.id);
          return sameGroup || sameTeams;
        })
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

      const players = groupTeams
        .flatMap((team) => (team.players || []).map((player) => ({ ...player, team })))
        .sort((a, b) => Number(b.marketPrice ?? b.current_price ?? 0) - Number(a.marketPrice ?? a.current_price ?? 0));

      return {
        key,
        name: groupDisplayName(key),
        teams: groupTeams,
        matches: groupMatches,
        standings: buildStandings(groupTeams, groupMatches),
        players,
        finishedMatches: groupMatches.filter((match) => match.status === 'FINISHED').length,
        scheduledMatches: groupMatches.filter((match) => match.status === 'SCHEDULED').length,
        liveMatches: groupMatches.filter((match) => ['IN_PLAY', 'LIVE'].includes(match.status)).length,
        avgScore: groupTeams.length ? Math.round(groupTeams.reduce((sum, team) => sum + (team.score || 0), 0) / groupTeams.length) : 0,
        avgMomentum: groupTeams.length ? Math.round(groupTeams.reduce((sum, team) => sum + (team.momentum || 50), 0) / groupTeams.length) : 0,
        highestDemandTeam: [...groupTeams].sort((a, b) => (b.marketDemand || 0) - (a.marketDemand || 0))[0],
        mostValuableTeam: [...groupTeams].sort((a, b) => Number(b.marketPrice ?? b.current_price ?? 0) - Number(a.marketPrice ?? a.current_price ?? 0))[0],
      };
    });
  }, [assets, matches]);

  const scrollToGroup = (groupKey: string) => {
    const element = document.getElementById(groupDomId(groupKey));
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-5 rounded-3xl border border-white/5 bg-surface/60 px-5 py-4 shadow-card md:px-6 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <LayoutGrid size={20} />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">المجموعات والتصفيات</h1>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-gray-400 md:text-base">
                اضغط على رقم المجموعة للانتقال مباشرة إلى جدولها، مبارياتها، وإحصائيات منتخباتها ولاعبيها.
              </p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-xs text-gray-400">
              <AlertCircle size={14} className="text-primary" />
              النتائج تظهر بعد بداية المباريات فقط
            </div>
          </div>
        </section>

        <section className="sticky top-16 z-40 mb-6 rounded-3xl border border-white/5 bg-background/90 p-3 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-white">اختر المجموعة</h2>
              <p className="text-xs text-gray-500">اضغط للانتقال لنفس المجموعة في الصفحة.</p>
            </div>
            <span className="hidden rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-black text-primary sm:inline-flex">
              {groupData.length} مجموعات
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groupData.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => scrollToGroup(group.key)}
                className="min-w-12 rounded-2xl border border-white/5 bg-surface px-4 py-2 text-base font-black text-gray-300 transition-all hover:border-primary/40 hover:bg-primary hover:text-black"
              >
                {group.key}
              </button>
            ))}
          </div>
        </section>

        {groupData.length === 0 ? (
          <EmptyState title="لا توجد مجموعات" text="تأكد من ربط المنتخبات بحقل المجموعة داخل قاعدة البيانات." />
        ) : (
          <div className="space-y-8">
            {groupData.map((group) => (
              <GroupSection key={group.key} group={group} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function GroupSection({ group }: { group: GroupData }) {
  return (
    <section id={groupDomId(group.key)} className="scroll-mt-40 rounded-3xl border border-white/5 bg-surface/70 p-5 shadow-card md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-2xl font-black text-primary">
            {group.key}
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">{group.name}</h2>
            <p className="text-sm text-gray-500">{group.teams.length} منتخبات · {group.players.length} لاعب · {group.matches.length} مباريات</p>
          </div>
        </div>
        {group.finishedMatches === 0 && (
          <span className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-300">
            البطولة لم تبدأ بعد — لا توجد نتائج فعلية
          </span>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Trophy size={18} />} label="المنتخبات" value={group.teams.length} hint="داخل المجموعة" />
        <StatCard icon={<Target size={18} />} label="متوسط القوة" value={group.avgScore} hint="تقييم المنتخبات" accent="text-accent" />
        <StatCard icon={<Flame size={18} />} label="متوسط الزخم" value={group.avgMomentum} hint="من بيانات السوق" accent="text-success" />
        <StatCard icon={<Users size={18} />} label="اللاعبون" value={group.players.length} hint="مرتبطون بالمنتخبات" accent="text-yellow-300" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/5 bg-background/40 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-black text-white"><ListOrdered size={20} className="text-primary" /> جدول المجموعة</h3>
            <span className="rounded-lg bg-white/5 px-2 py-1 text-xs text-gray-400">نتائج حقيقية فقط</span>
          </div>
          <StandingsTable standings={group.standings} finishedMatchesCount={group.finishedMatches} />
        </div>

        <div className="rounded-3xl border border-white/5 bg-background/40 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-black text-white"><CalendarDays size={20} className="text-primary" /> مباريات المجموعة</h3>
            <div className="flex gap-2 text-xs">
              <span className="rounded-lg bg-white/5 px-2 py-1 text-gray-400">قادمة {group.scheduledMatches}</span>
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary">مباشرة {group.liveMatches}</span>
              <span className="rounded-lg bg-success/10 px-2 py-1 text-success">منتهية {group.finishedMatches}</span>
            </div>
          </div>
          {group.matches.length === 0 ? <EmptyState title="لا توجد مباريات" text="لم يتم ربط مباريات بهذه المجموعة حتى الآن." /> : <div className="space-y-3">{group.matches.slice(0, 6).map((match) => <MatchCard key={match.id} match={match} />)}</div>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/5 bg-background/40 p-4">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><ShieldCheck size={20} className="text-primary" /> إحصائيات المنتخبات</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.teams.map((team) => <TeamStatsCard key={team.id} team={team} />)}
          </div>
        </div>

        <div className="rounded-3xl border border-white/5 bg-background/40 p-4">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><Users size={20} className="text-primary" /> أبرز اللاعبين</h3>
          {group.players.length === 0 ? <EmptyState title="لا توجد بيانات لاعبين" text="تأكد من ربط اللاعبين بمنتخباتهم داخل قاعدة البيانات." /> : <PlayersTable players={group.players.slice(0, 8)} />}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <HighlightCard title="أعلى طلب سوقي" asset={group.highestDemandTeam} metric={group.highestDemandTeam ? `${Math.round(group.highestDemandTeam.marketDemand || 0)}/100` : '—'} icon={<Zap size={18} />} />
        <HighlightCard title="أعلى سعر سوقي" asset={group.mostValuableTeam} metric={group.mostValuableTeam ? formatPrice(group.mostValuableTeam) : '—'} icon={<LineChart size={18} />} />
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, hint, accent = 'text-primary' }: { icon: React.ReactNode; label: string; value: number; hint: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-background/40 p-4">
      <div className={`mb-2 flex items-center gap-2 text-sm font-bold ${accent}`}>{icon}{label}</div>
      <div className="text-3xl font-black text-white tabular-nums">{value.toLocaleString()}</div>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function StandingsTable({ standings, finishedMatchesCount }: { standings: StandingRow[]; finishedMatchesCount: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5">
      <table className="w-full whitespace-nowrap text-right text-sm">
        <thead className="bg-white/5 text-gray-400">
          <tr>
            <th className="p-3 text-center">#</th>
            <th className="p-3">المنتخب</th>
            <th className="p-3 text-center">لعب</th>
            <th className="p-3 text-center">فاز</th>
            <th className="p-3 text-center">تعادل</th>
            <th className="p-3 text-center">خسر</th>
            <th className="p-3 text-center">له</th>
            <th className="p-3 text-center">عليه</th>
            <th className="p-3 text-center">فارق</th>
            <th className="p-3 text-center text-primary">نقاط</th>
            <th className="p-3 text-center">الحالة</th>
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
              <td className="p-3 text-center">{row.played}</td>
              <td className="p-3 text-center">{row.won}</td>
              <td className="p-3 text-center">{row.drawn}</td>
              <td className="p-3 text-center">{row.lost}</td>
              <td className="p-3 text-center">{row.goalsFor}</td>
              <td className="p-3 text-center">{row.goalsAgainst}</td>
              <td className="p-3 text-center font-bold">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td className="p-3 text-center text-lg font-black text-primary">{row.points}</td>
              <td className="p-3 text-center">
                {finishedMatchesCount === 0 ? <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-gray-400">لم يبدأ</span> : index < 2 ? <span className="rounded-lg border border-success/20 bg-success/10 px-2 py-1 text-xs font-bold text-success">منطقة تأهل</span> : <span className="rounded-lg border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-xs font-bold text-orange-300">ينافس</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const date = new Date(match.matchDate);
  const isLive = ['IN_PLAY', 'LIVE'].includes(match.status);
  const isFinished = match.status === 'FINISHED';
  return (
    <Link href={`/matches/${match.id}`} className="block rounded-2xl border border-white/5 bg-black/20 p-4 transition-colors hover:border-primary/30">
      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
        <span>{date.toLocaleDateString('ar-EG')} · {date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className={`rounded-lg px-2 py-1 font-bold ${isLive ? 'bg-primary/10 text-primary' : isFinished ? 'bg-success/10 text-success' : 'bg-white/5 text-gray-400'}`}>{isLive ? 'مباشرة' : isFinished ? 'انتهت' : 'قادمة'}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamMini team={match.homeTeam} score={isFinished || isLive ? match.homeScore : undefined} />
        <div className="text-center text-xs font-black text-gray-500">VS</div>
        <TeamMini team={match.awayTeam} score={isFinished || isLive ? match.awayScore : undefined} align="left" />
      </div>
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
    <div className="rounded-3xl border border-white/5 bg-background/40 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-primary">{icon}{title}</div>
      {asset ? <Link href={`/asset/${asset.id}`} className="flex items-center justify-between rounded-2xl bg-black/20 p-4 hover:bg-white/5"><div className="flex items-center gap-3"><AssetImage image={asset.image} type="TEAM" name={asset.name} width={46} height={46} className="h-12 w-12 rounded-xl object-cover" /><div><div className="font-black text-white">{asset.name}</div><div className="text-xs text-gray-500">{formatPrice(asset)}</div></div></div><div className="text-2xl font-black text-primary">{metric}</div></Link> : <p className="text-gray-500">لا توجد بيانات.</p>}
    </div>
  );
}

function TeamStatsCard({ team }: { team: Asset }) {
  const premiumDiscount = getPremiumDiscount(team);
  return (
    <Link href={`/asset/${team.id}`} className="rounded-2xl border border-white/5 bg-black/20 p-4 transition-colors hover:border-primary/30">
      <div className="mb-4 flex items-start justify-between gap-3"><AssetImage image={team.image} type="TEAM" name={team.name} width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" /><span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">FIFA #{team.fifaRank || '-'}</span></div>
      <h4 className="mb-4 text-lg font-black text-white">{team.name}</h4>
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
        <thead className="bg-white/5 text-gray-400"><tr><th className="p-3">اللاعب</th><th className="p-3 text-center">المنتخب</th><th className="p-3 text-center">المركز</th><th className="p-3 text-center">السعر</th><th className="p-3 text-center">الزخم</th><th className="p-3 text-left">إجراء</th></tr></thead>
        <tbody>{players.map((player) => <tr key={player.id} className="border-t border-white/5 hover:bg-white/5"><td className="p-3"><div className="flex items-center gap-3"><AssetImage image={player.image} type="PLAYER" name={player.name} width={38} height={38} className="h-10 w-10 rounded-xl border border-white/10 object-cover" /><div><div className="font-black text-white">{player.name}</div><div className="text-xs text-gray-500">{player.code}</div></div></div></td><td className="p-3 text-center text-gray-300">{player.team?.name || '-'}</td><td className="p-3 text-center"><span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-bold text-gray-300">{player.position || '-'}</span></td><td className="p-3 text-center font-black text-white">{formatPrice(player)}</td><td className="p-3 text-center font-bold text-success">{Math.round(player.momentum || 50)}</td><td className="p-3 text-left"><Link href={`/asset/${player.id}`} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary hover:bg-primary/20">تحليل <ChevronRight size={14} /></Link></td></tr>)}</tbody>
      </table>
    </div>
  );
}
