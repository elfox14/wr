'use client';

function sum(values: any[], key: string) {
  return values.reduce((total, item) => total + (Number(item?.[key]) || 0), 0);
}

function avg(values: any[], key: string) {
  const valid = values.map((item) => Number(item?.[key])).filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return null;
  return Math.round((valid.reduce((total, value) => total + value, 0) / valid.length) * 10) / 10;
}

function aggregatePlayer(player: any) {
  const performances = Array.isArray(player?.performances) ? player.performances : [];
  const minutes = sum(performances, 'minutes');
  const goals = sum(performances, 'goals');
  const assists = sum(performances, 'assists');
  const shotsOnTarget = sum(performances, 'shotsOnTarget');
  const keyPasses = sum(performances, 'keyPasses');
  const tackles = sum(performances, 'tackles');
  const interceptions = sum(performances, 'interceptions');
  const rating = avg(performances, 'apiRating') ?? avg(performances, 'internalRating');
  const score = minutes + goals * 90 + assists * 70 + shotsOnTarget * 10 + keyPasses * 8 + tackles * 5 + interceptions * 5 + (rating || 0) * 4;

  let reason = 'لا توجد إحصائيات أداء كافية حتى الآن.';
  if (goals || assists) reason = 'ظهر بسبب مساهماته الهجومية الموثقة في سجلات الأداء.';
  else if (minutes) reason = 'ظهر بسبب حجم المشاركة والدقائق المسجلة.';
  else if (tackles || interceptions) reason = 'ظهر بسبب مساهماته الدفاعية المسجلة.';

  return { ...player, minutes, goals, assists, shotsOnTarget, keyPasses, tackles, interceptions, rating, score, reason };
}

function positionOrder(position?: string | null) {
  const value = String(position || '').toUpperCase();
  if (['G', 'GK', 'GOALKEEPER'].some((key) => value.includes(key))) return 1;
  if (['D', 'DEF', 'DEFENDER'].some((key) => value.includes(key))) return 2;
  if (['M', 'MID', 'MIDFIELDER'].some((key) => value.includes(key))) return 3;
  if (['F', 'FW', 'FWD', 'ATTACKER', 'FORWARD'].some((key) => value.includes(key))) return 4;
  return 5;
}

export default function TeamSquadHighlight({ players = [] }: { players: any[] }) {
  const displayPlayers = players
    .map(aggregatePlayer)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff) return scoreDiff;
      const positionDiff = positionOrder(a.position) - positionOrder(b.position);
      if (positionDiff) return positionDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });

  if (!displayPlayers.length) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black mb-2">قائمة اللاعبين</h2>
        <div className="rounded-2xl border border-white/10 bg-[#111] p-6 text-sm text-gray-400">
          غير متوفر في المصادر: لا توجد قائمة لاعبين موثقة لهذا المنتخب في قاعدة البيانات الحالية.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-black mb-2">قائمة اللاعبين</h2>
          <p className="text-gray-400 text-sm">
            يتم عرض كل اللاعبين المتاحين لهذا المنتخب في قاعدة البيانات الحالية، وليس أول 9 لاعبين فقط.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-gray-300">
          <span className="text-2xl font-black text-white">{displayPlayers.length}</span> لاعب مسجل
        </div>
      </div>

      {displayPlayers.length < 26 ? (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm font-bold leading-7 text-yellow-100">
          القائمة الحالية أقل من 26 لاعبًا؛ هذا يعني أن قاعدة البيانات لم تستقبل القائمة الكاملة لهذا المنتخب بعد، ولن يتم اختراع أسماء غير موجودة.
        </div>
      ) : null}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayPlayers.map((player: any) => (
          <div key={player.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 hover:border-[#0FF0FC]/50 transition-colors">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex-shrink-0 flex items-center justify-center font-black text-xl overflow-hidden">
                {player.image ? <img src={player.image} alt={player.name} className="w-full h-full rounded-full object-cover" /> : player.name?.charAt(0) || '؟'}
              </div>
              <div>
                <h3 className="font-bold text-lg">{player.name}</h3>
                <p className="text-sm text-gray-400">
                  {player.position || 'المركز غير متوفر'} • {player.age ? `${player.age} سنة` : 'العمر غير متوفر'} • {player.club || 'النادي غير متوفر'}
                </p>
                <div className="mt-2 inline-block px-2 py-1 bg-[#0FF0FC]/10 text-[#0FF0FC] rounded text-xs font-bold border border-[#0FF0FC]/20">
                  تقييم البيانات: {player.rating == null ? 'غير متوفر' : player.rating}
                </div>
              </div>
            </div>
            
            <div className="bg-black/50 rounded-xl p-3 text-sm text-gray-300 border border-white/5 mb-4">
              <span className="font-bold text-white">ملاحظة البيانات: </span>
              {player.reason}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-sm border-t border-white/10 pt-4">
              <Stat label="الدقائق" value={player.minutes || 'غير متوفر'} />
              <Stat label="أهداف" value={player.goals || 0} />
              <Stat label="صناعة" value={player.assists || 0} />
              <Stat label="تمريرات مفتاحية" value={player.keyPasses || 0} />
              <Stat label="تدخلات" value={player.tackles || 0} />
              <Stat label="اعتراضات" value={player.interceptions || 0} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
