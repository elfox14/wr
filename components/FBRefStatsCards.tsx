'use client';

import { Database, ShieldAlert } from 'lucide-react';

type FBRefStatsCardsProps = {
  teamId: string;
};

export default function FBRefStatsCards({ teamId }: FBRefStatsCardsProps) {
  void teamId;

  return (
    <div className="rounded-3xl border border-yellow-300/15 bg-yellow-300/[0.06] p-6 text-yellow-50">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center items-start gap-4 sm:gap-3">
        <div className="rounded-2xl bg-yellow-300/10 p-3 text-yellow-100">
          <Database size={22} />
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-yellow-200">Stats source disabled</div>
          <h3 className="text-xl font-black text-white">الإحصائيات التفصيلية غير مفعّلة حاليًا</h3>
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-2xl border border-yellow-300/10 bg-black/20 p-4 text-sm leading-7 text-yellow-50">
        <ShieldAlert className="mt-1 h-4 w-4 flex-shrink-0" />
        <p>
          تم حذف مسارات جلب واستيراد FBref. استخدم تقارير المصادر اليدوية أو المصادر المصرح بها داخل لوحة إدارة تقارير المنتخبات.
        </p>
      </div>
    </div>
  );
}
