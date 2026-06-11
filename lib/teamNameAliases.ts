export type TeamAliasRecord = {
  code: string;
  aliases: string[];
};

export const teamAliasRecords: TeamAliasRecord[] = [
  { code: 'MEX', aliases: ['mexico', 'méxico', 'mexican national team', 'el tri', 'المكسيك', 'منتخب المكسيك'] },
  { code: 'USA', aliases: ['usa', 'united states', 'united states men', 'usmnt', 'america', 'الولايات المتحدة', 'أمريكا', 'منتخب امريكا', 'منتخب أمريكا'] },
  { code: 'CAN', aliases: ['canada', 'canadian national team', 'كندا', 'منتخب كندا'] },
  { code: 'KOR', aliases: ['korea republic', 'south korea', 'korea', 'republic of korea', 'كوريا الجنوبية', 'منتخب كوريا الجنوبية'] },
  { code: 'CIV', aliases: ['côte d’ivoire', 'cote d’ivoire', "cote d'ivoire", 'ivory coast', 'cote divoire', 'ساحل العاج', 'كوت ديفوار', 'كوت ديفوار'] },
  { code: 'ZAF', aliases: ['south africa', 'bafana bafana', 'جنوب أفريقيا', 'جنوب افريقيا', 'منتخب جنوب أفريقيا'] },
  { code: 'RSA', aliases: ['south africa', 'bafana bafana', 'جنوب أفريقيا', 'جنوب افريقيا', 'منتخب جنوب أفريقيا'] },
  { code: 'CZE', aliases: ['czechia', 'czech republic', 'التشيك', 'منتخب التشيك'] },
  { code: 'GER', aliases: ['germany', 'deutschland', 'ألمانيا', 'المانيا', 'منتخب ألمانيا'] },
  { code: 'ESP', aliases: ['spain', 'españa', 'la roja', 'إسبانيا', 'اسبانيا', 'منتخب إسبانيا'] },
  { code: 'BRA', aliases: ['brazil', 'brasil', 'seleção', 'selecao', 'البرازيل', 'منتخب البرازيل'] },
  { code: 'ARG', aliases: ['argentina', 'الأرجنتين', 'الارجنتين', 'منتخب الأرجنتين'] },
  { code: 'FRA', aliases: ['france', 'les bleus', 'فرنسا', 'منتخب فرنسا'] },
  { code: 'ENG', aliases: ['england', 'three lions', 'إنجلترا', 'انجلترا', 'منتخب إنجلترا'] },
  { code: 'NED', aliases: ['netherlands', 'holland', 'dutch national team', 'هولندا', 'منتخب هولندا'] },
  { code: 'NLD', aliases: ['netherlands', 'holland', 'dutch national team', 'هولندا', 'منتخب هولندا'] },
  { code: 'JPN', aliases: ['japan', 'samurai blue', 'اليابان', 'منتخب اليابان'] },
  { code: 'SWE', aliases: ['sweden', 'السويد', 'منتخب السويد'] },
  { code: 'TUN', aliases: ['tunisia', 'تونس', 'منتخب تونس'] },
  { code: 'ECU', aliases: ['ecuador', 'إكوادور', 'الاكوادور', 'منتخب الإكوادور'] },
  { code: 'CUW', aliases: ['curaçao', 'curacao', 'كوراساو', 'كوراساؤ'] },
];

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getAliasesForCode(code?: string | null) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return teamAliasRecords.find((record) => record.code === normalizedCode)?.aliases || [];
}

export function textMatchesTeamAlias(text: string, team: { code?: string | null; name: string }) {
  const normalizedText = normalizeSearchText(text);
  const code = String(team.code || '').trim().toLowerCase();
  const name = normalizeSearchText(team.name);
  const aliases = getAliasesForCode(team.code).map(normalizeSearchText);

  if (code && normalizedText.includes(code)) return true;
  if (name && normalizedText.includes(name)) return true;
  return aliases.some((alias) => alias && normalizedText.includes(alias));
}
