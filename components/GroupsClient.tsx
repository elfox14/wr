'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { useStore, Asset } from '@/lib/store';
import { Layers } from 'lucide-react';
import Link from 'next/link';
import { StockCard } from '@/components/ui/StockCard';

export default function GroupsClient() {
  const { assets, fetchAssets } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assets.length === 0) {
      fetchAssets().then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [assets.length, fetchAssets]);

  if (loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#0FF0FC] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  // Filter only teams
  const teams = assets.filter(a => a.type === 'TEAM');

  // Group by 'group' property
  const groupedTeams = teams.reduce((acc, team) => {
    // some APIs return 'Group A' or just 'A'
    const groupName = team.group ? (team.group.includes('Group') ? team.group : `المجموعة ${team.group}`) : 'مجموعات غير محددة';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(team);
    return acc;
  }, {} as Record<string, Asset[]>);

  // Sort groups alphabetically (A, B, C...)
  const sortedGroupKeys = Object.keys(groupedTeams).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#0FF0FC]/10 rounded-full blur-3xl -z-10"></div>
          <h1 className="text-5xl font-extrabold mb-4 flex items-center justify-center gap-4 text-transparent bg-clip-text bg-gradient-to-r from-[#0FF0FC] to-[#00B4DB]">
            <Layers className="text-[#0FF0FC]" size={48} />
            مجموعات البطولة
          </h1>
          <p className="text-gray-400 text-lg">استعرض المنتخبات المشاركة مقسمة حسب مجموعات كأس العالم</p>
        </div>

        {sortedGroupKeys.length === 0 ? (
          <div className="text-center py-12 bg-[#1A1A1A] rounded-2xl border border-white/5">
            <p className="text-gray-400">لا توجد منتخبات مضافة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {sortedGroupKeys.map(groupName => {
              // Sort teams inside group by score or name
              const groupTeams = groupedTeams[groupName].sort((a, b) => (b.score || 0) - (a.score || 0));
              
              return (
                <div key={groupName} className="bg-[#1A1A1A]/50 rounded-3xl p-6 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#0FF0FC]/5 rounded-bl-full -z-10"></div>
                  <h2 className="text-2xl font-bold mb-6 text-[#0FF0FC] border-b border-white/10 pb-4 inline-block pr-4 pl-12 border-l rounded-bl-xl bg-black/20">
                    {groupName}
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {groupTeams.map(team => {
                      let variant: 'default' | 'hot' | 'cold' = 'default';
                      if (team.change >= 5) variant = 'hot';
                      else if (team.change <= -5) variant = 'cold';
                      
                      return (
                        <div key={team.id} className="flex justify-center">
                          <StockCard 
                            type={team.type as 'TEAM' | 'PLAYER'}
                            name={team.name}
                            code={team.code}
                            image={team.image}
                            score={team.score || 0}
                            price={team.current_price}
                            change={team.change}
                            fifaRank={team.fifaRank || undefined}
                            priceHistory={team.priceHistory?.map((h: any) => h.price) || [team.current_price, team.current_price]}
                            onClick={() => {
                              window.location.href = `/asset/${team.id}`;
                            }}
                            variant={variant}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
