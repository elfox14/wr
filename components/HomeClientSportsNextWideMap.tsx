'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import HomeClientSportsNext from '@/components/HomeClientSportsNext';

type HomeProps = ComponentProps<typeof HomeClientSportsNext>;

type RegionalTeam = {
  name: string;
  flag: string;
  x: number;
  y: number;
};

type TeamRegion = {
  title: string;
  subtitle: string;
  viewBox: string;
  paths: string[];
  teams: RegionalTeam[];
};

const teamRegions: TeamRegion[] = [
  {
    title: 'المستضيفون',
    subtitle: 'أمريكا الشمالية: كندا، الولايات المتحدة، والمكسيك.',
    viewBox: '0 0 360 190',
    paths: [
      'M59 25 L87 17 L119 19 L143 34 L166 35 L190 48 L202 67 L193 87 L165 83 L147 100 L120 97 L97 84 L79 87 L60 70 L49 48 Z',
      'M97 91 L122 103 L142 120 L157 142 L150 158 L124 152 L105 130 L91 109 Z',
    ],
    teams: [
      { name: 'كندا', flag: '🇨🇦', x: 34, y: 28 },
      { name: 'الولايات المتحدة', flag: '🇺🇸', x: 40, y: 49 },
      { name: 'المكسيك', flag: '🇲🇽', x: 42, y: 67 },
    ],
  },
  {
    title: 'العرب',
    subtitle: 'شمال أفريقيا والشرق الأوسط بمواقع نسبية على الخريطة.',
    viewBox: '0 0 360 190',
    paths: [
      'M31 86 L54 72 L88 69 L116 74 L151 76 L171 88 L161 110 L124 117 L87 111 L55 103 Z',
      'M176 83 L207 80 L230 92 L242 115 L230 139 L205 132 L190 108 Z',
      'M238 104 L268 111 L294 133 L279 155 L246 147 L231 125 Z',
    ],
    teams: [
      { name: 'المغرب', flag: '🇲🇦', x: 17, y: 55 },
      { name: 'الجزائر', flag: '🇩🇿', x: 28, y: 55 },
      { name: 'تونس', flag: '🇹🇳', x: 38, y: 48 },
      { name: 'مصر', flag: '🇪🇬', x: 50, y: 58 },
      { name: 'الأردن', flag: '🇯🇴', x: 58, y: 55 },
      { name: 'العراق', flag: '🇮🇶', x: 64, y: 50 },
      { name: 'السعودية', flag: '🇸🇦', x: 70, y: 68 },
      { name: 'قطر', flag: '🇶🇦', x: 76, y: 66 },
    ],
  },
  {
    title: 'أوروبا',
    subtitle: 'خريطة أوروبية مصغرة تشمل الجزر والشمال والبلقان.',
    viewBox: '0 0 360 190',
    paths: [
      'M111 63 L130 45 L163 37 L201 43 L228 58 L242 81 L233 108 L209 125 L174 122 L145 110 L121 91 Z',
      'M84 52 L100 43 L111 55 L102 77 L85 80 L76 66 Z',
      'M181 18 L212 15 L229 31 L214 48 L187 43 Z',
      'M226 106 L260 116 L284 139 L263 151 L233 135 Z',
    ],
    teams: [
      { name: 'اسكتلندا', flag: '🏴', x: 25, y: 35 },
      { name: 'إنجلترا', flag: '🏴', x: 29, y: 45 },
      { name: 'فرنسا', flag: '🇫🇷', x: 39, y: 58 },
      { name: 'إسبانيا', flag: '🇪🇸', x: 34, y: 74 },
      { name: 'البرتغال', flag: '🇵🇹', x: 28, y: 75 },
      { name: 'ألمانيا', flag: '🇩🇪', x: 51, y: 49 },
      { name: 'هولندا', flag: '🇳🇱', x: 45, y: 42 },
      { name: 'بلجيكا', flag: '🇧🇪', x: 43, y: 49 },
      { name: 'سويسرا', flag: '🇨🇭', x: 49, y: 63 },
      { name: 'النمسا', flag: '🇦🇹', x: 56, y: 61 },
      { name: 'كرواتيا', flag: '🇭🇷', x: 62, y: 68 },
      { name: 'تركيا', flag: '🇹🇷', x: 76, y: 77 },
    ],
  },
  {
    title: 'أمريكا الجنوبية',
    subtitle: 'امتداد القارة من كولومبيا حتى الأرجنتين وأوروغواي.',
    viewBox: '0 0 360 190',
    paths: [
      'M154 16 L187 24 L207 45 L207 68 L193 86 L184 111 L171 139 L149 178 L127 163 L136 132 L121 104 L110 75 L119 44 Z',
      'M111 57 L92 69 L102 88 L124 82 Z',
    ],
    teams: [
      { name: 'كولومبيا', flag: '🇨🇴', x: 34, y: 35 },
      { name: 'الإكوادور', flag: '🇪🇨', x: 31, y: 44 },
      { name: 'البرازيل', flag: '🇧🇷', x: 55, y: 47 },
      { name: 'باراغواي', flag: '🇵🇾', x: 51, y: 64 },
      { name: 'أوروغواي', flag: '🇺🇾', x: 57, y: 75 },
      { name: 'الأرجنتين', flag: '🇦🇷', x: 45, y: 81 },
    ],
  },
  {
    title: 'أفريقيا',
    subtitle: 'شكل القارة مع شمال وغرب ووسط وجنوب أفريقيا.',
    viewBox: '0 0 360 190',
    paths: [
      'M143 13 L188 18 L223 41 L235 77 L219 103 L202 138 L177 177 L145 166 L123 132 L103 107 L90 74 L105 43 Z',
      'M238 133 L255 150 L248 169 L230 156 Z',
      'M70 78 L88 73 L95 91 L78 98 Z',
    ],
    teams: [
      { name: 'المغرب', flag: '🇲🇦', x: 31, y: 23 },
      { name: 'الجزائر', flag: '🇩🇿', x: 43, y: 31 },
      { name: 'تونس', flag: '🇹🇳', x: 54, y: 26 },
      { name: 'مصر', flag: '🇪🇬', x: 65, y: 36 },
      { name: 'السنغال', flag: '🇸🇳', x: 25, y: 49 },
      { name: 'كوت ديفوار', flag: '🇨🇮', x: 35, y: 60 },
      { name: 'غانا', flag: '🇬🇭', x: 40, y: 60 },
      { name: 'الكونغو الديمقراطية', flag: '🇨🇩', x: 56, y: 65 },
      { name: 'جنوب أفريقيا', flag: '🇿🇦', x: 55, y: 88 },
    ],
  },
  {
    title: 'آسيا',
    subtitle: 'الخليج ووسط آسيا وشرق القارة على خريطة واحدة.',
    viewBox: '0 0 360 190',
    paths: [
      'M53 70 L88 43 L138 27 L196 25 L252 39 L311 69 L293 101 L235 111 L191 96 L148 112 L105 103 L74 90 Z',
      'M86 91 L117 100 L125 129 L99 141 L76 119 Z',
      'M300 78 L322 87 L315 103 L294 99 Z',
    ],
    teams: [
      { name: 'الأردن', flag: '🇯🇴', x: 20, y: 55 },
      { name: 'العراق', flag: '🇮🇶', x: 27, y: 52 },
      { name: 'إيران', flag: '🇮🇷', x: 36, y: 49 },
      { name: 'السعودية', flag: '🇸🇦', x: 28, y: 67 },
      { name: 'قطر', flag: '🇶🇦', x: 34, y: 65 },
      { name: 'أوزبكستان', flag: '🇺🇿', x: 45, y: 37 },
      { name: 'كوريا الجنوبية', flag: '🇰🇷', x: 79, y: 43 },
      { name: 'اليابان', flag: '🇯🇵', x: 87, y: 51 },
    ],
  },
  {
    title: 'أوقيانوسيا',
    subtitle: 'أستراليا ونيوزيلندا في موضعهما الطبيعي.',
    viewBox: '0 0 360 190',
    paths: [
      'M91 91 L121 76 L164 82 L192 105 L181 134 L138 146 L96 130 L75 111 Z',
      'M234 124 L250 132 L243 147 L225 141 Z',
      'M258 150 L278 158 L267 174 L247 165 Z',
    ],
    teams: [
      { name: 'أستراليا', flag: '🇦🇺', x: 39, y: 63 },
      { name: 'نيوزيلندا', flag: '🇳🇿', x: 72, y: 82 },
    ],
  },
];

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function RegionalMapCard({ region }: { region: TeamRegion }) {
  return (
    <article className="group/map overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-[#FFD700]">{region.title}</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-400">{region.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-gray-300">{formatCount(region.teams.length)} منتخبات</span>
      </div>

      <div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.045),rgba(0,0,0,0.28))]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:24px_24px]" />
        <svg viewBox={region.viewBox} className="absolute inset-0 h-full w-full p-5 opacity-95" role="img" aria-label={`خريطة ${region.title}`}>
          {region.paths.map((path, index) => (
            <path key={path} d={path} fill={index === 0 ? 'rgba(15,240,252,0.23)' : 'rgba(255,215,0,0.12)'} stroke={index === 0 ? 'rgba(15,240,252,0.78)' : 'rgba(255,255,255,0.30)'} strokeWidth="2.4" strokeLinejoin="round" />
          ))}
        </svg>
        {region.teams.map((team) => (
          <Link key={`${region.title}-${team.name}`} href={`/teams?search=${encodeURIComponent(team.name)}`} title={team.name} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/75 px-1.5 py-1 text-lg shadow-[0_8px_22px_rgba(0,0,0,0.45)] transition hover:z-20 hover:scale-125 hover:border-[#FFD700]/70 hover:bg-[#FFD700]/20" style={{ left: `${team.x}%`, top: `${team.y}%` }}>
            <span className="sr-only">{team.name}</span>
            <span aria-hidden="true">{team.flag}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function FullWidthTournamentMap() {
  return (
    <section className="mx-auto max-w-7xl px-3 pb-6 sm:px-4 lg:px-6" dir="rtl" aria-label="خريطة البطولة بالعرض">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.15),transparent_28%),rgba(255,255,255,0.04)] p-4 shadow-card backdrop-blur md:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0FF0FC]">Tournament Map</p>
            <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">خريطة البطولة</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-gray-400">قسم بعرض الصفحة يعرض مناطق البطولة فوق خرائط جغرافية فعلية مبسطة، مع وضع أعلام المنتخبات في مواقعها النسبية.</p>
          </div>
          <Link href="/teams" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-gray-200 transition hover:bg-white/[0.08]">كل المنتخبات</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {teamRegions.map((region) => <RegionalMapCard key={region.title} region={region} />)}
        </div>
      </div>
    </section>
  );
}

export default function HomeClientSportsNextWideMap(props: HomeProps) {
  return (
    <div className="home-wide-map-override bg-[#05070b]">
      <style jsx global>{`
        .home-wide-map-override > main > div:last-child > section:last-child {
          display: none !important;
        }

        .home-wide-map-override > main > div:last-child > section:first-child {
          grid-column: 1 / -1;
        }
      `}</style>
      <HomeClientSportsNext {...props} />
      <FullWidthTournamentMap />
    </div>
  );
}
