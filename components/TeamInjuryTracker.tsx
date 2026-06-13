import { Stethoscope, ShieldAlert } from 'lucide-react';
import { AssetImage } from '@/components/ui/AssetImage';

type Player = {
  id: string;
  name: string;
  image?: string | null;
  position?: string | null;
  isAvailable?: boolean | null;
  injuries?: number | null;
};

type TeamInjuryTrackerProps = {
  players: Player[];
};

export default function TeamInjuryTracker({ players }: TeamInjuryTrackerProps) {
  if (!players || players.length === 0) return null;

  // Find players that are either marked unavailable or have injuries > 0.
  // Note: Depending on data logic, "isAvailable: false" usually means injured/suspended.
  const unavailablePlayers = players.filter((p) => p.isAvailable === false || (p.injuries && p.injuries > 0));

  if (unavailablePlayers.length === 0) {
    return (
      <div className="rounded-3xl border border-white/5 bg-black/25 p-5 md:p-6 text-center">
        <div className="mb-3 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <Stethoscope size={24} className="text-emerald-500" />
        </div>
        <h3 className="text-lg font-black text-white">العيادة الطبية فارغة</h3>
        <p className="mt-1 text-sm text-slate-400">القائمة مكتملة ولا توجد غيابات مؤثرة أو إيقافات في الوقت الحالي.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-rose-500/10 bg-rose-500/[0.02] p-5 md:p-6 shadow-[0_8px_30px_rgba(225,29,72,0.04)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
          <ShieldAlert size={20} className="text-rose-500" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">الغيابات والإيقافات</h3>
          <p className="text-xs text-rose-500/70">قائمة اللاعبين غير المتاحين</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unavailablePlayers.map((player) => (
          <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/40 p-3 transition hover:bg-white/5">
            <AssetImage 
              image={player.image || ''} 
              type="PLAYER" 
              name={player.name} 
              width={48} 
              height={48} 
              className="h-12 w-12 rounded-xl border border-white/10 object-cover grayscale" 
            />
            <div>
              <div className="text-sm font-black text-white truncate max-w-[120px]">{player.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                  {player.position || 'غير محدد'}
                </span>
                <span className="text-[10px] font-bold text-rose-400">
                  غير متاح
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
