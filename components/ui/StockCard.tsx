// components/ui/StockCard.tsx
'use client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import { AssetImage } from './AssetImage';

interface StockCardProps {
  type: 'TEAM' | 'PLAYER';
  name: string;
  code: string;
  image: string;
  score: number;
  price: number;
  change: number;
  volume?: string;
  marketCap?: string;
  priceHistory?: number[];
  position?: string;
  fifaRank?: number;
  onClick?: () => void;
  variant?: 'default' | 'hot' | 'cold';
}

export function StockCard({
  type, name, code, image, score, price, change,
  volume, marketCap, priceHistory = [], position, fifaRank,
  onClick, variant = 'default'
}: StockCardProps) {
  const isPositive = change >= 0;
  const isTeam = type === 'TEAM';

  const accentColor = variant === 'hot'
    ? '#FF6B35'
    : variant === 'cold'
    ? '#3B82F6'
    : isTeam ? '#0FF0FC' : '#FFD700';

  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: `0 20px 40px ${accentColor}30` }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative bg-[#111827] border border-white/10 rounded-2xl overflow-hidden cursor-pointer w-full transition-all duration-300"
      style={{ boxShadow: `0 4px 20px rgba(0,0,0,0.4)` }}
    >
      {/* شريط علوي ملون */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      {/* Badge نوع الأصل */}
      <div className="absolute top-3 left-3 z-10">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md"
          style={{ backgroundColor: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}
        >
          {isTeam ? 'منتخب' : position || 'لاعب'}
        </span>
      </div>

      {/* Trending badge */}
      {variant === 'hot' && (
        <div className="absolute top-3 right-3 z-10">
          <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full font-bold backdrop-blur-md">
            🔥 ساخن
          </span>
        </div>
      )}

      <div className="px-4 pt-8 pb-4 flex flex-col h-full">
        {/* صورة + معلومات أساسية */}
        <div className="flex items-center gap-3 mb-4 mt-2">
          <div
            className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-black/40 flex items-center justify-center relative"
            style={{ border: `2px solid ${accentColor}60` }}
          >
            <AssetImage image={image} name={name} className="w-10 h-10" width={40} height={40} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm truncate">{name}</div>
            <div className="text-white/40 text-xs uppercase tracking-wider">{code}</div>
            <div className="flex items-center gap-1 mt-1">
              <Star size={10} className="text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 text-xs font-bold">{score?.toFixed(1) || '0.0'}</span>
              {isTeam && fifaRank && (
                <span className="text-white/40 text-[10px]">• FIFA #{fifaRank}</span>
              )}
            </div>
          </div>
        </div>

        {/* Sparkline chart */}
        {priceHistory.length > 0 && (
          <div className="mb-3 -mx-1 opacity-70">
            <Sparklines data={priceHistory} height={40}>
              <SparklinesLine
                color={isPositive ? '#22c55e' : '#ef4444'}
                style={{ fill: 'none', strokeWidth: 2 }}
              />
            </Sparklines>
          </div>
        )}

        {/* السعر */}
        <div className="flex justify-between items-end mb-3 mt-auto">
          <div>
            <div className="text-white/40 text-[10px] mb-0.5">السعر الحالي</div>
            <div className="text-white font-black text-xl flex items-baseline gap-1">
              {price?.toLocaleString() || '0'}
              <span className="text-white/40 text-xs font-normal"> ¢</span>
            </div>
          </div>
          <div
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm ${
              isPositive
                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isPositive ? '+' : ''}{change || 0}%
          </div>
        </div>

        {/* Volume & Market Cap */}
        {(volume || marketCap) && (
          <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-2">
            {volume && (
              <div className="flex flex-col">
                <span className="text-[9px] text-white/40 uppercase tracking-wider">Volume</span>
                <span className="text-xs text-white/80 font-mono">{volume}</span>
              </div>
            )}
            {marketCap && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-white/40 uppercase tracking-wider">Market Cap</span>
                <span className="text-xs text-white/80 font-mono">{marketCap}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
