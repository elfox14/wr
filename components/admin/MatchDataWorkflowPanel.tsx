'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Code2, FileText, Loader2, Radio, RefreshCw, ShieldCheck, Video, XCircle } from 'lucide-react';

type ChecklistItem = { key: string; label: string; ok: boolean; hint: string };
type SourcePolicy = { group: string; value: string; publishable: boolean };
type SourceAction = { key: string; label: string; description: string; route?: string };
type ComparisonRow = { key: string; label: string; recommended?: string | null; status: string; values: { provider: string; sourceName: string; value: string; capturedAt?: string }[] };
type AuditLog = { id: string; action: string; actorEmail?: string | null; detail?: string | null; createdAt?: string };
type MatchItem = { id: string; homeTeam?: { name?: string | null } | null; awayTeam?: { name?: string | null } | null };
type Digest = { videoScript?: string; liveScript?: string; youtubeScript?: string; tiktokScript?: string; summary?: string; facebookPost?: string | null; infographicPoints?: string[] };
type ConsoleData = { selectedMatchId: string; match: MatchItem | null; sourcePolicy?: SourcePolicy[]; sourceActions?: SourceAction[]; articleChecklist?: ChecklistItem[]; statsComparison?: ComparisonRow[]; infographicExport?: unknown; auditLogs?: AuditLog[] };

function matchTitle(match?: MatchItem | null) {
  if (!match) return 'اختر مباراة من الأعلى';
  return `${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}`;
}
function formatDate(value?: string | null) {
  const d = value ? new Date(value) : null;
  return d && Number.isFinite(d.getTime()) ? d.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'غير محدد';
}
function jsonText(value: unknown) {
  try { return JSON.stringify(value || {}, null, 2); } catch { return '{}'; }
}
function selectedScript(digest: Digest | null, variant: 'live' | 'youtube' | 'tiktok') {
  if (!digest) return '';
  if (variant === 'live') return digest.liveScript || digest.videoScript || '';
  if (variant === 'tiktok') return digest.tiktokScript || digest.videoScript || '';
  return digest.youtubeScript || digest.videoScript || '';
}

export default function MatchDataWorkflowPanel() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [matchId, setMatchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [variant, setVariant] = useState<'live' | 'youtube' | 'tiktok'>('youtube');
  const [infographic, setInfographic] = useState<unknown>(null);

  const currentMatchId = matchId || data?.selectedMatchId || '';
  const checklistOk = useMemo(() => (data?.articleChecklist || []).every((item) => item.ok), [data]);

  useEffect(() => { void loadData(); }, []);

  async function loadData(id?: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/match-data-console${id ? `?matchId=${encodeURIComponent(id)}` : ''}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل تحميل workflow');
      setData(payload.data as ConsoleData);
      setMatchId(payload.data?.selectedMatchId || id || '');
      setInfographic(payload.data?.infographicExport || null);
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل التحميل'); }
    finally { setLoading(false); }
  }

  async function postConsole(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/match-data-console', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'فشل تنفيذ العملية');
    return payload;
  }

  async function runSourceAction(sourceAction: string) {
    if (!currentMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const payload = await postConsole({ action: 'record_source_action', matchId: currentMatchId, sourceAction });
      setData(payload.data as ConsoleData);
      setMessage('تم تسجيل إجراء المصدر وتحديث لوحة workflow.');
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل إجراء المصدر'); }
    finally { setSaving(false); }
  }

  async function generateBroadcast() {
    if (!currentMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const payload = await postConsole({ action: 'generate_broadcast', matchId: currentMatchId });
      setDigest(payload.item as Digest);
      setInfographic(payload.infographicExport || null);
      setMessage('تم توليد سكريبتات Live / YouTube / TikTok من بيانات المصادر.');
      await loadData(currentMatchId);
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل توليد السكريبتات'); }
    finally { setSaving(false); }
  }

  async function generateInfographic() {
    if (!currentMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const payload = await postConsole({ action: 'generate_infographic', matchId: currentMatchId });
      setInfographic(payload.item);
      setMessage('تم توليد JSON الإنفوجرافيك من بيانات المصادر.');
      await loadData(currentMatchId);
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل توليد الإنفوجرافيك'); }
    finally { setSaving(false); }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage('تم النسخ.');
  }

  return <section className="mx-auto mt-6 max-w-7xl space-y-6 rounded-[2rem] border border-[#0FF0FC]/20 bg-[#0FF0FC]/[0.035] p-5 text-white" dir="rtl">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><ShieldCheck size={14} /> Full Workflow Layer</p>
        <h2 className="mt-3 text-2xl font-black">تنفيذ كل المراحل فوق Match Data Console</h2>
        <p className="mt-1 text-sm font-bold text-gray-400">{matchTitle(data?.match)} — المصادر هي الأساس، والملاحظات اليدوية جانبية فقط.</p>
      </div>
      <button type="button" onClick={() => loadData(currentMatchId)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black"><RefreshCw size={15} /> تحديث workflow</button>
    </div>

    {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div> : null}
    {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div> : null}
    {loading ? <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm font-bold text-gray-400"><Loader2 className="mx-auto mb-2 animate-spin" /> تحميل workflow...</div> : null}

    <div className="grid gap-4 md:grid-cols-3">{(data?.sourcePolicy || []).map((item) => <div key={item.group} className={`rounded-2xl border p-4 ${item.publishable ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-[#FFD700]/20 bg-[#FFD700]/10'}`}><p className="text-xs font-black text-gray-400">{item.group}</p><p className="mt-2 text-sm font-black">{item.value}</p><p className="mt-1 text-xs font-bold text-gray-500">{item.publishable ? 'قابل للنشر بعد المراجعة' : 'جانبي فقط'}</p></div>)}</div>

    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Live Source Feed Controls" icon={<Radio className="text-[#0FF0FC]" />}>
        <div className="grid gap-3">{(data?.sourceActions || []).map((action) => <div key={action.key} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">{action.label}</h3><p className="mt-1 text-xs font-bold leading-6 text-gray-500">{action.description}</p>{action.route ? <p className="mt-1 text-xs font-bold text-[#FFD700]">Route: {action.route}</p> : null}</div><button type="button" disabled={saving} onClick={() => runSourceAction(action.key)} className="rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-2 text-xs font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black disabled:opacity-60">تسجيل/تحديث</button></div></div>)}</div>
      </Panel>

      <Panel title="Article Checklist" icon={<FileText className="text-emerald-300" />}>
        <p className={`mb-3 rounded-2xl p-3 text-xs font-black ${checklistOk ? 'bg-emerald-400/10 text-emerald-200' : 'bg-red-400/10 text-red-200'}`}>{checklistOk ? 'جاهز للمراجعة قبل النشر' : 'ينقصه مصدر/بيانات قبل النشر'}</p>
        <div className="space-y-3">{(data?.articleChecklist || []).map((item) => <div key={item.key} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">{item.ok ? <CheckCircle2 className="mt-0.5 text-emerald-300" size={18} /> : <XCircle className="mt-0.5 text-red-300" size={18} />}<div><h3 className="text-sm font-black">{item.label}</h3><p className="mt-1 text-xs font-bold leading-6 text-gray-500">{item.hint}</p></div></div>)}</div>
      </Panel>

      <Panel title="Stats Source Comparison" icon={<RefreshCw className="text-[#FFD700]" />}>
        <div className="space-y-3">{(data?.statsComparison || []).map((row) => <div key={row.key} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{row.label}</h3><span className="text-xs font-black text-[#0FF0FC]">المقترح: {row.recommended || 'غير متوفر'}</span></div><div className="mt-3 flex flex-wrap gap-2">{row.values.length ? row.values.map((item, index) => <span key={`${row.key}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-gray-300">{item.sourceName}: {item.value}</span>) : <span className="text-xs font-bold text-gray-500">غير متوفر في المصادر</span>}</div></div>)}</div>
      </Panel>

      <Panel title="Broadcast + Infographic Export" icon={<Video className="text-[#0FF0FC]" />}>
        <div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={saving} onClick={generateBroadcast} className="rounded-2xl bg-[#0FF0FC] px-4 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60">توليد سكريبتات البث</button><button type="button" disabled={saving} onClick={generateInfographic} className="rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black disabled:opacity-60">توليد JSON إنفوجرافيك</button></div>
        <div className="mt-4 grid grid-cols-3 gap-2">{(['live', 'youtube', 'tiktok'] as const).map((item) => <button key={item} type="button" onClick={() => setVariant(item)} className={`rounded-xl border px-3 py-2 text-xs font-black ${variant === item ? 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 text-gray-400'}`}>{item.toUpperCase()}</button>)}</div>
        <textarea readOnly value={selectedScript(digest, variant)} rows={8} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs font-bold leading-6 text-white outline-none" />
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => copy(selectedScript(digest, variant))} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-gray-300">نسخ السكريبت</button><button type="button" onClick={() => copy(jsonText(infographic))} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-gray-300"><Code2 size={13} className="inline" /> نسخ JSON</button></div>
        <textarea readOnly value={jsonText(infographic)} rows={8} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-xs leading-5 text-white outline-none" />
      </Panel>
    </div>

    <Panel title="Audit Log" icon={<ShieldCheck className="text-[#FFD700]" />}>
      <div className="grid gap-2 md:grid-cols-2">{(data?.auditLogs || []).slice(0, 10).map((log) => <div key={log.id} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-black text-[#0FF0FC]">{log.action}</p><p className="mt-1 text-xs font-bold text-gray-500">{log.detail || '—'} · {formatDate(log.createdAt)}</p></div>)}</div>
    </Panel>
  </section>;
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="mb-4 flex items-center gap-2 text-xl font-black">{icon}{title}</h2>{children}</div>;
}
