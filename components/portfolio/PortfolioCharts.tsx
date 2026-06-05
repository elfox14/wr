"use client";

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Holding } from '@/lib/store';

interface PortfolioChartsProps {
  holdings: Holding[];
}

const COLORS = ['#0FF0FC', '#FFD700', '#FF4500', '#00FF7F', '#FF1493', '#8A2BE2'];

export function PortfolioCharts({ holdings }: PortfolioChartsProps) {
  if (holdings.length === 0) return null;

  // Group by Asset Type (Team vs Player)
  const typeData = [
    { name: 'منتخبات', value: holdings.filter(h => h.asset?.type === 'TEAM').reduce((sum, h) => sum + (h.currentValue || 0), 0) },
    { name: 'لاعبين', value: holdings.filter(h => h.asset?.type === 'PLAYER').reduce((sum, h) => sum + (h.currentValue || 0), 0) }
  ].filter(d => d.value > 0);

  // Group by Position Type (Long vs Short)
  const positionData = [
    { name: 'شراء (Long)', value: holdings.filter(h => h.positionType !== 'SHORT').reduce((sum, h) => sum + (h.currentValue || 0), 0) },
    { name: 'بيع مكشوف (Short)', value: holdings.filter(h => h.positionType === 'SHORT').reduce((sum, h) => sum + (h.currentValue || 0), 0) }
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      {/* Asset Type Chart */}
      <div className="bg-[#1A1A1A]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-4 text-center">توزيع الأصول</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} ¢`, 'القيمة']}
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Position Type Chart */}
      <div className="bg-[#1A1A1A]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-4 text-center">استراتيجية التداول</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={positionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {positionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name.includes('Short') ? '#FF4500' : '#00FF7F'} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} ¢`, 'القيمة']}
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
