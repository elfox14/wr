import { getArabicTeamName } from '@/lib/teamDisplay';
import { getTeamFlagUrl } from '@/lib/teamFlags';

type T = { code?: string | null; name?: string | null; image?: string | null };
export function displayTeamName(team: T) { return getArabicTeamName(team.code, team.name); }
export default function TeamInlineFlag({ team, className = '' }: { team: T; className?: string }) {
  const name = displayTeamName(team);
  const src = getTeamFlagUrl({ code: team.code, name, image: team.image }, 80) || team.image || null;
  return <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>{src ? <img src={src} className="h-7 w-9 shrink-0 rounded-lg border border-white/10 object-cover" /> : <span className="h-7 w-9 shrink-0 rounded-lg border border-white/10 bg-black/35" />}<span className="truncate">{name}</span></span>;
}
