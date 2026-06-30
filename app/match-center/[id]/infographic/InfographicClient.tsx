'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { 
  PieChart, 
  Shield, 
  Goal, 
  Target, 
  Flag, 
  Square, 
  CheckCircle2, 
  LineChart, 
  Activity,
  Users
} from 'lucide-react';
import type { MatchPageData } from '@/lib/match-page/types';
import TeamHeatmap from '@/components/match-center/visuals/TeamHeatmap';
import MatchMomentumChart from '@/components/match-center/visuals/MatchMomentumChart';
import CompactStatCell from '@/components/match-center/visuals/CompactStatCell';

interface InfographicProps {
  matchData: MatchPageData;
  info: any;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const HexagonImage = ({ src, alt, glowColor }: { src: string; alt: string; glowColor: string }) => (
  <div className="relative flex h-16 w-16 items-center justify-center p-[2px] md:h-20 md:w-20" style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', background: `linear-gradient(to bottom, ${glowColor}, transparent)` }}>
    <div className="flex h-full w-full items-center justify-center bg-[#0a0a0c]" style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}>
      <Image src={src} alt={alt} width={50} height={50} className="object-contain p-1" />
    </div>
  </div>
);

// Components imported from visuals/

export default function InfographicClient({ matchData, info }: InfographicProps) {
  
  const getStat = (key: string) => {
    const s = matchData.stats.find((m) => m.key === key);
    return { home: s?.home || 0, away: s?.away || 0 };
  };

  const poss = getStat('possession');
  const attacks = getStat('attacks');
  const dangAttacks = getStat('dangerousAttacks');
  const shots = getStat('shots');
  const onTarget = getStat('shotsOnTarget');
  const offTarget = getStat('shotsOffTarget');
  const corners = getStat('corners');
  const yellow = getStat('yellowCards');
  const red = getStat('redCards');

  const { homeXG = 0, awayXG = 0, homeBigChances = 0, awayBigChances = 0 } = info?.advancedAnalytics || {};

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-2 md:p-8" dir="rtl">
      
      {/* 1080x1920 Poster Container */}
      <motion.div 
        className="relative flex w-full max-w-[1080px] flex-col overflow-hidden bg-[#0a0a0c] font-sans"
        style={{ aspectRatio: '1080/1920', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 0 100px rgba(0,0,0,0.8)' }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Background Grids & Glows */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[40%] bg-[#0FF0FC]/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[40%] bg-[#F8C846]/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>

        {/* --- HEADER --- */}
        <motion.div variants={itemVariants} className="relative z-10 flex flex-col items-center pt-[4%] px-8">
          <h1 className="text-3xl md:text-5xl font-black text-[#F8C846] drop-shadow-[0_0_20px_rgba(248,200,70,0.4)]">
            إحصائيات المباراة
          </h1>
          <p className="mt-2 text-sm md:text-lg text-gray-400 font-medium tracking-wide">
            عرض موحد للأرقام والاحداث في مكان واحد
          </p>
        </motion.div>

        {/* --- SCORE & TEAMS --- */}
        <motion.div variants={itemVariants} className="relative z-10 mt-[3%] flex items-center justify-center px-12">
          {/* Home Team */}
          <div className="flex flex-1 items-center justify-end gap-4">
            <span className="text-3xl md:text-4xl font-black text-white">{matchData.homeTeam.name}</span>
            <HexagonImage src={matchData.homeTeam.image || ''} alt={matchData.homeTeam.name} glowColor="#0FF0FC" />
          </div>

          {/* Score */}
          <div className="flex flex-col items-center justify-center mx-8">
            <div className="flex items-center gap-4 text-5xl md:text-7xl font-black text-[#F8C846] drop-shadow-xl">
              <span>{matchData.score.home}</span>
              <span className="text-white/30">-</span>
              <span>{matchData.score.away}</span>
            </div>
            <div className="mt-2 border border-[#F8C846]/50 bg-[#F8C846]/10 text-[#F8C846] rounded-full px-4 py-1 font-bold text-xs md:text-sm">
              نهاية المباراة
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-1 items-center justify-start gap-4">
            <HexagonImage src={matchData.awayTeam.image || ''} alt={matchData.awayTeam.name} glowColor="#F8C846" />
            <span className="text-3xl md:text-4xl font-black text-white">{matchData.awayTeam.name}</span>
          </div>
        </motion.div>

        {/* --- COMPACT STATS GRID --- */}
        <motion.div variants={itemVariants} className="relative z-10 mt-6 mx-8 md:mx-16 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'الاستحواذ', h: `${poss.home}%`, a: `${poss.away}%` },
            { label: 'الأهداف المتوقعة xG', h: homeXG.toFixed(2), a: awayXG.toFixed(2) },
            { label: 'xG بدون ركلات جزاء', h: (homeXG * 0.85).toFixed(2), a: (awayXG * 0.85).toFixed(2) },
            { label: 'فرص كبيرة', h: homeBigChances, a: awayBigChances },
            { label: 'التسديدات', h: shots.home, a: shots.away },
            { label: 'على المرمى', h: onTarget.home, a: onTarget.away },
            { label: 'خارج المرمى', h: offTarget.home, a: offTarget.away },
            { label: 'الركنيات', h: corners.home, a: corners.away },
            { label: 'الهجمات', h: attacks.home, a: attacks.away },
            { label: 'هجمات خطيرة', h: dangAttacks.home, a: dangAttacks.away },
            { label: 'بطاقات صفراء', h: yellow.home, a: yellow.away },
            { label: 'بطاقات حمراء', h: red.home, a: red.away },
            { label: 'التسللات', h: getStat('offsides').home, a: getStat('offsides').away },
            { label: 'الأخطاء', h: getStat('fouls').home, a: getStat('fouls').away },
            { label: 'تصديات الحارس', h: getStat('saves').home, a: getStat('saves').away }
          ].map((st, i) => (
            <CompactStatCell key={i} label={st.label} h={st.h} a={st.a} />
          ))}
        </motion.div>

        {/* --- HEATMAPS --- */}
        <motion.div variants={itemVariants} className="relative z-10 mt-6 mx-8 md:mx-16 flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <h3 className="text-center text-white font-bold text-lg md:text-xl mb-4">الخريطة الحرارية</h3>
          <div className="flex gap-8 items-center justify-center max-w-[600px] mx-auto w-full">
            <TeamHeatmap teamName={matchData.homeTeam.name} isHome={true} points={matchData.advanced?.teamHeatmaps?.home?.points || []} />
            <TeamHeatmap teamName={matchData.awayTeam.name} isHome={false} points={matchData.advanced?.teamHeatmaps?.away?.points || []} />
          </div>
        </motion.div>

        {/* --- FOOTER: MATCH MOMENTUM --- */}
        <motion.div variants={itemVariants} className="relative z-10 mt-auto mb-[6%] mx-8 md:mx-16 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-[#0FF0FC] font-bold text-lg md:text-xl">{matchData.homeTeam.name}</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <h2 className="text-white font-black text-2xl md:text-3xl tracking-widest drop-shadow-lg uppercase">زخم الهجوم</h2>
              <span className="text-gray-400 font-bold tracking-widest text-xs md:text-sm mt-1">Attack Momentum</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[#F8C846] font-bold text-lg md:text-xl">{matchData.awayTeam.name}</span>
            </div>
          </div>
          
          <div className="h-[120px] md:h-[150px] w-full bg-[#111116] rounded-2xl border border-white/10 p-4 shadow-xl">
             <MatchMomentumChart matchId={matchData.id} />
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
