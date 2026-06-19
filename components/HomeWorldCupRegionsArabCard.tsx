'use client';

import Link from 'next/link';

const REGIONS = [
  { label: 'أوروبا', count: 16, tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]' },
  { label: 'إفريقيا', count: 10, tone: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' },
  { label: 'آسيا', count: 9, tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' },
  { label: 'أمريكا الجنوبية', count: 6, tone: 'border-emerald-200/20 bg-emerald-300/10 text-emerald-200' },
  { label: 'الكونكاكاف', count: 6, tone: 'border-red-300/25 bg-red-400/10 text-red-100' },
  { label: 'أوقيانوسيا', count: 1, tone: 'border-sky-200/25 bg-sky-300/10 text-sky-200' },
];

const ARAB_TEAMS = ['مصر', 'المغرب', 'تونس', 'الجزائر', 'قطر', 'السعودية', 'العراق', 'الأردن'];
const HOST_TEAMS = ['الولايات المتحدة', 'كندا', 'المكسيك'];

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function TextCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[34px] items-center justify-center rounded-xl border px-2 py-1.5 text-center text-[11px] font-black leading-4 ${className || 'border-white/10 bg-white/[0.045] text-white'}`}>
      {children}
    </div>
  );
}

export default function HomeWorldCupRegionsArabCard() {
  const totalTeams = REGIONS.reduce((sum, region) => sum + region.count, 0);

  return (
    <section className="relative overflow-hidden rounded-[1.45rem] border border-[#FFD700]/15 bg-[radial-gradient(circle_at_10%_10%,rgba(255,215,0,0.10),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(15,240,252,0.10),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.24)] backdrop-blur">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/70 to-transparent" />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black leading-tight text-white">خريطة المونديال</h2>
          <p className="mt-0.5 text-[10px] font-bold text-gray-500">{formatCount(totalTeams)} منتخبًا • عرب ومستضيفون</p>
        </div>
        <Link href="/teams" className="mobile-tap shrink-0 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2.5 py-1.5 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">
          المنتخبات
        </Link>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1.15fr_1.35fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
          <div className="mb-1.5 text-[10px] font-black text-[#0FF0FC]">المناطق</div>
          <div className="grid grid-cols-2 gap-1.5">
            {REGIONS.map((region) => (
              <TextCard key={region.label} className={`${region.tone} min-h-[32px]`}>
                <span className="truncate">{region.label} {formatCount(region.count)}</span>
              </TextCard>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
          <div className="mb-1.5 text-[10px] font-black text-[#FFD700]">المنتخبات العربية</div>
          <div className="grid grid-cols-4 gap-1.5">
            {ARAB_TEAMS.map((name) => (
              <TextCard key={name}>{name}</TextCard>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.055] p-2">
          <div className="mb-1.5 text-[10px] font-black text-[#0FF0FC]">الدول المستضيفة</div>
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-1">
            {HOST_TEAMS.map((name) => (
              <TextCard key={name} className="border-[#0FF0FC]/15 bg-black/20 text-white">{name}</TextCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
