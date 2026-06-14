'use client';

const tabs = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'matches', label: 'المباريات' },
  { id: 'squad', label: 'اللاعبون' },
  { id: 'stats', label: 'الإحصائيات' },
  { id: 'tactics', label: 'التحليل الفني' },
  { id: 'history', label: 'التاريخ' },
  { id: 'sources', label: 'المصادر' },
];

export default function TeamTabs({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (id: any) => void }) {
  return (
    <div className="flex overflow-x-auto hide-scrollbar border-b border-white/10 pb-px mb-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`whitespace-nowrap px-6 py-3 text-sm font-bold transition-colors relative ${
            activeTab === tab.id ? 'text-[#0FF0FC]' : 'text-gray-400 hover:text-white'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0FF0FC]" />
          )}
        </button>
      ))}
    </div>
  );
}
