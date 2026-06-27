import type { MatchPageData } from '@/lib/match-page/types';
import TeamInlineFlag from './TeamInlineFlag';

const ar = new Intl.NumberFormat('ar-EG');
const fmt = (v: unknown) => v === null || v === undefined || v === '' ? '—' : Number.isFinite(Number(v)) ? ar.format(Number(v)) : String(v);
const when = (v: string) => new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(new Date(v));

export default function PanelSmall({ data }: { data: MatchPageData }) {
  const h = data.history || { homeRecentForm: [], awayRecentForm: [], headToHead: [], homeWorldCupHistory: '', awayWorldCupHistory: '' };
  const rows = h.homeRecentForm.concat(h.awayRecentForm).slice(0, 10);
  return <section className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4"><h2 className="mb-4 text-xl font-black text-white">التحليل</h2><div className="grid gap-3">{rows.map((r) => <article key={r.id} className="rounded-2xl bg-black/25 p-3"><div className="flex items-center justify-between gap-2"><TeamInlineFlag team={{ name: r.opponentName, code: r.opponentCode }} /><b className="text-[#F8C846]">{fmt(r.teamScore)} - {fmt(r.opponentScore)}</b><span className="text-xs text-slate-500">{when(r.date)}</span></div></article>)}</div></section>;
}
