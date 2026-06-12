'use client';

import { useMemo, useState } from 'react';
import { Copy, FileText, Image as ImageIcon, Sparkles, Video } from 'lucide-react';

type MatchEvent = {
  minute?: number | null;
  type?: string | null;
  teamName?: string | null;
  playerName?: string | null;
  detail?: string | null;
};

type Props = {
  matchTitle: string;
  scoreLine: string;
  statusLabel: string;
  events: MatchEvent[];
};

function eventLine(event: MatchEvent) {
  const minute = typeof event.minute === 'number' ? `${event.minute}'` : '--';
  const who = event.playerName ? ` - ${event.playerName}` : '';
  const team = event.teamName ? ` (${event.teamName})` : '';
  return `${minute} ${event.type || 'note'}${who}${team}: ${event.detail || 'بدون تفاصيل'}`;
}

function trimText(value: string, max = 260) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 3).trim()}...` : value;
}

async function copyText(text: string) {
  if (!text) return;
  await navigator.clipboard?.writeText(text);
}

export default function MatchCenterContentTools({ matchTitle, scoreLine, statusLabel, events }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const pack = useMemo(() => {
    const sorted = [...events].sort((a, b) => Number(a.minute ?? 999) - Number(b.minute ?? 999));
    const goals = sorted.filter((event) => String(event.type || '').toLowerCase().includes('goal'));
    const cards = sorted.filter((event) => String(event.type || '').toLowerCase().includes('card'));
    const firstGoal = goals[0];
    const turningPoint = cards[0] || goals[goals.length - 1] || sorted[0];
    const eventLines = sorted.length ? sorted.map(eventLine).join('\n') : 'لا توجد أحداث مسجلة بعد.';
    const summary = sorted.length
      ? `${matchTitle} — ${scoreLine}. شهدت المباراة ${goals.length} هدف/أهداف و${cards.length} بطاقة/بطاقات مسجلة في الـ Timeline. أبرز ما يمكن البناء عليه: ${turningPoint ? eventLine(turningPoint) : 'غير متوفر في الأحداث'}.`
      : `${matchTitle} — ${scoreLine}. لا توجد أحداث مسجلة بعد، لذلك لا يمكن توليد ملخص تفصيلي موثق.`;
    const script = [
      'يا أهلاً بكم في مركز المباراة من بورصة المونديال.',
      `المباراة: ${matchTitle}.`,
      `الحالة: ${statusLabel}. النتيجة: ${scoreLine}.`,
      sorted.length ? `أهم الأحداث:\n${eventLines}` : 'لا توجد أحداث موثقة في الـ Timeline حتى الآن.',
      turningPoint ? `نقطة التحول: ${eventLine(turningPoint)}.` : 'نقطة التحول: غير متوفر في الأحداث المسجلة.',
      'تنبيه مهم: هذا ملخص كروي مبني على الأحداث المسجلة داخل المنصة، وليس توصية تداول.',
    ].join('\n');
    return {
      summary,
      turningPoint: turningPoint ? eventLine(turningPoint) : 'غير متوفر في الأحداث المسجلة.',
      script,
      facebookPost: `${matchTitle}\n${scoreLine}\n\n${trimText(summary, 260)}\n\nهذا رصد كروي من Timeline المباراة، وليس توصية تداول.\n\n#بورصة_المونديال #كأس_العالم`,
      infographicPoints: [
        `المباراة: ${matchTitle}`,
        `النتيجة/الحالة: ${scoreLine} — ${statusLabel}`,
        `عدد الأهداف المسجلة في Timeline: ${goals.length}`,
        `عدد البطاقات المسجلة في Timeline: ${cards.length}`,
        `نقطة التحول: ${turningPoint ? eventLine(turningPoint) : 'غير متوفر'}`,
      ],
    };
  }, [events, matchTitle, scoreLine, statusLabel]);

  async function handleCopy(key: string, text: string) {
    await copyText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <section className="rounded-[2rem] border border-[#FFD700]/15 bg-[#FFD700]/[0.035] p-5 shadow-card md:p-6">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><Sparkles className="text-[#FFD700]" /> محتوى المباراة من الـ Timeline</h2>
          <p className="mt-1 text-xs font-bold text-gray-500">يحوّل الأحداث المسجلة إلى ملخص، سكربت، ونقاط إنفوجرافيك قابلة للنسخ.</p>
        </div>
        {copied && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">تم النسخ</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ContentBox title="ملخص المباراة" icon={<FileText size={16} />} text={pack.summary} onCopy={() => handleCopy('summary', pack.summary)} />
        <ContentBox title="نقطة التحول" icon={<Sparkles size={16} />} text={pack.turningPoint} onCopy={() => handleCopy('turningPoint', pack.turningPoint)} />
        <ContentBox title="سكريبت فيديو" icon={<Video size={16} />} text={pack.script} onCopy={() => handleCopy('script', pack.script)} />
        <ContentBox title="نقاط إنفوجرافيك" icon={<ImageIcon size={16} />} text={pack.infographicPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')} onCopy={() => handleCopy('infographic', pack.infographicPoints.map((point, index) => `${index + 1}. ${point}`).join('\n'))} />
      </div>
    </section>
  );
}

function ContentBox({ title, text, icon, onCopy }: { title: string; text: string; icon: React.ReactNode; onCopy: () => void }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-black text-white">{icon}{title}</h3>
        <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-black text-gray-400 transition hover:border-[#0FF0FC]/30 hover:text-[#0FF0FC]"><Copy size={13} /> نسخ</button>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/35 p-3 text-xs font-bold leading-6 text-gray-300">{text}</pre>
    </article>
  );
}
