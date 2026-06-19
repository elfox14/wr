'use client';

import Link from 'next/link';

const REGIONS = [
  { label: 'أوروبا', count: 16, code: 'UEFA', tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]' },
  { label: 'إفريقيا', count: 10, code: 'CAF', tone: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]' },
  { label: 'آسيا', count: 9, code: 'AFC', tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]' },
  { label: 'أمريكا الجنوبية', count: 6, code: 'CONMEBOL', tone: 'border-emerald-200/20 bg-emerald-300/10 text-emerald-200' },
  { label: 'الكونكاكاف', count: 6, code: 'CONCACAF', tone: 'border-red-300/25 bg-red-400/10 text-red-100' },
  { label: 'أوقيانوسيا', count: 1, code: 'OFC', tone: 'border-sky-200/25 bg-sky-300/10 text-sky-200' },
];

const ARAB_TEAMS = [
  { name: 'مصر', code: 'EGY', flag: '🇪🇬', region: 'إفريقيا' },
  { name: 'المغرب', code: 'MAR', flag: '🇲🇦', region: 'إفريقيا' },
  { name: 'تونس', code: 'TUN', flag: '🇹🇳', region: 'إفريقيا' },
  { name: 'الجزائر', code: 'ALG', flag: '🇩🇿', region: 'إفريقيا' },
  { name: 'قطر', code: 'QAT', flag: '🇶🇦', region: 'آسيا' },
  { name: 'السعودية', code: 'KSA', flag: '🇸🇦', region: 'آسيا' },
  { name: 'العراق', code: 'IRQ', flag: '🇮🇶', region: 'آسيا' },
  { name: 'الأردن', code: 'JOR', flag: '🇯🇴', region: 'آسيا' },
];

const HOST_TEAMS = [
  { name: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', note: 'الدولة المستضيفة' },
  { name: 'كندا', code: 'CAN', flag: '🇨🇦', note: 'الدولة المستضيفة' },
  { name: 'المكسيك', code: 'MEX', flag: '🇲🇽', note: 'الدولة المستضيفة' },
];

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function TeamMiniCard({ team }: { team: { name: string; code: string; flag: string; region?: string; note?: string } }) {
  return (
    <Link href={`/teams?search=${encodeURIComponent(team.code)}`} className="group/team flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-2.5 py-2 transition hover:border-[#FFD700]/30 hover:bg-white/[0.075]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-lg shadow-[0_8px_18px_rgba(0,0,0,0.22)]">{team.flag}</span>
      <span className="min-w-0 text-right">
        <span className="block truncate text-xs font-black text-white">{team.name}</span>
        <span className="mt-0.5 block truncate text-[9px] font-bold text-gray-500">{team.code} • {team.region || team.note}</span>
      </span>
    </Link>
  );
}

export default function HomeWorldCupRegionsArabCard() {
  const totalTeams = REGIONS.reduce((sum, region) => sum + region.count, 0);

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-[#FFD700]/15 bg-[radial-gradient(circle_at_10%_10%,rgba(255,215,0,0.12),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(15,240,252,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(0,0,0,0.24))] p-3 text-white shadow-[0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur sm:p-4">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/70 to-transparent" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/25 bg-[#FFD700]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#FFD700]">
            🌐 WORLD MAP
          </span>
          <h2 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">خريطة المونديال</h2>
          <p className="mt-1 text-xs font-bold text-gray-400">توزيع المنتخبات الـ{formatCount(totalTeams)} حسب المناطق، مع المنتخبات العربية والدول المستضيفة.</p>
        </div>
        <Link href="/teams" className="mobile-tap rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-2 text-[11px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">
          كل المنتخبات
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {REGIONS.map((region) => (
          <div key={region.code} className={`rounded-2xl border p-2.5 text-center ${region.tone}`}>
            <div className="text-[10px] font-black text-current/80">{region.code}</div>
            <div className="mt-1 truncate text-sm font-black text-white">{region.label}</div>
            <div className="mt-1 text-2xl font-black leading-none text-current">{formatCount(region.count)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.52fr)]">
        <div className="rounded-[1.25rem] border border-white/10 bg-black/30 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-[#FFD700]">المنتخبات العربية</h3>
              <p className="mt-0.5 text-[10px] font-bold text-gray-500">{formatCount(ARAB_TEAMS.length)} منتخبات عربية في البطولة</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-gray-300">CAF + AFC</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            {ARAB_TEAMS.map((team) => <TeamMiniCard key={team.code} team={team} />)}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.055] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-[#0FF0FC]">الدول المستضيفة</h3>
              <p className="mt-0.5 text-[10px] font-bold text-gray-500">{formatCount(HOST_TEAMS.length)} دول تنظم مونديال ٢٠٢٦</p>
            </div>
            <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">HOSTS</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {HOST_TEAMS.map((team) => <TeamMiniCard key={team.code} team={team} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
