'use client';

const REGIONS = [
  {
    label: 'أوروبا',
    count: 16,
    tone: 'border-[#0FF0FC]/25 bg-[#0FF0FC]/10 text-[#0FF0FC]',
    teams: ['التشيك', 'البوسنة', 'سويسرا', 'اسكتلندا', 'تركيا', 'ألمانيا', 'هولندا', 'السويد', 'بلجيكا', 'إسبانيا', 'فرنسا', 'النرويج', 'النمسا', 'البرتغال', 'إنجلترا', 'كرواتيا'],
  },
  {
    label: 'إفريقيا',
    count: 10,
    tone: 'border-[#00FF88]/25 bg-[#00FF88]/10 text-[#00FF88]',
    teams: ['جنوب إفريقيا', 'المغرب', 'كوت ديفوار', 'تونس', 'مصر', 'الرأس الأخضر', 'السنغال', 'الجزائر', 'الكونغو الديمقراطية', 'غانا'],
  },
  {
    label: 'آسيا',
    count: 9,
    tone: 'border-[#FFD700]/25 bg-[#FFD700]/10 text-[#FFD700]',
    teams: ['كوريا الجنوبية', 'قطر', 'أستراليا', 'اليابان', 'إيران', 'السعودية', 'العراق', 'الأردن', 'أوزبكستان'],
  },
  {
    label: 'أمريكا الجنوبية',
    count: 6,
    tone: 'border-emerald-200/20 bg-emerald-300/10 text-emerald-200',
    teams: ['البرازيل', 'باراغواي', 'الإكوادور', 'أوروغواي', 'الأرجنتين', 'كولومبيا'],
  },
  {
    label: 'الكونكاكاف',
    count: 6,
    tone: 'border-red-300/25 bg-red-400/10 text-red-100',
    teams: ['المكسيك', 'كندا', 'هايتي', 'الولايات المتحدة', 'كوراساو', 'بنما'],
  },
  {
    label: 'أوقيانوسيا',
    count: 1,
    tone: 'border-sky-200/25 bg-sky-300/10 text-sky-200',
    teams: ['نيوزيلندا'],
  },
];

const ARAB_TEAMS = ['مصر', 'المغرب', 'تونس', 'الجزائر', 'قطر', 'السعودية', 'العراق', 'الأردن'];
const HOST_TEAMS = ['الولايات المتحدة', 'كندا', 'المكسيك'];

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function TextCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[26px] items-center justify-center rounded-lg border px-1.5 py-1 text-center text-[9px] font-black leading-4 ${className || 'border-white/10 bg-white/[0.04] text-white'}`}>
      {children}
    </div>
  );
}

export default function HomeWorldCupRegionsArabCard() {
  return (
    <section className="relative overflow-hidden rounded-[1.45rem] border border-[#FFD700]/15 bg-[radial-gradient(circle_at_10%_10%,rgba(255,215,0,0.10),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(15,240,252,0.10),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.22))] p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.24)] backdrop-blur">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700]/70 to-transparent" />

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-black leading-tight text-white sm:text-lg">خريطة المونديال</h2>
        <span className="rounded-full border border-[#FFD700]/15 bg-[#FFD700]/10 px-2.5 py-1 text-[10px] font-black text-[#FFD700]">٤٨ منتخبًا</span>
      </div>

      <div className="grid gap-2">
        {REGIONS.map((region) => (
          <div key={region.label} className={`rounded-2xl border p-2.5 ${region.tone} lg:grid lg:grid-cols-[118px_1fr] lg:items-start lg:gap-3`}>
            <div className="mb-2 flex items-center justify-between gap-2 lg:mb-0 lg:flex-col lg:items-stretch">
              <span className="truncate text-xs font-black text-white lg:text-center">{region.label}</span>
              <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 text-center text-[10px] font-black text-current">{formatCount(region.count)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {region.teams.map((team) => (
                <span key={team} className="flex min-h-[24px] items-center justify-center rounded-lg border border-white/10 bg-black/20 px-1 py-0.5 text-center text-[8.5px] font-bold leading-3 text-white/90">
                  {team}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-white/10 bg-black/25 p-2.5 lg:grid lg:grid-cols-[118px_1fr] lg:items-start lg:gap-3">
          <div className="mb-2 flex items-center justify-between gap-2 lg:mb-0 lg:flex-col lg:items-stretch">
            <span className="text-xs font-black text-[#FFD700] lg:text-center">المنتخبات العربية</span>
            <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 text-center text-[10px] font-black text-[#FFD700]">{formatCount(ARAB_TEAMS.length)}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
            {ARAB_TEAMS.map((name) => (
              <TextCard key={name}>{name}</TextCard>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.055] p-2.5 lg:grid lg:grid-cols-[118px_1fr] lg:items-start lg:gap-3">
          <div className="mb-2 flex items-center justify-between gap-2 lg:mb-0 lg:flex-col lg:items-stretch">
            <span className="text-xs font-black text-[#0FF0FC] lg:text-center">الدول المستضيفة</span>
            <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 text-center text-[10px] font-black text-[#0FF0FC]">{formatCount(HOST_TEAMS.length)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-7">
            {HOST_TEAMS.map((name) => (
              <TextCard key={name} className="border-[#0FF0FC]/15 bg-black/20 text-white">{name}</TextCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
