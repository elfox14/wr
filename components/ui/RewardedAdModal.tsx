'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, Loader2, Coins } from 'lucide-react';
import { useStore } from '@/lib/store';

interface RewardedAdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RewardedAdModal({ isOpen, onClose }: RewardedAdModalProps) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { fetchPortfolio } = useStore();

  useEffect(() => {
    if (isOpen) {
      setTimeLeft(15);
      setIsPlaying(true);
      setIsClaiming(false);
      setIsSuccess(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    } else if (isPlaying && timeLeft === 0) {
      setIsPlaying(false);
      claimReward();
    }
    return () => clearTimeout(timer);
  }, [isPlaying, timeLeft]);

  const claimReward = async () => {
    setIsClaiming(true);
    try {
      const res = await fetch('/api/portfolio/reward', {
        method: 'POST',
      });
      if (res.ok) {
        setIsSuccess(true);
        await fetchPortfolio();
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to claim reward', error);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-surface border border-accent/30 rounded-2xl overflow-hidden shadow-anti-gravity"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlayCircle className="text-accent" /> إعلان ممول
              </h3>
              {!isPlaying && !isClaiming && !isSuccess && (
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-8 flex flex-col items-center justify-center text-center min-h-[300px] relative overflow-hidden">
              {/* Fake Video Background */}
              <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-accent to-primary animate-pulse" />
              
              {isPlaying ? (
                <div className="relative z-10">
                  <div className="w-24 h-24 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-6" />
                  <h4 className="text-xl font-bold text-white mb-2">جاري عرض الإعلان...</h4>
                  <p className="text-gray-400">ستحصل على المكافأة بعد <span className="text-accent font-bold text-lg">{timeLeft}</span> ثانية</p>
                </div>
              ) : isClaiming ? (
                <div className="relative z-10 text-center">
                  <Loader2 className="w-16 h-16 animate-spin text-accent mx-auto mb-4" />
                  <p className="text-lg font-bold text-white">جاري إضافة الرصيد لمحفظتك...</p>
                </div>
              ) : isSuccess ? (
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }} 
                  className="relative z-10 text-center"
                >
                  <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                    <Coins size={40} />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-2">تهانينا!</h4>
                  <p className="text-gray-300">تم إضافة <span className="text-accent font-bold">500 ¢</span> إلى رصيدك بنجاح.</p>
                </motion.div>
              ) : (
                <div className="relative z-10">
                  <p className="text-gray-400">تم إغلاق الإعلان قبل اكتماله.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
