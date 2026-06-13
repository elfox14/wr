export const REAL_WORLD_CUP_HISTORY: Record<string, { appearances: number; bestFinish: string; totalMatches: number; wins: number; draws: number; losses: number; goalsFor?: number; }> = {
  'البرازيل': { appearances: 22, bestFinish: 'البطل (5 مرات)', totalMatches: 114, wins: 76, draws: 19, losses: 19, goalsFor: 237 },
  'ألمانيا': { appearances: 20, bestFinish: 'البطل (4 مرات)', totalMatches: 112, wins: 68, draws: 21, losses: 23, goalsFor: 232 },
  'الأرجنتين': { appearances: 18, bestFinish: 'البطل (3 مرات)', totalMatches: 88, wins: 47, draws: 17, losses: 24, goalsFor: 149 },
  'إيطاليا': { appearances: 18, bestFinish: 'البطل (4 مرات)', totalMatches: 83, wins: 45, draws: 21, losses: 17, goalsFor: 128 },
  'فرنسا': { appearances: 16, bestFinish: 'البطل (مرتان)', totalMatches: 73, wins: 39, draws: 14, losses: 20, goalsFor: 136 },
  'إنجلترا': { appearances: 16, bestFinish: 'البطل (1966)', totalMatches: 74, wins: 32, draws: 22, losses: 20, goalsFor: 104 },
  'إسبانيا': { appearances: 16, bestFinish: 'البطل (2010)', totalMatches: 67, wins: 31, draws: 17, losses: 19, goalsFor: 108 },
  'هولندا': { appearances: 11, bestFinish: 'الوصيف (3 مرات)', totalMatches: 55, wins: 30, draws: 14, losses: 11, goalsFor: 96 },
  'أوروغواي': { appearances: 14, bestFinish: 'البطل (مرتان)', totalMatches: 59, wins: 25, draws: 13, losses: 21, goalsFor: 89 },
  'البرتغال': { appearances: 8, bestFinish: 'المركز الثالث (1966)', totalMatches: 35, wins: 17, draws: 6, losses: 12, goalsFor: 61 },
  'بلجيكا': { appearances: 14, bestFinish: 'المركز الثالث (2018)', totalMatches: 51, wins: 21, draws: 10, losses: 20, goalsFor: 69 },
  'المغرب': { appearances: 6, bestFinish: 'المركز الرابع (2022)', totalMatches: 23, wins: 7, draws: 7, losses: 9, goalsFor: 20 },
  'السعودية': { appearances: 6, bestFinish: 'دور الـ 16 (1994)', totalMatches: 19, wins: 4, draws: 2, losses: 13, goalsFor: 14 },
  'كرواتيا': { appearances: 6, bestFinish: 'الوصيف (2018)', totalMatches: 30, wins: 13, draws: 8, losses: 9, goalsFor: 43 },
};

export function getRealWorldCupData(teamName: string) {
  // Try exact match
  if (REAL_WORLD_CUP_HISTORY[teamName]) return REAL_WORLD_CUP_HISTORY[teamName];
  // Try finding by inclusion (e.g. "منتخب البرازيل" contains "البرازيل")
  for (const [key, val] of Object.entries(REAL_WORLD_CUP_HISTORY)) {
    if (teamName.includes(key)) return val;
  }
  return null;
}
