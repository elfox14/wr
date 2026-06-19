'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type Team = {
  id?: string | number | null;
  name?: string | null;
  code?: string | null;
  image?: string | null;
  continent?: string | null;
  group?: string | null;
};

type RegionKey = 'africa' | 'europe' | 'asia' | 'southAmerica' | 'concacaf' | 'oceania';

type RegionDef = {
  key: RegionKey;
  label: string;
  shortLabel: string;
  icon: string;
  accent: string;
  glow: string;
};

const REGIONS: RegionDef[] = [
  { key: 'africa', label: 'إفريقيا', shortLabel: 'إفريقيا', icon: '🌍', accent: 'text-[#00FF88] border-[#00FF88]/25 bg-[#00FF88]/10', glow: 'rgba(0,255,136,0.16)' },
  { key: 'europe', label: 'أوروبا', shortLabel: 'أوروبا', icon: '⭐', accent: 'text-[#0FF0FC] border-[#0FF0FC]/25 bg-[#0FF0FC]/10', glow: 'rgba(15,240,252,0.15)' },
  { key: 'asia', label: 'آسيا', shortLabel: 'آسيا', icon: '🌅', accent: 'text-[#FFD700] border-[#FFD700]/25 bg-[#FFD700]/10', glow: 'rgba(255,215,0,0.15)' },
  { key: 'southAmerica', label: 'أمريكا الجنوبية', shortLabel: 'جنوبية', icon: '🔥', accent: 'text-emerald-200 border-emerald-200/20 bg-emerald-300/10', glow: 'rgba(167,243,208,0.14)' },
  { key: 'concacaf', label: 'الكونكاكاف', shortLabel: 'كونكاكاف', icon: '⚡', accent: 'text-red-100 border-red-300/25 bg-red-400/10', glow: 'rgba(248,113,113,0.13)' },
  { key: 'oceania', label: 'أوقيانوسيا', shortLabel: 'أوقيانوسيا', icon: '🌊', accent: 'text-sky-200 border-sky-200/25 bg-sky-300/10', glow: 'rgba(125,211,252,0.13)' },
];

const CODE_REGION: Record<string, RegionKey> = {
  // Africa
  EGY: 'africa', MAR: 'africa', TUN: 'africa', DZA: 'africa', SEN: 'africa', GHA: 'africa', CIV: 'africa', RSA: 'africa', CPV: 'africa', COD: 'africa', CMR: 'africa', NGA: 'africa', MLI: 'africa',
  // Europe
  NED: 'europe', CZE: 'europe', BEL: 'europe', ESP: 'europe', BIH: 'europe', GER: 'europe', SUI: 'europe', SCO: 'europe', SWE: 'europe', FRA: 'europe', NOR: 'europe', AUT: 'europe', POR: 'europe', ENG: 'europe', CRO: 'europe', TUR: 'europe', ITA: 'europe', DEN: 'europe', POL: 'europe',
  // Asia
  KOR: 'asia', JPN: 'asia', QAT: 'asia', KSA: 'asia', IRI: 'asia', IRN: 'asia', AUS: 'asia', IRQ: 'asia', JOR: 'asia', UZB: 'asia',
  // South America
  BRA: 'southAmerica', ARG: 'southAmerica', URU: 'southAmerica', COL: 'southAmerica', PAR: 'southAmerica', ECU: 'southAmerica', CHI: 'southAmerica', PER: 'southAmerica', BOL: 'southAmerica',
  // CONCACAF
  MEX: 'concacaf', USA: 'concacaf', CAN: 'concacaf', PAN: 'concacaf', HTI: 'concacaf', CUW: 'concacaf', CRC: 'concacaf', JAM: 'concacaf', HON: 'concacaf',
  // Oceania
  NZL: 'oceania',
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function regionFromTeam(team: Team): RegionKey {
  const continent = normalize(team.continent);
  if (continent.includes('africa') || continent.includes('caf') || continent.includes('إفريقيا')) return 'africa';
  if (continent.includes('europe') || continent.includes('uefa') || continent.includes('أوروبا')) return 'europe';
  if (continent.includes('asia') || continent.includes('afc') || continent.includes('آسيا')) return 'asia';
  if (continent.includes('south') || continent.includes('conmebol') || continent.includes('جنوبية')) return 'southAmerica';
  if (continent.includes('concacaf') || continent.includes('north') || continent.includes('central') || continent.includes('كونكاكاف')) return 'concacaf';
  if (continent.includes('oceania') || continent.includes('ofc') || continent.includes('أوقيانوسيا')) return 'oceania';
  return CODE_REGION[String(team.code || '').toUpperCase()] || 'africa';
}

function teamName(team: Team) {
  return team.name || team.code || 'منتخب';
}

function teamCode(team: Team) {
  return team.code || team.name?.slice(0, 3) || '---';
}

function teamHref(team: Team) {
  return team.id ? `/teams/${encodeURIComponent(String(team.id))}` : '/teams';
}

function flagUrl(team: Team) {
  return team.image?.startsWith('http') ? team.image : getTeamFlagUrl({ code: team.code, name: team.name, image: team.image }, 80);
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ar-EG').format(value);
}

export default function HomeRegionsTeamsCard({ teams = [] }: { teams?: Team[] }) {
  const grouped = useMemo(() => {
    const map = new Map<RegionKey, Team[]>();
    for (const region of REGIONS) map.set(region.key, []);
    for (const team of teams) {
      if (!team?.name && !team?.code) continue;
      const key = regionFromTeam(team);
      map.set(key, [...(map.get(key) || []), team]);
    }
    for (const [key, value] of map) {
      map.set(key, value.sort((a, b) => teamName(a).localeCompare(teamName(b), 'ar')));
    }
    return map;
  }, [teams]);

  const visibleRegions = REGIONS.filter((region) => (grouped.get(region.key)?.length || 0) > 0);
  const [activeKey, setActiveKey] = useState<RegionKey>(visibleRegions[0]?.key || 'africa');
  const activeRegion = REGIONS.find((region) => region.key === activeKey) || REGIONS[0];
  const activeTeams = grouped.get(activeRegion.key) || [];
  const featuredTeams = activeTeams.slice(0, 6);
  const remaining = Math.max(0, activeTeams.length - featuredTeams.length);

  if (!teams.length) {
    return (
      <section className="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(0,0,0,0.24))] p-3 text-white shadow-[0_14px_36px_rgba(0,0,0,0.26)]">
        <div className="text-sm font-black text-[#FFD700]">خريطة المنتخبات</div>
        <p className="mt-2 text-xs font-bold leading-6 text-gray-400">سيظهر توزيع المنتخبات حسب المناطق عند توفر بيانات الفرق.</p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(135deg,rgba(3,12,11,0.98),rgba(2,6,13,0.98))] p-3 text-white shadow-[0_14px_36px_rgba(0,0,0,0.26)]">
      <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full blur-3xl" style={{ backgroundColor: activeRegion.glow }} />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${activeRegion.accent}`}>
            <span>{activeRegion.icon}</span>
            REGION DECK
          </div>
          <h2 className="mt-1.5 text-base font-black leading-tight text-white">خريطة المنتخبات</h2>
        </div>
        <Link href="/teams" className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-2.5 py-1 text-[10px] font-black text-[#0FF0FC] transition hover:bg-[#0FF0FC]/15">
          كل الفرق
        </Link>
      </div>

      <div className="relative z-10 mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {visibleRegions.map((region) => {
          const count = grouped.get(region.key)?.length || 0;
          const active = activeKey === region.key;
          return (
            <button key={region.key} type="button" onClick={() => setActiveKey(region.key)} className={`mobile-tap shrink-0 rounded-xl border px-2.5 py-1.5 text-[10px] font-black transition ${active ? `${region.accent} shadow-[0_6px_18px_rgba(0,0,0,0.18)]` : 'border-white/10 bg-white/[0.045] text-gray-400 hover:text-white'}`}>
              {region.shortLabel} <span className="text-[9px] opacity-75">{formatCount(count)}</span>
            </button>
          );
        })}
      </div>

      <div className="relative z-10 mt-3 rounded-2xl border border-white/10 bg-black/25 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-white">{activeRegion.label}</p>
            <p className="mt-0.5 text-[9px] font-bold text-gray-500">{formatCount(activeTeams.length)} منتخب في المنطقة</p>
          </div>
          {remaining ? <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-black text-gray-300">+{formatCount(remaining)}</span> : null}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {featuredTeams.map((team) => {
            const src = flagUrl(team);
            return (
              <Link key={String(team.id || team.code || team.name)} href={teamHref(team)} className="group/team flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-2 py-1.5 transition hover:border-[#FFD700]/30 hover:bg-white/[0.075]">
                <span className="flex h-7 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/35 bg-cover bg-center text-[9px] font-black text-[#FFD700]" style={src ? { backgroundImage: `url(${src})` } : undefined}>
                  {!src ? teamCode(team) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-black leading-4 text-white">{teamName(team)}</span>
                  <span className="block text-[8px] font-bold text-gray-500">{teamCode(team)}</span>
                </span>
              </Link>
            );
          })}
        </div>

        <Link href={`/teams?region=${activeRegion.key}`} className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[10px] font-black text-gray-200 transition hover:border-[#0FF0FC]/25 hover:text-[#0FF0FC]">
          استكشف {activeRegion.label}
        </Link>
      </div>
    </section>
  );
}
