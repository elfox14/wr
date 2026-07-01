'use client';
// ============================================================
// app/admin/fbref-import/page.tsx
// Admin UI: upload FBref/Stathead CSV or JSON,
// preview dry-run, then confirm import.
// ============================================================
import { useState, useRef } from 'react';
import { dryRunImport, importSourcePack } from './actions';
import type { DryRunResult, ImportResult } from './actions';

const SOURCE_CATEGORIES = [
  { value: 'fbref',       label: 'FBref' },
  { value: 'stathead',   label: 'Stathead' },
  { value: 'fifa',       label: 'FIFA / Federation' },
  { value: 'editorial', label: 'تحريري' },
];

const REPORT_TYPES = [
  { value: 'TEAM_PROFILE',   label: 'ملف المنتخب' },
  { value: 'SQUAD_ANALYSIS', label: 'تحليل التشكيل' },
  { value: 'HISTORICAL',     label: 'سجل تاريخي' },
  { value: 'FORM_GUIDE',     label: 'مسار التأهل' },
  { value: 'TACTICAL',       label: 'هوية تكتيكية' },
];

const C_COLOR: Record<string, string> = {
  A: 'text-emerald-400', B: 'text-blue-400',
  C: 'text-amber-400',   D: 'text-red-400',
};

export default function FbrefImportPage() {
  const formRef  = useRef<HTMLFormElement>(null);
  const [dry,    setDry]    = useState<DryRunResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading,setLoading]= useState<'dry' | 'import' | null>(null);
  const [file,   setFile]   = useState('');

  async function handleDry(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setLoading('dry'); setDry(null); setResult(null);
    setDry(await dryRunImport(new FormData(formRef.current)));
    setLoading(null);
  }

  async function handleImport() {
    if (!formRef.current || !dry?.matched) return;
    setLoading('import'); setResult(null);
    const res = await importSourcePack(new FormData(formRef.current));
    setResult(res); setLoading(null);
    if (res.success) { formRef.current.reset(); setDry(null); setFile(''); }
  }

  const inp = 'w-full rounded-xl bg-white/8 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">استيراد FBref / Stathead</h1>
        <p className="text-sm text-white/50 mt-1">ارفع ملف CSV أو JSON من FBref أو Stathead لإنشاء تقرير تحليل منتخب.</p>
      </div>

      <form ref={formRef} onSubmit={handleDry} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">اسم المنتخب *</label>
          <input name="teamName" required placeholder="مثال: Brazil" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">اسم المصدر</label>
          <input name="sourceName" defaultValue="FBref" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">رابط المصدر (اختياري)</label>
          <input name="sourceUrl" type="url" placeholder="https://fbref.com/..." className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">فئة المصدر</label>
            <select name="sourceCategory" className={inp}>
              {SOURCE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">نوع التقرير</label>
            <select name="reportType" className={inp}>
              {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">الملف (CSV / JSON) *</label>
          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 hover:bg-white/8 transition">
            <span className="text-2xl">📂</span>
            <span className="text-sm text-white/50">{file || 'اختر ملف .csv أو .json'}</span>
            <input name="file" type="file" accept=".csv,.json" required className="hidden"
              onChange={(e) => setFile(e.target.files?.[0]?.name || '')} />
          </label>
        </div>

        <button type="submit" disabled={!!loading}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition">
          {loading === 'dry' ? 'جاري الفحص...' : 'فحص مسبق (Dry Run)'}
        </button>
      </form>

      {dry && (
        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
          <h2 className="text-sm font-semibold">نتيجة الفحص</h2>
          <p className={`text-sm font-medium ${dry.matched ? 'text-emerald-400' : 'text-red-400'}`}>
            {dry.matched ? `✅ تطابق: ${dry.assetName}` : `❌ لا يوجد منتخب باسم: «${dry.pack.teamName}»`}
          </p>
          <div className="text-xs text-white/60 space-y-1">
            <p>صفوف: <span className="text-white">{dry.pack.rows.length}</span></p>
            <p>مستوى الثقة: <span className={C_COLOR[dry.pack.confidence]}>{dry.pack.confidence}</span></p>
            <p>{dry.pack.summary}</p>
          </div>
          {Object.keys(dry.pack.metrics).length > 0 && (
            <div>
              <p className="text-xs font-medium text-white/50 mb-2">المقاييس:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(dry.pack.metrics).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 px-2 py-1 text-xs">
                    <span className="text-white/40">{k}: </span>
                    <span className={typeof v === 'number' ? 'text-white' : 'text-white/30 italic'}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dry.pack.warnings.map((w, i) => <p key={i} className="text-xs text-amber-400">⚠️ {w}</p>)}
          {dry.matched && (
            <button type="button" onClick={handleImport} disabled={!!loading}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition mt-2">
              {loading === 'import' ? 'جاري الاستيراد...' : '✅ استيراد وإنشاء التقرير'}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className={`mt-4 rounded-2xl border p-4 text-sm ${
          result.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                         : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {result.success ? `✅ تم إنشاء التقرير. المعرف: ${result.reportId}` : `❌ ${result.error}`}
          {result.warnings.map((w, i) => <p key={i} className="text-amber-400 mt-1 text-xs">⚠️ {w}</p>)}
        </div>
      )}
    </div>
  );
}
