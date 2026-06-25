export type TeamLike = {
  code?: string | null;
  name?: string | null;
  image?: string | null;
  type?: string | null;
};

type TeamDisplay = {
  code: string;
  flag: string;
  arabicName: string;
};

const TEAMS: Record<string, TeamDisplay> = {
  MEX: { code: 'MEX', flag: '🇲🇽', arabicName: 'المكسيك' },
  RSA: { code: 'RSA', flag: '🇿🇦', arabicName: 'جنوب أفريقيا' },
  KOR: { code: 'KOR', flag: '🇰🇷', arabicName: 'كوريا الجنوبية' },
  CZE: { code: 'CZE', flag: '🇨🇿', arabicName: 'التشيك' },
  CAN: { code: 'CAN', flag: '🇨🇦', arabicName: 'كندا' },
  BIH: { code: 'BIH', flag: '🇧🇦', arabicName: 'البوسنة والهرسك' },
  QAT: { code: 'QAT', flag: '🇶🇦', arabicName: 'قطر' },
  SUI: { code: 'SUI', flag: '🇨🇭', arabicName: 'سويسرا' },
  BRA: { code: 'BRA', flag: '🇧🇷', arabicName: 'البرازيل' },
  MAR: { code: 'MAR', flag: '🇲🇦', arabicName: 'المغرب' },
  HTI: { code: 'HTI', flag: '🇭🇹', arabicName: 'هايتي' },
  SCO: { code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', arabicName: 'اسكتلندا' },
  USA: { code: 'USA', flag: '🇺🇸', arabicName: 'الولايات المتحدة' },
  PAR: { code: 'PAR', flag: '🇵🇾', arabicName: 'باراغواي' },
  AUS: { code: 'AUS', flag: '🇦🇺', arabicName: 'أستراليا' },
  TUR: { code: 'TUR', flag: '🇹🇷', arabicName: 'تركيا' },
  GER: { code: 'GER', flag: '🇩🇪', arabicName: 'ألمانيا' },
  CUW: { code: 'CUW', flag: '🇨🇼', arabicName: 'كوراساو' },
  CIV: { code: 'CIV', flag: '🇨🇮', arabicName: 'ساحل العاج' },
  ECU: { code: 'ECU', flag: '🇪🇨', arabicName: 'الإكوادور' },
  NED: { code: 'NED', flag: '🇳🇱', arabicName: 'هولندا' },
  JPN: { code: 'JPN', flag: '🇯🇵', arabicName: 'اليابان' },
  SWE: { code: 'SWE', flag: '🇸🇪', arabicName: 'السويد' },
  TUN: { code: 'TUN', flag: '🇹🇳', arabicName: 'تونس' },
  BEL: { code: 'BEL', flag: '🇧🇪', arabicName: 'بلجيكا' },
  EGY: { code: 'EGY', flag: '🇪🇬', arabicName: 'مصر' },
  IRN: { code: 'IRN', flag: '🇮🇷', arabicName: 'إيران' },
  IRI: { code: 'IRI', flag: '🇮🇷', arabicName: 'إيران' },
  NZL: { code: 'NZL', flag: '🇳🇿', arabicName: 'نيوزيلندا' },
  ESP: { code: 'ESP', flag: '🇪🇸', arabicName: 'إسبانيا' },
  CPV: { code: 'CPV', flag: '🇨🇻', arabicName: 'الرأس الأخضر' },
  KSA: { code: 'KSA', flag: '🇸🇦', arabicName: 'السعودية' },
  URU: { code: 'URU', flag: '🇺🇾', arabicName: 'أوروغواي' },
  FRA: { code: 'FRA', flag: '🇫🇷', arabicName: 'فرنسا' },
  SEN: { code: 'SEN', flag: '🇸🇳', arabicName: 'السنغال' },
  IRQ: { code: 'IRQ', flag: '🇮🇶', arabicName: 'العراق' },
  NOR: { code: 'NOR', flag: '🇳🇴', arabicName: 'النرويج' },
  ARG: { code: 'ARG', flag: '🇦🇷', arabicName: 'الأرجنتين' },
  DZA: { code: 'DZA', flag: '🇩🇿', arabicName: 'الجزائر' },
  ALG: { code: 'ALG', flag: '🇩🇿', arabicName: 'الجزائر' },
  AUT: { code: 'AUT', flag: '🇦🇹', arabicName: 'النمسا' },
  JOR: { code: 'JOR', flag: '🇯🇴', arabicName: 'الأردن' },
  POR: { code: 'POR', flag: '🇵🇹', arabicName: 'البرتغال' },
  COD: { code: 'COD', flag: '🇨🇩', arabicName: 'الكونغو الديمقراطية' },
  DRC: { code: 'DRC', flag: '🇨🇩', arabicName: 'الكونغو الديمقراطية' },
  UZB: { code: 'UZB', flag: '🇺🇿', arabicName: 'أوزبكستان' },
  COL: { code: 'COL', flag: '🇨🇴', arabicName: 'كولومبيا' },
  ENG: { code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', arabicName: 'إنجلترا' },
  CRO: { code: 'CRO', flag: '🇭🇷', arabicName: 'كرواتيا' },
  GHA: { code: 'GHA', flag: '🇬🇭', arabicName: 'غانا' },
  PAN: { code: 'PAN', flag: '🇵🇦', arabicName: 'بنما' },
};

const NAME_TO_CODE: Array<[string, string]> = [
  ['mexico', 'MEX'], ['south africa', 'RSA'], ['south korea', 'KOR'], ['korea republic', 'KOR'], ['czechia', 'CZE'], ['czech republic', 'CZE'],
  ['canada', 'CAN'], ['bosnia', 'BIH'], ['qatar', 'QAT'], ['switzerland', 'SUI'], ['brazil', 'BRA'], ['morocco', 'MAR'], ['haiti', 'HTI'], ['scotland', 'SCO'],
  ['united states', 'USA'], ['usa', 'USA'], ['paraguay', 'PAR'], ['australia', 'AUS'], ['turkey', 'TUR'], ['türkiye', 'TUR'],
  ['germany', 'GER'], ['curacao', 'CUW'], ['curaçao', 'CUW'], ['ivory coast', 'CIV'], ['côte d’ivoire', 'CIV'], ['cote d', 'CIV'], ['ecuador', 'ECU'],
  ['netherlands', 'NED'], ['holland', 'NED'], ['japan', 'JPN'], ['sweden', 'SWE'], ['tunisia', 'TUN'], ['belgium', 'BEL'], ['egypt', 'EGY'],
  ['iran', 'IRI'], ['new zealand', 'NZL'], ['spain', 'ESP'], ['cape verde', 'CPV'], ['saudi', 'KSA'], ['uruguay', 'URU'], ['france', 'FRA'],
  ['senegal', 'SEN'], ['iraq', 'IRQ'], ['norway', 'NOR'], ['argentina', 'ARG'], ['algeria', 'DZA'], ['austria', 'AUT'], ['jordan', 'JOR'],
  ['portugal', 'POR'], ['dr congo', 'COD'], ['congo dr', 'COD'], ['congo democratic', 'COD'], ['uzbekistan', 'UZB'], ['colombia', 'COL'],
  ['england', 'ENG'], ['croatia', 'CRO'], ['ghana', 'GHA'], ['panama', 'PAN'],
];

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function getTeamDisplay(code?: string | null, name?: string | null): TeamDisplay {
  const codeKey = String(code || '').trim().toUpperCase();
  if (TEAMS[codeKey]) return TEAMS[codeKey];

  const normalizedName = normalize(name);
  const match = NAME_TO_CODE.find(([needle]) => normalizedName.includes(needle));
  if (match && TEAMS[match[1]]) return TEAMS[match[1]];

  return { code: codeKey || 'TEAM', flag: '🏳️', arabicName: String(name || code || 'منتخب') };
}

export function getArabicTeamName(code?: string | null, name?: string | null) {
  return getTeamDisplay(code, name).arabicName;
}

export function getTeamFlag(code?: string | null, name?: string | null) {
  return getTeamDisplay(code, name).flag;
}

export function formatTeamDisplay(team: TeamLike) {
  const display = getTeamDisplay(team.code, team.name);
  return `${display.flag} ${display.arabicName}`;
}

export function withTeamDisplay<T extends TeamLike>(team: T): T & { arabicName: string; flagEmoji: string; displayName: string; originalName: string | null | undefined } {
  const display = getTeamDisplay(team.code, team.name);
  const displayName = `${display.flag} ${display.arabicName}`;
  return {
    ...team,
    name: displayName,
    arabicName: display.arabicName,
    flagEmoji: display.flag,
    displayName,
    originalName: team.name,
  };
}

export function withTeamDisplays<T extends TeamLike>(teams: T[]) {
  return teams.map((team) => withTeamDisplay(team));
}

export function publicTeamName(team: TeamLike) {
  return formatTeamDisplay(team);
}
