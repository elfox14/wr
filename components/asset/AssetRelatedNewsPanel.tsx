import Link from 'next/link';
import { Activity, ArrowLeft, Newspaper, Timer } from 'lucide-react';

type RelatedNewsItem = {
  id: string;
  title: string;
  body: string;
  category?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  publishedAt?: string | Date | null;
};

type RelatedEventItem = {
  id: string;
  minute?: number | null;
  type: string;
  detail: string;
  playerName?: string | null;
  sourceName?: string | null;
  matchId: string;
  matchLabel?: string | null;
  matchDate?: string | Date | null;
};

function formatDate(value?: string | Date | null) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'غير محدد';
  return date.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AssetRelatedNewsPanel({ asset, pressNews, matchEvents }: { asset: any; pressNews: RelatedNewsItem[]; matchEvents: RelatedEventItem[] }) {
  const isPlayer = asset?.type === 'PLAYER';
  if (!pressNews.length && !matchEvents.length) return null;

  return (
    <section className="mx-auto mb-6 max-w-[1600px] px-4">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-card md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/8 pb-4">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><Newspaper className="text-[#FFD700]" /> الأخبار المرتبطة</h2>
            <Link href="/news" className="text-xs font-black text-[#0FF0FC]">غرفة الأخبار</Link>
          </div>
          {pressNews.length ? <div className="space-y-3">{pressNews.map((item) => <NewsCard key={item.id} item={item} />)}</div> : <EmptyText text="لا توجد أخبار مرتبطة بهذا الأصل حتى الآن." />}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-card md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/8 pb-4">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><Timer className="text-[#0FF0FC]" /> {isPlayer ? 'أحداث اللاعب' : 'أحداث مرتبطة'}</h2>
            <Link href="/admin/match-events" className="text-xs font-black text-[#FFD700]">إدارة الأحداث</Link>
          </div>
          {matchEvents.length ? <div className="space-y-3">{matchEvents.map((event) => <EventCard key={event.id} event={event} />)}</div> : <EmptyText text={isPlayer ? 'لا توجد أحداث مرتبطة بهذا اللاعب حتى الآن.' : 'لا توجد أحداث مرتبطة بهذا المنتخب حتى الآن.'} />}
        </div>
      </div>
    </section>
  );
}

function NewsCard({ item }: { item: RelatedNewsItem }) {
  const href = item.sourceUrl || `/news#${item.id}`;
  const external = String(href).startsWith('http');
  return (
    <article className="rounded-2xl border border-white/8 bg-black/25 p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black text-gray-500"><span>{item.category || 'رصد صحفي'}</span><span>{item.sourceName || 'مصدر صحفي'}</span></div>
      <h3 className="font-black leading-6 text-white">{item.title}</h3>
      <p className="mt-2 line-clamp-3 text-xs font-bold leading-6 text-gray-500">{item.body}</p>
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] font-bold text-gray-600">{formatDate(item.publishedAt)}</span><Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-1 text-xs font-black text-[#FFD700]">تفاصيل <ArrowLeft size={12} /></Link></div>
    </article>
  );
}

function EventCard({ event }: { event: RelatedEventItem }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-black/25 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black text-gray-500"><Activity size={12} className="text-[#0FF0FC]" /><span>{event.minute ? `${event.minute}'` : '--'}</span><span>{event.type}</span>{event.sourceName && <span>{event.sourceName}</span>}</div>
      {event.playerName && <p className="text-sm font-black text-white">{event.playerName}</p>}
      <p className="mt-1 text-sm font-bold leading-6 text-gray-400">{event.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] font-bold text-gray-600">{event.matchLabel || 'مباراة'} · {formatDate(event.matchDate)}</span><Link href={`/match-center/${event.matchId}`} className="text-xs font-black text-[#0FF0FC]">مركز المباراة</Link></div>
    </article>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm font-bold leading-7 text-gray-500">{text}</div>;
}
