'use client';

import React from 'react';

export default function CompactStatCell({ label, h, a }: { label: string, h: string|number, a: string|number }) {
  const hNum = parseFloat(String(h).replace(/[^0-9.]/g, '')) || 0;
  const aNum = parseFloat(String(a).replace(/[^0-9.]/g, '')) || 0;
  const total = hNum + aNum;
  
  const hPct = total > 0 ? (hNum / total) * 100 : 50;
  const aPct = total > 0 ? (aNum / total) * 100 : 50;

  return (
    <div className="flex flex-col bg-black/40 border border-white/5 rounded-xl px-4 py-3 shadow-inner group hover:bg-black/60 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#0FF0FC] font-bold text-lg w-10 text-center">{h}</span>
        <span className="text-white text-xs md:text-sm font-bold text-center flex-1 tracking-wide">{label}</span>
        <span className="text-[#F8C846] font-bold text-lg w-10 text-center">{a}</span>
      </div>
      
      {/* Comparison Bar */}
      <div className="w-full h-1.5 flex bg-white/10 rounded-full overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
         <div 
           className="h-full bg-[#0FF0FC] transition-all duration-1000 ease-out" 
           style={{ width: `${hPct}%` }}
         />
         <div 
           className="h-full bg-[#F8C846] transition-all duration-1000 ease-out" 
           style={{ width: `${aPct}%` }}
         />
      </div>
    </div>
  );
}
