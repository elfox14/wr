'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlusCircle } from 'lucide-react';
import { StockCard } from '@/components/ui/StockCard';
import { Holding } from '@/lib/store';

interface PitchPortfolioProps {
  playerHoldings: Holding[];
  captainId: string | null;
  setCaptain: (id: string) => void;
}

export function PitchPortfolio({ playerHoldings, captainId, setCaptain }: PitchPortfolioProps) {
  const getPlayerInPosition = (pos: string) => {
    return playerHoldings.find(h => h.asset?.position === pos);
  };

  const positions = [
    { id: 'FWD', label: 'المهاجم', gridArea: 'fwd' },
    { id: 'MID', label: 'خط الوسط', gridArea: 'mid' },
    { id: 'DEF', label: 'المدافع', gridArea: 'def' },
    { id: 'GK', label: 'حارس المرمى', gridArea: 'gk' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mb-16 relative">
      <h2 className="text-2xl font-bold mb-6 text-center">الملعب (تشكيلتك الأساسية)</h2>
      
      {/* Pitch Background */}
      <div className="relative w-full aspect-[2/3] sm:aspect-[3/4] md:aspect-square bg-[#0F5A3E] rounded-3xl overflow-hidden border-4 border-white/20 shadow-anti-gravity">
        {/* Pitch Lines */}
        <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none" />
        <div className="absolute top-1/2 left-4 right-4 h-0 border-t-2 border-white/30 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/30 rounded-full pointer-events-none" />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-48 h-32 border-2 border-white/30 pointer-events-none" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-32 border-2 border-white/30 pointer-events-none" />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-12 border-2 border-white/30 pointer-events-none" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-12 border-2 border-white/30 pointer-events-none" />

        {/* Players Layout */}
        <div className="absolute inset-0 grid grid-rows-4 items-center justify-items-center p-6 gap-4">
          {positions.map(pos => {
            const holding = getPlayerInPosition(pos.id);
            return (
              <div key={pos.id} className="w-full max-w-[280px] z-10">
                {holding && holding.asset ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="relative"
                  >
                    <StockCard 
                      type="PLAYER"
                      name={holding.asset.name}
                      code={holding.asset.code}
                      image={holding.asset.image}
                      score={holding.asset.score || 0}
                      price={holding.asset.current_price}
                      change={holding.asset.change}
                      position={holding.asset.position || undefined}
                      holding={{
                        quantity: holding.quantity,
                        avg_buy_price: holding.avg_buy_price,
                        positionType: holding.positionType,
                        profitLoss: holding.profitLoss,
                        profitLossPercent: holding.profitLossPercent
                      }}
                      isCaptain={captainId === holding.asset.id}
                      onMakeCaptain={setCaptain}
                    />
                  </motion.div>
                ) : (
                  <Link href="/market">
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full h-[180px] bg-black/40 backdrop-blur-sm border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center text-white/50 hover:text-white hover:border-accent hover:bg-accent/10 transition-colors shadow-card cursor-pointer"
                    >
                      <PlusCircle size={40} className="mb-2 opacity-50" />
                      <span className="font-bold text-lg">{pos.label}</span>
                      <span className="text-sm mt-1">اضغط لشراء لاعب</span>
                    </motion.div>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
