import { ExternalLink, PlayCircle, ShieldCheck } from 'lucide-react';

type OfficialMatchMediaItem = {
  id?: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  metrics?: {
    videoId?: string | null;
    licenseStatus?: string | null;
    mediaType?: string | null;
    region?: string | null;
    language?: string | null;
  } | null;
};

function getStatusLabel(status?: string | null) {
  if (status === 'official_embed') return 'تضمين رسمي';
  if (status === 'official_link') return 'رابط رسمي';
  if (status === 'unavailable') return 'غير متوفر رسميًا';
  return 'يحتاج مراجعة';
}

function getMediaTypeLabel(type?: string | null) {
  if (type === 'official_goal') return 'هدف رسمي';
  if (type === 'replay') return 'إعادة كاملة';
  if (type === 'press_conference') return 'مؤتمر صحفي';
  if (type === 'shorts') return 'Shorts';
  if (type === 'behind_the_scenes') return 'خلف الكواليس';
  return 'ملخص رسمي';
}

export default function OfficialMatchMedia({ media }: { media: OfficialMatchMediaItem[] }) {
  if (!media.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 text-xl font-black text-white"><PlayCircle size={20} className="text-primary" /> ملخص المباراة الرسمي</h2>
        <p className="text-sm leading-7 text-gray-400">الفيديو: غير متوفر من مصدر رسمي حاليًا. سيتم عرض الملخص الرسمي عند توفر رابط أو تضمين من مصدر موثوق.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-surface p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-white"><PlayCircle size={20} className="text-primary" /> ملخص المباراة الرسمي</h2>
      <div className="grid gap-4">
        {media.map((item) => {
          const status = item.metrics?.licenseStatus || 'needs_review';
          const canEmbed = status === 'official_embed' && item.metrics?.videoId;
          return (
            <article key={item.id || item.sourceUrl} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-black text-white">{item.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{item.sourceName} · {getMediaTypeLabel(item.metrics?.mediaType)} · {item.metrics?.region || 'Global'}</div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-black text-primary"><ShieldCheck size={13} /> {getStatusLabel(status)}</span>
              </div>

              {canEmbed ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <iframe
                    className="aspect-video w-full"
                    src={`https://www.youtube.com/embed/${item.metrics?.videoId}`}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:border-primary/40 hover:text-primary">
                  مشاهدة من المصدر الرسمي <ExternalLink size={15} />
                </a>
              )}

              <p className="mt-3 text-xs leading-6 text-gray-500">هذا الفيديو أو الرابط معروض من المصدر الخارجي ولا تستضيفه المنصة داخليًا.</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
