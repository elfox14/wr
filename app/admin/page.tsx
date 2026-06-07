'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Settings, ShieldAlert, TrendingUp, TrendingDown, Users, Activity } from 'lucide-react';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { assets, fetchAssets } = useStore();

  const [selectedAsset, setSelectedAsset] = useState('');
  const [eventType, setEventType] = useState('GOAL');
  const [customImpact, setCustomImpact] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (session?.user?.email !== 'admin@worldcup.com') { // Basic check, ideally check role from DB
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleApplyEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) {
      showNotification('الرجاء اختيار الأصل أولاً', 'error');
      return;
    }

    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset,
          eventType,
          impactPercentage: customImpact ? parseFloat(customImpact) : undefined,
          customNews: customMessage
        })
      });

      const data = await res.json();
      if (res.ok) {
        showNotification('تم تطبيق الحدث وتحديث السعر بنجاح!', 'success');
        fetchAssets(); // Refresh prices
      } else {
        showNotification(`خطأ: ${data.error}`, 'error');
      }
    } catch (err) {
      showNotification('حدث خطأ في الاتصال بالخادم', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const handleDistributeDividends = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const assetId = formData.get('dividendAssetId');
    const amountPerShare = formData.get('amountPerShare');
    const reason = formData.get('reason');

    if (!assetId || !amountPerShare) {
      showNotification('الرجاء تعبئة الحقول المطلوبة', 'error');
      return;
    }

    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          amountPerShare: parseFloat(amountPerShare as string),
          reason
        })
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(data.message || 'تم التوزيع بنجاح!', 'success');
        (e.target as HTMLFormElement).reset();
      } else {
        showNotification(`خطأ: ${data.error}`, 'error');
      }
    } catch (err) {
      showNotification('حدث خطأ أثناء التوزيع', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  if (status === 'loading' || !assets.length) {
    return <div className="min-h-screen bg-[#121212] text-white p-10 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <ShieldAlert className="text-red-500" size={32} />
          <h1 className="text-3xl font-bold text-white">لوحة تحكم الإدارة (Admin Panel)</h1>
        </div>

        {notification && (
          <div className="bg-white/10 border border-white/20 p-4 rounded-lg mb-6 text-center font-bold">
            {notification}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* System Overview */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1A1A1A] border border-red-500/20 p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Activity className="text-red-400" /> مراقبة النظام
              </h2>
              <ul className="space-y-4 text-gray-400">
                <li className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span>حالة محرك العرض والطلب:</span>
                  <span className="text-green-500 font-bold">نشط آلياً (0.05%±)</span>
                </li>
                <li className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span>حالة مستقبل الإشارات (Webhook):</span>
                  <span className="text-green-500 font-bold">يعمل (Listening)</span>
                </li>
                <li className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span>تنبيهات الواتساب:</span>
                  <span className="text-yellow-500 font-bold">وضع المحاكاة</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Event Trigger Form */}
          <div className="lg:col-span-2">
            <div className="bg-[#1A1A1A] border border-white/10 p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="text-[#0FF0FC]" /> إطلاق حدث يدوي (تغيير سعر)
              </h2>

              <form onSubmit={handleApplyEvent} className="space-y-6">
                
                {/* Asset Selection */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">الفريق أو اللاعب المستهدف</label>
                  <select 
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]"
                    required
                  >
                    <option value="" disabled>اختر الأصل...</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.image} {a.name} ({a.current_price} ¢)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Event Type */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">نوع الحدث (إعدادات مسبقة)</label>
                    <select 
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]"
                    >
                      <option value="GOAL">هدف مبكر (+5%)</option>
                      <option value="WIN">فوز بالمباراة (+10%)</option>
                      <option value="QUALIFY">تأهل للدور القادم (+15%)</option>
                      <option value="LOSS">خسارة (-10%)</option>
                      <option value="ELIMINATED">إقصاء من البطولة (-20%)</option>
                      <option value="INJURY">إصابة مؤثرة (-5%)</option>
                      <option value="RED_CARD">بطاقة حمراء (-8%)</option>
                      <option value="CUSTOM">تخصيص يدوي</option>
                    </select>
                  </div>

                  {/* Custom Impact */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">تأثير مخصص (كنسبة مئوية %)</label>
                    <input 
                      type="number" 
                      placeholder="مثال: 12.5 أو -7"
                      value={customImpact}
                      onChange={(e) => setCustomImpact(e.target.value)}
                      disabled={eventType !== 'CUSTOM'}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC] disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">عنوان الخبر (News) الذي سيظهر للمتداولين</label>
                  <input 
                    type="text" 
                    placeholder="مثال: ميسي يسجل هاتريك تاريخي في الشوط الأول!"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]"
                  />
                  <p className="text-xs text-gray-500 mt-1">اتركه فارغاً لاستخدام العنوان الافتراضي الخاص بالحدث.</p>
                </div>

                <button 
                  type="submit"
                  disabled={loadingAction}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                  {loadingAction ? 'جاري التطبيق...' : 'تنفيذ الحدث فوراً 🚀'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Add Asset Form */}
        <div className="mt-8 bg-[#1A1A1A] border border-[#0FF0FC]/20 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="text-[#0FF0FC]" /> إضافة منتخب أو لاعب جديد
          </h2>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const body = Object.fromEntries(formData);
            
            setLoadingAction(true);
            try {
              const res = await fetch('/api/admin/asset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              const data = await res.json();
              if (res.ok) {
                showNotification('تم إضافة الأصل بنجاح!', 'success');
                (e.target as HTMLFormElement).reset();
                fetchAssets();
              } else {
                showNotification(`خطأ: ${data.error}`, 'error');
              }
            } catch (err) {
              showNotification('حدث خطأ', 'error');
            } finally {
              setLoadingAction(false);
            }
          }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">نوع الأصل</label>
              <select name="type" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]">
                <option value="PLAYER">لاعب (Player)</option>
                <option value="TEAM">منتخب (Team)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">الاسم (Name)</label>
              <input name="name" type="text" placeholder="مثال: Lamine Yamal" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">الرمز (Code)</label>
              <input name="code" type="text" placeholder="مثال: LY19" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">المنتخب التابع له (للاعبين فقط)</label>
              <select name="teamId" className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]">
                <option value="">لا ينطبق (أو اختر الفريق)</option>
                {assets.filter(a => a.type === 'TEAM').map(t => (
                  <option key={t.id} value={t.id}>{t.image} {t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">السعر الافتتاحي (¢)</label>
              <input name="current_price" type="number" placeholder="مثال: 1500" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#0FF0FC]" />
            </div>

            <div className="flex items-end">
              <button type="submit" disabled={loadingAction} className="w-full bg-[#0FF0FC] hover:bg-[#0FF0FC]/80 text-black font-bold py-3 px-4 rounded-lg transition-colors">
                إضافة الأصل ➕
              </button>
            </div>

          </form>
        </div>

        {/* Dividend Distribution Form */}
        <div className="mt-8 bg-[#1A1A1A] border border-[#FFD700]/30 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none"></div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span className="text-2xl">💰</span> توزيع أرباح نقدية (Dividends)
          </h2>
          <p className="text-sm text-gray-400 mb-6">سيتم دفع الأرباح لجميع المُلّاك حسب عدد أسهمهم. (سيتم مضاعفة الربح x2 لمن اختار الأصل ككابتن)</p>

          <form onSubmit={handleDistributeDividends} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="lg:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">الأصل الموزع للأرباح</label>
              <select name="dividendAssetId" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#FFD700]">
                <option value="" disabled selected>اختر الأصل...</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.image} {a.name} (السعر الحالي: {a.current_price} ¢)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">العائد للسهم الواحد (¢)</label>
              <input name="amountPerShare" type="number" step="0.1" placeholder="مثال: 50" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#FFD700]" />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm text-gray-400 mb-2">سبب التوزيع (سيظهر في الإشعار)</label>
              <input name="reason" type="text" placeholder="مثال: الفوز بجائزة رجل المباراة" required className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#FFD700]" />
            </div>

            <div className="flex items-end lg:col-span-1">
              <button type="submit" disabled={loadingAction} className="w-full bg-gradient-to-r from-[#FFD700] to-[#CD7F32] hover:opacity-90 text-black font-bold py-3 px-4 rounded-lg transition-colors shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                توزيع الأرباح 💸
              </button>
            </div>

          </form>
        </div>

      </main>
    </div>
  );
}
