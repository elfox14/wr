'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TeamHero from './TeamHero';
import TeamTabs from './TeamTabs';
import TeamOverviewPanel from './TeamOverviewPanel';
import TeamMatchesList from './TeamMatchesList';
import TeamSquadHighlight from './TeamSquadHighlight';
import TeamStatsOverview from './TeamStatsOverview';
import TeamTacticalBoard from './TeamTacticalBoard';
import TeamHistoryPanel from './TeamHistoryPanel';
import TeamDataSources from './TeamDataSources';

type TabType = 'overview' | 'matches' | 'squad' | 'stats' | 'tactics' | 'history' | 'sources';

export default function TeamIntelligenceHub({ team, players = [], matches = [], intelligenceReport }: any) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <TeamHero team={team} matches={matches} players={players} report={intelligenceReport} />
      
      <TeamTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'overview' && <TeamOverviewPanel team={team} matches={matches} players={players} report={intelligenceReport} />}
            {activeTab === 'matches' && <TeamMatchesList team={team} matches={matches} />}
            {activeTab === 'squad' && <TeamSquadHighlight players={players} />}
            {activeTab === 'stats' && <TeamStatsOverview team={team} matches={matches} />}
            {activeTab === 'tactics' && <TeamTacticalBoard report={intelligenceReport} />}
            {activeTab === 'history' && <TeamHistoryPanel team={team} matches={matches} report={intelligenceReport} />}
            {activeTab === 'sources' && <TeamDataSources report={intelligenceReport} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
