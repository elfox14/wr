import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Gauge, Trophy } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';
import { formatDate, formatNumber, matches, percent, performance } from './teamData';
import type { TeamAsset } from './teamPageTypes';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-[11px] font-black text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-white tabular-nums md:text-2xl">{value}</div>
      {hint && <div className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</div>}
    </div>
  );
}

function teamRating(team: TeamAsset) {
  if (typeof team.score === 'number' && Number.isFinite(team.score)) return `${Math.round(team.score).toLocaleString('ar-EG')}/100`;
  const stats = performance(team);
  if (!stats) return '—';
  const value = Math.max(0, Math.min(100, 50 + stats.wins * 10 + stats.draws * 4 - stats.losses * 7 + stats.avgGoalsFor * 7 - stats.avgGoalsAgainst * 5));
  return `${Math.round(value).toLocaleString('ar-EG')}/100`;
}

export default function TeamHeroSnapshot({ team }: { team: TeamAsset }) {
  const allMatches = matches(team).sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const nextMatch = allMatches.find((match) => match.status !== 'FINISHED' && new Date(match.matchDate).getTime() >= Date.now()) || allMatches.find((match) => match.status !== 'FINISHED');
  const remainingGroupMatches = allMatches.filter((match) => match.status !== 'FINISHED' && (match.stage === 'group' || match.groupPhase || team.group)).length;
  const change = typeof team.change === 'number' ? team.change : null;
  const ChangeIcon = change !== null && change < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <section className="overflow-hidden rounded-3xl border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(15,240,252,0.18),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.28)] md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center">
          <AssetImage image={team.image || ''} type="TEAM" name={team.name} width={92} height={92} className="h-24 w-24 rounded-[1.6rem] border border-white/10 bg-black/35 object-cover" />
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-black text-primary"><Trophy size={14} /> TEAM PROFILE</span>
              {team.code && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{team.code}</span>}
              {team.group && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">المجموعة {team.group}</span>}
              {team.continent && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">{team.continent}</span>}
              {team.fifaRank && <span className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs font-black text-slate-300">FIFA #{formatNumber(team.fifaRank)}</span>}
            </div>
            <h2 className="text-3xl font-black text-white md:text-4xl">{team.name}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-8 text-slate-300">هوية المنتخب، وضعه في المجموعة، مؤشرات الأداء، وإحصاءات FBref/Stathead المستوردة في صفحة واحدة دون جلب مباشر من مصادر خارجية.</p>
            {nextMatch && (
              <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-slate-300">
                <CalendarDays size={14} className="text-primary" /> المباراة القادمة: {formatDate(nextMatch.matchDate, true)}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/team-intelligence?teamId=${team.id}`} className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary transition hover:bg-primary hover:text-black">تحديث التقرير</Link>
          <Link href="/groups" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:border-primary/40 hover:text-primary">المجموعات</Link>
          <Link href="/matches" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:border-primary/40 hover:text-primary">المباريات</Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="السعر في البورصة" value={`${formatNumber(Math.round(Number(team.marketPrice ?? team.current_price ?? 0)))}¢`} hint="قيمة افتراضية ترفيهية" />
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="text-[11px] font-black text-slate-500">التغيير</div>
          <div className="mt-1 flex items-center gap-2 text-xl font-black text-white tabular-nums md:text-2xl"><ChangeIcon size={20} className={change !== null && change < 0 ? 'text-rose-300' : 'text-emerald-300'} />{percent(change)}</div>
          <div className="mt-1 text-[11px] leading-5 text-slate-500">آخر حركة سعرية محفوظة</div>
        </div>
        <Tile label="تقييم الفريق" value={teamRating(team)} hint="مؤشر داخلي مبني على البيانات المتاحة" />
        <Tile label="مباريات المجموعة المتبقية" value={formatNumber(remainingGroupMatches)} hint="حسب جدول المباريات المخزن" />
      </div>

      <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><Gauge size={14} className="mb-2 text-primary" /> لا يتم عرض أي رقم إحصائي غير موجود في المصادر أو قاعدة البيانات.</div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><BarChart3 size={14} className="mb-2 text-primary" /> مؤشرات الأداء هنا للعرض والتحليل وليست توقعات تأهل أو نصائح تداول.</div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><CalendarDays size={14} className="mb-2 text-primary" /> يتم حساب المباريات والجدول من بيانات Prisma الحالية.</div>
      </div>
    </section>
  );
}
