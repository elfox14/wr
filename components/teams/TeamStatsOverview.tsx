'use client';

function latestSnapshot(match: any) {
  return Array.isArray(match?.statsSnapshots) ? match.statsSnapshots[0] : null;
}

function sideForTeam(teamId: string, match: any) {
  if (match?.homeTeam?.id === teamId) return 'home';
  if (match?.awayTeam?.id === teamId) return 'away';
  return null;
}

function ownValue(teamId: string, match: any, homeKey: string, awayKey: string) {
  const side = sideForTeam(teamId, match);
  const snapshot = latestSnapshot(match);
  if (!side || !snapshot) return null;
  const value = snapshot[side === 'home' ? homeKey : awayKey];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function opponentValue(teamId: string, match: any, homeKey: string, awayKey: string) {
  const side = sideForTeam(teamId, match);
  const snapshot = latestSnapshot(match);
  if (!side || !snapshot) return null;
  const value = snapshot[side === 'home' ? awayKey : homeKey];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function total(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0);
}

function format(value: number | null, suffix = '') {
  return value === null ? 'غير متوفر' : `${value}${suffix}`;
}

export default function TeamStatsOverview({ team, matches = [] }: { team: any; matches: any[] }) {
  const matchesWithSnapshots = matches.filter((match) => latestSnapshot(match));

  const stats = {
    goalsFor: total(matches.map((match) => ownValue(team.id, match, 'homeScore', 'awayScore'))),
    goalsAgainst: total(matches.map((match) => opponentValue(team.id, match, 'homeScore', 'awayScore'))),
    shots: average(matches.map((match) => ownValue(team.id, match, 'homeShots', 'awayShots'))),
    shotsAgainst: average(matches.map((match) => opponentValue(team.id, match, 'homeShots', 'awayShots'))),
    shotsOnTarget: average(matches.map((match) => ownValue(team.id, match, 'homeShotsOnTarget', 'awayShotsOnTarget'))),
    dangerousAttacks: average(matches.map((match) => ownValue(team.id, match, 'homeDangerousAttacks', 'awayDangerousAttacks'))),
    possession: average(matches.map((match) => ownValue(team.id, match, 'homePossession', 'awayPossession'))),
    attacks: average(matches.map((match) => ownValue(team.id, match, 'homeAttacks', 'awayAttacks'))),
    corners: average(matches.map((match) => ownValue(team.id, match, 'homeCorners', 'awayCorners'))),
    yellowCards: total(matches.map((match) => ownValue(team.id, match, 'homeYellowCards', 'awayYellowCards'))),
    redCards: total(matches.map((match) => ownValue(team.id, match, 'homeRedCards', 'awayRedCards'))),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-2">
        <h2 className="text-2xl font-black">إحصائيات المنتخب (كأس العالم 2026)</h2>
        <div className="text-sm px-3 py-1 bg-white/10 rounded-full text-gray-400 w-fit">
          مباريات بإحصائيات موثقة: {matchesWithSnapshots.length}
        </div>
      </div>
      {matchesWithSnapshots.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#111] p-6 text-sm text-gray-400">
          غير متوفر في المصادر: لا توجد لقطات إحصائية MatchStatsSnapshot لهذا المنتخب حتى الآن.
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-4 sm:p-5 md:p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            مؤشرات هجومية
          </h3>
          <div className="space-y-4">
            <StatRow label="الأهداف" value={format(stats.goalsFor)} max={Math.max(stats.goalsFor || 0, 5)} current={stats.goalsFor} />
            <StatRow label="التسديدات (متوسط)" value={format(stats.shots)} max={25} current={stats.shots} />
            <StatRow label="التسديدات على المرمى" value={format(stats.shotsOnTarget)} max={12} current={stats.shotsOnTarget} />
            <StatRow label="الهجمات الخطيرة" value={format(stats.dangerousAttacks)} max={70} current={stats.dangerousAttacks} />
          </div>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-4 sm:p-5 md:p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            مؤشرات دفاعية
          </h3>
          <div className="space-y-4">
            <StatRow label="الأهداف المستقبلة" value={format(stats.goalsAgainst)} max={Math.max(stats.goalsAgainst || 0, 5)} current={stats.goalsAgainst} />
            <StatRow label="التسديدات المستقبلة" value={format(stats.shotsAgainst)} max={25} current={stats.shotsAgainst} />
            <StatRow label="البطاقات الصفراء" value={format(stats.yellowCards)} max={10} current={stats.yellowCards} />
            <StatRow label="البطاقات الحمراء" value={format(stats.redCards)} max={3} current={stats.redCards} />
          </div>
        </div>

        <div className="bg-[#111] border border-white/10 rounded-2xl p-4 sm:p-5 md:p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            مؤشرات التحكم
          </h3>
          <div className="space-y-4">
            <StatRow label="متوسط الاستحواذ" value={format(stats.possession, '%')} max={100} current={stats.possession} />
            <StatRow label="الهجمات" value={format(stats.attacks)} max={120} current={stats.attacks} />
            <StatRow label="الركنيات" value={format(stats.corners)} max={12} current={stats.corners} />
            <StatRow label="عدد المباريات المقاسة" value={matchesWithSnapshots.length || 'غير متوفر'} max={matches.length || 1} current={matchesWithSnapshots.length || null} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, max, current }: { label: string; value: string | number; max: number; current: number | null }) {
  const width = current === null ? 0 : Math.max(4, Math.min(100, Math.round((current / Math.max(max, 1)) * 100)));
  return (
    <div>
      <div className="flex justify-between items-end gap-3 text-sm mb-1">
        <span className="text-gray-300 truncate">{label}</span>
        <span className="font-bold shrink-0">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-white rounded-full" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
