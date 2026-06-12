'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Pencil, Plus, Save, Trash2, Trophy, X } from 'lucide-react';

type TeamBrief = { id: string; name: string; code?: string };
type MatchItem = { id: string; matchDate: string; status: string; homeTeam?: TeamBrief; awayTeam?: TeamBrief };
type PlayerBrief = { id: string; name: string; teamId?: string | null };
type MatchEventItem = { id: string; matchId: string; minute?: number | null; type: string; teamId?: string | null; playerId?: string | null; playerName?: string | null; detail: string; sourceName?: string | null; sourceUrl?: string | null; createdAt: string };

const initialForm = { minute: '', type: 'goal', teamId: '', playerId: '', playerName: '', detail: '', sourceName: 'رصد يدوي', sourceUrl: '' };
function matchName(match: MatchItem) { return `${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}`; }
function formatDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'غير محدد'; }

export default function AdminMatchEventsClient() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [players, setPlayers] = useState<PlayerBrief[]>([]);
  const [events, setEvents] = useState<MatchEventItem[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = useMemo(() => matches.find((match) => match.id === selectedMatchId), [matches, selectedMatchId]);
  const matchTeamIds = useMemo(() => [selectedMatch?.homeTeam?.id, selectedMatch?.awayTeam?.id].filter(Boolean), [selectedMatch]);
  const matchPlayers = useMemo(() => players.filter((player) => !player.teamId || matchTeamIds.includes(player.teamId)), [players, matchTeamIds]);

  useEffect(() => {
    fetch('/api/matches').then((res) => (res.ok ? res.json() : [])).then((data) => { const list = Array.isArray(data) ? data : []; setMatches(list); if (list[0]?.id) setSelectedMatchId(list[0].id); }).catch(() => setError('فشل تحميل المباريات')).finally(() => setLoadingMatches(false));
    fetch('/api/admin/press-news-relations').then((res) => (res.ok ? res.json() : null)).then((data) => setPlayers(Array.isArray(data?.players) ? data.players : [])).catch(() => undefined);
  }, []);

  useEffect(() => { if (selectedMatchId) loadEvents(selectedMatchId); }, [selectedMatchId]);

  async function loadEvents(matchId: string) {
    try { setLoadingEvents(true); const res = await fetch(`/api/admin/match-events?matchId=${encodeURIComponent(matchId)}`, { cache: 'no-store' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'فشل تحميل الأحداث'); setEvents(Array.isArray(data.items) ? data.items : []); }
    catch (err: any) { setError(err?.message || 'فشل تحميل الأحداث'); }
    finally { setLoadingEvents(false); }
  }

  function updateField(field: string, value: any) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePlayer(playerId: string) {
    const player = players.find((item) => item.id === playerId);
    setForm((current) => ({ ...current, playerId, playerName: player?.name || current.playerName }));
  }

  function startEdit(item: MatchEventItem) {
    setEditingId(item.id); setSelectedMatchId(item.matchId);
    setForm({ minute: item.minute === null || typeof item.minute === 'undefined' ? '' : String(item.minute), type: item.type || 'note', teamId: item.teamId || '', playerId: item.playerId || '', playerName: item.playerName || '', detail: item.detail || '', sourceName: item.sourceName || 'رصد يدوي', sourceUrl: item.sourceUrl || '' });
    setMessage('وضع التعديل مفعل. عدّل البيانات ثم اضغط حفظ التعديل.');
  }
  function cancelEdit() { setEditingId(null); setForm(initialForm); setMessage(null); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null); setError(null);
    try { const res = await fetch('/api/admin/match-events', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, matchId: selectedMatchId, id: editingId }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'فشل حفظ الحدث'); setMessage(editingId ? 'تم تعديل الحدث بنجاح.' : 'تم حفظ الحدث وظهر في مركز المباراة.'); setForm(initialForm); setEditingId(null); await loadEvents(selectedMatchId); }
    catch (err: any) { setError(err?.message || 'فشل حفظ الحدث'); }
    finally { setSaving(false); }
  }

  async function deleteEvent(id: string) {
    setMessage(null); setError(null);
    try { const res = await fetch(`/api/admin/match-events?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'فشل حذف الحدث'); if (editingId === id) cancelEdit(); setMessage('تم حذف الحدث.'); await loadEvents(selectedMatchId); }
    catch (err: any) { setError(err?.message || 'فشل حذف الحدث'); }
  }

  return <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl"><section className="mx-auto max-w-6xl space-y-6">
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-card md:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Trophy size={14} /> إدارة أحداث المباراة</p><h1 className="text-3xl font-black">الأهداف والبطاقات واللقطات</h1><p className="mt-2 text-sm font-bold leading-7 text-gray-400">أضف أو عدّل أحداث المباراة واربطها بلاعب محدد لتظهر في صفحة اللاعب لاحقًا.</p></div><div className="flex flex-wrap gap-2">{selectedMatchId && <Link href={`/match-center/${selectedMatchId}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black">فتح مركز المباراة <ArrowLeft size={15} /></Link>}<Link href="/admin" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-gray-300 hover:bg-white/10">لوحة الإدارة</Link></div></div></div>
    {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div>}{error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div>}
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-6"><label><span className="mb-2 block text-xs font-black text-gray-400">اختر المباراة</span><select disabled={loadingMatches} value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50">{matches.map((match) => <option key={match.id} value={match.id}>{matchName(match)} — {formatDate(match.matchDate)}</option>)}</select></label>{selectedMatch && <div className="mt-3 rounded-2xl border border-[#0FF0FC]/15 bg-[#0FF0FC]/[0.04] p-4 text-sm font-bold text-gray-300">المباراة المختارة: {matchName(selectedMatch)} · {selectedMatch.status}</div>}</section>
    <form onSubmit={submit} className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:grid-cols-2 md:p-6">{editingId && <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-[#FFD700]/20 bg-[#FFD700]/10 p-4 text-sm font-black text-[#FFD700]"><span>تعديل حدث موجود</span><button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-xl bg-black/25 px-3 py-2 text-xs"><X size={13} /> إلغاء</button></div>}
      <label><span className="mb-2 block text-xs font-black text-gray-400">الدقيقة</span><input type="number" min={0} max={130} value={form.minute} onChange={(event) => updateField('minute', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="67" /></label>
      <label><span className="mb-2 block text-xs font-black text-gray-400">نوع الحدث</span><select value={form.type} onChange={(event) => updateField('type', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50"><option value="goal">هدف</option><option value="yellow_card">بطاقة صفراء</option><option value="red_card">بطاقة حمراء</option><option value="substitution">تبديل</option><option value="note">ملاحظة</option></select></label>
      <label><span className="mb-2 block text-xs font-black text-gray-400">المنتخب المرتبط</span><select value={form.teamId} onChange={(event) => updateField('teamId', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50"><option value="">حدث عام</option>{selectedMatch?.homeTeam && <option value={selectedMatch.homeTeam.id}>{selectedMatch.homeTeam.name}</option>}{selectedMatch?.awayTeam && <option value={selectedMatch.awayTeam.id}>{selectedMatch.awayTeam.name}</option>}</select></label>
      <label><span className="mb-2 block text-xs font-black text-gray-400">اختيار لاعب مرتبط</span><select value={form.playerId} onChange={(event) => updatePlayer(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50"><option value="">بدون ربط لاعب</option>{matchPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-black text-gray-400">اسم اللاعب احتياطي/يدوي</span><input value={form.playerName} onChange={(event) => updateField('playerName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="Raul Jimenez" /></label>
      <label className="md:col-span-2"><span className="mb-2 block text-xs font-black text-gray-400">تفاصيل الحدث</span><textarea value={form.detail} onChange={(event) => updateField('detail', event.target.value)} rows={4} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold leading-7 text-white outline-none focus:border-[#0FF0FC]/50" placeholder="سجل من عرضية داخل المنطقة / بطاقة بسبب تدخل قوي..." /></label>
      <label><span className="mb-2 block text-xs font-black text-gray-400">اسم المصدر اختياري</span><input value={form.sourceName} onChange={(event) => updateField('sourceName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="The Athletic FC / رصد يدوي" /></label>
      <label><span className="mb-2 block text-xs font-black text-gray-400">رابط المصدر اختياري</span><input value={form.sourceUrl} onChange={(event) => updateField('sourceUrl', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50" placeholder="https://..." /></label>
      <button disabled={saving || !selectedMatchId} className="md:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black transition hover:bg-[#FFD700] disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {editingId ? 'حفظ التعديل' : 'حفظ الحدث'}</button>
    </form>
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-6"><div className="mb-4 flex items-center gap-2 text-xl font-black"><Plus className="text-[#FFD700]" /> الأحداث المسجلة</div>{loadingEvents ? <div className="p-8 text-center text-gray-500">جاري التحميل...</div> : events.length ? <div className="space-y-3">{events.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/25 p-4 md:flex-row md:items-center md:justify-between"><div><div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-black text-gray-500"><span>{item.minute ? `${item.minute}'` : '--'}</span><span>{item.type}</span>{item.sourceName && <span>{item.sourceName}</span>}{item.playerId && <span>لاعب مربوط</span>}</div>{item.playerName && <h3 className="font-black text-white">{item.playerName}</h3>}<p className="text-sm font-bold leading-6 text-gray-400">{item.detail}</p></div><div className="flex gap-2"><button type="button" onClick={() => startEdit(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-2 text-xs font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black"><Pencil size={14} /> تعديل</button><button type="button" onClick={() => deleteEvent(item.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-400 hover:text-black"><Trash2 size={14} /> حذف</button></div></article>)}</div> : <div className="p-8 text-center text-gray-500">لا توجد أحداث لهذه المباراة بعد.</div>}</section>
  </section></main>;
}
