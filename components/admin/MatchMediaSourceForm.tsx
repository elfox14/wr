'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

type MatchOption = {
  id: string;
  label: string;
  matchDate: string;
};

export default function MatchMediaSourceForm({ matches }: { matches: MatchOption[] }) {
  const [matchId, setMatchId] = useState('');
  const [sourceName, setSourceName] = useState('FIFA');
  const [sourceUrl, setSourceUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [mediaType, setMediaType] = useState('official_highlight');
  const [licenseStatus, setLicenseStatus] = useState('official_link');
  const [region, setRegion] = useState('Global');
  const [language, setLanguage] = useState('ar');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/match-media-sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId, sourceName, sourceUrl, videoId, mediaType, licenseStatus, region, language, title, notes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'فشل حفظ مصدر الفيديو.');
        return;
      }
      setMessage(data.skipped ? 'هذا المصدر محفوظ بالفعل.' : 'تم حفظ مصدر الفيديو الرسمي للمباراة.');
      if (!data.skipped) {
        setSourceUrl('');
        setVideoId('');
        setTitle('');
        setNotes('');
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'فشل حفظ مصدر الفيديو.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-primary/10 bg-surface p-5 shadow-card md:p-6">
      <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><ShieldCheck size={20} className="text-primary" /> إضافة مصدر فيديو رسمي</h2>
      <p className="mb-4 text-sm leading-7 text-gray-400">أضف رابط ملخص أو هدف أو مؤتمر صحفي من مصدر رسمي. المنصة تحفظ الرابط أو التضمين فقط ولا تستضيف الفيديو داخليًا.</p>

      <div className="grid gap-4">
        <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">المباراة</span><select value={matchId} onChange={(event) => setMatchId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="">اختر المباراة</option>{matches.map((match) => <option key={match.id} value={match.id}>{match.label} — {new Date(match.matchDate).toLocaleDateString('ar-EG')}</option>)}</select></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">اسم المصدر</span><input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="FIFA / beIN Sports / BBC / FOX" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">عنوان العرض</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ملخص رسمي — الفريق × الفريق" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
        </div>
        <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">رابط المصدر الرسمي</span><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">YouTube Video ID اختياري</span><input value={videoId} onChange={(event) => setVideoId(event.target.value)} placeholder="يستخرج تلقائيًا من الرابط غالبًا" className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">نوع المحتوى</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="official_highlight">ملخص رسمي</option><option value="official_goal">هدف رسمي</option><option value="replay">إعادة كاملة</option><option value="press_conference">مؤتمر صحفي</option><option value="shorts">Shorts</option><option value="behind_the_scenes">خلف الكواليس</option></select></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">حالة العرض</span><select value={licenseStatus} onChange={(event) => setLicenseStatus(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary"><option value="official_link">رابط رسمي</option><option value="official_embed">تضمين رسمي</option><option value="unavailable">غير متوفر رسميًا</option><option value="needs_review">يحتاج مراجعة</option></select></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">المنطقة</span><input value={region} onChange={(event) => setRegion(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">اللغة</span><input value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
        </div>
        <label className="block"><span className="mb-2 block text-xs font-bold text-gray-500">ملاحظات</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" /></label>
        <button type="button" onClick={submit} disabled={loading || !matchId || !sourceName.trim() || !sourceUrl.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />} حفظ مصدر الفيديو</button>
      </div>

      {message && <div className="mt-4 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold text-success"><CheckCircle2 className="ml-2 inline" size={16} />{message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger"><XCircle className="ml-2 inline" size={16} />{error}</div>}
    </section>
  );
}
