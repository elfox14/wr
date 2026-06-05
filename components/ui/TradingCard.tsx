import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowRight, ChevronRight } from 'lucide-react';
import { Asset } from '@/lib/store';

interface TradingCardProps {
  asset: Asset;
  onViewRoster?: (asset: Asset) => void;
  holding?: {
    quantity: number;
    avg_buy_price: number;
    positionType?: string;
    profitLoss?: number;
    profitLoss?: number;
    profitLossPercent?: number;
  };
  isCaptain?: boolean;
  onMakeCaptain?: (assetId: string) => void;
}

export function TradingCard({ asset, onViewRoster, holding, isCaptain, onMakeCaptain }: TradingCardProps) {
  const isTeam = asset.type === 'TEAM';
  const isPositive = asset.change >= 0;
  const isShort = holding?.positionType === 'SHORT';

  // Determine glow color based on position type and asset type
  let glowColor = isTeam ? 'rgba(15,240,252,0.3)' : 'rgba(255,215,0,0.3)';
  let gradientFrom = isTeam ? 'from-[#0FF0FC]/20' : 'from-[#FFD700]/20';
  
  if (isShort) {
    glowColor = 'rgba(255,69,0,0.3)'; // Red-orange for short
    gradientFrom = 'from-[#FF4500]/20';
  }

  return (
    <motion.div 
      whileHover={{ scale: 1.03, rotateY: 5, rotateX: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`relative bg-[#1A1A1A] rounded-2xl p-[1px] overflow-hidden group shadow-xl hover:shadow-[0_0_25px_${glowColor}] transition-shadow`}
      style={{ perspective: 1000 }}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent group-hover:opacity-100 opacity-50 transition-opacity" />
      <div className={`absolute inset-0 bg-gradient-to-tr opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradientFrom} to-transparent`} />

      <div className={`relative h-full bg-[#1A1A1A] rounded-2xl flex flex-col p-5 border ${isShort ? 'border-red-500/20' : 'border-white/5'} backdrop-blur-md`}>
        
        {/* Captain Badge */}
        {isCaptain && (
          <div className="absolute -top-3 -right-3 text-4xl drop-shadow-[0_0_10px_rgba(255,215,0,0.8)] z-10" title="كابتن المحفظة">
            👑
          </div>
        )}
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="font-mono font-bold text-gray-500 text-sm">{asset.code}</div>
          <div className={`px-2 py-0.5 rounded text-xs font-bold ${isTeam ? 'bg-white/10 text-white' : 'bg-[#FFD700]/10 text-[#FFD700]'}`}>
            {isTeam ? `#${asset.fifaRank || '-'}` : (asset.position || 'N/A')}
          </div>
        </div>
        
        {/* Icon/Image */}
        <div className="text-6xl mb-4 text-center transform group-hover:scale-110 transition-transform duration-300">
          {asset.image}
        </div>
        
        {/* Name */}
        <h3 className="text-xl font-bold text-white mb-2 text-center group-hover:text-glow transition-colors">
          {asset.name}
        </h3>
        
        {/* Stats */}
        <div className="flex justify-center gap-2 text-xs mb-6 flex-wrap">
          <span className="bg-white/5 border border-white/10 text-gray-300 px-3 py-1 rounded-full">
            تقييم: {asset.score || 'N/A'}
          </span>
          {holding && (
            <span className={`bg-white/5 border px-3 py-1 rounded-full font-mono ${isShort ? 'border-red-500/50 text-red-400' : 'border-white/10 text-gray-300'}`}>
              الكمية: {holding.quantity} ({holding.positionType || 'LONG'})
            </span>
          )}
        </div>

        {/* Price & Change / Portfolio Info */}
        <div className="mt-auto flex justify-between items-end bg-black/40 p-4 rounded-xl border border-white/5">
          <div>
            <div className="text-xs text-gray-500 mb-1">{holding ? 'إجمالي القيمة' : 'السعر'}</div>
            <div className="text-xl font-mono font-bold text-white flex items-center gap-1">
              {holding ? asset.current_price * holding.quantity : asset.current_price}<span className="text-[#0FF0FC] text-lg">¢</span>
            </div>
          </div>
          
          {holding ? (
            <div className={`flex flex-col items-end`}>
              <div className="text-xs text-gray-500 mb-1">الربح/الخسارة</div>
              <div className={`flex items-center gap-1 font-bold text-sm ${(holding.profitLoss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {(holding.profitLoss || 0) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(holding.profitLossPercent || 0).toFixed(1)}%
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-end`}>
              <div className="text-xs text-gray-500 mb-1">24h</div>
              <div className={`flex items-center gap-1 font-bold text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(asset.change)}%
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          {isTeam && onViewRoster ? (
            <button 
              onClick={() => onViewRoster(asset)}
              className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-bold flex items-center justify-center gap-2 group-hover:bg-[#0FF0FC]/10 group-hover:border-[#0FF0FC]/30 group-hover:text-[#0FF0FC] transition-all"
            >
              عرض القائمة <ChevronRight size={18} className="group-hover:translate-x-reverse group-hover:-translate-x-1 transition-transform" />
            </button>
          ) : (
            <Link 
              href={`/asset/${asset.id}`}
              className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-bold flex items-center justify-center gap-2 group-hover:bg-[#FFD700]/10 group-hover:border-[#FFD700]/30 group-hover:text-[#FFD700] transition-all"
            >
              تداول <ArrowRight size={18} className="group-hover:translate-x-reverse group-hover:-translate-x-1 transition-transform" />
            </Link>
          )}

          {/* Captain Button for Players in Portfolio */}
          {holding && !isTeam && onMakeCaptain && !isCaptain && (
            <button
              onClick={() => onMakeCaptain(asset.id)}
              title="تعيين ككابتن (مضاعفة الأرباح)"
              className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500 hover:bg-yellow-500/20 hover:scale-105 transition-all"
            >
              👑
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
