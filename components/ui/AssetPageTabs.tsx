'use client';

import { ReactNode, useMemo, useState } from 'react';
import { BarChart3, Brain, FileText, LineChart, ShoppingCart, Users } from 'lucide-react';

type AssetPageTabsProps = {
  isTeam: boolean;
  lineup?: ReactNode;
  playerOverview?: ReactNode;
  trade?: ReactNode;
  technical?: ReactNode;
  overview?: ReactNode;
  market?: ReactNode;
};

type TabItem = {
  id: string;
  label: string;
  icon: ReactNode;
  content?: ReactNode;
};

export function AssetPageTabs({ isTeam, lineup, playerOverview, trade, technical, overview, market }: AssetPageTabsProps) {
  const tabs = useMemo<TabItem[]>(() => {
    const base: TabItem[] = isTeam
      ? [
          { id: 'overview', label: 'التحليل الكروي', icon: <FileText size={16} />, content: overview },
          { id: 'lineup', label: 'التشكيل واللاعبون', icon: <Users size={16} />, content: lineup },
          { id: 'technical', label: 'مؤشرات الجاهزية', icon: <Brain size={16} />, content: technical },
          { id: 'trade', label: 'التداول الافتراضي', icon: <ShoppingCart size={16} />, content: trade },
        ]
      : [
          { id: 'overview', label: 'نظرة اللاعب', icon: <LineChart size={16} />, content: playerOverview },
          { id: 'technical', label: 'التحليل الفني', icon: <Brain size={16} />, content: technical },
          { id: 'market', label: 'السوق', icon: <BarChart3 size={16} />, content: market },
        ];

    return base.filter((tab) => Boolean(tab.content));
  }, [isTeam, lineup, playerOverview, trade, technical, overview, market]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'overview');
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  if (!active) return null;

  return (
    <div className="w-full">
      <div className="sticky top-[72px] z-40 mx-auto mb-4 w-full max-w-[1600px] px-3 lg:px-4">
        <div className="rounded-[1.35rem] border border-white/10 bg-black/80 p-1.5 shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const selected = tab.id === active.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[1rem] px-3 text-xs font-black transition active:scale-[0.98] lg:px-5 lg:text-sm ${
                    selected
                      ? 'bg-[#0FF0FC] text-black shadow-[0_0_20px_rgba(15,240,252,0.18)]'
                      : 'bg-white/[0.04] text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>{active.content}</div>
    </div>
  );
}
