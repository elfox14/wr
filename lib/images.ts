/**
 * Image Utilities for Smart Fallback System
 */

// Mapping of FIFA/IOC 3-letter codes to ISO 3166-1 alpha-2 codes (used by FlagCDN)
const countryCodeMap: Record<string, string> = {
  'URY': 'uy', 'ARG': 'ar', 'BRA': 'br', 'COL': 'co', 'ECU': 'ec', 'PAR': 'py', 'VEN': 've', 'CHI': 'cl', 'PER': 'pe', 'BOL': 'bo',
  'GER': 'de', 'ESP': 'es', 'FRA': 'fr', 'ENG': 'gb-eng', 'POR': 'pt', 'ITA': 'it', 'NED': 'nl', 'BEL': 'be', 'CRO': 'hr', 'DEN': 'dk',
  'SUI': 'ch', 'SRB': 'rs', 'POL': 'pl', 'WAL': 'gb-wls', 'SCO': 'gb-sct', 'UKR': 'ua', 'AUT': 'at', 'CZE': 'cz', 'HUN': 'hu', 'SVK': 'sk',
  'SVN': 'si', 'ALB': 'al', 'GEO': 'ge', 'TUR': 'tr', 'GRE': 'gr',
  'USA': 'us', 'MEX': 'mx', 'CAN': 'ca', 'CRC': 'cr', 'HON': 'hn', 'JAM': 'jm', 'PAN': 'pa', 'TRI': 'tt',
  'JPN': 'jp', 'KOR': 'kr', 'KSA': 'sa', 'IRN': 'ir', 'AUS': 'au', 'QAT': 'qa', 'IRQ': 'iq', 'UZB': 'uz', 'BHR': 'bh', 'IDN': 'id',
  'CHN': 'cn', 'OMA': 'om', 'UAE': 'ae', 'IND': 'in',
  'MAR': 'ma', 'SEN': 'sn', 'NGA': 'ng', 'EGY': 'eg', 'CMR': 'cm', 'GHA': 'gh', 'CIV': 'ci', 'ALG': 'dz', 'TUN': 'tn', 'MLI': 'ml',
  'BFA': 'bf', 'COD': 'cd', 'ZAF': 'za', 'TAN': 'tz', 'CPV': 'cv', 'RSA': 'za', 'BIH': 'ba', 'CUW': 'cw', 'JOR': 'jo',
  'NZL': 'nz'
};

/**
 * Returns a FlagCDN URL for a given 3-letter country code.
 */
export function getFlagUrl(threeLetterCode: string): string | null {
  const alpha2 = countryCodeMap[threeLetterCode.toUpperCase()];
  if (!alpha2) return null;
  return `https://flagcdn.com/w160/${alpha2}.png`;
}

/**
 * Returns a ui-avatars.com fallback URL for a given name.
 */
export function getAvatarFallbackUrl(name: string): string {
  // Use a glassmorphism/dark theme friendly color setup
  // background=1a1a2e (dark blue) & color=ffffff (white)
  const encodedName = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encodedName}&background=1a1a2e&color=ffffff&size=200&font-size=0.33&bold=true`;
}

/**
 * Normalizes an image source. If it's an emoji or invalid, returns the fallback avatar.
 */
export function normalizeImageSource(src: string | null | undefined, assetType: 'TEAM' | 'PLAYER', name: string, code?: string): string {
  // If it's a known URL format, return it
  if (src && src.startsWith('http')) return src;

  // If it's a team and we have a code, use FlagCDN
  if (assetType === 'TEAM' && code) {
    const flagUrl = getFlagUrl(code);
    if (flagUrl) return flagUrl;
  }

  // Fallback to text avatar
  return getAvatarFallbackUrl(name);
}
