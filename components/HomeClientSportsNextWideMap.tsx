'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import HomeClientSportsNext from '@/components/HomeClientSportsNext';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type HomeProps = ComponentProps<typeof HomeClientSportsNext>;

type RegionalTeam = {
  name: string;
  code: string;
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
      { name: 'كندا', code: 'CAN', flag: '🇨🇦', x: 27, y: 25 },
      { name: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', x: 45, y: 48 },
      { name: 'المكسيك', code: 'MEX', flag: '🇲🇽', x: 38, y: 70 },
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
      { name: 'المغرب', code: 'MAR', flag: '🇲🇦', x: 13, y: 57 },
      { name: 'الجزائر', code: 'ALG', flag: '🇩🇿', x: 28, y: 50 },
      { name: 'تونس', code: 'TUN', flag: '🇹🇳', x: 42, y: 43 },
      { name: 'مصر', code: 'EGY', flag: '🇪🇬', x: 52, y: 61 },
      { name: 'الأردن', code: 'JOR', flag: '🇯🇴', x: 61, y: 51 },
      { name: 'العراق', code: 'IRQ', flag: '🇮🇶', x: 69, y: 42 },
      { name: 'السعودية', code: 'KSA', flag: '🇸🇦', x: 71, y: 72 },
      { name: 'قطر', code: 'QAT', flag: '🇶🇦', x: 84, y: 62 },
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
      { name: 'اسكتلندا', code: 'SCO', flag: '🏴', x: 22, y: 29 },
      { name: 'إنجلترا', code: 'ENG', flag: '🏴', x: 28, y: 46 },
      { name: 'فرنسا', code: 'FRA', flag: '🇫🇷', x: 38, y: 61 },
      { name: 'إسبانيا', code: 'ESP', flag: '🇪🇸', x: 31, y: 78 },
      { name: 'البرتغال', code: 'POR', flag: '🇵🇹', x: 18, y: 77 },
      { name: 'هولندا', code: 'NED', flag: '🇳🇱', x: 42, y: 39 },
      { name: 'بلجيكا', code: 'BEL', flag: '🇧🇪', x: 48, y: 52 },
      { name: 'ألمانيا', code: 'GER', flag: '🇩🇪', x: 56, y: 43 },
      { name: 'سويسرا', code: 'SUI', flag: '🇨🇭', x: 51, y: 66 },
      { name: 'النمسا', code: 'AUT', flag: '🇦🇹', x: 64, y: 60 },
      { name: 'كرواتيا', code: 'CRO', flag: '🇭🇷', x: 66, y: 75 },
      { name: 'تركيا', code: 'TUR', flag: '🇹🇷', x: 83, y: 79 },
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
      { name: 'كولومبيا', code: 'COL', flag: '🇨🇴', x: 30, y: 33 },
      { name: 'الإكوادور', code: 'ECU', flag: '🇪🇨', x: 25, y: 47 },
      { name: 'البرازيل', code: 'BRA', flag: '🇧🇷', x: 58, y: 48 },
      { name: 'باراغواي', code: 'PAR', flag: '🇵🇾', x: 54, y: 65 },
      { name: 'أوروغواي', code: 'URU', flag: '🇺🇾', x: 62, y: 78 },
      { name: 'الأرجنتين', code: 'ARG', flag: '🇦🇷', x: 42, y: 84 },
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
      { name: 'المغرب', code: 'MAR', flag: '🇲🇦', x: 28, y: 20 },
      { name: 'الجزائر', code: 'ALG', flag: '🇩🇿', x: 42, y: 31 },
      { name: 'تونس', code: 'TUN', flag: '🇹🇳', x: 57, y: 23 },
      { name: 'مصر', code: 'EGY', flag: '🇪🇬', x: 67, y: 38 },
      { name: 'السنغال', code: 'SEN', flag: '🇸🇳', x: 20, y: 51 },
      { name: 'كوت ديفوار', code: 'CIV', flag: '🇨🇮', x: 30, y: 64 },
      { name: 'غانا', code: 'GHA', flag: '🇬🇭', x: 44, y: 60 },
      { name: 'الكونغو الديمقراطية', code: 'COD', flag: '🇨🇩', x: 61, y: 67 },
      { name: 'جنوب أفريقيا', code: 'RSA', flag: '🇿🇦', x: 52, y: 88 },
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
      { name: 'الأردن', code: 'JOR', flag: '🇯🇴', x: 15, y: 56 },
      { name: 'العراق', code: 'IRQ', flag: '🇮🇶', x: 27, y: 49 },
      { name: 'إيران', code: 'IRN', flag: '🇮🇷', x: 39, y: 52 },
      { name: 'السعودية', code: 'KSA', flag: '🇸🇦', x: 26, y: 72 },
      { name: 'قطر', code: 'QAT', flag: '🇶🇦', x: 42, y: 68 },
      { name: 'أوزبكستان', code: 'UZB', flag: '🇺🇿', x: 49, y: 34 },
      { name: 'كوريا الجنوبية', code: 'KOR', flag: '🇰🇷', x: 78, y: 42 },
      { name: 'اليابان', code: 'JPN', flag: '🇯🇵', x: 88, y: 54 },
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
      { name: 'أستراليا', code: 'AUS', flag: '🇦🇺', x: 35, y: 62 },
      { name: 'نيوزيلندا', code: 'NZL', flag: '🇳🇿', x: 72, y: 82 },
    ],
  },
];

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

function TeamMapLabel({ team }: { team: RegionalTeam }) {
  const flagUrl = getTeamFlagUrl({ code: team.code, name: team.name }, 80);

  return (
    <Link
      href={`/teams?search=${encodeURIComponent(team.name)}`}
      title={team.name}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-2.5 py-1.5 text-[11px] font-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.48)] backdrop-blur transition hover:z-20 hover:scale-110 hover:border-[#FFD700]/70 hover:bg-[#111827]"
      style={{ left: `${team.x}%`, top: `${team.y}%` }}
    >
      <span
        className="h-4 w-6 shrink-0 rounded-[3px] border border-white/20 bg-cover bg-center shadow-sm"
        style={flagUrl ? { backgroundImage: `url(${flagUrl})` } : undefined}
        aria-hidden="true"
      >
        {!flagUrl ? team.flag : null}
      </span>
      <span className="whitespace-nowrap leading-none">{team.name}</span>
    </Link>
  );
}

function RegionalMapCard({ region }: { region: TeamRegion }) {
  return (
    <article className="group/map overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.055] xl:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-[#FFD700]">{region.title}</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-gray-400">{region.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black text-gray-300">{formatCount(region.teams.length)} منتخبات</span>
      </div>

      <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(15,240,252,0.14),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.045),rgba(0,0,0,0.28))] md:min-h-[420px]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
        <svg viewBox={region.viewBox} className="absolute inset-0 h-full w-full p-7 opacity-95" role="img" aria-label={`خريطة ${region.title}`}>
          {region.paths.map((path, index) => (
            <path key={path} d={path} fill={index === 0 ? 'rgba(15,240,252,0.23)' : 'rgba(255,215,0,0.12)'} stroke={index === 0 ? 'rgba(15,240,252,0.78)' : 'rgba(255,255,255,0.30)'} strokeWidth="2.4" strokeLinejoin="round" />
          ))}
        </svg>
        {region.teams.map((team) => <TeamMapLabel key={`${region.title}-${team.name}`} team={team} />)}
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
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-gray-400">كل منطقة أصبحت خريطة عريضة بمسافات أكبر بين المنتخبات، مع اسم المنتخب والعلم الحقيقي للدولة فوق موقعه النسبي.</p>
          </div>
          <Link href="/teams" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-gray-200 transition hover:bg-white/[0.08]">كل المنتخبات</Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
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

        .home-wide-map-override main section[aria-label='مركز المباريات'] {
          padding: 0.75rem !important;
        }

        .home-wide-map-override main section[aria-label='مركز المباريات'] h1 {
          font-size: 1.15rem !important;
          line-height: 1.45 !important;
        }

        .home-wide-map-override main section[aria-label='مركز المباريات'] h2 {
          font-size: 1rem !important;
        }

        .home-wide-map-override main section[aria-label='مركز المباريات'] article {
          border-radius: 1.25rem !important;
          padding: 0.85rem !important;
        }

        .home-wide-map-override main section[aria-label='مركز المباريات'] [aria-label='العد التنازلي للمباراة المرتقبة'] {
          display: none !important;
        }

        .home-wide-map-override main section[aria-label='مركز المباريات'] article + div {
          margin-top: 0.75rem !important;
          margin-bottom: 0.75rem !important;
        }
      `}</style>
      <HomeClientSportsNext {...props} />
      <FullWidthTournamentMap />
    </div>
  );
}
