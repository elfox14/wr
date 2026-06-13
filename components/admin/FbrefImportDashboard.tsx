'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database, FileJson, RefreshCw, ShieldAlert, UploadCloud } from 'lucide-react';

type ImportResponse = {
  success?: boolean;
  dryRun?: boolean;
  error?: string;
  created?: number;
  deletedExisting?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  unmatched?: string[];
  preview?: {
    competitionTableCount?: number;
    squadPageCount?: number;
    successfulSquadPageCount?: number;
    draftCount?: number;
    teams?: {
      teamName: string;
      tableCount?: number;
      completedWorldCupMatches?: number;
      hasShooting?: boolean;
      hasGoalkeeping?: boolean;
      hasStandard?: boolean;
    }[];
  };
  reports?: { id: string; teamName: string; assetName: string }[];
  matchedTeams?: { fbrefTeam: string; assetId: string; assetName: string; method: string }[];
};

function getMessage(data: ImportResponse) {
  if (data.error) return data.error;
  if (data.dryRun) {
    return `فحص ناجح: تم مطابقة ${data.matchedCount || 0} منتخب، وغير مطابق ${data.unmatchedCount || 0}.`;
  }
  return `استيراد ناجح: تم إنشاء ${data.created || 0} تقرير، وحذف ${data.deletedExisting || 0} تقرير قديم.`;
}

export default function FbrefImportDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [loadingMode, setLoadingMode] = useState<'dry' | 'import' | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState('');

  const runImport = async (dryRun: boolean) => {
    if (!file) {
      setError('اختر ملف JSON أولًا.');
      return;
    }

    setLoadingMode(dryRun ? 'dry' : 'import');
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', dryRun ? 'true' : 'false');
      formData.append('replaceExisting', replaceExisting ? 'true' : 'false');

      const res = await fetch('/api/admin/fbref-import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as ImportResponse;
      if (!res.ok || data.error) {
        setError(data.error || 'فشل استيراد ملف FBref.');
        return;
      }

      setResult(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'فشل استيراد ملف FBref.');
    } finally {
      setLoadingMode(null);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runImport(true);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/team-intelligence" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">
            <ArrowRight className="h-4 w-4" />
            رجوع لتقارير المنتخبات
          </Link>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-100">
            FBref / Stathead Import
          </span>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl bg-cyan-300/10 p-3 text-cyan-100">
              <Database className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">استيراد بيانات FBref لكأس العالم 2026</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                ارفع الملف المدمج الناتج من تصدير المتصفح. النظام سيقرأ صفحات المنتخبات، يطابقها مع أصول المنصة، ثم يولّد تقارير TeamIntelligenceReport جاهزة للعرض في صفحة المنتخب.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="grid gap-5 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <label className="grid cursor-pointer gap-3 rounded-3xl border border-dashed border-cyan-300/30 bg-cyan-300/5 p-6 text-center hover:bg-cyan-300/10">
              <UploadCloud className="mx-auto h-10 w-10 text-cyan-100" />
              <span className="text-sm font-black text-cyan-50">اختر ملف JSON المدمج</span>
              <span className="text-xs text-slate-400">مثال: FBREF_WC2026_competition_plus_48_squads_merged.json</span>
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              {file ? <span className="text-xs font-bold text-emerald-200">تم اختيار: {file.name}</span> : null}
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
                className="mt-1"
              />
              <span>
                <strong className="block text-white">استبدال تقارير FBref السابقة</strong>
                يحذف التقارير القديمة التي مصدرها FBREF_STATHEAD_IMPORT لنفس المنتخب قبل إنشاء التقرير الجديد، حتى لا تتكرر التقارير في صفحة المنتخب.
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={Boolean(loadingMode) || !file}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMode === 'dry' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                فحص ومطابقة فقط
              </button>
              <button
                type="button"
                onClick={() => void runImport(false)}
                disabled={Boolean(loadingMode) || !file}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMode === 'import' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                استيراد فعلي وإنشاء التقارير
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <div className="flex items-start gap-3 rounded-3xl border border-red-300/20 bg-red-500/10 p-5 text-sm text-red-100">
            <ShieldAlert className="mt-0.5 h-5 w-5" />
            <span>{error}</span>
          </div>
        ) : null}

        {result ? (
          <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-6 text-emerald-50">
            <h2 className="mb-3 text-xl font-black">نتيجة العملية</h2>
            <p className="text-sm font-bold">{getMessage(result)}</p>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-2xl bg-black/20 p-4">
                <span className="block text-slate-300">مطابق</span>
                <strong className="text-2xl">{result.matchedCount ?? 0}</strong>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <span className="block text-slate-300">غير مطابق</span>
                <strong className="text-2xl">{result.unmatchedCount ?? 0}</strong>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <span className="block text-slate-300">تقارير منشأة</span>
                <strong className="text-2xl">{result.created ?? 0}</strong>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <span className="block text-slate-300">تقارير قديمة محذوفة</span>
                <strong className="text-2xl">{result.deletedExisting ?? 0}</strong>
              </div>
            </div>

            {result.preview?.teams?.length ? (
              <div className="mt-6 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-black/20">
                <table className="min-w-full text-right text-xs">
                  <thead className="sticky top-0 bg-slate-950/95 text-slate-300">
                    <tr>
                      <th className="px-3 py-2">المنتخب</th>
                      <th className="px-3 py-2">الجداول</th>
                      <th className="px-3 py-2">مباريات مكتملة</th>
                      <th className="px-3 py-2">Standard</th>
                      <th className="px-3 py-2">Shooting</th>
                      <th className="px-3 py-2">GK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.teams.map((team) => (
                      <tr key={team.teamName} className="border-t border-white/10">
                        <td className="px-3 py-2 font-bold">{team.teamName}</td>
                        <td className="px-3 py-2">{team.tableCount}</td>
                        <td className="px-3 py-2">{team.completedWorldCupMatches}</td>
                        <td className="px-3 py-2">{team.hasStandard ? 'نعم' : 'لا'}</td>
                        <td className="px-3 py-2">{team.hasShooting ? 'نعم' : 'لا'}</td>
                        <td className="px-3 py-2">{team.hasGoalkeeping ? 'نعم' : 'لا'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {result.unmatched?.length ? (
              <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-yellow-50">
                <strong className="block">منتخبات تحتاج مطابقة يدوية:</strong>
                <span>{result.unmatched.join('، ')}</span>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
