'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, UploadCloud, XCircle } from 'lucide-react';

type TeamOption = { id: string; name: string; code: string };

type UploadResponse = {
  success?: boolean;
  error?: string;
  report?: { id: string; title: string; team?: { id: string; name: string; code: string } };
  draft?: { detectedRows?: number; detectedColumns?: string[] };
};

export default function SportsReferenceCsvUpload({ teams }: { teams: TeamOption[] }) {
  const [teamId, setTeamId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('https://www.sports-reference.com/');
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectedTeam = useMemo(() => teams.find((team) => team.id === teamId), [teamId, teams]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    if (!teamId) {
      const lowerName = file.name.toLowerCase();
      const match = teams.find((team) => lowerName.includes(team.code.toLowerCase()) || lowerName.includes(team.name.toLowerCase()));
      if (match) setTeamId(match.id);
    }
  };

  const submitCsv = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/sports-reference-csv-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          teamId,
          teamCode: selectedTeam?.code,
          teamName: selectedTeam?.name,
          sourceName: 'Sports Reference / Stathead / FBref subscription',
          sourceUrl,
          csvText,
        }),
      });
      const data = await res.json() as UploadResponse;
      if (!res.ok || !data.success) {
        setError(data.error || 'فشل استيراد CSV.');
        return;
      }
      const rows = data.draft?.detectedRows ? ` · rows=${data.draft.detectedRows}` : '';
      setMessage(`تم استيراد CSV وحفظ التقرير لـ ${data.report?.team?.name || selectedTeam?.name || 'المنتخب'}${rows}.`);
      setCsvText('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'فشل استيراد CSV.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-primary/10 bg-surface p-5 shadow-card md:p-6">
      <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><UploadCloud size={20} className="text-primary" /> رفع Sports Reference CSV</h2>
      <p className="mb-4 text-sm leading-7 text-gray-400">ارفع ملف CSV أو الصق محتواه، وسيتم تحويله إلى تقرير كروت محفوظ مباشرة في صفحة المنتخب.</p>

      <div className="grid gap-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">المنتخب</span>
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary">
            <option value="">اختر المنتخب</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name} — {team.code}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">رابط المصدر</span>
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-white outline-none focus:border-primary" />
        </label>

        <label className="block rounded-2xl border border-dashed border-white/10 bg-black/20 p-4">
          <span className="mb-2 block text-xs font-bold text-gray-500">ملف CSV</span>
          <input type="file" accept=".csv,text/csv,text/plain" onChange={onFileChange} className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-black file:text-black" />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold text-gray-500">محتوى CSV</span>
          <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Player,Min,Gls,Ast,xG,Sh,SoT" className="min-h-44 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 font-mono text-xs text-white outline-none focus:border-primary" />
        </label>

        <button type="button" onClick={submitCsv} disabled={loading || !teamId || !csvText.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-black hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <UploadCloud size={17} />}
          استيراد CSV الآن
        </button>
      </div>

      {message && <div className="mt-4 rounded-2xl border border-success/20 bg-success/10 p-4 text-sm font-bold leading-7 text-success"><CheckCircle2 className="ml-2 inline" size={16} />{message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold leading-7 text-danger"><XCircle className="ml-2 inline" size={16} />{error}</div>}
    </section>
  );
}
