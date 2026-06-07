'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Shield, Users, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface AssetWithLabel {
  id: string;
  name: string;
  image: string;
  current_price: number;
  score: number | null;
  ipoLabel: string;
  code: string;
  position?: string | null;
  fifaRank?: number | null;
}

interface IpoClientProps {
  teams: AssetWithLabel[];
  players: AssetWithLabel[];
}

export default function IpoClient({ teams, players }: IpoClientProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = new Date('2026-06-11T00:00:00Z').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper to group array by property
  const groupBy = (array: any[], key: string) => {
    return array.reduce((result, currentValue) => {
      (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
      return result;
    }, {});
  };

  const groupedTeams = groupBy(teams, 'ipoLabel');
  const groupedPlayers = groupBy(players, 'ipoLabel');

  // Define ordering for labels
  const teamOrder = ['الأسهم الذهبية (Tier A)', 'أسهم قيادية (Tier B)', 'أسهم النمو (Tier C)', 'أسهم الفرص (Tier D)', 'أسهم المخاطرة (Tier E)'];
  const playerOrder = ['World-class', 'Top starter', 'Key player', 'Squad/rotation', 'Reserve'];

  return (
    <div className="w-full">
      {/* Target Countdown */}
      <div className="bg-neutral-900/50 border border-emerald-500/20 rounded-2xl p-6 mb-12 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Market Opens In</h3>
            <p className="text-sm text-neutral-400">June 11, 2026 - Fixed IPO prices end here.</p>
          </div>
        </div>
        
        <div className="flex gap-4 text-center" dir="ltr">
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-black font-mono text-emerald-400">{timeLeft.days}</span>
            <span className="text-xs text-neutral-500 font-bold tracking-wider">DAYS</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-black font-mono text-emerald-400">{timeLeft.hours.toString().padStart(2, '0')}</span>
            <span className="text-xs text-neutral-500 font-bold tracking-wider">HOURS</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-black font-mono text-emerald-400">{timeLeft.minutes.toString().padStart(2, '0')}</span>
            <span className="text-xs text-neutral-500 font-bold tracking-wider">MINUTES</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-black font-mono text-emerald-400">{timeLeft.seconds.toString().padStart(2, '0')}</span>
            <span className="text-xs text-neutral-500 font-bold tracking-wider">SECONDS</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-10">
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
            activeTab === 'teams' ? 'bg-emerald-500 text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Shield className="w-5 h-5" />
          National Teams
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${
            activeTab === 'players' ? 'bg-emerald-500 text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Users className="w-5 h-5" />
          Superstar Players
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-16"
        >
          {activeTab === 'teams' ? (
            teamOrder.map((tierLabel) => {
              const tierTeams = groupedTeams[tierLabel];
              if (!tierTeams || tierTeams.length === 0) return null;
              
              return (
                <section key={tierLabel}>
                  <div className="mb-6 flex items-center gap-4">
                    <h2 className="text-2xl font-black text-white">{tierLabel}</h2>
                    <div className="h-px bg-neutral-800 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {tierTeams.map((team: AssetWithLabel) => (
                      <IpoAssetCard key={team.id} asset={team} type="TEAM" />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            playerOrder.map((tierLabel) => {
              const tierPlayers = groupedPlayers[tierLabel];
              if (!tierPlayers || tierPlayers.length === 0) return null;

              // Only display first 50 per tier for performance
              const displayPlayers = tierPlayers.slice(0, 50);
              
              return (
                <section key={tierLabel}>
                  <div className="mb-6 flex items-center gap-4">
                    <h2 className="text-2xl font-black text-white">{tierLabel} <span className="text-neutral-500 text-sm ml-2">({tierPlayers.length} Players)</span></h2>
                    <div className="h-px bg-neutral-800 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {displayPlayers.map((player: AssetWithLabel) => (
                      <IpoAssetCard key={player.id} asset={player} type="PLAYER" />
                    ))}
                  </div>
                  {tierPlayers.length > 50 && (
                    <div className="mt-4 text-center">
                      <Link href="/market" className="text-emerald-400 hover:text-emerald-300 text-sm font-bold">
                        View all {tierPlayers.length} players in Market →
                      </Link>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function IpoAssetCard({ asset, type }: { asset: AssetWithLabel, type: 'TEAM' | 'PLAYER' }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl p-4 transition-all group overflow-hidden relative flex flex-col h-full">
      <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
        <TrendingUp className="w-16 h-16 text-emerald-400" />
      </div>
      
      <div className="relative z-10 flex flex-col items-center flex-1">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 mb-3 border border-neutral-700">
          <Image src={asset.image} alt={asset.name} width={64} height={64} className="w-full h-full object-cover" />
        </div>
        
        <h4 className="text-sm font-bold text-white text-center line-clamp-1 mb-1">{asset.name}</h4>
        
        {type === 'PLAYER' ? (
          <div className="text-xs text-neutral-400 mb-3">{asset.position} • Rating: {asset.score}</div>
        ) : (
          <div className="text-xs text-neutral-400 mb-3">Rank: {asset.fifaRank}</div>
        )}
        
        <div className="mt-auto w-full pt-3 border-t border-neutral-800 flex items-center justify-between">
          <div className="font-mono font-bold text-emerald-400">{asset.current_price} ¢</div>
          <Link href={`/asset/${asset.id}`} className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md text-xs font-bold transition-colors">
            BUY
          </Link>
        </div>
      </div>
    </div>
  );
}
