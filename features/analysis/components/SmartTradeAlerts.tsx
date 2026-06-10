import Link from 'next/link';
import { AlertTriangle, ArrowRight, Brain, Flame, TrendingUp } from 'lucide-react';
import type { SmartTradeAlert } from '../lib/smart-alerts';

function iconForType(type: SmartTradeAlert['type']) {
  if (type === 'OPPORTUNITY') return <TrendingUp size={16} />;
  if (type === 'WARNING') return <AlertTriangle size={16} />;
  if (type === 'MOMENTUM') return <Flame size={16} />;
  return <Brain size={16} />;
}

function toneForAlert(alert: SmartTradeAlert) {
  if (alert.type === 'OPPORTUNITY') return 'border-emerald-400/20 bg-emerald-400/[0.055] text-emerald-300';
  if (alert.type === 'WARNING') return 'border-red-400/20 bg-red-400/[0.055] text-red-300';
  if (alert.type === 'MOMENTUM') return 'border-orange-400/20 bg-orange-400/[0.055] text-orange-300';
  return 'border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.055] text-[#0FF0FC]';
}

function severityLabel(severity: SmartTradeAlert['severity']) {
  if (severity === 'HIGH') return 'مرتفع';
  if (severity === 'MEDIUM') return 'متوسط';
  return 'منخفض';
}

export function SmartTradeAlerts({ alerts = [] }: { alerts?: SmartTradeAlert[] }) {
  if (!alerts.length) return null;

  return (
    <section className="mb-8 rounded-[1.7rem] border border-white/10 bg-[#101217] p-4 shadow-card lg:rounded-3xl lg:p-6">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]">
            <AlertTriangle size={14} /> Smart Trade Alerts
          </div>
          <h2 className="text-xl font-black text-white lg:text-2xl">تنبيهات ذكية حسب التحليل الفني والسعر</h2>
          <p className="mt-1 text-xs leading-6 text-gray-400 lg:text-sm">تنبيهات غير مالية تساعدك تفهم الفرص والتحذيرات داخل السوق الافتراضي.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {alerts.map((alert) => (
          <Link key={alert.id} href={`/asset/${alert.asset.id}`} className={`group rounded-2xl border p-4 transition hover:border-[#0FF0FC]/35 hover:bg-white/[0.04] ${toneForAlert(alert)}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black">
                {iconForType(alert.type)}
                {alert.title}
              </div>
              <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-black text-white">
                {severityLabel(alert.severity)}
              </span>
            </div>
            <p className="mb-2 truncate text-sm font-black text-white group-hover:text-[#0FF0FC]">{alert.asset.name}</p>
            <p className="line-clamp-3 text-xs leading-6 text-gray-300">{alert.message}</p>
            <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-gray-400">
              <span>Tech {alert.metrics.technicalScore}</span>
              <span className="inline-flex items-center gap-1 text-[#0FF0FC]">فتح الأصل <ArrowRight size={12} /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
