export const WORLD_CUP_2026_GROUPS = {
  A: { arName: 'الأولى', teams: [
    { name: 'المكسيك', codes: ['MEX'] },
    { name: 'جنوب أفريقيا', codes: ['ZAF', 'RSA'] },
    { name: 'كوريا الجنوبية', codes: ['KOR'] },
    { name: 'التشيك', codes: ['CZE'] },
  ] },
  B: { arName: 'الثانية', teams: [
    { name: 'كندا', codes: ['CAN'] },
    { name: 'البوسنة والهرسك', codes: ['BIH', 'BOS'] },
    { name: 'قطر', codes: ['QAT'] },
    { name: 'سويسرا', codes: ['SUI', 'CHE'] },
  ] },
  C: { arName: 'الثالثة', teams: [
    { name: 'البرازيل', codes: ['BRA'] },
    { name: 'المغرب', codes: ['MAR'] },
    { name: 'هايتي', codes: ['HAI'] },
    { name: 'اسكتلندا', codes: ['SCO'] },
  ] },
  D: { arName: 'الرابعة', teams: [
    { name: 'الولايات المتحدة', codes: ['USA', 'USMNT'] },
    { name: 'باراغواي', codes: ['PAR'] },
    { name: 'أستراليا', codes: ['AUS'] },
    { name: 'تركيا', codes: ['TUR'] },
  ] },
  E: { arName: 'الخامسة', teams: [
    { name: 'ألمانيا', codes: ['GER', 'DE'] },
    { name: 'كوراساو', codes: ['CUW', 'CW'] },
    { name: 'الإكوادور', codes: ['ECU'] },
    { name: 'كوت ديفوار', codes: ['CIV'] },
  ] },
  F: { arName: 'السادسة', teams: [
    { name: 'هولندا', codes: ['NED', 'NLD'] },
    { name: 'اليابان', codes: ['JPN'] },
    { name: 'السويد', codes: ['SWE'] },
    { name: 'تونس', codes: ['TUN'] },
  ] },
  G: { arName: 'السابعة', teams: [
    { name: 'بلجيكا', codes: ['BEL'] },
    { name: 'مصر', codes: ['EGY'] },
    { name: 'إيران', codes: ['IRN'] },
    { name: 'نيوزيلندا', codes: ['NZL'] },
  ] },
  H: { arName: 'الثامنة', teams: [
    { name: 'إسبانيا', codes: ['ESP'] },
    { name: 'الرأس الأخضر', codes: ['CPV', 'CV'] },
    { name: 'السعودية', codes: ['KSA', 'SA'] },
    { name: 'أوروغواي', codes: ['URU'] },
  ] },
  I: { arName: 'التاسعة', teams: [
    { name: 'فرنسا', codes: ['FRA'] },
    { name: 'السنغال', codes: ['SEN'] },
    { name: 'العراق', codes: ['IRQ'] },
    { name: 'النرويج', codes: ['NOR'] },
  ] },
  J: { arName: 'العاشرة', teams: [
    { name: 'الأرجنتين', codes: ['ARG'] },
    { name: 'الجزائر', codes: ['ALG', 'DZA'] },
    { name: 'النمسا', codes: ['AUT'] },
    { name: 'الأردن', codes: ['JOR'] },
  ] },
  K: { arName: 'الحادية عشرة', teams: [
    { name: 'البرتغال', codes: ['POR'] },
    { name: 'الكونغو الديمقراطية', codes: ['COD', 'DRC', 'CD'] },
    { name: 'أوزبكستان', codes: ['UZB'] },
    { name: 'كولومبيا', codes: ['COL'] },
  ] },
  L: { arName: 'الثانية عشرة', teams: [
    { name: 'إنجلترا', codes: ['ENG'] },
    { name: 'كرواتيا', codes: ['CRO'] },
    { name: 'غانا', codes: ['GHA'] },
    { name: 'بنما', codes: ['PAN'] },
  ] },
} as const;

export type WorldCup2026GroupKey = keyof typeof WORLD_CUP_2026_GROUPS;

export function getWorldCup2026GroupKey(value?: string | null): WorldCup2026GroupKey {
  const group = String(value || 'A').trim().toUpperCase();
  if (group in WORLD_CUP_2026_GROUPS) return group as WorldCup2026GroupKey;
  return 'A';
}

export function getAllWorldCup2026Codes(group: WorldCup2026GroupKey) {
  return WORLD_CUP_2026_GROUPS[group].teams.flatMap((team) => team.codes);
}
