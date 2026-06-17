import { getTeamFlagUrl } from '@/lib/teamFlags';
import type { Team } from '../types';

type TeamNameProps = {
  team: Team;
  fallback: string;
  align: 'right' | 'left';
};

function flagUrl(team: Team) {
  return getTeamFlagUrl({ code: team?.code, name: team?.name, image: team?.image }, 80);
}

export default function TeamName({ team, fallback, align }: TeamNameProps) {
  const name = team?.name || fallback;
  const flag = flagUrl(team);

  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}>
      <span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 text-[10px] font-black text-[#FFD700]">
        {flag ? <img src={flag} alt={`علم ${name}`} className="h-full w-full object-cover" loading="lazy" /> : team?.code || '---'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black text-white md:text-xl">{name}</span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase text-gray-500">{team?.code || '---'}</span>
      </span>
    </div>
  );
}
