export type TeamAliasRecord = {
  code: string;
  aliases: string[];
};

export const teamAliasRecords: TeamAliasRecord[] = [
  { code: 'MEX', aliases: ['mexico', 'méxico', 'mexican national team', 'el tri', 'المكسيك', 'منتخب المكسيك'] },
  { code: 'USA', aliases: ['usa', 'united states', 'united states men', 'usmnt', 'america', 'الولايات المتحدة', 'أمريكا', 'منتخب امريكا', 'منتخب أمريكا'] },
  { code: 'CAN', aliases: ['canada', 'canadian national team', 'كندا', 'منتخب كندا'] },
  { code: 'BIH', aliases: ['bosnia and herzegovina', 'bosnia', 'البوسنة والهرسك', 'البوسنة'] },
  { code: 'QAT', aliases: ['qatar', 'قطر', 'منتخب قطر'] },
  { code: 'SUI', aliases: ['switzerland', 'swiss national team', 'سويسرا', 'منتخب سويسرا'] },
  { code: 'KOR', aliases: ['korea republic', 'south korea', 'korea', 'republic of korea', 'كوريا الجنوبية', 'منتخب كوريا الجنوبية'] },
  { code: 'CIV', aliases: ['côte d’ivoire', 'cote d’ivoire', "cote d'ivoire", 'ivory coast', 'cote divoire', 'ساحل العاج', 'كوت ديفوار'] },
  { code: 'ZAF', aliases: ['south africa', 'bafana bafana', 'جنوب أفريقيا', 'جنوب افريقيا', 'منتخب جنوب أفريقيا'] },
  { code: 'RSA', aliases: ['south africa', 'bafana bafana', 'جنوب أفريقيا', 'جنوب افريقيا', 'منتخب جنوب أفريقيا'] },
  { code: 'CZE', aliases: ['czechia', 'czech republic', 'التشيك', 'منتخب التشيك'] },
  { code: 'GER', aliases: ['germany', 'deutschland', 'ألمانيا', 'المانيا', 'منتخب ألمانيا'] },
  { code: 'ESP', aliases: ['spain', 'españa', 'la roja', 'إسبانيا', 'اسبانيا', 'منتخب إسبانيا'] },
  { code: 'BRA', aliases: ['brazil', 'brasil', 'seleção', 'selecao', 'البرازيل', 'منتخب البرازيل'] },
  { code: 'MAR', aliases: ['morocco', 'المغرب', 'منتخب المغرب', 'أسود الأطلس', 'atlas lions'] },
  { code: 'HAI', aliases: ['haiti', 'هايتي', 'منتخب هايتي'] },
  { code: 'SCO', aliases: ['scotland', 'اسكتلندا', 'إسكتلندا', 'منتخب اسكتلندا'] },
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
  { code: 'BEL', aliases: ['belgium', 'red devils', 'بلجيكا', 'منتخب بلجيكا'] },
  { code: 'EGY', aliases: ['egypt', 'pharaohs', 'مصر', 'منتخب مصر', 'الفراعنة'] },
  { code: 'IRN', aliases: ['iran', 'team melli', 'إيران', 'ايران', 'منتخب إيران'] },
  { code: 'NZL', aliases: ['new zealand', 'all whites', 'نيوزيلندا', 'منتخب نيوزيلندا'] },
  { code: 'CPV', aliases: ['cape verde', 'cabo verde', 'الرأس الأخضر', 'كاب فيردي', 'منتخب الرأس الأخضر'] },
  { code: 'KSA', aliases: ['saudi arabia', 'ksa', 'السعودية', 'منتخب السعودية', 'الأخضر'] },
  { code: 'URU', aliases: ['uruguay', 'la celeste', 'أوروغواي', 'اوروجواي', 'منتخب أوروغواي'] },
  { code: 'SEN', aliases: ['senegal', 'lions of teranga', 'السنغال', 'منتخب السنغال'] },
  { code: 'IRQ', aliases: ['iraq', 'العراق', 'منتخب العراق', 'أسود الرافدين'] },
  { code: 'NOR', aliases: ['norway', 'النرويج', 'منتخب النرويج'] },
  { code: 'ALG', aliases: ['algeria', 'الجزائر', 'منتخب الجزائر', 'محاربو الصحراء'] },
  { code: 'AUT', aliases: ['austria', 'النمسا', 'منتخب النمسا'] },
  { code: 'JOR', aliases: ['jordan', 'الأردن', 'الاردن', 'منتخب الأردن'] },
  { code: 'POR', aliases: ['portugal', 'portuguese national team', 'البرتغال', 'منتخب البرتغال'] },
  { code: 'COD', aliases: ['dr congo', 'drc', 'democratic republic of the congo', 'congo dr', 'الكونغو الديمقراطية', 'منتخب الكونغو الديمقراطية'] },
  { code: 'UZB', aliases: ['uzbekistan', 'أوزبكستان', 'اوزبكستان', 'منتخب أوزبكستان'] },
  { code: 'COL', aliases: ['colombia', 'كولومبيا', 'منتخب كولومبيا'] },
  { code: 'CRO', aliases: ['croatia', 'كرواتيا', 'منتخب كرواتيا'] },
  { code: 'GHA', aliases: ['ghana', 'black stars', 'غانا', 'منتخب غانا'] },
  { code: 'PAN', aliases: ['panama', 'بنما', 'منتخب بنما'] },
  { code: 'PAR', aliases: ['paraguay', 'باراغواي', 'باراجواي', 'منتخب باراغواي'] },
  { code: 'AUS', aliases: ['australia', 'socceroos', 'أستراليا', 'استراليا', 'منتخب أستراليا'] },
  { code: 'TUR', aliases: ['turkey', 'turkiye', 'türkiye', 'تركيا', 'منتخب تركيا'] },
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
