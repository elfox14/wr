'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database, KeyRound, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';

type SeedResponse = {
  success?: boolean;
  created?: number;
  updated?: number;
  skipped?: number;
  count?: number;
  error?: string;
  message?: string;
};

function getResponseMessage(data: SeedResponse) {
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (data.success) {
    const parts = [
      typeof data.created === 'number' ? `created=${data.created}` : null,
      typeof data.updated === 'number' ? `updated=${data.updated}` : null,
      typeof data.skipped === 'number' ? `skipped=${data.skipped}` : null,
      typeof data.count === 'number' ? `count=${data.count}` : null,
    ].filter(Boolean);

    return parts.length ? `تم تشغيل seed بنجاح: ${parts.join(' · ')}` : 'تم تشغيل seed بنجاح.';
  }

  return 'تم استلام رد غير متوقع من الخادم.';
}

export default function TeamIntelligenceAdminPage() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<SeedResponse | null>(null);

  const runSeed = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    setLastResult(null);

    try {
      const res = await fetch('/api/admin/seed-team-intelligence', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret.trim()}`,
        },
      });
      const data = await res.json() as SeedResponse;
      setLastResult(data);

      if (!res.ok) {
        setError(getResponseMessage(data));
        return;
      }

      setMessage(getResponseMessage(data));
    } catch (caughtError) {
      const fallbackMessage = caughtError instanceof Error ? caughtError.message : 'فشل تشغيل seed تقارير المنتخبات.';
      setError(fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary/30">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-primary/10 bg-surface/70 p-5 shadow-card md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary">
                <Database size={16} /> TEAM INTELLIGENCE ADMIN
              </div>
              <h1 className="text-2xl font-black text-white md:text-3xl">إدارة تقارير المنتخبات</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-400">
                شغّل seed تقارير TeamIntelligenceReport يدويًا، ثم راجع النتائج في مركز تقارير المنتخبات وصفحة AI Analyst.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/team-intelligence" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">
                مركز التقارير <ArrowRight size={15} />
              </Link>
              <Link href="/ai-analyst" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-black hover:bg-primary/90">
                AI Analyst <Sparkles size={15} />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-300/10 bg-yellow-300/[0.055] p-4 text-sm leading-7 text-yellow-100">
            هذه الصفحة لا تعرض السر ولا تخزنه. أدخل قيمة <code className="rounded bg-black/25 px-1 text-yellow-200">ADMIN_CRON_SECRET</code> يدويًا لتشغيل endpoint المحمي.
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-surface p-5 shadow-card md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white">
            <KeyRound size={20} className="text-primary" /> تشغيل Seed يدوي
          </h2>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-gray-500">ADMIN_CRON_SECRET</span>
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="أدخل السر لتشغيل seed"
                className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={runSeed}
              disabled={loading || !secret.trim()}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'جاري التشغيل...' : 'تشغيل seed'} <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success">
              <CheckCircle2 className="ml-2 inline" size={16} />{message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger">
              <ShieldAlert className="ml-2 inline" size={16} />{error}
            </div>
          )}

          {lastResult && (
            <pre className="mt-5 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-6 text-gray-300">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          )}
        </section>
      </main>
    </div>
  );
}
