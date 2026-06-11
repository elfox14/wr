'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, Loader2, ShoppingCart, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useStore } from '@/lib/store';

type TeamTradePanelProps = {
  assetId: string;
  initialPrice?: number | null;
  fairValue?: number | null;
  change?: number | null;
};

export default function TeamTradePanel({ assetId, initialPrice, fairValue, change }: TeamTradePanelProps) {
  const { assets, holdings, buyAsset, sellAsset, fetchPortfolio, fetchAssets } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [loadingAction, setLoadingAction] = useState<'BUY' | 'SELL' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPortfolio();
    if (assets.length === 0) fetchAssets();
  }, [fetchPortfolio, fetchAssets, assets.length]);

  const asset = useMemo(() => assets.find((item) => item.id === assetId), [assets, assetId]);
  const holding = holdings.find((item) => item.assetId === assetId);
  const price = Math.round(Number(asset?.marketPrice ?? asset?.current_price ?? initialPrice ?? 0));
  const fair = Number(asset?.fairValue ?? fairValue ?? price);
  const changeValue = Number(asset?.change ?? change ?? 0);
  const isUp = changeValue >= 0;
  const total = price * quantity;
  const premiumDiscount = fair > 0 ? ((price - fair) / fair) * 100 : 0;

  const signal = premiumDiscount <= -8
    ? {
        label: 'منطقة مراقبة للشراء',
        tone: 'text-emerald-300 border-emerald-400/20 bg-emerald-400/10',
        icon: <TrendingUp size={16} />,
        note: 'السعر أقل من القيمة العادلة الافتراضية، لكن القرار يحتاج مراجعة التحليل الكروي أولًا.',
      }
    : premiumDiscount >= 8
      ? {
          label: 'منطقة حذر',
          tone: 'text-red-300 border-red-400/20 bg-red-400/10',
          icon: <AlertTriangle size={16} />,
          note: 'السعر أعلى من القيمة العادلة الافتراضية؛ لا تدخل إلا إذا كان التحليل الكروي يدعم الصعود.',
        }
      : {
          label: 'سعر قريب من العادل',
          tone: 'text-[#0FF0FC] border-[#0FF0FC]/20 bg-[#0FF0FC]/10',
          icon: <Info size={16} />,
          note: 'السعر قريب من القيمة العادلة، لذلك الأفضل انتظار خبر كروي أو تحديث قائمة/تشكيلة.',
        };

  async function handleTrade(type: 'BUY' | 'SELL') {
    setLoadingAction(type);
    setMessage(null);
    try {
      if (type === 'BUY') await buyAsset(assetId, quantity);
      else await sellAsset(assetId, quantity);
      await fetchPortfolio();
      await fetchAssets();
      setMessage(type === 'BUY' ? 'تم تنفيذ الشراء الافتراضي بنجاح.' : 'تم تنفيذ البيع الافتراضي بنجاح.');
    } catch (error: any) {
      setMessage(error?.message || 'تعذر تنفيذ العملية.');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section id="trade-panel" className="mx-auto mb-4 scroll-mt-24 w-full max-w-[1600px] px-4">
      <div className="rounded-3xl border border-[#0FF0FC]/15 bg-[#101217] p-5 shadow-card md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-start">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">
              <ShoppingCart size={14} /> التداول المرتبط بالتحليل الكروي
            </div>
            <h2 className="text-2xl font-black text-white md:text-3xl">لوحة التداول الافتراضي</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">
              هذا التب يربط سعر سهم المنتخب بالقراءة الكروية: النتائج الأخيرة، قوة الدفاع والهجوم، التشكيلة، الغيابات، وحظوظ التأهل. التداول هنا افتراضي فقط ولا توجد أموال حقيقية أو مراهنات.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-500">السعر الحالي</p>
                <p className="mt-1 text-2xl font-black text-[#0FF0FC]">{price.toLocaleString()}¢</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-500">القيمة العادلة</p>
                <p className="mt-1 text-2xl font-black text-white">{Math.round(fair).toLocaleString()}¢</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-500">خصم / علاوة</p>
                <p className={`mt-1 text-2xl font-black ${premiumDiscount <= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{premiumDiscount > 0 ? '+' : ''}{premiumDiscount.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-gray-500">تغير 24h</p>
                <p className={`mt-1 flex items-center gap-1 text-2xl font-black ${isUp ? 'text-emerald-300' : 'text-red-300'}`}>
                  {isUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}{Math.abs(changeValue)}%
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className={`rounded-3xl border p-4 ${signal.tone}`}>
                <div className="mb-2 flex items-center gap-2 text-sm font-black">{signal.icon}{signal.label}</div>
                <p className="text-xs leading-6 text-gray-300">{signal.note}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-white"><CheckCircle2 size={16} className="text-emerald-300" /> قبل الشراء راجع كرويًا</h3>
                <div className="grid gap-2 text-xs leading-6 text-gray-300 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">آخر 5-10 مباريات: هل النتائج مستقرة؟</div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">الدفاع: هل يستقبل أهدافًا كثيرة؟</div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">الهجوم: هل يسجل بمعدل جيد؟</div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">التشكيلة: هل الأساسيون متاحون؟</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-yellow-400/15 bg-yellow-400/[0.06] p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-yellow-300"><AlertTriangle size={16} /> نصائح تداول مرتبطة بالتحليل</h3>
              <ul className="space-y-2 text-xs leading-6 text-gray-300">
                <li>• الشراء يكون أقوى عندما يجتمع السعر المنخفض مع مؤشرات كروية إيجابية، مثل سلسلة لا هزيمة أو دفاع قوي.</li>
                <li>• البيع أو تقليل الكمية منطقي عند ارتفاع السعر مع ظهور مؤشرات كروية سلبية، مثل إصابات أو تراجع نتائج.</li>
                <li>• لا تعتمد على السعر وحده؛ افتح تب التحليل الكروي وتب التشكيلة قبل تنفيذ القرار الافتراضي.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5">
            {holding && (
              <div className="mb-4 rounded-2xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 p-4 text-center">
                <p className="mb-1 flex items-center justify-center gap-2 text-xs font-bold text-[#0FF0FC]"><Wallet size={14} /> تمتلك حاليًا</p>
                <p className="text-3xl font-black text-white">{holding.quantity}</p>
                <p className="mt-1 text-xs text-gray-400">متوسط الشراء: {holding.avg_buy_price}¢</p>
              </div>
            )}

            <label className="mb-2 block text-xs font-bold text-gray-400">كمية الأسهم الافتراضية</label>
            <div className="mb-4 flex items-center rounded-2xl border border-white/10 bg-black/50 p-1">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-11 w-12 rounded-xl bg-white/5 text-xl font-black text-white hover:bg-white/10">-</button>
              <input
                type="number"
                value={quantity}
                min={1}
                max={100}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="min-w-0 flex-1 bg-transparent text-center text-2xl font-black text-white outline-none"
              />
              <button onClick={() => setQuantity(quantity + 1)} className="h-11 w-12 rounded-xl bg-white/5 text-xl font-black text-white hover:bg-white/10">+</button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-sm text-gray-400">الإجمالي</span>
              <span className="text-xl font-black text-white">{total.toLocaleString()}¢</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTrade('BUY')}
                disabled={Boolean(loadingAction)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {loadingAction === 'BUY' ? <Loader2 className="animate-spin" size={18} /> : <TrendingUp size={18} />} شراء
              </button>
              <button
                onClick={() => handleTrade('SELL')}
                disabled={Boolean(loadingAction)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-60"
              >
                {loadingAction === 'SELL' ? <Loader2 className="animate-spin" size={18} /> : <TrendingDown size={18} />} بيع
              </button>
            </div>

            {message && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-sm text-gray-200">{message}</p>}
            <Link href="/portfolio" className="mt-3 block text-center text-xs font-black text-[#0FF0FC] hover:text-white">عرض المحفظة</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
