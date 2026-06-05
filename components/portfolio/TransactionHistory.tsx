"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  quantity: number;
  price_at_time: number;
  timestamp: string;
  asset: {
    name: string;
    code: string;
    image: string;
    type: string;
  };
}

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/portfolio/history')
      .then(res => res.json())
      .then(data => {
        if (data.transactions) {
          setTransactions(data.transactions);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500 py-4">جاري تحميل سجل العمليات...</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-[#1A1A1A]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5 text-center">
        <p className="text-gray-400">لا توجد عمليات سابقة</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5 h-[400px] overflow-y-auto custom-scrollbar">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Clock size={20} className="text-[#0FF0FC]" />
        سجل العمليات
      </h3>
      <div className="flex flex-col gap-3">
        {transactions.map((tx) => {
          const isBuy = tx.type === 'BUY';
          const totalValue = tx.quantity * tx.price_at_time;
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={tx.id} 
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isBuy ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {isBuy ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                </div>
                <div>
                  <div className="font-bold text-white">{tx.asset.name}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span className={isBuy ? 'text-green-400' : 'text-red-400'}>
                      {isBuy ? 'شراء' : 'بيع'}
                    </span>
                    • {new Date(tx.timestamp).toLocaleDateString('ar-SA')}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className="font-mono font-bold text-white">{totalValue.toLocaleString()} ¢</div>
                <div className="text-xs text-gray-500 font-mono">
                  {tx.quantity} x {tx.price_at_time}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
