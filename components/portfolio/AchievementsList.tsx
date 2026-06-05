"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Achievement } from '@/lib/store';

interface AchievementsListProps {
  achievements: Achievement[];
}

const BADGES: Record<string, { title: string; icon: string; desc: string; color: string }> = {
  'DIAMOND_HANDS': { title: 'أيدي من ألماس', icon: '💎', desc: 'احتفظت بأسهم خاسرة لفترة طويلة', color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400' },
  'WOLF_OF_WALL_STREET': { title: 'ذئب وول ستريت', icon: '🐺', desc: 'حققت أرباح خيالية من صفقة واحدة', color: 'from-yellow-500/20 to-orange-500/20 text-yellow-400' },
  'EARLY_ADOPTER': { title: 'المكتشف المبكر', icon: '🔭', desc: 'اشتريت منتخب قبل أن يشتهر', color: 'from-purple-500/20 to-pink-500/20 text-purple-400' },
  'BEAR_MARKET_KING': { title: 'ملك السوق الهابط', icon: '🐻', desc: 'ربحت من البيع المكشوف', color: 'from-red-500/20 to-rose-500/20 text-red-400' },
};

export function AchievementsList({ achievements }: AchievementsListProps) {
  if (achievements.length === 0) {
    return (
      <div className="bg-[#1A1A1A]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5 h-[400px] flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-4 opacity-50">🏆</div>
        <h3 className="text-xl font-bold text-white mb-2">معرض الأوسمة</h3>
        <p className="text-gray-400 text-sm max-w-[200px]">قم بالتداول وتحقيق أرباح لفتح أوسمة نادرة هنا!</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5 h-[400px] overflow-y-auto custom-scrollbar">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        🏆 معرض الأوسمة
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {achievements.map((ach) => {
          const badge = BADGES[ach.badgeId] || { title: ach.badgeId, icon: '🏅', desc: 'إنجاز رائع', color: 'from-gray-500/20 to-slate-500/20 text-gray-400' };
          
          return (
            <motion.div 
              whileHover={{ scale: 1.05 }}
              key={ach.id} 
              className={`p-4 rounded-2xl bg-gradient-to-br ${badge.color} border border-white/10 flex flex-col items-center text-center`}
              title={new Date(ach.earnedAt).toLocaleDateString('ar-SA')}
            >
              <div className="text-4xl mb-2 drop-shadow-xl">{badge.icon}</div>
              <div className="font-bold text-sm mb-1">{badge.title}</div>
              <div className="text-[10px] opacity-80">{badge.desc}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
