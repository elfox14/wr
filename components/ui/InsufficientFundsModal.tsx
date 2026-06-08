import React from 'react';
import Link from 'next/link';
import { AlertCircle, X, Coins } from 'lucide-react';

interface InsufficientFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InsufficientFundsModal({ isOpen, onClose }: InsufficientFundsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        className="bg-[#121212] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-white bg-black/50 p-2 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
            <AlertCircle size={40} />
          </div>
          
          <h2 className="text-2xl font-black text-white mb-4">رصيد غير كافٍ</h2>
          
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            رصيدك الحالي غير كافٍ لإتمام هذه الصفقة. يمكنك استلام كوينز مجانية عبر إكمال المهام، دعوة الأصدقاء، أو مشاهدة الإعلانات.
          </p>

          <Link href="/rewards" onClick={onClose} className="w-full">
            <button className="w-full bg-[#0FF0FC] text-black font-black py-4 rounded-xl shadow-[0_0_15px_rgba(15,240,252,0.3)] hover:shadow-[0_0_25px_rgba(15,240,252,0.5)] transition-all flex items-center justify-center gap-2">
              <Coins size={20} />
              اكسب كوينز مجانية
            </button>
          </Link>

          <button onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-white transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
