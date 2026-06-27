import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 86400; // 1 day

// Load a font that supports Arabic. We use a CDN link for a TTF/WOFF font from Fontsource.
const fontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.3/files/cairo-arabic-700-normal.woff';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 1. Fetch match data
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      m."id", m."homeScore", m."awayScore", m."matchDate", m."status",
      home."name" AS "homeTeamName", away."name" AS "awayTeamName",
      latest."homePossession", latest."awayPossession",
      latest."homeShots", latest."awayShots",
      latest."homeShotsOnTarget", latest."awayShotsOnTarget",
      latest."homeCorners", latest."awayCorners",
      latest."homeYellowCards", latest."awayYellowCards",
      latest."homeRedCards", latest."awayRedCards",
      latest."homeAttacks", latest."awayAttacks",
      latest."homeDangerousAttacks", latest."awayDangerousAttacks"
    FROM "Match" m
    JOIN "Asset" home ON home."id" = m."homeTeamId"
    JOIN "Asset" away ON away."id" = m."awayTeamId"
    LEFT JOIN LATERAL (
      SELECT * FROM "MatchStatsSnapshot" s
      WHERE s."matchId" = m."id"
      ORDER BY s."capturedAt" DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE m."id" = $1
  `, id);

  const match = rows[0];
  if (!match) {
    return new NextResponse('Match not found', { status: 404 });
  }

  // Fallback data if stats are missing
  const stats = {
    homePossession: match.homePossession || 50,
    awayPossession: match.awayPossession || 50,
    homeShots: match.homeShots || 0,
    awayShots: match.awayShots || 0,
    homeShotsOnTarget: match.homeShotsOnTarget || 0,
    awayShotsOnTarget: match.awayShotsOnTarget || 0,
    homeCorners: match.homeCorners || 0,
    awayCorners: match.awayCorners || 0,
    homeYellowCards: match.homeYellowCards || 0,
    awayYellowCards: match.awayYellowCards || 0,
    homeRedCards: match.homeRedCards || 0,
    awayRedCards: match.awayRedCards || 0,
    homeAttacks: match.homeAttacks || 0,
    awayAttacks: match.awayAttacks || 0,
    homeDangerousAttacks: match.homeDangerousAttacks || 0,
    awayDangerousAttacks: match.awayDangerousAttacks || 0,
  };

  let fontData: ArrayBuffer | null = null;
  try {
    const fontRes = await fetch(fontUrl, { signal: AbortSignal.timeout(8000) });
    if (fontRes.ok) {
      fontData = await fontRes.arrayBuffer();
    } else {
      console.error('Font fetch failed with status:', fontRes.status);
    }
  } catch (error) {
    console.error('Error fetching font:', error);
  }

  // Function to render a stat bar
  const StatBar = ({ label, homeVal, awayVal, invertColors = false }: { label: string, homeVal: number, awayVal: number, invertColors?: boolean }) => {
    const homeValNum = Number(homeVal) || 0;
    const awayValNum = Number(awayVal) || 0;
    const total = homeValNum + awayValNum;
    const homePct = total > 0 ? (homeValNum / total) * 100 : 50;
    const awayPct = total > 0 ? (awayValNum / total) * 100 : 50;
    
    // Invert colors means Home is blue, Away is red (or vice versa). Let's use red for Home, blue for Away as a default theme.
    const homeColor = invertColors ? '#3b82f6' : '#ef4444'; // blue or red
    const awayColor = invertColors ? '#ef4444' : '#3b82f6'; // red or blue

    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '28px', color: '#fff', fontWeight: 700 }}>
          <span style={{ color: homeColor }}>{homeVal}{label.includes('استحواذ') ? '%' : ''}</span>
          <span>{label}</span>
          <span style={{ color: awayColor }}>{awayVal}{label.includes('استحواذ') ? '%' : ''}</span>
        </div>
        <div style={{ display: 'flex', width: '100%', height: '16px', backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: `${homePct}%`, backgroundColor: homeColor, height: '100%' }}></div>
          <div style={{ display: 'flex', width: `${awayPct}%`, backgroundColor: awayColor, height: '100%' }}></div>
        </div>
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
          backgroundColor: '#020617', // Very dark blue/black
          color: '#ffffff',
          fontFamily: '"Cairo"',
          padding: '60px',
        }}
      >
        {/* Background Grid Pattern (simulated with border) */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'linear-gradient(to bottom, #1e293b, #020617)',
        }} />

        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#ef4444', marginBottom: '16px' }}>{match.homeTeamName}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%' }}>
            <div style={{ fontSize: '32px', color: '#94a3b8', marginBottom: '12px' }}>إحصائيات المباراة</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: '20px 40px', borderRadius: '24px', border: '2px solid #334155' }}>
              <span style={{ fontSize: '72px', fontWeight: 'bold', color: '#ef4444' }}>{match.homeScore ?? 0}</span>
              <span style={{ fontSize: '48px', color: '#64748b', margin: '0 30px' }}>-</span>
              <span style={{ fontSize: '72px', fontWeight: 'bold', color: '#3b82f6' }}>{match.awayScore ?? 0}</span>
            </div>
            <div style={{ fontSize: '24px', color: '#cbd5e1', marginTop: '16px' }}>{match.status}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '16px' }}>{match.awayTeamName}</div>
          </div>
        </div>

        {/* Main Stats Columns */}
        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between' }}>
          {/* Left Column (Stats Bars) */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: '#0f172a', borderRadius: '32px', padding: '40px', border: '1px solid #1e293b' }}>
            <StatBar label="الاستحواذ" homeVal={stats.homePossession} awayVal={stats.awayPossession} />
            <StatBar label="الهجمات" homeVal={stats.homeAttacks} awayVal={stats.awayAttacks} />
            <StatBar label="الهجمات الخطيرة" homeVal={stats.homeDangerousAttacks} awayVal={stats.awayDangerousAttacks} />
            <StatBar label="إجمالي التسديدات" homeVal={stats.homeShots} awayVal={stats.awayShots} />
            <StatBar label="التسديد على المرمى" homeVal={stats.homeShotsOnTarget} awayVal={stats.awayShotsOnTarget} />
            <StatBar label="الركنيات" homeVal={stats.homeCorners} awayVal={stats.awayCorners} />
            <StatBar label="البطاقات الصفراء" homeVal={stats.homeYellowCards} awayVal={stats.awayYellowCards} invertColors={true} />
            <StatBar label="البطاقات الحمراء" homeVal={stats.homeRedCards} awayVal={stats.awayRedCards} invertColors={true} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', fontSize: '24px', color: '#64748b' }}>
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
