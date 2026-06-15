export const WORLD_CUP_2026_GROUPS = {
  A: { arName: 'الأولى', teams: [
    { name: 'المكسيك', arName: 'المكسيك', codes: ['MEX'] },
    { name: 'جنوب أفريقيا', arName: 'جنوب أفريقيا', codes: ['ZAF', 'RSA'] },
    { name: 'كوريا الجنوبية', arName: 'كوريا الجنوبية', codes: ['KOR'] },
    { name: 'التشيك', arName: 'التشيك', codes: ['CZE'] },
  ] },
  B: { arName: 'الثانية', teams: [
    { name: 'كندا', arName: 'كندا', codes: ['CAN'] },
    { name: 'البوسنة والهرسك', arName: 'البوسنة والهرسك', codes: ['BIH', 'BOS'] },
    { name: 'قطر', arName: 'قطر', codes: ['QAT'] },
    { name: 'سويسرا', arName: 'سويسرا', codes: ['SUI', 'CHE'] },
  ] },
  C: { arName: 'الثالثة', teams: [
    { name: 'البرازيل', arName: 'البرازيل', codes: ['BRA'] },
    { name: 'المغرب', arName: 'المغرب', codes: ['MAR'] },
    { name: 'هايتي', arName: 'هايتي', codes: ['HAI'] },
    { name: 'اسكتلندا', arName: 'اسكتلندا', codes: ['SCO'] },
  ] },
  D: { arName: 'الرابعة', teams: [
    { name: 'الولايات المتحدة', arName: 'الولايات المتحدة', codes: ['USA', 'USMNT'] },
    { name: 'باراغواي', arName: 'باراغواي', codes: ['PAR'] },
    { name: 'أستراليا', arName: 'أستراليا', codes: ['AUS'] },
    { name: 'تركيا', arName: 'تركيا', codes: ['TUR'] },
  ] },
  E: { arName: 'الخامسة', teams: [
    { name: 'ألمانيا', arName: 'ألمانيا', codes: ['GER', 'DE'] },
    { name: 'كوراساو', arName: 'كوراساو', codes: ['CUW', 'CW'] },
    { name: 'الإكوادور', arName: 'الإكوادور', codes: ['ECU'] },
    { name: 'كوت ديفوار', arName: 'كوت ديفوار', codes: ['CIV'] },
  ] },
  F: { arName: 'السادسة', teams: [
    { name: 'هولندا', arName: 'هولندا', codes: ['NED', 'NLD'] },
    { name: 'اليابان', arName: 'اليابان', codes: ['JPN'] },
    { name: 'السويد', arName: 'السويد', codes: ['SWE'] },
    { name: 'تونس', arName: 'تونس', codes: ['TUN'] },
  ] },
  G: { arName: 'السابعة', teams: [
    { name: 'بلجيكا', arName: 'بلجيكا', codes: ['BEL'] },
    { name: 'مصر', arName: 'مصر', codes: ['EGY'] },
    { name: 'إيران', arName: 'إيران', codes: ['IRN'] },
    { name: 'نيوزيلندا', arName: 'نيوزيلندا', codes: ['NZL'] },
  ] },
  H: { arName: 'الثامنة', teams: [
    { name: 'إسبانيا', arName: 'إسبانيا', codes: ['ESP'] },
    { name: 'الرأس الأخضر', arName: 'الرأس الأخضر', codes: ['CPV', 'CV'] },
    { name: 'السعودية', arName: 'السعودية', codes: ['KSA', 'SA'] },
    { name: 'أوروغواي', arName: 'أوروغواي', codes: ['URU', 'UY', 'UR', 'URY', 'URUGUAY'] },
  ] },
  I: { arName: 'التاسعة', teams: [
    { name: 'فرنسا', arName: 'فرنسا', codes: ['FRA'] },
    { name: 'السنغال', arName: 'السنغال', codes: ['SEN'] },
    { name: 'العراق', arName: 'العراق', codes: ['IRQ'] },
    { name: 'النرويج', arName: 'النرويج', codes: ['NOR'] },
  ] },
  J: { arName: 'العاشرة', teams: [
    { name: 'الأرجنتين', arName: 'الأرجنتين', codes: ['ARG'] },
    { name: 'الجزائر', arName: 'الجزائر', codes: ['ALG', 'DZA'] },
    { name: 'النمسا', arName: 'النمسا', codes: ['AUT'] },
    { name: 'الأردن', arName: 'الأردن', codes: ['JOR'] },
  ] },
  K: { arName: 'الحادية عشرة', teams: [
    { name: 'البرتغال', arName: 'البرتغال', codes: ['POR'] },
    { name: 'الكونغو الديمقراطية', arName: 'الكونغو الديمقراطية', codes: ['COD', 'DRC', 'CD'] },
    { name: 'أوزبكستان', arName: 'أوزبكستان', codes: ['UZB'] },
    { name: 'كولومبيا', arName: 'كولومبيا', codes: ['COL'] },
  ] },
  L: { arName: 'الثانية عشرة', teams: [
    { name: 'إنجلترا', arName: 'إنجلترا', codes: ['ENG'] },
    { name: 'كرواتيا', arName: 'كرواتيا', codes: ['CRO'] },
    { name: 'غانا', arName: 'غانا', codes: ['GHA'] },
    { name: 'بنما', arName: 'بنما', codes: ['PAN'] },
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
