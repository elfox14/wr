'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, BarChart3, ClipboardList, FileText, Loader2, Radio, RefreshCw, Save, Trash2, Video } from 'lucide-react';

type TabId = 'live' | 'stats' | 'article' | 'broadcast';
type TeamBrief = { id: string; name: string; code?: string | null };
type MatchItem = { id: string; matchDate: string; status: string; homeScore?: number | null; awayScore?: number | null; homeTeam?: TeamBrief | null; awayTeam?: TeamBrief | null };
type MatchEventItem = { id: string; matchId: string; minute?: number | null; type: string; teamId?: string | null; playerName?: string | null; detail: string; sourceName?: string | null; sourceUrl?: string | null };
type SnapshotItem = { id: string; provider: string; minute?: number | null; homeScore?: number | null; awayScore?: number | null; homePossession?: number | null; awayPossession?: number | null; homeShots?: number | null; awayShots?: number | null; homeShotsOnTarget?: number | null; awayShotsOnTarget?: number | null; homeDangerousAttacks?: number | null; awayDangerousAttacks?: number | null; homeCorners?: number | null; awayCorners?: number | null; homeYellowCards?: number | null; awayYellowCards?: number | null; homeRedCards?: number | null; awayRedCards?: number | null; xgHome?: number | null; xgAway?: number | null; sourceName?: string | null; sourceUrl?: string | null; capturedAt?: string };
type MatchDigestDraft = { matchId: string; matchTitle: string; scoreLine: string; statusLabel: string; summary: string; turningPoint?: string | null; videoScript: string; facebookPost?: string | null; infographicPoints: string[]; status: string };
type ConsoleData = { matches: MatchItem[]; selectedMatchId: string; match: MatchItem | null; events: MatchEventItem[]; latestSnapshot: SnapshotItem | null; snapshotHistory: SnapshotItem[]; existingDigest?: MatchDigestDraft | null };
type ArticlePreview = { id: string; title: string; body: string; category?: string; sourceUrl?: string; relatedMatchId?: string };

const inputClass = 'w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50';
const tabs: { id: TabId; title: string; hint: string; icon: React.ElementType }[] = [
  { id: 'live', title: 'Live Events', hint: 'إدخال واستقبال الأحداث', icon: Radio },
  { id: 'stats', title: 'Stats Review', hint: 'FBref / FotMob / SofaScore / FIFA', icon: BarChart3 },
  { id: 'article', title: 'Article Builder', hint: 'مقال من الأحداث والأرقام', icon: FileText },
  { id: 'broadcast', title: 'Broadcast Script', hint: 'سكريبت بث ويوتيوب وتيك توك', icon: Video },
];
const emptyEventForm = { minute: '', type: 'goal', teamId: '', playerName: '', detail: '', sourceName: 'رصد يدوي', sourceUrl: '' };
const emptyStatsForm = { provider: 'FBREF', sourceName: 'FBref', sourceUrl: '', providerMatchId: '', reviewNote: '', minute: '', homeScore: '', awayScore: '', homePossession: '', awayPossession: '', homeShots: '', awayShots: '', homeShotsOnTarget: '', awayShotsOnTarget: '', homeDangerousAttacks: '', awayDangerousAttacks: '', homeCorners: '', awayCorners: '', homeYellowCards: '', awayYellowCards: '', homeRedCards: '', awayRedCards: '', xgHome: '', xgAway: '' };

function formatDate(value?: string | null) { const d = value ? new Date(value) : null; return d && Number.isFinite(d.getTime()) ? d.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'غير محدد'; }
function val(value?: string | number | null) { if (value === null || value === undefined || value === '') return '—'; return typeof value === 'number' ? value.toLocaleString('ar-EG') : String(value); }
function matchName(match?: MatchItem | null) { return match ? `${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}` : 'اختر مباراة'; }
function scoreLine(match?: MatchItem | null, snapshot?: SnapshotItem | null) { return `${val(snapshot?.homeScore ?? match?.homeScore ?? 0)} - ${val(snapshot?.awayScore ?? match?.awayScore ?? 0)}`; }
function normalizeDigest(item?: MatchDigestDraft | null): MatchDigestDraft | null { return item ? { ...item, infographicPoints: Array.isArray(item.infographicPoints) ? item.infographicPoints.map(String) : [] } : null; }
function eventTypeLabel(type: string) { const value = type.toLowerCase(); if (value.includes('goal')) return 'هدف'; if (value.includes('yellow')) return 'بطاقة صفراء'; if (value.includes('red')) return 'بطاقة حمراء'; if (value.includes('sub')) return 'تبديل'; if (value.includes('var')) return 'VAR'; if (value.includes('penalty')) return 'ركلة جزاء'; if (value.includes('corner')) return 'ركنية'; if (value.includes('shot')) return 'تسديدة'; if (value.includes('danger')) return 'هجمة خطيرة'; return 'ملاحظة'; }

export default function MatchDataConsole() {
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [statsForm, setStatsForm] = useState(emptyStatsForm);
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const [broadcast, setBroadcast] = useState<MatchDigestDraft | null>(null);

  const selectedMatch = data?.match || null;
  const latestSnapshot = data?.latestSnapshot || null;
  const counts = useMemo(() => {
    const events = data?.events || [];
    return { total: events.length, goals: events.filter((item) => item.type.includes('goal')).length, cards: events.filter((item) => item.type.includes('card')).length, snapshots: data?.snapshotHistory?.length || 0 };
  }, [data]);

  useEffect(() => { void loadConsole(selectedMatchId || undefined); }, [selectedMatchId]);

  async function loadConsole(matchId?: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/match-data-console${matchId ? `?matchId=${encodeURIComponent(matchId)}` : ''}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل تحميل بيانات الأداة');
      const loaded = payload.data as ConsoleData;
      setData(loaded); setBroadcast(normalizeDigest(loaded.existingDigest));
      if (!selectedMatchId && loaded.selectedMatchId) setSelectedMatchId(loaded.selectedMatchId);
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل تحميل البيانات'); }
    finally { setLoading(false); }
  }

  function updateEventField(field: keyof typeof emptyEventForm, value: string) { setEventForm((current) => ({ ...current, [field]: value })); }
  function updateStatsField(field: keyof typeof emptyStatsForm, value: string) { setStatsForm((current) => ({ ...current, [field]: value })); }

  async function addEvent(event: FormEvent) {
    event.preventDefault(); if (!selectedMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const res = await fetch('/api/admin/match-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...eventForm, matchId: selectedMatchId }) });
      const payload = await res.json(); if (!res.ok) throw new Error(payload.error || 'فشل حفظ الحدث');
      setEventForm(emptyEventForm); setMessage('تم حفظ الحدث داخل قاعدة بيانات المباراة.'); await loadConsole(selectedMatchId);
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل حفظ الحدث'); }
    finally { setSaving(false); }
  }

  async function deleteEvent(id: string) {
    if (!confirm('حذف هذا الحدث من المباراة؟')) return;
    setSaving(true); setMessage(null); setError(null);
    try { const res = await fetch(`/api/admin/match-events?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); const payload = await res.json(); if (!res.ok) throw new Error(payload.error || 'فشل حذف الحدث'); setMessage('تم حذف الحدث.'); await loadConsole(selectedMatchId); }
    catch (err) { setError(err instanceof Error ? err.message : 'فشل حذف الحدث'); }
    finally { setSaving(false); }
  }

  async function saveStatsSnapshot(event: FormEvent) {
    event.preventDefault(); if (!selectedMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const res = await fetch('/api/admin/match-data-console', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...statsForm, action: 'save_stats_snapshot', matchId: selectedMatchId }) });
      const payload = await res.json(); if (!res.ok) throw new Error(payload.error || 'فشل حفظ الإحصائيات');
      setData(payload.data as ConsoleData); setStatsForm((current) => ({ ...emptyStatsForm, provider: current.provider, sourceName: current.sourceName })); setMessage('تم حفظ Snapshot جديدة للمراجعة والتحليل.');
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل حفظ الإحصائيات'); }
    finally { setSaving(false); }
  }

  async function buildArticle(save = false) {
    if (!selectedMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const res = await fetch('/api/admin/match-article', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId: selectedMatchId, mode: save ? 'upsert' : 'preview', status: save ? 'published' : 'draft' }) });
      const payload = await res.json(); if (!res.ok) throw new Error(payload.error || 'فشل توليد المقال');
      if (save) setMessage(`تم نشر المقال: ${payload.url || '/news'}`); else { setArticle(payload.item as ArticlePreview); setMessage('تم توليد معاينة المقال من بيانات المباراة.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل توليد المقال'); }
    finally { setSaving(false); }
  }

  async function generateBroadcast() {
    if (!selectedMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const res = await fetch('/api/admin/match-data-console', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate_broadcast', matchId: selectedMatchId }) });
      const payload = await res.json(); if (!res.ok) throw new Error(payload.error || 'فشل توليد السكريبت');
      setBroadcast(normalizeDigest(payload.item as MatchDigestDraft)); setMessage('تم توليد سكريبت البث من الأحداث والإحصائيات الحالية.');
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل توليد السكريبت'); }
    finally { setSaving(false); }
  }

  function updateBroadcastField(field: keyof MatchDigestDraft, value: string) { setBroadcast((current) => current ? { ...current, [field]: value } : current); }
  function updateInfographic(value: string) { setBroadcast((current) => current ? { ...current, infographicPoints: value.split('\n').map((item) => item.trim()).filter(Boolean) } : current); }
  async function copyText(text?: string | null) { if (!text) return; try { await navigator.clipboard.writeText(text); setMessage('تم نسخ النص.'); } catch { setError('تعذر النسخ من المتصفح.'); } }

  async function saveBroadcast() {
    if (!broadcast || !selectedMatchId) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const res = await fetch('/api/admin/match-digests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...broadcast, matchId: selectedMatchId, status: 'published' }) });
      const payload = await res.json(); if (!res.ok) throw new Error(payload.error || 'فشل حفظ السكريبت');
      setBroadcast(normalizeDigest(payload.item as MatchDigestDraft)); setMessage('تم حفظ سكريبت المباراة في أرشيف ملخصات المباريات.'); await loadConsole(selectedMatchId);
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل حفظ السكريبت'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl"><section className="mx-auto max-w-7xl space-y-6">
    <Header selectedMatchId={selectedMatchId} />
    {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div> : null}
    {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div> : null}

    <section className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><Field label="اختر المباراة"><select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)} className={inputClass}>{(data?.matches || []).map((match) => <option key={match.id} value={match.id}>{matchName(match)} — {formatDate(match.matchDate)}</option>)}</select></Field><button type="button" onClick={() => loadConsole(selectedMatchId)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black"><RefreshCw size={15} /> تحديث البيانات</button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="المباراة" value={matchName(selectedMatch)} hint={formatDate(selectedMatch?.matchDate)} /><Metric title="النتيجة" value={scoreLine(selectedMatch, latestSnapshot)} hint={selectedMatch?.status || 'غير محدد'} /><Metric title="الأحداث" value={counts.total} hint={`${counts.goals} أهداف · ${counts.cards} بطاقات`} /><Metric title="Snapshots" value={counts.snapshots} hint={latestSnapshot?.provider || 'غير متوفر'} /></div>
    </section>

    <section className="grid gap-3 md:grid-cols-4">{tabs.map((tab) => { const Icon = tab.icon; const active = activeTab === tab.id; return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-[1.5rem] border p-4 text-right transition ${active ? 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.06]'}`}><Icon size={18} /><h2 className="mt-2 font-black">{tab.title}</h2><p className="mt-1 text-xs font-bold text-gray-500">{tab.hint}</p></button>; })}</section>
    {loading && !data ? <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center text-sm font-bold text-gray-400"><Loader2 className="mx-auto mb-3 animate-spin" /> جاري تحميل الأداة...</div> : null}

    {activeTab === 'live' ? <LiveTab data={data} selectedMatch={selectedMatch} eventForm={eventForm} saving={saving} updateEventField={updateEventField} addEvent={addEvent} deleteEvent={deleteEvent} /> : null}
    {activeTab === 'stats' ? <StatsTab data={data} statsForm={statsForm} saving={saving} updateStatsField={updateStatsField} saveStatsSnapshot={saveStatsSnapshot} /> : null}
    {activeTab === 'article' ? <ArticleTab article={article} saving={saving} buildArticle={buildArticle} copyText={copyText} /> : null}
    {activeTab === 'broadcast' ? <BroadcastTab broadcast={broadcast} saving={saving} generateBroadcast={generateBroadcast} saveBroadcast={saveBroadcast} copyText={copyText} updateBroadcastField={updateBroadcastField} updateInfographic={updateInfographic} /> : null}
  </section></main>;
}

function Header({ selectedMatchId }: { selectedMatchId: string }) { return <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-card md:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Activity size={14} /> Match Data Console</p><h1 className="text-3xl font-black">أداة بيانات المباراة الداخلية</h1><p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-400">إدخال أحداث اللايف، مراجعة الإحصائيات، توليد المقال، وتجهيز سكريبت البث من نفس قاعدة البيانات.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/match-events" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-gray-300 hover:bg-white/10">الأحداث القديمة <ArrowLeft size={14} /></Link>{selectedMatchId ? <Link href={`/match-center/${selectedMatchId}`} className="inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black">فتح صفحة المباراة <ArrowLeft size={14} /></Link> : null}</div></div></div>; }
function Metric({ title, value, hint }: { title: string; value: string | number; hint?: string | null }) { return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-black text-gray-500">{title}</p><p className="mt-2 line-clamp-2 text-lg font-black text-white">{value}</p><p className="mt-1 text-xs font-bold text-gray-500">{hint || '—'}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-2 block text-xs font-black text-gray-400">{label}</span>{children}</label>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-500">{text}</div>; }

function LiveTab({ data, selectedMatch, eventForm, saving, updateEventField, addEvent, deleteEvent }: { data: ConsoleData | null; selectedMatch: MatchItem | null; eventForm: typeof emptyEventForm; saving: boolean; updateEventField: (field: keyof typeof emptyEventForm, value: string) => void; addEvent: (event: FormEvent) => void; deleteEvent: (id: string) => void }) {
  return <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]"><form onSubmit={addEvent} className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="flex items-center gap-2 text-xl font-black"><Radio className="text-[#0FF0FC]" /> Live Events</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="الدقيقة"><input type="number" min="0" max="130" value={eventForm.minute} onChange={(event) => updateEventField('minute', event.target.value)} className={inputClass} placeholder="67" /></Field><Field label="نوع الحدث"><select value={eventForm.type} onChange={(event) => updateEventField('type', event.target.value)} className={inputClass}><option value="goal">هدف</option><option value="yellow_card">بطاقة صفراء</option><option value="red_card">بطاقة حمراء</option><option value="substitution">تبديل</option><option value="var">VAR</option><option value="penalty">ركلة جزاء</option><option value="shot_on_target">تسديدة على المرمى</option><option value="dangerous_attack">هجمة خطيرة</option><option value="note">ملاحظة</option></select></Field><Field label="المنتخب"><select value={eventForm.teamId} onChange={(event) => updateEventField('teamId', event.target.value)} className={inputClass}><option value="">حدث عام</option>{selectedMatch?.homeTeam ? <option value={selectedMatch.homeTeam.id}>{selectedMatch.homeTeam.name}</option> : null}{selectedMatch?.awayTeam ? <option value={selectedMatch.awayTeam.id}>{selectedMatch.awayTeam.name}</option> : null}</select></Field><Field label="اللاعب"><input value={eventForm.playerName} onChange={(event) => updateEventField('playerName', event.target.value)} className={inputClass} placeholder="اسم اللاعب إن وجد" /></Field></div><Field label="تفاصيل الحدث"><textarea value={eventForm.detail} onChange={(event) => updateEventField('detail', event.target.value)} rows={4} className={`${inputClass} leading-7`} placeholder="مثال: هدف بعد هجمة مرتدة سريعة / فرصة خطيرة من عرضية..." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="اسم المصدر"><input value={eventForm.sourceName} onChange={(event) => updateEventField('sourceName', event.target.value)} className={inputClass} /></Field><Field label="رابط المصدر"><input value={eventForm.sourceUrl} onChange={(event) => updateEventField('sourceUrl', event.target.value)} className={inputClass} placeholder="https://..." /></Field></div><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60"><Save size={16} /> حفظ الحدث</button></form><div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="mb-4 text-xl font-black">Timeline محفوظ</h2><div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">{(data?.events || []).map((item) => <EventCard key={item.id} item={item} match={selectedMatch} onDelete={() => deleteEvent(item.id)} />)}{data?.events?.length ? null : <EmptyState text="لا توجد أحداث محفوظة لهذه المباراة بعد." />}</div></div></section>;
}
function EventCard({ item, match, onDelete }: { item: MatchEventItem; match?: MatchItem | null; onDelete: () => void }) { const team = item.teamId === match?.homeTeam?.id ? match.homeTeam?.name : item.teamId === match?.awayTeam?.id ? match.awayTeam?.name : 'حدث عام'; return <article className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-2 flex items-center justify-between gap-3"><span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">د{val(item.minute)} · {eventTypeLabel(item.type)}</span><button type="button" onClick={onDelete} className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"><Trash2 size={14} /></button></div><h3 className="text-sm font-black text-white">{team}{item.playerName ? ` · ${item.playerName}` : ''}</h3><p className="mt-2 text-sm font-bold leading-7 text-gray-400">{item.detail}</p>{item.sourceName || item.sourceUrl ? <p className="mt-2 text-xs font-bold text-gray-500">المصدر: {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[#FFD700]">{item.sourceName || item.sourceUrl}</a> : item.sourceName}</p> : null}</article>; }

function StatsTab({ data, statsForm, saving, updateStatsField, saveStatsSnapshot }: { data: ConsoleData | null; statsForm: typeof emptyStatsForm; saving: boolean; updateStatsField: (field: keyof typeof emptyStatsForm, value: string) => void; saveStatsSnapshot: (event: FormEvent) => void }) {
  const statFields = ['homeScore', 'awayScore', 'homePossession', 'awayPossession', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeDangerousAttacks', 'awayDangerousAttacks', 'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards', 'xgHome', 'xgAway'] as const;
  return <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]"><form onSubmit={saveStatsSnapshot} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-[#FFD700]" /> Stats Review</h2><p className="mt-2 text-sm font-bold leading-7 text-gray-500">أدخل الأرقام المؤكدة فقط واترك غير المتوفر فارغًا.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="المصدر"><select value={statsForm.provider} onChange={(event) => updateStatsField('provider', event.target.value)} className={inputClass}><option value="FBREF">FBref</option><option value="FOTMOB">FotMob</option><option value="SOFASCORE">SofaScore</option><option value="FIFA">FIFA</option><option value="THE_STATS_API">TheStatsAPI</option><option value="MANUAL_REVIEW">Manual Review</option></select></Field><Field label="اسم المصدر"><input value={statsForm.sourceName} onChange={(event) => updateStatsField('sourceName', event.target.value)} className={inputClass} /></Field><Field label="رابط المصدر"><input value={statsForm.sourceUrl} onChange={(event) => updateStatsField('sourceUrl', event.target.value)} className={inputClass} /></Field><Field label="Provider Match ID"><input value={statsForm.providerMatchId} onChange={(event) => updateStatsField('providerMatchId', event.target.value)} className={inputClass} /></Field><Field label="الدقيقة"><input value={statsForm.minute} onChange={(event) => updateStatsField('minute', event.target.value)} className={inputClass} /></Field><Field label="ملاحظة"><input value={statsForm.reviewNote} onChange={(event) => updateStatsField('reviewNote', event.target.value)} className={inputClass} /></Field></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{statFields.map((field) => <Field key={field} label={statLabel(field)}><input value={statsForm[field]} onChange={(event) => updateStatsField(field, event.target.value)} className={inputClass} /></Field>)}</div><button disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black hover:bg-[#0FF0FC] disabled:opacity-60"><Save size={16} /> حفظ Snapshot</button></form><div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="mb-4 text-xl font-black">آخر الإحصائيات المحفوظة</h2><div className="space-y-3">{(data?.snapshotHistory || []).slice(0, 8).map((item) => <SnapshotCard key={item.id} item={item} />)}{data?.snapshotHistory?.length ? null : <EmptyState text="لا توجد Snapshots محفوظة لهذه المباراة." />}</div></div></section>;
}
function SnapshotCard({ item }: { item: SnapshotItem }) { return <article className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]">{item.provider}</span><span className="text-xs font-bold text-gray-500">{formatDate(item.capturedAt)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold text-gray-300"><span>النتيجة: {val(item.homeScore)} - {val(item.awayScore)}</span><span>الدقيقة: {val(item.minute)}</span><span>الاستحواذ: {val(item.homePossession)} - {val(item.awayPossession)}</span><span>التسديدات: {val(item.homeShots)} - {val(item.awayShots)}</span><span>على المرمى: {val(item.homeShotsOnTarget)} - {val(item.awayShotsOnTarget)}</span><span>xG: {val(item.xgHome)} - {val(item.xgAway)}</span></div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-[#0FF0FC]">فتح المصدر</a> : null}</article>; }

function ArticleTab({ article, saving, buildArticle, copyText }: { article: ArticlePreview | null; saving: boolean; buildArticle: (save?: boolean) => void; copyText: (text?: string | null) => void }) { return <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><Panel title="Article Builder" icon={<FileText className="text-emerald-300" />}><p className="text-sm font-bold leading-7 text-gray-500">يستخدم الأحداث وآخر Snapshot لتوليد مقال قابل للنشر.</p><div className="mt-5 grid gap-3"><button type="button" onClick={() => buildArticle(false)} disabled={saving} className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-5 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-300 hover:text-black disabled:opacity-60">توليد معاينة المقال</button><button type="button" onClick={() => buildArticle(true)} disabled={saving} className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60">نشر المقال من البيانات الحالية</button></div></Panel><Panel title="معاينة المقال">{article ? <div className="space-y-4"><input readOnly value={article.title} className={inputClass} /><textarea readOnly value={article.body} rows={16} className={`${inputClass} leading-7`} /><button type="button" onClick={() => copyText(`${article.title}\n\n${article.body}`)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-gray-300">نسخ المقال</button></div> : <EmptyState text="اضغط توليد معاينة المقال لعرض النص هنا." />}</Panel></section>; }

function BroadcastTab({ broadcast, saving, generateBroadcast, saveBroadcast, copyText, updateBroadcastField, updateInfographic }: { broadcast: MatchDigestDraft | null; saving: boolean; generateBroadcast: () => void; saveBroadcast: () => void; copyText: (text?: string | null) => void; updateBroadcastField: (field: keyof MatchDigestDraft, value: string) => void; updateInfographic: (value: string) => void }) { return <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><Panel title="Broadcast Script" icon={<Video className="text-[#0FF0FC]" />}><p className="text-sm font-bold leading-7 text-gray-500">يولد سكريبت TTS مع فواصل، ويمكن حفظه لأرشيف ملخصات المباريات.</p><div className="mt-5 grid gap-3"><button type="button" onClick={generateBroadcast} disabled={saving} className="rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black disabled:opacity-60">توليد السكريبت</button><button type="button" onClick={saveBroadcast} disabled={saving || !broadcast} className="rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60">حفظ في أرشيف الملخصات</button>{broadcast?.videoScript ? <button type="button" onClick={() => copyText(broadcast.videoScript)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-gray-300 hover:bg-white/10">نسخ السكريبت</button> : null}</div></Panel><Panel title="محرر السكريبت">{broadcast ? <div className="grid gap-4"><Field label="عنوان المباراة"><input value={broadcast.matchTitle} onChange={(event) => updateBroadcastField('matchTitle', event.target.value)} className={inputClass} /></Field><Field label="الملخص"><textarea value={broadcast.summary} onChange={(event) => updateBroadcastField('summary', event.target.value)} rows={4} className={`${inputClass} leading-7`} /></Field><Field label="سكريبت TTS"><textarea value={broadcast.videoScript} onChange={(event) => updateBroadcastField('videoScript', event.target.value)} rows={14} className={`${inputClass} leading-7`} /></Field><Field label="منشور فيسبوك"><textarea value={broadcast.facebookPost || ''} onChange={(event) => updateBroadcastField('facebookPost', event.target.value)} rows={5} className={`${inputClass} leading-7`} /></Field><Field label="نقاط الإنفوجرافيك"><textarea value={(broadcast.infographicPoints || []).join('\n')} onChange={(event) => updateInfographic(event.target.value)} rows={5} className={`${inputClass} leading-7`} /></Field></div> : <EmptyState text="اضغط توليد السكريبت أو افتح مباراة لها ملخص محفوظ." />}</Panel></section>; }

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) { return <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5"><h2 className="mb-4 flex items-center gap-2 text-xl font-black">{icon}{title}</h2>{children}</div>; }
function statLabel(field: keyof typeof emptyStatsForm) { const labels: Record<string, string> = { homeScore: 'أهداف الأول', awayScore: 'أهداف الثاني', homePossession: 'استحواذ الأول %', awayPossession: 'استحواذ الثاني %', homeShots: 'تسديدات الأول', awayShots: 'تسديدات الثاني', homeShotsOnTarget: 'على المرمى - الأول', awayShotsOnTarget: 'على المرمى - الثاني', homeDangerousAttacks: 'هجمات خطيرة - الأول', awayDangerousAttacks: 'هجمات خطيرة - الثاني', homeCorners: 'ركنيات الأول', awayCorners: 'ركنيات الثاني', homeYellowCards: 'صفراء الأول', awayYellowCards: 'صفراء الثاني', homeRedCards: 'حمراء الأول', awayRedCards: 'حمراء الثاني', xgHome: 'xG الأول', xgAway: 'xG الثاني' }; return labels[field] || field; }
