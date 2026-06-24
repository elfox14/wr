export type TeamVisualTheme = {
  code: string;
  flagEmoji: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  crowdPrimary: string;
  crowdSecondary: string;
  shirtPrimary: string;
  shirtSecondary: string;
};

const DEFAULT_THEME: TeamVisualTheme = {
  code: 'TEAM',
  flagEmoji: '🏳️',
  primaryColor: '#E5E7EB',
  secondaryColor: '#94A3B8',
  accentColor: '#18E58F',
  crowdPrimary: '#E5E7EB',
  crowdSecondary: '#94A3B8',
  shirtPrimary: '#E5E7EB',
  shirtSecondary: '#111827',
};

const THEMES: Record<string, TeamVisualTheme> = {
  EGY: { code: 'EGY', flagEmoji: '🇪🇬', primaryColor: '#CE1126', secondaryColor: '#FFFFFF', accentColor: '#111111', crowdPrimary: '#CE1126', crowdSecondary: '#FFFFFF', shirtPrimary: '#CE1126', shirtSecondary: '#FFFFFF' },
  NZL: { code: 'NZL', flagEmoji: '🇳🇿', primaryColor: '#111111', secondaryColor: '#FFFFFF', accentColor: '#D4AF37', crowdPrimary: '#111111', crowdSecondary: '#FFFFFF', shirtPrimary: '#111111', shirtSecondary: '#FFFFFF' },
  MEX: { code: 'MEX', flagEmoji: '🇲🇽', primaryColor: '#006847', secondaryColor: '#FFFFFF', accentColor: '#CE1126', crowdPrimary: '#006847', crowdSecondary: '#CE1126', shirtPrimary: '#006847', shirtSecondary: '#FFFFFF' },
  BRA: { code: 'BRA', flagEmoji: '🇧🇷', primaryColor: '#FFDF00', secondaryColor: '#009C3B', accentColor: '#002776', crowdPrimary: '#FFDF00', crowdSecondary: '#009C3B', shirtPrimary: '#FFDF00', shirtSecondary: '#009C3B' },
  ARG: { code: 'ARG', flagEmoji: '🇦🇷', primaryColor: '#75AADB', secondaryColor: '#FFFFFF', accentColor: '#F6B40E', crowdPrimary: '#75AADB', crowdSecondary: '#FFFFFF', shirtPrimary: '#75AADB', shirtSecondary: '#FFFFFF' },
  FRA: { code: 'FRA', flagEmoji: '🇫🇷', primaryColor: '#1D4ED8', secondaryColor: '#FFFFFF', accentColor: '#EF4444', crowdPrimary: '#1D4ED8', crowdSecondary: '#FFFFFF', shirtPrimary: '#1D4ED8', shirtSecondary: '#FFFFFF' },
  ENG: { code: 'ENG', flagEmoji: '🏴', primaryColor: '#FFFFFF', secondaryColor: '#DC2626', accentColor: '#111827', crowdPrimary: '#FFFFFF', crowdSecondary: '#DC2626', shirtPrimary: '#FFFFFF', shirtSecondary: '#DC2626' },
  POR: { code: 'POR', flagEmoji: '🇵🇹', primaryColor: '#C8102E', secondaryColor: '#006A4E', accentColor: '#FFCC00', crowdPrimary: '#C8102E', crowdSecondary: '#006A4E', shirtPrimary: '#C8102E', shirtSecondary: '#006A4E' },
  ESP: { code: 'ESP', flagEmoji: '🇪🇸', primaryColor: '#AA151B', secondaryColor: '#F1BF00', accentColor: '#111827', crowdPrimary: '#AA151B', crowdSecondary: '#F1BF00', shirtPrimary: '#AA151B', shirtSecondary: '#F1BF00' },
  GER: { code: 'GER', flagEmoji: '🇩🇪', primaryColor: '#FFFFFF', secondaryColor: '#111111', accentColor: '#DD0000', crowdPrimary: '#FFFFFF', crowdSecondary: '#111111', shirtPrimary: '#FFFFFF', shirtSecondary: '#111111' },
  JPN: { code: 'JPN', flagEmoji: '🇯🇵', primaryColor: '#1D4ED8', secondaryColor: '#FFFFFF', accentColor: '#BC002D', crowdPrimary: '#1D4ED8', crowdSecondary: '#FFFFFF', shirtPrimary: '#1D4ED8', shirtSecondary: '#FFFFFF' },
  TUN: { code: 'TUN', flagEmoji: '🇹🇳', primaryColor: '#E70013', secondaryColor: '#FFFFFF', accentColor: '#111827', crowdPrimary: '#E70013', crowdSecondary: '#FFFFFF', shirtPrimary: '#E70013', shirtSecondary: '#FFFFFF' },
  MAR: { code: 'MAR', flagEmoji: '🇲🇦', primaryColor: '#C1272D', secondaryColor: '#006233', accentColor: '#FFFFFF', crowdPrimary: '#C1272D', crowdSecondary: '#006233', shirtPrimary: '#C1272D', shirtSecondary: '#006233' },
  KSA: { code: 'KSA', flagEmoji: '🇸🇦', primaryColor: '#006C35', secondaryColor: '#FFFFFF', accentColor: '#111827', crowdPrimary: '#006C35', crowdSecondary: '#FFFFFF', shirtPrimary: '#006C35', shirtSecondary: '#FFFFFF' },
  USA: { code: 'USA', flagEmoji: '🇺🇸', primaryColor: '#1F4E79', secondaryColor: '#FFFFFF', accentColor: '#B22234', crowdPrimary: '#1F4E79', crowdSecondary: '#B22234', shirtPrimary: '#FFFFFF', shirtSecondary: '#1F4E79' },
  CAN: { code: 'CAN', flagEmoji: '🇨🇦', primaryColor: '#D52B1E', secondaryColor: '#FFFFFF', accentColor: '#111827', crowdPrimary: '#D52B1E', crowdSecondary: '#FFFFFF', shirtPrimary: '#D52B1E', shirtSecondary: '#FFFFFF' },
  BEL: { code: 'BEL', flagEmoji: '🇧🇪', primaryColor: '#EF3340', secondaryColor: '#FAE042', accentColor: '#111111', crowdPrimary: '#EF3340', crowdSecondary: '#111111', shirtPrimary: '#EF3340', shirtSecondary: '#111111' },
  IRN: { code: 'IRN', flagEmoji: '🇮🇷', primaryColor: '#FFFFFF', secondaryColor: '#239F40', accentColor: '#DA0000', crowdPrimary: '#FFFFFF', crowdSecondary: '#239F40', shirtPrimary: '#FFFFFF', shirtSecondary: '#DA0000' },
  IRI: { code: 'IRI', flagEmoji: '🇮🇷', primaryColor: '#FFFFFF', secondaryColor: '#239F40', accentColor: '#DA0000', crowdPrimary: '#FFFFFF', crowdSecondary: '#239F40', shirtPrimary: '#FFFFFF', shirtSecondary: '#DA0000' },
};

export function getTeamVisualTheme(code?: string | null, name?: string | null): TeamVisualTheme {
  const key = String(code || '').toUpperCase();
  if (THEMES[key]) return THEMES[key];

  const normalizedName = String(name || '').toLowerCase();
  if (normalizedName.includes('egypt')) return THEMES.EGY;
  if (normalizedName.includes('new zealand')) return THEMES.NZL;
  if (normalizedName.includes('brazil')) return THEMES.BRA;
  if (normalizedName.includes('argentina')) return THEMES.ARG;

  return { ...DEFAULT_THEME, code: key || 'TEAM' };
}
