import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarChart3, Goal, Shield, Zap } from 'lucide-react';
import { decimal, formatDate, formatNumber, getFbrefMetrics, getFbrefReport, list, sourceLabel } from './teamData';
import type { FbrefMetrics, TeamAsset } from './teamPageTypes';

function value(value?: number | null, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)}${suffix}` : 'غير متوفر';
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-black text-white/75">{icon}{title}</div>
      <div className="space-y-3 text-sm text-slate-300">{children}</div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-3 py-2"><span className="text-slate-500">{label}</span><span className="font-black text-white tabular-nums">{value}</span></div>;
}

function missingText(metrics: FbrefMetrics) {
  const missing = (metrics.missing || []).slice(0, 3);
  return missing.length ? missing.join('، ') : 'لا توجد عناصر ناقصة مسجلة في التصدير.';
}

export default function FbrefStatsPanel({ team }: { team: TeamAsset }) {
  const report = getFbrefReport(team.intelligenceReports);
  const metrics = getFbrefMetrics(team.intelligenceReports);

  if (!metrics) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#101217] p-5">
        <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-black text-primary"><BarChart3 size={15} /> FBREF</div>
        <h3 className="text-xl font-black text-white">لوحة إحصاءات FBref/Stathead</h3>
        <p className="mt-3 text-sm leading-7 text-slate-400">غير متوفر في المصادر: لم يتم استيراد تقرير FBref/Stathead لهذا المنتخب بعد.</p>
      </section>
    );
  }

  const sourceUrl = report?.sourceUrl || metrics.pageUrl || null;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#101217] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-black text-primary"><BarChart3 size={15} /> FBREF / STATHEAD</div>
          <h3 className="text-xl font-black text-white">لوحة الإحصاءات التفصيلية</h3>
        </div>
        <div className="text-xs leading-6 text-slate-500">
          <div>{sourceLabel(report)}</div>
          {metrics.exportedAt && <div>تاريخ التصدير: {formatDate(metrics.exportedAt)}</div>}
          {sourceUrl && <Link href={sourceUrl} className="font-black text-primary hover:underline" target="_blank">فتح المصدر</Link>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="الهجوم" icon={<Goal size={15} />}>
          <Row label="الأهداف" value={value(metrics.shooting?.goals)} />
          <Row label="التسديدات" value={value(metrics.shooting?.shots)} />
          <Row label="على المرمى" value={value(metrics.shooting?.shotsOnTarget)} />
          <Row label="دقة التسديد" value={typeof metrics.shooting?.shotAccuracy === 'number' ? `${decimal(metrics.shooting.shotAccuracy)}%` : 'غير متوفر'} />
          <p className="text-xs leading-6 text-slate-500">أبرز المسددين: {list(metrics.shooting?.activeShooters) || 'غير متوفر في المصادر'}</p>
        </Card>
        <Card title="الدفاع والحراسة" icon={<Shield size={15} />}>
          <Row label="أهداف مستقبلة" value={value(metrics.standing?.ga ?? metrics.goalkeeping?.goalsAgainst)} />
          <Row label="الحارس" value={metrics.goalkeeping?.goalkeeper || metrics.league?.goalkeeper || 'غير متوفر'} />
          <Row label="تصديات" value={value(metrics.goalkeeping?.saves)} />
          <Row label="تسديدات على مرماه" value={value(metrics.goalkeeping?.shotsOnTargetAgainst)} />
          <p className="text-xs leading-6 text-slate-500">نسبة التصديات: {metrics.goalkeeping?.savePercentage || 'غير متوفر في المصادر'}</p>
        </Card>
        <Card title="الأسلوب والتحكم" icon={<Zap size={15} />}>
          <Row label="متوسط الاستحواذ" value={typeof metrics.matchContext?.averagePossession === 'number' ? `${decimal(metrics.matchContext.averagePossession)}%` : 'غير متوفر'} />
          <Row label="الرسوم الخططية" value={list(metrics.matchContext?.formations) || 'غير متوفر'} />
          <Row label="متوسط العمر" value={typeof metrics.roster?.averageAge === 'number' ? `${decimal(metrics.roster.averageAge)} سنة` : 'غير متوفر'} />
          <Row label="عدد اللاعبين في المصدر" value={value(metrics.roster?.count)} />
          <p className="text-xs leading-6 text-slate-500">أندية حاضرة: {list(metrics.roster?.topClubs) || 'غير متوفر في المصادر'}</p>
        </Card>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-7 text-slate-400">
        معلومات ناقصة في التصدير الحالي: {missingText(metrics)}
      </div>
    </section>
  );
}
