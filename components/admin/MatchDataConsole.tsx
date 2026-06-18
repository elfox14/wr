'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, BarChart3, ClipboardList, FileText, Loader2, Radio, RefreshCw, Save, Trash2, Video } from 'lucide-react';

type TabId = 'live' | 'stats' | 'article' | 'broadcast';

type TeamBrief = { id: string; name: string; code?: string | null };
type MatchItem = {
  id: string;
  matchDate: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  animationMatchId?: number | null;
  homeTeam?: TeamBrief | null;
  awayTeam?: TeamBrief | null;
};

type MatchEventItem = {
  id: string;
  matchId: string;
  minute?: number | null;
  type: string;
  teamId?: string | null;
  playerName?: string | null;
  detail: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  createdAt?: string;
};

type SnapshotItem = {
  id: string;
  provider: string;
  providerMatchId?: number | null;
  minute?: number | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homePossession?: number | null;
  awayPossession?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeShotsOnTarget?: number | null;
  awayShotsOnTarget?: number | null;
  homeDangerousAttacks?: number | null;
  awayDangerousAttacks?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeYellowCards?: number | null;
  awayYellowCards?: number | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  xgHome?: number | null;
  xgAway?: number | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  capturedAt?: string;
};

type MatchDigestDraft = {
  matchId: string;
  matchTitle: string;
  scoreLine: string;
  statusLabel: string;
  summary: string;
  turningPoint?: string | null;
  videoScript: string;
  facebookPost?: string | null;
  infographicPoints: string[];
  status: string;
};

type ConsoleData = {
  matches: MatchItem[];
  selectedMatchId: string;
  match: MatchItem | null;
  events: MatchEventItem[];
  latestSnapshot: SnapshotItem | null;
  snapshotHistory: SnapshotItem[];
  existingDigest?: MatchDigestDraft | null;
};

type ArticlePreview = {
  id: string;
  title: string;
  body: string;
  category?: string;
  sourceUrl?: string;
  relatedMatchId?: string;
};

const tabs: { id: TabId; title: string; subtitle: string; icon: typeof Radio }[] = [
  { id: 'live', title: 'Live Events', subtitle: 'إدخال واستقبال الأحداث', icon: Radio },
  { id: 'stats', title: 'Stats Review', subtitle: 'مراجعة أرقام FBref/FotMob/SofaScore/FIFA', icon: BarChart3 },
  { id: 'article', title: 'Article Builder', subtitle: 'توليد مقال من البيانات', icon: FileText },
  { id: 'broadcast', title: 'Broadcast Script', subtitle: 'سكريبت بث ويوتيوب وتيك توك', icon: Video },
];

const emptyEventForm = {
  minute: '',
  type: 'goal',
  teamId: '',
  playerName: '',
  detail: '',
  sourceName: 'رصد يدوي',
  sourceUrl: '',
};

const emptyStatsForm = {
  provider: 'FBREF',
  sourceName: 'FBref',
  sourceUrl: '',
  providerMatchId: '',
  reviewNote: '',
  minute: '',
  homeScore: '',
  awayScore: '',
  homePossession: '',
  awayPossession: '',
  homeShots: '',
  awayShots: '',
  homeShotsOnTarget: '',
  awayShotsOnTarget: '',
  homeDangerousAttacks: '',
  awayDangerousAttacks: '',
  homeCorners: '',
  awayCorners: '',
  homeYellowCards: '',
  awayYellowCards: '',
  homeRedCards: '',
  awayRedCards: '',
  xgHome: '',
  xgAway: '',
};

function formatDate(value?: string | null) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function label(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('ar-EG');
  return String(value);
}

function matchName(match?: MatchItem | null) {
  if (!match) return 'اختر مباراة';
  return `${match.homeTeam?.name || 'الفريق الأول'} ضد ${match.awayTeam?.name || 'الفريق الثاني'}`;
}

function scoreLine(match?: MatchItem | null, snapshot?: SnapshotItem | null) {
  const home = snapshot?.homeScore ?? match?.homeScore ?? 0;
  const away = snapshot?.awayScore ?? match?.awayScore ?? 0;
  return `${label(home)} - ${label(away)}`;
}

function eventTypeLabel(type: string) {
  const value = String(type || '').toLowerCase();
  if (value.includes('goal')) return 'هدف';
  if (value.includes('yellow')) return 'بطاقة صفراء';
  if (value.includes('red')) return 'بطاقة حمراء';
  if (value.includes('sub')) return 'تبديل';
  if (value.includes('var')) return 'VAR';
  if (value.includes('penalty')) return 'ركلة جزاء';
  if (value.includes('corner')) return 'ركنية';
  if (value.includes('shot')) return 'تسديدة';
  if (value.includes('danger')) return 'هجمة خطيرة';
  return 'ملاحظة';
}

function normalizeDigest(item?: MatchDigestDraft | null): MatchDigestDraft | null {
  if (!item) return null;
  const points = Array.isArray(item.infographicPoints) ? item.infographicPoints.map(String) : [];
  return { ...item, infographicPoints: points };
}

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
  const homeTeam = selectedMatch?.homeTeam || null;
  const awayTeam = selectedMatch?.awayTeam || null;

  const eventCounts = useMemo(() => {
    const events = data?.events || [];
    return {
      total: events.length,
      goals: events.filter((event) => String(event.type).includes('goal')).length,
      cards: events.filter((event) => String(event.type).includes('card')).length,
      sources: new Set(events.map((event) => event.sourceName).filter(Boolean)).size,
    };
  }, [data?.events]);

  useEffect(() => {
    void loadConsole(selectedMatchId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatchId]);

  async function loadConsole(matchId?: string) {
    setLoading(true);
    setError(null);
    try {
      const suffix = matchId ? `?matchId=${encodeURIComponent(matchId)}` : '';
      const res = await fetch(`/api/admin/match-data-console${suffix}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل تحميل بيانات الأداة');
      const loaded = payload.data as ConsoleData;
      setData(loaded);
      setBroadcast(normalizeDigest(loaded.existingDigest));
      if (!selectedMatchId && loaded.selectedMatchId) setSelectedMatchId(loaded.selectedMatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  function updateEventField(field: keyof typeof emptyEventForm, value: string) {
    setEventForm((current) => ({ ...current, [field]: value }));
  }

  function updateStatsField(field: keyof typeof emptyStatsForm, value: string) {
    setStatsForm((current) => ({ ...current, [field]: value }));
  }

  async function addEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMatchId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/match-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventForm, matchId: selectedMatchId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل حفظ الحدث');
      setEventForm(emptyEventForm);
      setMessage('تم حفظ الحدث داخل قاعدة بيانات المباراة.');
      await loadConsole(selectedMatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الحدث');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('حذف هذا الحدث من المباراة؟')) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/match-events?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل حذف الحدث');
      setMessage('تم حذف الحدث.');
      await loadConsole(selectedMatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حذف الحدث');
    } finally {
      setSaving(false);
    }
  }

  async function saveStatsSnapshot(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMatchId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/match-data-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...statsForm, action: 'save_stats_snapshot', matchId: selectedMatchId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل حفظ الإحصائيات');
      setData(payload.data as ConsoleData);
      setStatsForm((current) => ({ ...emptyStatsForm, provider: current.provider, sourceName: current.sourceName }));
      setMessage('تم حفظ Snapshot جديدة للمراجعة والتحليل.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الإحصائيات');
    } finally {
      setSaving(false);
    }
  }

  async function previewArticle(save = false) {
    if (!selectedMatchId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/match-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatchId, mode: save ? 'upsert' : 'preview', status: save ? 'published' : 'draft' }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل توليد المقال');
      if (save) {
        setMessage(`تم نشر المقال: ${payload.url || '/news'}`);
      } else {
        setArticle(payload.item as ArticlePreview);
        setMessage('تم توليد معاينة المقال من بيانات المباراة.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل توليد المقال');
    } finally {
      setSaving(false);
    }
  }

  async function generateBroadcast() {
    if (!selectedMatchId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/match-data-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_broadcast', matchId: selectedMatchId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل توليد السكريبت');
      setBroadcast(normalizeDigest(payload.item as MatchDigestDraft));
      setMessage('تم توليد سكريبت البث من الأحداث والإحصائيات الحالية.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل توليد السكريبت');
    } finally {
      setSaving(false);
    }
  }

  function updateBroadcastField(field: keyof MatchDigestDraft, value: string) {
    setBroadcast((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateInfographic(value: string) {
    setBroadcast((current) => (current ? { ...current, infographicPoints: value.split('\n').map((item) => item.trim()).filter(Boolean) } : current));
  }

  async function saveBroadcast() {
    if (!broadcast || !selectedMatchId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/match-digests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...broadcast, matchId: selectedMatchId, status: 'published' }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'فشل حفظ السكريبت');
      setBroadcast(normalizeDigest(payload.item as MatchDigestDraft));
      setMessage('تم حفظ سكريبت المباراة في أرشيف ملخصات المباريات.');
      await loadConsole(selectedMatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ السكريبت');
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text?: string | null) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage('تم نسخ النص.');
    } catch {
      setError('تعذر النسخ من المتصفح.');
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-white sm:px-6 lg:px-8" dir="rtl">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]"><Activity size={14} /> Match Data Console</p>
              <h1 className="text-3xl font-black">أداة بيانات المباراة الداخلية</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-gray-400">أربع مراحل في مكان واحد: إدخال أحداث اللايف، مراجعة الإحصائيات بعد المباراة، توليد المقال، وتجهيز سكريبت البث أو الفيديو.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/match-events" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-gray-300 hover:bg-white/10">الأحداث القديمة <ArrowLeft size={14} /></Link>
              {selectedMatchId ? <Link href={`/match-center/${selectedMatchId}`} className="inline-flex items-center gap-2 rounded-2xl border border-[#FFD700]/25 bg-[#FFD700]/10 px-4 py-3 text-sm font-black text-[#FFD700] hover:bg-[#FFD700] hover:text-black">فتح صفحة المباراة <ArrowLeft size={14} /></Link> : null}
            </div>
          </div>
        </div>

        {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">{error}</div> : null}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
            <label>
              <span className="mb-2 block text-xs font-black text-gray-400">اختر المباراة</span>
              <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#0FF0FC]/50">
                {(data?.matches || []).map((match) => <option key={match.id} value={match.id}>{matchName(match)} — {formatDate(match.matchDate)}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => loadConsole(selectedMatchId)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-4 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black"><RefreshCw size={15} /> تحديث البيانات</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="المباراة" value={matchName(selectedMatch)} hint={formatDate(selectedMatch?.matchDate)} />
            <Metric title="النتيجة" value={scoreLine(selectedMatch, latestSnapshot)} hint={selectedMatch?.status || 'غير محدد'} />
            <Metric title="الأحداث" value={eventCounts.total} hint={`${eventCounts.goals} أهداف · ${eventCounts.cards} بطاقات`} />
            <Metric title="آخر Snapshot" value={latestSnapshot?.provider || 'غير متوفر'} hint={latestSnapshot?.capturedAt ? formatDate(latestSnapshot.capturedAt) : 'لم يتم الحفظ'} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-[1.5rem] border p-4 text-right transition ${active ? 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.06]'}`}>
                <Icon size={18} />
                <h2 className="mt-2 font-black">{tab.title}</h2>
                <p className="mt-1 text-xs font-bold text-gray-500">{tab.subtitle}</p>
              </button>
            );
          })}
        </section>

        {loading && !data ? <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center text-sm font-bold text-gray-400"><Loader2 className="mx-auto mb-3 animate-spin" /> جاري تحميل الأداة...</div> : null}

        {activeTab === 'live' ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
            <form onSubmit={addEvent} className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><Radio className="text-[#0FF0FC]" /> Live Events</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الدقيقة"><input type="number" min="0" max="130" value={eventForm.minute} onChange={(event) => updateEventField('minute', event.target.value)} className="field-input" placeholder="67" /></Field>
                <Field label="نوع الحدث"><select value={eventForm.type} onChange={(event) => updateEventField('type', event.target.value)} className="field-input"><option value="goal">هدف</option><option value="yellow_card">بطاقة صفراء</option><option value="red_card">بطاقة حمراء</option><option value="substitution">تبديل</option><option value="var">VAR</option><option value="penalty">ركلة جزاء</option><option value="shot_on_target">تسديدة على المرمى</option><option value="dangerous_attack">هجمة خطيرة</option><option value="note">ملاحظة</option></select></Field>
                <Field label="المنتخب"><select value={eventForm.teamId} onChange={(event) => updateEventField('teamId', event.target.value)} className="field-input"><option value="">حدث عام</option>{homeTeam ? <option value={homeTeam.id}>{homeTeam.name}</option> : null}{awayTeam ? <option value={awayTeam.id}>{awayTeam.name}</option> : null}</select></Field>
                <Field label="اللاعب"><input value={eventForm.playerName} onChange={(event) => updateEventField('playerName', event.target.value)} className="field-input" placeholder="اسم اللاعب إن وجد" /></Field>
              </div>
              <Field label="تفاصيل الحدث"><textarea value={eventForm.detail} onChange={(event) => updateEventField('detail', event.target.value)} rows={4} className="field-input leading-7" placeholder="مثال: هدف بعد هجمة مرتدة سريعة / فرصة خطيرة من عرضية..." /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم المصدر"><input value={eventForm.sourceName} onChange={(event) => updateEventField('sourceName', event.target.value)} className="field-input" placeholder="رصد يدوي / API" /></Field>
                <Field label="رابط المصدر"><input value={eventForm.sourceUrl} onChange={(event) => updateEventField('sourceUrl', event.target.value)} className="field-input" placeholder="https://..." /></Field>
              </div>
              <button disabled={saving || !selectedMatchId} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ الحدث</button>
            </form>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="mb-4 text-xl font-black">Timeline محفوظ</h2>
              <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                {(data?.events || []).map((item) => <EventCard key={item.id} item={item} match={selectedMatch} onDelete={() => deleteEvent(item.id)} />)}
                {data?.events?.length ? null : <EmptyState text="لا توجد أحداث محفوظة لهذه المباراة بعد." />}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'stats' ? (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <form onSubmit={saveStatsSnapshot} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-[#FFD700]" /> Stats Review</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-gray-500">أدخل فقط الأرقام الموجودة في المصدر. أي خانة غير مؤكدة اتركها فارغة.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="المصدر"><select value={statsForm.provider} onChange={(event) => updateStatsField('provider', event.target.value)} className="field-input"><option value="FBREF">FBref</option><option value="FOTMOB">FotMob</option><option value="SOFASCORE">SofaScore</option><option value="FIFA">FIFA</option><option value="THE_STATS_API">TheStatsAPI</option><option value="MANUAL_REVIEW">Manual Review</option></select></Field>
                <Field label="اسم المصدر المعروض"><input value={statsForm.sourceName} onChange={(event) => updateStatsField('sourceName', event.target.value)} className="field-input" /></Field>
                <Field label="رابط المصدر"><input value={statsForm.sourceUrl} onChange={(event) => updateStatsField('sourceUrl', event.target.value)} className="field-input" placeholder="رابط FBref/FotMob/SofaScore/FIFA" /></Field>
                <Field label="Provider Match ID"><input value={statsForm.providerMatchId} onChange={(event) => updateStatsField('providerMatchId', event.target.value)} className="field-input" placeholder="اختياري" /></Field>
                <Field label="الدقيقة"><input value={statsForm.minute} onChange={(event) => updateStatsField('minute', event.target.value)} className="field-input" /></Field>
                <Field label="ملاحظة المراجعة"><input value={statsForm.reviewNote} onChange={(event) => updateStatsField('reviewNote', event.target.value)} className="field-input" placeholder="مثال: بعد نهاية المباراة" /></Field>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(['homeScore', 'awayScore', 'homePossession', 'awayPossession', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeDangerousAttacks', 'awayDangerousAttacks', 'homeCorners', 'awayCorners', 'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards', 'xgHome', 'xgAway'] as const).map((field) => <Field key={field} label={statLabel(field)}><input value={statsForm[field]} onChange={(event) => updateStatsField(field, event.target.value)} className="field-input" /></Field>)}
              </div>
              <button disabled={saving || !selectedMatchId} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD700] px-5 py-3 text-sm font-black text-black hover:bg-[#0FF0FC] disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ Snapshot</button>
            </form>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="mb-4 text-xl font-black">آخر الإحصائيات المحفوظة</h2>
              <div className="space-y-3">
                {(data?.snapshotHistory || []).slice(0, 8).map((item) => <SnapshotCard key={item.id} item={item} />)}
                {data?.snapshotHistory?.length ? null : <EmptyState text="لا توجد Snapshots محفوظة لهذه المباراة." />}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'article' ? (
          <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><FileText className="text-emerald-300" /> Article Builder</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-gray-500">يستخدم الأحداث + آخر Snapshot محفوظة لتوليد مقال قابل للنشر في الأخبار.</p>
              <div className="mt-5 grid gap-3">
                <button type="button" onClick={() => previewArticle(false)} disabled={saving || !selectedMatchId} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-5 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-300 hover:text-black disabled:opacity-60"><FileText size={16} /> توليد معاينة المقال</button>
                <button type="button" onClick={() => previewArticle(true)} disabled={saving || !selectedMatchId} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60"><Save size={16} /> نشر المقال من البيانات الحالية</button>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-bold leading-7 text-gray-400">تنبيه مهم: لا تستخدم المقال مباشرة إلا بعد مراجعة أرقام المصدر. الخانات غير الموجودة ستظهر كبيانات غير مكتملة بدل اختراع أرقام.</div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">معاينة المقال</h2>{article?.body ? <button type="button" onClick={() => copyText(`${article.title}\n\n${article.body}`)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-gray-300">نسخ</button> : null}</div>
              {article ? <div className="space-y-4"><input readOnly value={article.title} className="field-input" /><textarea readOnly value={article.body} rows={16} className="field-input leading-7" /></div> : <EmptyState text="اضغط توليد معاينة المقال لعرض النص هنا." />}
            </div>
          </section>
        ) : null}

        {activeTab === 'broadcast' ? (
          <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black"><Video className="text-[#0FF0FC]" /> Broadcast Script</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-gray-500">يولد سكريبت TTS مع فواصل، ومنه تستخدم نفس البيانات ليوتيوب وتيك توك والإنفوجرافيك.</p>
              <div className="mt-5 grid gap-3">
                <button type="button" onClick={generateBroadcast} disabled={saving || !selectedMatchId} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0FF0FC]/25 bg-[#0FF0FC]/10 px-5 py-3 text-sm font-black text-[#0FF0FC] hover:bg-[#0FF0FC] hover:text-black disabled:opacity-60"><ClipboardList size={16} /> توليد السكريبت</button>
                <button type="button" onClick={saveBroadcast} disabled={saving || !broadcast} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] px-5 py-3 text-sm font-black text-black hover:bg-[#FFD700] disabled:opacity-60"><Save size={16} /> حفظ في أرشيف ملخصات المباريات</button>
                {broadcast?.videoScript ? <button type="button" onClick={() => copyText(broadcast.videoScript)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-gray-300 hover:bg-white/10">نسخ السكريبت</button> : null}
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="mb-4 text-xl font-black">محرر السكريبت</h2>
              {broadcast ? <div className="grid gap-4"><Field label="عنوان المباراة"><input value={broadcast.matchTitle} onChange={(event) => updateBroadcastField('matchTitle', event.target.value)} className="field-input" /></Field><Field label="الملخص"><textarea value={broadcast.summary} onChange={(event) => updateBroadcastField('summary', event.target.value)} rows={4} className="field-input leading-7" /></Field><Field label="سكريبت TTS"><textarea value={broadcast.videoScript} onChange={(event) => updateBroadcastField('videoScript', event.target.value)} rows={14} className="field-input leading-7" /></Field><Field label="منشور فيسبوك"><textarea value={broadcast.facebookPost || ''} onChange={(event) => updateBroadcastField('facebookPost', event.target.value)} rows={5} className="field-input leading-7" /></Field><Field label="نقاط الإنفوجرافيك - سطر لكل نقطة"><textarea value={(broadcast.infographicPoints || []).join('\n')} onChange={(event) => updateInfographic(event.target.value)} rows={5} className="field-input leading-7" /></Field></div> : <EmptyState text="اضغط توليد السكريبت أو افتح مباراة لها ملخص محفوظ." />}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ title, value, hint }: { title: string; value: string | number; hint?: string | null }) {
  return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-black text-gray-500">{title}</p><p className="mt-2 line-clamp-2 text-lg font-black text-white">{value}</p><p className="mt-1 text-xs font-bold text-gray-500">{hint || '—'}</p></div>;
}

function Field({ label: fieldLabel, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-2 block text-xs font-black text-gray-400">{fieldLabel}</span>{children}</label>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm font-bold text-gray-500">{text}</div>;
}

function EventCard({ item, match, onDelete }: { item: MatchEventItem; match?: MatchItem | null; onDelete: () => void }) {
  const team = item.teamId === match?.homeTeam?.id ? match.homeTeam?.name : item.teamId === match?.awayTeam?.id ? match.awayTeam?.name : 'حدث عام';
  return <article className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-2 flex items-center justify-between gap-3"><span className="rounded-full border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-3 py-1 text-xs font-black text-[#0FF0FC]">د{label(item.minute)} · {eventTypeLabel(item.type)}</span><button type="button" onClick={onDelete} className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"><Trash2 size={14} /></button></div><h3 className="text-sm font-black text-white">{team}{item.playerName ? ` · ${item.playerName}` : ''}</h3><p className="mt-2 text-sm font-bold leading-7 text-gray-400">{item.detail}</p>{item.sourceName || item.sourceUrl ? <p className="mt-2 text-xs font-bold text-gray-500">المصدر: {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[#FFD700]">{item.sourceName || item.sourceUrl}</a> : item.sourceName}</p> : null}</article>;
}

function SnapshotCard({ item }: { item: SnapshotItem }) {
  return <article className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-3 py-1 text-xs font-black text-[#FFD700]">{item.provider}</span><span className="text-xs font-bold text-gray-500">{formatDate(item.capturedAt)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold text-gray-300"><span>النتيجة: {label(item.homeScore)} - {label(item.awayScore)}</span><span>الدقيقة: {label(item.minute)}</span><span>الاستحواذ: {label(item.homePossession)} - {label(item.awayPossession)}</span><span>التسديدات: {label(item.homeShots)} - {label(item.awayShots)}</span><span>على المرمى: {label(item.homeShotsOnTarget)} - {label(item.awayShotsOnTarget)}</span><span>xG: {label(item.xgHome)} - {label(item.xgAway)}</span></div>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-[#0FF0FC]">فتح المصدر</a> : null}</article>;
}

function statLabel(field: keyof typeof emptyStatsForm) {
  const labels: Record<string, string> = {
    homeScore: 'أهداف الفريق الأول',
    awayScore: 'أهداف الفريق الثاني',
    homePossession: 'استحواذ الفريق الأول %',
    awayPossession: 'استحواذ الفريق الثاني %',
    homeShots: 'تسديدات الفريق الأول',
    awayShots: 'تسديدات الفريق الثاني',
    homeShotsOnTarget: 'على المرمى - الأول',
    awayShotsOnTarget: 'على المرمى - الثاني',
    homeDangerousAttacks: 'هجمات خطيرة - الأول',
    awayDangerousAttacks: 'هجمات خطيرة - الثاني',
    homeCorners: 'ركنيات الأول',
    awayCorners: 'ركنيات الثاني',
    homeYellowCards: 'صفراء الأول',
    awayYellowCards: 'صفراء الثاني',
    homeRedCards: 'حمراء الأول',
    awayRedCards: 'حمراء الثاني',
    xgHome: 'xG الأول',
    xgAway: 'xG الثاني',
  };
  return labels[field] || field;
}
