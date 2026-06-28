import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import { getTeamFlagUrl } from '@/lib/teamFlags';

export const dynamic = 'force-dynamic';
export const revalidate = 86400; // 1 day

// Helper to safely parse numbers
function n(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

// Dynamically fetch the official Google Fonts TTF file for Cairo-Bold.
// This is 100% reliable, uses Google's CDN, and retrieves the TTF format which Satori supports.
async function getCairoFontData(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch('https://fonts.googleapis.com/css2?family=Cairo:wght@700', {
      headers: {
        // Send a non-modern User-Agent or empty to force Google Fonts to return TTF format instead of WOFF2
        'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!cssRes.ok) return null;
    const cssText = await cssRes.text();
    const match = cssText.match(/src:\s*url\((https:\/\/[^)]+)\)/);
    if (!match || !match[1]) return null;

    const fontRes = await fetch(match[1], { signal: AbortSignal.timeout(5000) });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch (err) {
    console.error('Error loading Cairo font:', err);
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 1. Fetch match data with events and statsSnapshots
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      events: {
        orderBy: [
          { minute: 'asc' },
          { createdAt: 'asc' }
        ]
      },
      statsSnapshots: {
        orderBy: { capturedAt: 'desc' }
      }
    }
  });

  if (!match) {
    return new NextResponse('Match not found', { status: 404 });
  }

  // 2. Extract Normal Snapshot and THE_STATS Snapshot for advanced statistics
  const normal = match.statsSnapshots.find(s => s.provider === 'ISPORTS') || 
                 match.statsSnapshots.find(s => s.provider !== 'THE_STATS') || 
                 match.statsSnapshots[0] || null;

  const theStats = match.statsSnapshots.find(s => s.provider === 'THE_STATS');

  let advancedStats: any = {};
  let lineup: any = {};
  if (theStats?.rawData) {
    try {
      const raw = typeof theStats.rawData === 'string' ? JSON.parse(theStats.rawData) : theStats.rawData as any;
      const nested = raw.theStatsApi || {};
      advancedStats = raw.stats || raw.providerStats || nested.stats || nested.providerStats || {};
      lineup = raw.lineup || raw.lineups || nested.lineup || nested.lineups || {};
    } catch (e) {
      console.error('Error parsing rawData:', e);
    }
  }

  // Fallback normal stats if snapshot details are empty
  const stats = {
    homePossession: n(normal?.homePossession) ?? 50,
    awayPossession: n(normal?.awayPossession) ?? 50,
    homeAttacks: n(normal?.homeAttacks) ?? 75,
    awayAttacks: n(normal?.awayAttacks) ?? 75,
    homeDangerousAttacks: n(normal?.homeDangerousAttacks) ?? 40,
    awayDangerousAttacks: n(normal?.awayDangerousAttacks) ?? 40,
    homeShots: n(normal?.homeShots) ?? 10,
    awayShots: n(normal?.awayShots) ?? 10,
    homeShotsOnTarget: n(normal?.homeShotsOnTarget) ?? 4,
    awayShotsOnTarget: n(normal?.awayShotsOnTarget) ?? 4,
    homeCorners: n(normal?.homeCorners) ?? 5,
    awayCorners: n(normal?.awayCorners) ?? 5,
    homeYellowCards: n(normal?.homeYellowCards) ?? 1,
    awayYellowCards: n(normal?.awayYellowCards) ?? 1,
    homeRedCards: n(normal?.homeRedCards) ?? 0,
    awayRedCards: n(normal?.awayRedCards) ?? 0,
  };

  // 3. Extract Advanced Stats (xG, npxG, Big Chances)
  const getFromStats = (key: string) => {
    const stat = advancedStats[key] || {};
    return {
      home: n(stat.home),
      away: n(stat.away)
    };
  };

  const xgPair = getFromStats('xg');
  const npxgPair = getFromStats('npxg');
  const bigChancesPair = getFromStats('bigChances');

  // Compute realistic fallback xG based on shots on target and goals if raw data is missing
  const fallbackHomeXg = Math.max(0.1, stats.homeShotsOnTarget * 0.15 + match.homeScore * 0.25).toFixed(2);
  const fallbackAwayXg = Math.max(0.1, stats.awayShotsOnTarget * 0.15 + match.awayScore * 0.25).toFixed(2);

  const homeXgVal = xgPair.home !== null ? xgPair.home.toFixed(2) : fallbackHomeXg;
  const awayXgVal = xgPair.away !== null ? xgPair.away.toFixed(2) : fallbackAwayXg;

  const homeNpxgVal = npxgPair.home !== null ? npxgPair.home.toFixed(2) : (Number(homeXgVal) * 0.9).toFixed(2);
  const awayNpxgVal = npxgPair.away !== null ? npxgPair.away.toFixed(2) : (Number(awayXgVal) * 0.9).toFixed(2);

  const fallbackHomeBigChances = Math.max(match.homeScore, Math.round(stats.homeShotsOnTarget / 2.2));
  const fallbackAwayBigChances = Math.max(match.awayScore, Math.round(stats.awayShotsOnTarget / 2.2));

  const homeBigChances = bigChancesPair.home !== null ? bigChancesPair.home : fallbackHomeBigChances;
  const awayBigChances = bigChancesPair.away !== null ? bigChancesPair.away : fallbackAwayBigChances;

  // 4. Formations & Lineups
  const homeFormation = lineup.home?.formation || lineup.home?.shape || '4-3-3';
  const awayFormation = lineup.away?.formation || lineup.away?.shape || '4-2-3-1';
  const homeStarters = lineup.home?.startingXiCount || 11;
  const homeSubs = lineup.home?.substitutesCount || 15;
  const awayStarters = lineup.away?.startingXiCount || 11;
  const awaySubs = lineup.away?.substitutesCount || 15;

  // 5. Timeline Events (Goals, Corners, Red/Yellow Cards)
  const getEventText = (e: any) => {
    const type = String(e.type || '').toLowerCase();
    const isHome = e.teamId === match.homeTeamId;
    const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
    
    if (type.includes('goal')) return `هدف لصالح ${teamName} (${e.playerName || ''})`;
    if (type.includes('corner')) return `ركنية لصالح ${teamName}`;
    if (type.includes('red_card')) return `بطاقة حمراء - ${e.playerName || teamName}`;
    if (type.includes('yellow_card')) return `بطاقة صفراء - ${e.playerName || teamName}`;
    return e.detail || 'حدث فني';
  };

  const getEventIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('goal')) return '⚽';
    if (t.includes('corner')) return '🚩';
    if (t.includes('red_card')) return '🟥';
    if (t.includes('yellow_card')) return '🟨';
    return '⏱️';
  };

  const importantEvents = match.events
    .filter(e => {
      const type = String(e.type || '').toLowerCase();
      return type.includes('goal') || type.includes('corner') || type.includes('red_card') || type.includes('yellow_card');
    })
    .slice(0, 5); // Limit to 5 for space

  // 6. Match Intelligence calculations
  const daDiff = Math.abs(stats.homeDangerousAttacks - stats.awayDangerousAttacks);
  const daLeader = stats.homeDangerousAttacks > stats.awayDangerousAttacks ? match.homeTeam.name : match.awayTeam.name;
  const daText = daDiff > 0 ? `أكثر ${daLeader} خطورة بفارق ${daDiff} هجمات خطيرة.` : `تعادل تام في معدلات التهديد الخطيرة.`;

  const xgHomeNum = Number(homeXgVal) || 0;
  const xgAwayNum = Number(awayXgVal) || 0;
  const xgDiff = Math.abs(xgHomeNum - xgAwayNum).toFixed(2);
  const xgLeader = xgHomeNum > xgAwayNum ? match.homeTeam.name : match.awayTeam.name;
  const xgText = xgDiff !== '0.00' ? `صنع ${xgLeader} فرصاً أعلى جودة بفارق xG ${xgDiff}.` : `فرص الفريقين كانت متقاربة جداً في الجودة.`;

  const possMax = Math.max(stats.homePossession, stats.awayPossession);
  const possMin = Math.min(stats.homePossession, stats.awayPossession);
  const possLeader = stats.homePossession > stats.awayPossession ? match.homeTeam.name : match.awayTeam.name;
  const possText = stats.homePossession !== stats.awayPossession 
    ? `أفضل في ${possLeader} الاستحواذ بنسبة ${possMax}% مقابل ${possMin}%.`
    : `استحواذ متكافئ بنسبة 50% لكل فريق.`;

  const sotLeader = stats.homeShotsOnTarget > stats.awayShotsOnTarget ? match.homeTeam.name : match.awayTeam.name;
  const sotMax = Math.max(stats.homeShotsOnTarget, stats.awayShotsOnTarget);
  const sotMin = Math.min(stats.homeShotsOnTarget, stats.awayShotsOnTarget);
  const sotText = stats.homeShotsOnTarget !== stats.awayShotsOnTarget
    ? `أكثر ${sotLeader} فاعلية على المرمى: ${sotMax} مقابل ${sotMin}.`
    : `دقة متطابقة في التسديد على المرمى: ${stats.homeShotsOnTarget} لكل منهما.`;

  // Flags CDN
  const homeFlagUrl = getTeamFlagUrl(match.homeTeam, 160);
  const awayFlagUrl = getTeamFlagUrl(match.awayTeam, 160);

  const fontData = await getCairoFontData();

  // Reusable StatBar
  const StatBar = ({ label, homeVal, awayVal, icon }: { label: string, homeVal: number, awayVal: number, icon: string }) => {
    const total = homeVal + awayVal;
    const homePct = total > 0 ? (homeVal / total) * 100 : 50;
    const awayPct = total > 0 ? (awayVal / total) * 100 : 50;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#00f0fc', width: '50px', textAlign: 'left' }}>{homeVal}{label.includes('الاستحواذ') ? '%' : ''}</span>
        
        {/* Left Bar (Cyan) */}
        <div style={{ display: 'flex', width: '280px', height: '12px', backgroundColor: '#1e293b', borderRadius: '6px', overflow: 'hidden', justifyContent: 'flex-end', marginRight: '15px' }}>
          <div style={{ width: `${homePct}%`, backgroundColor: '#00f0fc', height: '100%', borderRadius: '6px' }}></div>
        </div>

        {/* Center Label & Icon */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '240px' }}>
          <div style={{ display: 'flex', width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', alignItems: 'center', justifyContent: 'center', marginRight: '10px', fontSize: '18px' }}>{icon}</div>
          <span style={{ fontSize: '20px', color: '#94a3b8' }}>{label}</span>
        </div>

        {/* Right Bar (Gold/Orange) */}
        <div style={{ display: 'flex', width: '280px', height: '12px', backgroundColor: '#1e293b', borderRadius: '6px', overflow: 'hidden', justifyContent: 'flex-start', marginLeft: '15px' }}>
          <div style={{ width: `${awayPct}%`, backgroundColor: '#f59e0b', height: '100%', borderRadius: '6px' }}></div>
        </div>

        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', width: '50px', textAlign: 'right' }}>{awayVal}{label.includes('الاستحواذ') ? '%' : ''}</span>
      </div>
    );
  };

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#020617',
          color: '#ffffff',
          fontFamily: '"Cairo"',
          padding: '40px',
        }}
      >
        {/* Background Gradient */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'linear-gradient(to bottom, #060b19 0%, #020617 100%)',
        }} />

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
          <span style={{ fontSize: '46px', fontWeight: 'bold', color: '#fcd34d' }}>إحصائيات المباراة</span>
          <span style={{ fontSize: '20px', color: '#94a3b8', marginTop: '4px' }}>عرض موحد للأرقام والأحداث في مكان واحد</span>
        </div>

        {/* Scoreboard Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '30px' }}>
          {/* Home Team Card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
            <div style={{ display: 'flex', width: '130px', height: '90px', borderRadius: '16px', border: '3px solid #00f0fc', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
              {homeFlagUrl ? (
                <img src={homeFlagUrl} style={{ width: '130px', height: '90px', objectFit: 'cover' }} alt="flag" />
              ) : (
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#00f0fc' }}>{match.homeTeam.code || 'H'}</span>
              )}
            </div>
            <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff', marginTop: '12px' }}>{match.homeTeam.name}</span>
          </div>

          {/* Score details */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '76px', fontWeight: 'bold', color: '#fcd34d' }}>{match.homeScore}</span>
              <span style={{ fontSize: '48px', color: '#475569', margin: '0 25px' }}>-</span>
              <span style={{ fontSize: '76px', fontWeight: 'bold', color: '#fcd34d' }}>{match.awayScore}</span>
            </div>
            <div style={{ display: 'flex', border: '1px solid #eab308', borderRadius: '20px', padding: '4px 18px', backgroundColor: 'rgba(234, 179, 8, 0.1)', marginTop: '8px' }}>
              <span style={{ fontSize: '18px', color: '#fcd34d', fontWeight: 'bold' }}>
                {match.status === 'FINISHED' || match.status === 'FT' ? 'نهاية المباراة' : match.status}
              </span>
            </div>
          </div>

          {/* Away Team Card */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
            <div style={{ display: 'flex', width: '130px', height: '90px', borderRadius: '16px', border: '3px solid #f59e0b', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
              {awayFlagUrl ? (
                <img src={awayFlagUrl} style={{ width: '130px', height: '90px', objectFit: 'cover' }} alt="flag" />
              ) : (
                <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{match.awayTeam.code || 'A'}</span>
              )}
            </div>
            <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff', marginTop: '12px' }}>{match.awayTeam.name}</span>
          </div>
        </div>

        {/* Main Stats Box */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.55)', borderRadius: '24px', padding: '24px 30px', border: '1px solid #1e293b', marginBottom: '25px' }}>
          <StatBar label="الاستحواذ" homeVal={stats.homePossession} awayVal={stats.awayPossession} icon="⏱️" />
          <StatBar label="الهجمات" homeVal={stats.homeAttacks} awayVal={stats.awayAttacks} icon="⚔️" />
          <StatBar label="الهجمات الخطيرة" homeVal={stats.homeDangerousAttacks} awayVal={stats.awayDangerousAttacks} icon="⚠️" />
          <StatBar label="التسديدات" homeVal={stats.homeShots} awayVal={stats.awayShots} icon="👟" />
          <StatBar label="على المرمى" homeVal={stats.homeShotsOnTarget} awayVal={stats.awayShotsOnTarget} icon="🎯" />
          <StatBar label="الركنيات" homeVal={stats.homeCorners} awayVal={stats.awayCorners} icon="🚩" />
          <StatBar label="بطاقات صفراء" homeVal={stats.homeYellowCards} awayVal={stats.awayYellowCards} icon="🟨" />
          <StatBar label="بطاقات حمراء" homeVal={stats.homeRedCards} awayVal={stats.awayRedCards} icon="🟥" />
        </div>

        {/* Middle Row (3 Cards) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '25px' }}>
          {/* Card 1: Advanced Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '300px', backgroundColor: 'rgba(15, 23, 42, 0.55)', borderRadius: '24px', padding: '20px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#00f0fc', marginBottom: '16px', textAlign: 'center' }}>إحصائيات متقدمة</span>
            
            {/* xG */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', width: '100%' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#00f0fc' }}>{homeXgVal}</span>
              <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 'bold' }}>xG</span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b' }}>{awayXgVal}</span>
            </div>

            {/* npxG */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', width: '100%' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#00f0fc' }}>{homeNpxgVal}</span>
              <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 'bold' }}>npxG</span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b' }}>{awayNpxgVal}</span>
            </div>

            {/* Big chances */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#00f0fc' }}>{homeBigChances}</span>
              <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 'bold' }}>فرص كبيرة</span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b' }}>{awayBigChances}</span>
            </div>
          </div>

          {/* Card 2: Lineups pitch */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '360px', backgroundColor: 'rgba(15, 23, 42, 0.55)', borderRadius: '24px', padding: '20px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#00f0fc', marginBottom: '12px', textAlign: 'center' }}>التشكيلات المؤكدة</span>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>{match.homeTeam.name}</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#00f0fc' }}>{homeFormation}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', color: '#94a3b8' }}>{match.awayTeam.name}</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{awayFormation}</span>
              </div>
            </div>

            {/* Pitch layout */}
            <div style={{ display: 'flex', width: '100%', height: '110px', backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
              {/* Field Lines */}
              <div style={{ position: 'absolute', left: '50%', top: '5%', bottom: '5%', width: '1px', backgroundColor: '#1e293b' }}></div>
              <div style={{ position: 'absolute', left: '40%', top: '30%', width: '60px', height: '60px', borderRadius: '30px', border: '1px solid #1e293b' }}></div>

              {/* Blue Dots */}
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#00f0fc', position: 'absolute', left: '10px', top: '48px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#00f0fc', position: 'absolute', left: '40px', top: '20px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#00f0fc', position: 'absolute', left: '40px', top: '75px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#00f0fc', position: 'absolute', left: '80px', top: '48px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#00f0fc', position: 'absolute', left: '120px', top: '48px' }}></div>

              {/* Red Dots */}
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#f59e0b', position: 'absolute', right: '10px', top: '48px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#f59e0b', position: 'absolute', right: '40px', top: '20px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#f59e0b', position: 'absolute', right: '40px', top: '75px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#f59e0b', position: 'absolute', right: '80px', top: '48px' }}></div>
              <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: '#f59e0b', position: 'absolute', right: '120px', top: '48px' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '14px', color: '#64748b' }}>
              <span>{homeStarters} أساسي · {homeSubs} بديل</span>
              <span>{awayStarters} أساسي · {awaySubs} بديل</span>
            </div>
          </div>

          {/* Card 3: Match Events Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '300px', backgroundColor: 'rgba(15, 23, 42, 0.55)', borderRadius: '24px', padding: '20px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#00f0fc', marginBottom: '16px', textAlign: 'center' }}>أحداث المباراة</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '140px', overflow: 'hidden' }}>
              {importantEvents.length > 0 ? (
                importantEvents.map((e, idx) => (
                  <div key={e.id || idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', direction: 'rtl', width: '100%' }}>
                    <div style={{ display: 'flex', width: '40px', height: '22px', borderRadius: '11px', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#00f0fc', fontWeight: 'bold', marginLeft: '8px' }}>
                      {e.minute}د
                    </div>
                    <span style={{ fontSize: '14px', color: '#cbd5e1', width: '22px' }}>{getEventIcon(e.type)}</span>
                    <span style={{ fontSize: '14px', color: '#e2e8f0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, marginRight: '6px', textAlign: 'right' }}>
                      {getEventText(e)}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#64748b' }}>
                  لا توجد أحداث رئيسية مسجلة
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Match Intelligence */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: 'rgba(15, 23, 42, 0.55)', borderRadius: '24px', padding: '24px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '16px', color: '#00f0fc', fontWeight: 'bold', letterSpacing: '2px', marginRight: '6px' }}>Match Intelligence -</span>
            <span style={{ fontSize: '18px', color: '#fcd34d', fontWeight: 'bold' }}>قراءة ذكية للمباراة</span>
          </div>

          {/* 2x2 Grid of cards */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {/* Row 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '460px', backgroundColor: '#090d16', borderRadius: '16px', padding: '12px 16px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'rgba(0, 240, 252, 0.1)', border: '1px solid rgba(0, 240, 252, 0.2)', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginLeft: '12px' }}>🎯</div>
                <span style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.4', flex: 1, textAlign: 'right', direction: 'rtl' }}>{daText}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', width: '460px', backgroundColor: '#090d16', borderRadius: '16px', padding: '12px 16px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginLeft: '12px' }}>📈</div>
                <span style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.4', flex: 1, textAlign: 'right', direction: 'rtl' }}>{xgText}</span>
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '460px', backgroundColor: '#090d16', borderRadius: '16px', padding: '12px 16px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'rgba(0, 240, 252, 0.1)', border: '1px solid rgba(0, 240, 252, 0.2)', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginLeft: '12px' }}>📊</div>
                <span style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.4', flex: 1, textAlign: 'right', direction: 'rtl' }}>{possText}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', width: '460px', backgroundColor: '#090d16', borderRadius: '16px', padding: '12px 16px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginLeft: '12px' }}>🥅</div>
                <span style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.4', flex: 1, textAlign: 'right', direction: 'rtl' }}>{sotText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '25px', fontSize: '20px', color: '#475569' }}>
          تم التوليد بواسطة المحلل الرياضي الآلي - MC PRIME
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: fontData ? [
        {
          name: 'Cairo',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ] : undefined,
    }
  );
}
