'use client';

type Team = { name?: string | null; code?: string | null };
type HomeMatch = {
  id?: string | number | null;
  animationMatchId?: string | number | null;
  matchDate?: string | Date | null;
  status?: string | null;
  displayStatus?: string | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  isLiveNow?: boolean;
  isHalfTime?: boolean;
  isLikelyLiveByTime?: boolean;
  isStaleAutoFinished?: boolean;
};

type Props = { matches?: HomeMatch[] | unknown[] };

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'IN_PLAY', 'LIVE'];
const HALF_TIME_STATUSES = ['HT', 'HALFTIME', 'HALF_TIME', 'HALF-TIME'];
const FINISHED_STATUSES = ['FINISHED', 'FT', 'AET', 'PEN', 'FULL_TIME', 'ENDED'];
const TEXT = {
  title: '\u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u062a\u0623\u0647\u0644',
  badge: '\u062a\u0641\u0627\u0639\u0644\u064a',
  noLive: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0645\u0628\u0627\u0631\u0627\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0639\u0631\u0636 \u062a\u0623\u062b\u064a\u0631 \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.',
  liveSuffix: '\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0642\u062f \u062a\u063a\u064a\u0651\u0631 \u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629.',
  vs: '\u0636\u062f',
  nextSuffix: '\u0627\u0644\u0641\u0648\u0632 \u064a\u0645\u0646\u062d \u0635\u0627\u062d\u0628\u0647 \u062f\u0641\u0639\u0629 \u0642\u0648\u064a\u0629 \u0641\u064a \u0633\u0628\u0627\u0642 \u0627\u0644\u062a\u0623\u0647\u0644.',
  noNext: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u062a\u062d\u062f\u064a\u062b \u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u062a\u0623\u0647\u0644 \u0628\u0639\u062f \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629.',
  thirds: '\u0623\u0641\u0636\u0644 \u0627\u0644\u062b\u0648\u0627\u0644\u062b: \u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u064a\u064f\u062d\u0633\u0628 \u062d\u0633\u0628 \u0627\u0644\u0646\u0642\u0627\u0637 \u062b\u0645 \u0641\u0627\u0631\u0642 \u0627\u0644\u0623\u0647\u062f\u0627\u0641 \u062b\u0645 \u0627\u0644\u0623\u0647\u062f\u0627\u0641 \u0627\u0644\u0645\u0633\u062c\u0644\u0629.',
  footer: '\u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0628\u0639\u062f \u0643\u0644 \u0645\u0628\u0627\u0631\u0627\u0629 \u0645\u0643\u062a\u0645\u0644\u0629 \u0623\u0648 \u0639\u0646\u062f \u0648\u0635\u0648\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0648\u062b\u0642\u0629.',
  unknownTeam: '\u0645\u0646\u062a\u062e\u0628 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f',
};

function normalizeStatus(match?: HomeMatch | null) { return String(match?.displayStatus || match?.status || '').toUpperCase(); }
function teamLabel(team?: Team | null) { return team?.name || team?.code || TEXT.unknownTeam; }
function matchKey(match?: HomeMatch | null) { return String(match?.id || match?.animationMatchId || `${teamLabel(match?.homeTeam)}-${teamLabel(match?.awayTeam)}-${match?.matchDate || ''}`); }
function matchTime(match: HomeMatch) { const date = match.matchDate ? new Date(match.matchDate) : null; return date && Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER; }
function isFinished(match?: HomeMatch | null) { return FINISHED_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isStaleAutoFinished); }
function isHalfTime(match?: HomeMatch | null) { return HALF_TIME_STATUSES.includes(normalizeStatus(match)) || Boolean(match?.isHalfTime); }
function isLive(match?: HomeMatch | null) { const status = normalizeStatus(match); return !isFinished(match) && (LIVE_STATUSES.includes(status) || Boolean(match?.isLiveNow) || Boolean(match?.isLikelyLiveByTime) || isHalfTime(match)); }
function uniqueMatches(list: HomeMatch[]) { const seen = new Set<string>(); return list.filter((match) => { const key = matchKey(match); if (seen.has(key)) return false; seen.add(key); return true; }); }

export default function HomeQualificationScenariosCard({ matches = [] }: Props) {
  const safeMatches = Array.isArray(matches) ? (matches as HomeMatch[]) : [];
  const unique = uniqueMatches(safeMatches);
  const liveMatch = unique.find((match) => isLive(match));
  const nextMatch = unique.filter((match) => !isFinished(match)).sort((a, b) => matchTime(a) - matchTime(b))[0];
  const scenarios = [
    liveMatch ? `${teamLabel(liveMatch.homeTeam)} - ${teamLabel(liveMatch.awayTeam)}: ${TEXT.liveSuffix}` : TEXT.noLive,
    nextMatch ? `${teamLabel(nextMatch.homeTeam)} ${TEXT.vs} ${teamLabel(nextMatch.awayTeam)}: ${TEXT.nextSuffix}` : TEXT.noNext,
    TEXT.thirds,
  ];

  return (
    <section className="rounded-[1.2rem] border border-[#FFD700]/15 bg-black/25 p-3 text-white shadow-[0_14px_38px_rgba(0,0,0,0.16)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-black text-white">{TEXT.title}</h3>
        <span className="rounded-full border border-[#FFD700]/20 bg-[#FFD700]/10 px-2 py-0.5 text-[9px] font-black text-[#FFD700]">{TEXT.badge}</span>
      </div>
      <div className="space-y-2">
        {scenarios.map((scenario, index) => (
          <div key={scenario} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[10px] font-bold leading-5 text-gray-200">
            <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#FFD700]/10 text-[9px] font-black text-[#FFD700]">{new Intl.NumberFormat('ar-EG').format(index + 1)}</span>
            {scenario}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] font-bold text-gray-500">{TEXT.footer}</p>
    </section>
  );
}
