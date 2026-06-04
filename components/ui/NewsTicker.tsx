'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import Link from 'next/link';

export function NewsTicker() {
  const { assets } = useStore();
  const [tickerItems, setTickerItems] = useState<{ id: string, text: string, type: 'up' | 'down' | 'hot', link: string }[]>([]);

  useEffect(() => {
    if (assets.length === 0) return;

    const items: typeof tickerItems = [];

    // Find top gainers
    const sortedByChange = [...assets].sort((a, b) => b.change - a.change);
    
    // Add top 2 gainers
    for (let i = 0; i < Math.min(2, sortedByChange.length); i++) {
      const gainer = sortedByChange[i];
      if (gainer && gainer.change > 0) {
        items.push({
          id: `gainer-${gainer.id}`,
          text: `${gainer.type === 'TEAM' ? 'منتخب' : 'اللاعب'} ${gainer.name} يرتفع بنسبة ${gainer.change}%.`,
          type: 'up',
          link: `/asset/${gainer.id}`
        });
      }
    }

    // Add top 2 losers
    for (let i = 1; i <= Math.min(2, sortedByChange.length); i++) {
      const loser = sortedByChange[sortedByChange.length - i];
      if (loser && loser.change < 0) {
        items.push({
          id: `loser-${loser.id}`,
          text: `${loser.type === 'TEAM' ? 'منتخب' : 'اللاعب'} ${loser.name} يتراجع بنسبة ${Math.abs(loser.change)}%.`,
          type: 'down',
          link: `/asset/${loser.id}`
        });
      }
    }

    // Add hot players
    const players = assets.filter(a => a.type === 'PLAYER');
    if (players.length > 0) {
      // Pick 1 random hot player
      for (let i = 0; i < Math.min(1, players.length); i++) {
        const hotPlayer = players[Math.floor(Math.random() * players.length)];
        items.push({
          id: `hot-${hotPlayer.id}-${i}`,
          text: `${hotPlayer.name} الأعلى تداولًا هذا الأسبوع.`,
          type: 'hot',
          link: `/asset/${hotPlayer.id}`
        });
      }
    }

    // Shuffle the items so it looks more natural
    const shuffledItems = items.sort(() => Math.random() - 0.5);

    setTickerItems(shuffledItems);
  }, [assets]);

  if (tickerItems.length === 0) return null;

  return (
    <div className="w-full bg-transparent overflow-hidden flex items-center h-10">
      <div className="bg-[#0FF0FC] text-black font-bold px-4 h-full flex items-center z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)] whitespace-nowrap">
        أخبار السوق
      </div>
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        {/* We use an inline style animation or tailwind. We will inject a style tag for the keyframes. */}
        <style>{`
          @keyframes ticker {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-ticker {
            display: inline-block;
            white-space: nowrap;
            animation: ticker 45s linear infinite;
            padding-right: 50px;
          }
          .animate-ticker:hover {
            animation-play-state: paused;
          }
        `}</style>
        <div className="animate-ticker w-full">
          {tickerItems.map((item, idx) => (
            <Link href={item.link} key={item.id + idx} className="inline-flex items-center gap-2 mx-8 text-sm hover:underline">
              {item.type === 'up' && <TrendingUp className="text-green-500" size={16} />}
              {item.type === 'down' && <TrendingDown className="text-red-500" size={16} />}
              {item.type === 'hot' && <Flame className="text-orange-500" size={16} />}
              <span className={item.type === 'up' ? 'text-green-400' : item.type === 'down' ? 'text-red-400' : 'text-orange-400'}>
                {item.text}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
