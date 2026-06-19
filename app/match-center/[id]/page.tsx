import MatchCenterPageLivePriority, { metadata } from '@/components/match-center/MatchCenterPageLivePriority';
import InternalAnimationPlayer from '@/app/animation-live/player/InternalAnimationPlayer';

export { metadata };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchCenterRoutePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolved = await params;
  const matchId = resolved.id;

  return (
    <>
      <MatchCenterPageLivePriority matchId={matchId} />
      <section id="live-broadcast" className="bg-[#02060d] px-3 pb-8 text-white sm:px-6" dir="rtl">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="border-b border-white/10 bg-black/25 px-4 py-4 sm:px-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0FF0FC]">Live Interactive Center</p>
            <h2 className="mt-1 text-xl font-black text-white">الملعب التفاعلي والتحليل الذكي</h2>
            <p className="mt-1 text-xs font-bold text-gray-400">استعادة أسماء وصور اللاعبين، أحداث الملعب، التحليل الذكي، وزخم المباراة.</p>
          </div>
          <InternalAnimationPlayer dbMatchId={matchId} />
        </div>
      </section>
    </>
  );
}
