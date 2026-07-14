'use client';

import React from 'react';
import TeamHeatmap from './TeamHeatmap';
import type { HeatmapPoint, HeatmapSource, MatchPlayerStatItem } from '@/lib/match-page/types';

interface PlayerHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  playerImage?: string | null;
  isHome: boolean;
  points?: HeatmapPoint[];
  heatmapSource?: HeatmapSource;
  stats?: MatchPlayerStatItem | null;
}

const STAT_DEFINITIONS: Array<[keyof MatchPlayerStatItem, string]> = [
  ['rating', 'التقييم'], ['minutes', 'الدقائق'], ['goals', 'الأهداف'], ['assists', 'التمريرات الحاسمة'],
  ['shots', 'التسديدات'], ['shotsOnTarget', 'على المرمى'], ['shotsOffTarget', 'خارج المرمى'], ['blockedShots', 'تسديدات محجوبة'],
  ['expectedGoals', 'xG'], ['npExpectedGoals', 'npxG'], ['expectedAssists', 'xA'], ['bigChancesCreated', 'فرص كبيرة مصنوعة'],
  ['passes', 'التمريرات'], ['accuratePasses', 'تمريرات صحيحة'], ['keyPasses', 'تمريرات مفتاحية'], ['crosses', 'عرضيات'],
  ['accurateCrosses', 'عرضيات صحيحة'], ['longBalls', 'كرات طويلة'], ['accurateLongBalls', 'كرات طويلة صحيحة'], ['touches', 'اللمسات'],
  ['tackles', 'التدخلات'], ['interceptions', 'الاعتراضات'], ['clearances', 'التشتيت'], ['duelWon', 'التحامات ناجحة'],
  ['duelLost', 'التحامات خاسرة'], ['aerialWon', 'التحامات هوائية'], ['wonContest', 'مراوغات ناجحة'], ['challengeLost', 'تمت مراوغته'],
  ['dispossessed', 'فقد تحت الضغط'], ['possessionLost', 'فقد الاستحواذ'], ['foulsCommitted', 'أخطاء مرتكبة'], ['foulsWon', 'أخطاء مكتسبة'],
  ['offsides', 'تسلل'], ['yellowCards', 'بطاقات صفراء'], ['redCards', 'بطاقات حمراء'], ['saves', 'تصديات'],
];

function displayValue(value: unknown) {
  if (typeof value !== 'number') return String(value);
  return Number.isInteger(value) ? value.toLocaleString('ar-EG') : value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

export default function PlayerHeatmapModal({ isOpen, onClose, playerName, playerImage, isHome, points = [], heatmapSource, stats }: PlayerHeatmapModalProps) {
  if (!isOpen) return null;
  const availableStats = stats
    ? STAT_DEFINITIONS.map(([key, label]) => ({ key, label, value: stats[key] })).filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={onClose} dir="rtl">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111916] p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-white/60 transition hover:text-white" aria-label="إغلاق">✕</button>

        <div className="flex items-center gap-4">
          {playerImage ? (
            <img src={playerImage} alt={playerName} className="h-16 w-16 rounded-full border-2 border-white/20 bg-white/5 object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 bg-white/5 text-xl font-bold">{playerName.charAt(0)}</div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-white">{playerName}</h3>
              {stats?.started === true && <span className="rounded-full bg-[#18E58F]/10 px-2 py-1 text-[10px] font-black text-[#18E58F]">أساسي</span>}
              {stats?.started === false && stats?.played === true && <span className="rounded-full bg-[#F8C846]/10 px-2 py-1 text-[10px] font-black text-[#F8C846]">بديل شارك</span>}
            </div>
            <p className="mt-1 text-xs font-bold text-white/50">#{stats?.number || '—'} · {stats?.position || 'المركز غير متوفر'}</p>
            {(stats?.playerSubbedOn || stats?.playerSubbedOff) && <p className="mt-1 text-[11px] font-bold text-slate-400">{stats.playerSubbedOn ? `دخل بدل ${stats.playerSubbedOn}` : ''}{stats.playerSubbedOn && stats.playerSubbedOff ? ' · ' : ''}{stats.playerSubbedOff ? `خرج وبدله ${stats.playerSubbedOff}` : ''}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(260px,0.75fr)_1.25fr]">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-black text-white">{heatmapSource === 'PROVIDER_SEASON_HEATMAP' ? 'خريطة البطولة المجمعة' : 'الخريطة الحرارية الموثقة للمباراة'}</h4>
            {points.length ? (
              <>
                <div className="mt-4 flex justify-center"><TeamHeatmap teamName="" isHome={isHome} points={points} source={heatmapSource} /></div>
                <p className="mt-3 text-center text-[11px] font-bold leading-5 text-white/45">تعتمد الخريطة على {points.length.toLocaleString('ar-EG')} إحداثية {heatmapSource === 'VERIFIED_ACTION_COORDINATES' ? 'مستخرجة من أحداث اللاعب الموثقة' : heatmapSource === 'PROVIDER_SEASON_HEATMAP' ? 'مجمعة لكل مباريات اللاعب في البطولة حتى الآن، وليست خاصة بهذه المباراة' : heatmapSource === 'PROVIDER_HEATMAP' ? 'مرسلة مباشرة من المزود لهذه المباراة' : 'موثقة'} لهذا اللاعب.</p>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 p-8 text-center text-xs font-bold text-slate-500">لم تصل نقاط خريطة حرارية موثقة لهذا اللاعب، لذلك لا نعرض خريطة تقديرية.</div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-black text-white">كل الإحصاءات المتوفرة</h4>
            {availableStats.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {availableStats.map((item) => (
                  <div key={String(item.key)} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <b className="block text-lg font-black tabular-nums text-[#F8C846]">{displayValue(item.value)}</b>
                    <span className="mt-1 block text-[10px] font-bold text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 p-8 text-center text-xs font-bold text-slate-500">لا توجد إحصاءات فردية موثقة متاحة لهذا اللاعب.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
