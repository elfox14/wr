type TeamIdentity = {
  code?: string | null;
  name?: string | null;
  continent?: string | null;
  image?: string | null;
};

const FIFA_TO_ISO2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', ALG: 'DZ', AND: 'AD', ANG: 'AO', ARG: 'AR', ARM: 'AM', ARU: 'AW', AUS: 'AU', AUT: 'AT', AZE: 'AZ',
  BAH: 'BS', BAN: 'BD', BAR: 'BB', BEL: 'BE', BEN: 'BJ', BFA: 'BF', BHR: 'BH', BIH: 'BA', BLR: 'BY', BOL: 'BO', BOT: 'BW', BRA: 'BR', BRB: 'BB', BRN: 'BN', BUL: 'BG',
  CAM: 'KH', CAN: 'CA', CAY: 'KY', CHA: 'TD', CHI: 'CL', CHN: 'CN', CIV: 'CI', CMR: 'CM', COD: 'CD', COG: 'CG', COL: 'CO', COM: 'KM', CPV: 'CV', CRC: 'CR', CRO: 'HR', CUB: 'CU', CUW: 'CW', CYP: 'CY', CZE: 'CZ',
  DEN: 'DK', DJI: 'DJ', DOM: 'DO', ECU: 'EC', EGY: 'EG', EQG: 'GQ', ERI: 'ER', ESP: 'ES', EST: 'EE', ETH: 'ET', FIN: 'FI', FRA: 'FR', GAB: 'GA', GAM: 'GM', GEO: 'GE', GER: 'DE', GHA: 'GH', GRE: 'GR', GRN: 'GD', GUA: 'GT', GUI: 'GN', GNB: 'GW', GUY: 'GY',
  HAI: 'HT', HON: 'HN', HUN: 'HU', IDN: 'ID', IND: 'IN', IRL: 'IE', IRN: 'IR', IRQ: 'IQ', ISL: 'IS', ISR: 'IL', ITA: 'IT', JAM: 'JM', JOR: 'JO', JPN: 'JP', KAZ: 'KZ', KEN: 'KE', KGZ: 'KG', KOR: 'KR', KSA: 'SA', KUW: 'KW',
  LAO: 'LA', LBN: 'LB', LBR: 'LR', LBY: 'LY', LIE: 'LI', LTU: 'LT', LUX: 'LU', LVA: 'LV', MAR: 'MA', MAS: 'MY', MDA: 'MD', MDV: 'MV', MEX: 'MX', MKD: 'MK', MLI: 'ML', MLT: 'MT', MNE: 'ME', MON: 'MN', MOZ: 'MZ', MTN: 'MR', MRI: 'MU',
  NAM: 'NA', NED: 'NL', NEP: 'NP', NGA: 'NG', NIG: 'NE', NIR: 'GB-NIR', NOR: 'NO', NZL: 'NZ', OMA: 'OM', PAK: 'PK', PAN: 'PA', PAR: 'PY', PER: 'PE', PHI: 'PH', PNG: 'PG', POL: 'PL', POR: 'PT', PRK: 'KP', PUR: 'PR', QAT: 'QA', ROU: 'RO', RSA: 'ZA', RUS: 'RU', RWA: 'RW',
  SCO: 'GB-SCT', SEN: 'SN', SEY: 'SC', SIN: 'SG', SLV: 'SV', SMR: 'SM', SRB: 'RS', SRI: 'LK', SUI: 'CH', SUR: 'SR', SVK: 'SK', SVN: 'SI', SWE: 'SE', SYR: 'SY', TAN: 'TZ', THA: 'TH', TJK: 'TJ', TOG: 'TG', TRI: 'TT', TUN: 'TN', TUR: 'TR', TPE: 'TW',
  UAE: 'AE', UGA: 'UG', UKR: 'UA', URU: 'UY', USA: 'US', UZB: 'UZ', VEN: 'VE', VIE: 'VN', WAL: 'GB-WLS', ZAM: 'ZM', ZIM: 'ZW', ENG: 'GB-ENG',
};

const SPECIAL_FLAG_EMOJI_BY_CODE: Record<string, string> = {
  ENG: '🏴',
  NIR: '🇬🇧',
  SCO: '🏴',
  WAL: '🏴',
};

const NAME_TO_ISO2: Record<string, string> = {
  'afghanistan': 'AF',
  'albania': 'AL',
  'algeria': 'DZ',
  'angola': 'AO',
  'argentina': 'AR',
  'australia': 'AU',
  'austria': 'AT',
  'belgium': 'BE',
  'bolivia': 'BO',
  'bosnia and herzegovina': 'BA',
  'brazil': 'BR',
  'bulgaria': 'BG',
  'burkina faso': 'BF',
  'cameroon': 'CM',
  'canada': 'CA',
  'cape verde': 'CV',
  'chile': 'CL',
  'china': 'CN',
  'colombia': 'CO',
  'costa rica': 'CR',
  'croatia': 'HR',
  'curacao': 'CW',
  'curaçao': 'CW',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'denmark': 'DK',
  'ecuador': 'EC',
  'egypt': 'EG',
  'england': 'GB-ENG',
  'france': 'FR',
  'germany': 'DE',
  'ghana': 'GH',
  'greece': 'GR',
  'honduras': 'HN',
  'hungary': 'HU',
  'iceland': 'IS',
  'india': 'IN',
  'iran': 'IR',
  'iraq': 'IQ',
  'italy': 'IT',
  'ivory coast': 'CI',
  "cote d'ivoire": 'CI',
  'côte d’ivoire': 'CI',
  'jamaica': 'JM',
  'japan': 'JP',
  'jordan': 'JO',
  'mexico': 'MX',
  'morocco': 'MA',
  'netherlands': 'NL',
  'new zealand': 'NZ',
  'nigeria': 'NG',
  'norway': 'NO',
  'panama': 'PA',
  'paraguay': 'PY',
  'peru': 'PE',
  'poland': 'PL',
  'portugal': 'PT',
  'qatar': 'QA',
  'republic of ireland': 'IE',
  'romania': 'RO',
  'saudi arabia': 'SA',
  'scotland': 'GB-SCT',
  'senegal': 'SN',
  'serbia': 'RS',
  'slovakia': 'SK',
  'slovenia': 'SI',
  'south africa': 'ZA',
  'south korea': 'KR',
  'korea republic': 'KR',
  'spain': 'ES',
  'sweden': 'SE',
  'switzerland': 'CH',
  'tunisia': 'TN',
  'turkey': 'TR',
  'ukraine': 'UA',
  'united arab emirates': 'AE',
  'united states': 'US',
  'united states of america': 'US',
  'uruguay': 'UY',
  'uzbekistan': 'UZ',
  'venezuela': 'VE',
  'wales': 'GB-WLS',
};

const ARABIC_NAME_TO_ISO2: Record<string, string> = {
  'مصر': 'EG',
  'السعودية': 'SA',
  'المغرب': 'MA',
  'تونس': 'TN',
  'قطر': 'QA',
  'الإمارات': 'AE',
  'الامارات': 'AE',
  'الأردن': 'JO',
  'الاردن': 'JO',
  'الأرجنتين': 'AR',
  'الارجنتين': 'AR',
  'البرازيل': 'BR',
  'فرنسا': 'FR',
  'إسبانيا': 'ES',
  'اسبانيا': 'ES',
  'ألمانيا': 'DE',
  'المانيا': 'DE',
  'إنجلترا': 'GB-ENG',
  'انجلترا': 'GB-ENG',
  'البرتغال': 'PT',
  'هولندا': 'NL',
  'بلجيكا': 'BE',
  'كرواتيا': 'HR',
  'أمريكا': 'US',
  'امريكا': 'US',
  'الولايات المتحدة': 'US',
  'كندا': 'CA',
  'المكسيك': 'MX',
  'اليابان': 'JP',
  'كوريا الجنوبية': 'KR',
  'إيران': 'IR',
  'ايران': 'IR',
  'أستراليا': 'AU',
  'استراليا': 'AU',
  'نيوزيلندا': 'NZ',
  'اسكتلندا': 'GB-SCT',
  'ويلز': 'GB-WLS',
};

function normalizeName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(national|football|soccer|team|منتخب)\b/g, '')
    .replace(/[.,()\-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function iso2ToFlag(iso2?: string | null) {
  const code = String(iso2 || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return code
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('');
}

export function getTeamFlagCode(team: TeamIdentity) {
  const code = String(team.code || '').trim().toUpperCase();
  const isoFromCode = FIFA_TO_ISO2[code] || (/^[A-Z]{2}$/.test(code) ? code : null);
  if (isoFromCode) return isoFromCode;

  const name = normalizeName(team.name);
  const isoFromName = NAME_TO_ISO2[name] || ARABIC_NAME_TO_ISO2[String(team.name || '').trim()];
  if (isoFromName) return isoFromName;

  const country = normalizeName(team.continent);
  const isoFromCountry = NAME_TO_ISO2[country] || ARABIC_NAME_TO_ISO2[String(team.continent || '').trim()];
  if (isoFromCountry) return isoFromCountry;

  return null;
}

export function getTeamFlagUrl(team: TeamIdentity, width = 80) {
  const code = getTeamFlagCode(team);
  if (!code) return null;
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

export function getTeamFlag(team: TeamIdentity) {
  const code = String(team.code || '').trim().toUpperCase();
  if (SPECIAL_FLAG_EMOJI_BY_CODE[code]) return SPECIAL_FLAG_EMOJI_BY_CODE[code];

  const resolvedCode = getTeamFlagCode(team);
  if (resolvedCode && /^[A-Z]{2}$/.test(resolvedCode)) return iso2ToFlag(resolvedCode);

  const name = normalizeName(team.name);
  if (name === 'england' || name === 'scotland' || name === 'wales') return '🏴';

  return null;
}
