import { Prisma } from '@prisma/client';

export type WorldCupMasterStanding = {
  group: string;
  rank: number;
  code: string;
  fbrefCode: string;
  team: string;
  squad: string;
  mp: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number | null;
  ga: number | null;
  gd: string | null;
  pts: number;
  last5: string;
  topTeamScorer?: string | null;
  goalkeeper?: string | null;
};

export type WorldCupMasterLeader = {
  player: string;
  team: string;
  value: number | string;
};

export const worldCupMasterMeta = {
  competition: 'FIFA World Cup',
  season: 2026,
  gender: 'Male',
  hostCountries: ['United States', 'Mexico', 'Canada'],
  teamsInLeague: 48,
  groupStageDateRange: { from: '2026-06-11', to: '2026-06-28' },
  sourceName: 'FBref copied World Cup Master page',
  sourceUrl: 'https://fbref.com/en/comps/1/2026/2026-World-Cup-Stats',
  sourceNote: 'Copy/paste snapshot sent by the platform owner. Use as an FBref statistical snapshot, not as an official FIFA source.',
  siteLastUpdated: 'Monday, June 15, 1:46PM',
};

export const teamCodeAliases: Record<string, string[]> = {
  MEX: ['MEX', 'MX', 'MEXICO'],
  KOR: ['KOR', 'KR', 'SOUTH KOREA', 'KOREA REPUBLIC'],
  CZE: ['CZE', 'CZ', 'CZECHIA'],
  RSA: ['RSA', 'ZA', 'SOUTH AFRICA'],
  SUI: ['SUI', 'CH', 'SWITZERLAND'],
  CAN: ['CAN', 'CA', 'CANADA'],
  QAT: ['QAT', 'QA', 'QATAR'],
  BIH: ['BIH', 'BA', 'BOSNIA-HERZEGOVINA', 'BOSNIA AND HERZEGOVINA'],
  SCO: ['SCO', 'SCT', 'SCOTLAND'],
  MAR: ['MAR', 'MA', 'MOROCCO'],
  BRA: ['BRA', 'BR', 'BRAZIL'],
  HTI: ['HTI', 'HT', 'HAITI'],
  USA: ['USA', 'US', 'UNITED STATES'],
  AUS: ['AUS', 'AU', 'AUSTRALIA'],
  TUR: ['TUR', 'TR', 'TÜRKIYE', 'TURKIYE', 'TURKEY'],
  PAR: ['PAR', 'PY', 'PARAGUAY'],
  GER: ['GER', 'DE', 'GERMANY'],
  CIV: ['CIV', 'CI', "COTE D'IVOIRE", 'CÔTE D’IVOIRE', 'IVORY COAST'],
  ECU: ['ECU', 'EC', 'ECUADOR'],
  CUW: ['CUW', 'CW', 'CURAÇAO', 'CURACAO'],
  SWE: ['SWE', 'SE', 'SWEDEN'],
  JPN: ['JPN', 'JP', 'JAPAN'],
  NED: ['NED', 'NL', 'NETHERLANDS'],
  TUN: ['TUN', 'TN', 'TUNISIA'],
  BEL: ['BEL', 'BE', 'BELGIUM'],
  EGY: ['EGY', 'EG', 'EGYPT'],
  IRI: ['IRI', 'IR', 'IR IRAN', 'IRAN'],
  NZL: ['NZL', 'NZ', 'NEW ZEALAND'],
  KSA: ['KSA', 'SA', 'SAUDI ARABIA'],
  ESP: ['ESP', 'ES', 'SPAIN'],
  URU: ['URU', 'UY', 'URUGUAY'],
  CPV: ['CPV', 'CV', 'CAPE VERDE'],
  FRA: ['FRA', 'FR', 'FRANCE'],
  IRQ: ['IRQ', 'IQ', 'IRAQ'],
  NOR: ['NOR', 'NO', 'NORWAY'],
  SEN: ['SEN', 'SN', 'SENEGAL'],
  DZA: ['DZA', 'DZ', 'ALGERIA'],
  ARG: ['ARG', 'AR', 'ARGENTINA'],
  AUT: ['AUT', 'AT', 'AUSTRIA'],
  JOR: ['JOR', 'JO', 'JORDAN'],
  COL: ['COL', 'CO', 'COLOMBIA'],
  POR: ['POR', 'PT', 'PORTUGAL'],
  COD: ['COD', 'CD', 'CONGO DR', 'DR CONGO'],
  UZB: ['UZB', 'UZ', 'UZBEKISTAN'],
  CRO: ['CRO', 'HR', 'CROATIA'],
  ENG: ['ENG', 'EN', 'ENGLAND'],
  GHA: ['GHA', 'GH', 'GHANA'],
  PAN: ['PAN', 'PA', 'PANAMA'],
};

export const groupStandings: Record<string, WorldCupMasterStanding[]> = {
  A: [
    { group: 'A', rank: 1, code: 'MEX', fbrefCode: 'mx', team: 'Mexico', squad: 'mx Mexico', mp: 1, wins: 1, draws: 0, losses: 0, gf: 2, ga: 0, gd: '+2', pts: 3, last5: 'D W W W W', topTeamScorer: 'Raúl Jiménez, Julián Quiñones - 1', goalkeeper: 'Raúl Rangel' },
    { group: 'A', rank: 2, code: 'KOR', fbrefCode: 'kr', team: 'Korea Republic', squad: 'kr Korea Republic', mp: 1, wins: 1, draws: 0, losses: 0, gf: 2, ga: 1, gd: '+1', pts: 3, last5: 'L L W W W', topTeamScorer: 'Hwang In-beom, Oh Hyeon-gyu - 1', goalkeeper: 'Kim Seung-gyu' },
    { group: 'A', rank: 3, code: 'CZE', fbrefCode: 'cz', team: 'Czechia', squad: 'cz Czechia', mp: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 2, gd: '-1', pts: 0, last5: 'D D W W L', topTeamScorer: 'Ladislav Krejčí - 1', goalkeeper: 'Matej Kovar' },
    { group: 'A', rank: 4, code: 'RSA', fbrefCode: 'za', team: 'South Africa', squad: 'za South Africa', mp: 1, wins: 0, draws: 0, losses: 1, gf: 0, ga: 2, gd: '-2', pts: 0, last5: 'L D L D L', topTeamScorer: null, goalkeeper: 'Ronwen Williams' },
  ],
  B: [
    { group: 'B', rank: 1, code: 'SUI', fbrefCode: 'ch', team: 'Switzerland', squad: 'ch Switzerland', mp: 1, wins: 0, draws: 1, losses: 0, gf: 1, ga: 1, gd: '0', pts: 1, last5: 'L D W D D', topTeamScorer: 'Breel Embolo - 1', goalkeeper: 'Gregor Kobel' },
    { group: 'B', rank: 2, code: 'CAN', fbrefCode: 'ca', team: 'Canada', squad: 'ca Canada', mp: 1, wins: 0, draws: 1, losses: 0, gf: 1, ga: 1, gd: '0', pts: 1, last5: 'D D W D D', topTeamScorer: 'Cyle Larin - 1', goalkeeper: 'Maxime Crépeau' },
    { group: 'B', rank: 3, code: 'QAT', fbrefCode: 'qa', team: 'Qatar', squad: 'qa Qatar', mp: 1, wins: 0, draws: 1, losses: 0, gf: 1, ga: 1, gd: '0', pts: 1, last5: 'D W L D D', topTeamScorer: 'Boualem Khoukhi - 1', goalkeeper: 'Mahmoud Abunada' },
    { group: 'B', rank: 4, code: 'BIH', fbrefCode: 'ba', team: 'Bosnia-Herzegovina', squad: 'ba Bosnia-Herzegovina', mp: 1, wins: 0, draws: 1, losses: 0, gf: 1, ga: 1, gd: '0', pts: 1, last5: 'D D D D D', topTeamScorer: 'Jovo Lukić - 1', goalkeeper: 'Nikola Vasilj' },
  ],
  C: [
    { group: 'C', rank: 1, code: 'SCO', fbrefCode: 'sct', team: 'Scotland', squad: 'sct Scotland', mp: 1, wins: 1, draws: 0, losses: 0, gf: 1, ga: 0, gd: '+1', pts: 3, last5: 'L L W W W', topTeamScorer: 'John McGinn - 1', goalkeeper: 'Angus Gunn' },
    { group: 'C', rank: 2, code: 'MAR', fbrefCode: 'ma', team: 'Morocco', squad: 'ma Morocco', mp: 1, wins: 0, draws: 1, losses: 0, gf: 1, ga: 1, gd: '0', pts: 1, last5: 'D W W D D', topTeamScorer: 'Ismael Saibari - 1', goalkeeper: 'Yassine Bounou' },
    { group: 'C', rank: 3, code: 'BRA', fbrefCode: 'br', team: 'Brazil', squad: 'br Brazil', mp: 1, wins: 0, draws: 1, losses: 0, gf: 1, ga: 1, gd: '0', pts: 1, last5: 'L W W W D', topTeamScorer: 'Vinicius Júnior - 1', goalkeeper: 'Alisson' },
    { group: 'C', rank: 4, code: 'HTI', fbrefCode: 'ht', team: 'Haiti', squad: 'ht Haiti', mp: 1, wins: 0, draws: 0, losses: 1, gf: 0, ga: 1, gd: '-1', pts: 0, last5: 'L D W L L', topTeamScorer: null, goalkeeper: 'Johny Placide' },
  ],
  D: [
    { group: 'D', rank: 1, code: 'USA', fbrefCode: 'us', team: 'United States', squad: 'us United States', mp: 1, wins: 1, draws: 0, losses: 0, gf: 4, ga: 1, gd: '+3', pts: 3, last5: 'L L W L W', topTeamScorer: 'Folarin Balogun - 2', goalkeeper: 'Matt Freese' },
    { group: 'D', rank: 2, code: 'AUS', fbrefCode: 'au', team: 'Australia', squad: 'au Australia', mp: 1, wins: 1, draws: 0, losses: 0, gf: 2, ga: 0, gd: '+2', pts: 3, last5: 'L L L D W', topTeamScorer: 'Connor Metcalfe, Nestory Irankunda - 1', goalkeeper: 'Patrick Beach' },
    { group: 'D', rank: 3, code: 'TUR', fbrefCode: 'tr', team: 'Türkiye', squad: 'tr Türkiye', mp: 1, wins: 0, draws: 0, losses: 1, gf: 0, ga: 2, gd: '-2', pts: 0, last5: 'W W W W L', topTeamScorer: null, goalkeeper: 'Uğurcan Çakır' },
    { group: 'D', rank: 4, code: 'PAR', fbrefCode: 'py', team: 'Paraguay', squad: 'py Paraguay', mp: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 4, gd: '-3', pts: 0, last5: 'W W L W L', topTeamScorer: 'Mauricio - 1', goalkeeper: 'Orlando Gill' },
  ],
  E: [
    { group: 'E', rank: 1, code: 'GER', fbrefCode: 'de', team: 'Germany', squad: 'de Germany', mp: 1, wins: 1, draws: 0, losses: 0, gf: 7, ga: 1, gd: '+6', pts: 3, last5: 'W W W W W', topTeamScorer: 'Kai Havertz - 2', goalkeeper: 'Manuel Neuer' },
    { group: 'E', rank: 2, code: 'CIV', fbrefCode: 'ci', team: "Côte d'Ivoire", squad: "ci Côte d'Ivoire", mp: 1, wins: 1, draws: 0, losses: 0, gf: 1, ga: 0, gd: '+1', pts: 3, last5: 'L W W W W', topTeamScorer: 'Amad Diallo - 1', goalkeeper: 'Yahia Fofana' },
    { group: 'E', rank: 3, code: 'ECU', fbrefCode: 'ec', team: 'Ecuador', squad: 'ec Ecuador', mp: 1, wins: 0, draws: 0, losses: 1, gf: 0, ga: 1, gd: '-1', pts: 0, last5: 'D D W W L', topTeamScorer: null, goalkeeper: 'Hernán Galíndez' },
    { group: 'E', rank: 4, code: 'CUW', fbrefCode: 'cw', team: 'Curaçao', squad: 'cw Curaçao', mp: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 7, gd: '-6', pts: 0, last5: 'W D L W L', topTeamScorer: 'Livano Comenencia - 1', goalkeeper: 'Eloy Room' },
  ],
  F: [
    { group: 'F', rank: 1, code: 'SWE', fbrefCode: 'se', team: 'Sweden', squad: 'se Sweden', mp: 1, wins: 1, draws: 0, losses: 0, gf: 5, ga: 1, gd: '+4', pts: 3, last5: 'W W L D W', topTeamScorer: 'Yasin Ayari - 2', goalkeeper: 'Kristoffer Nordfeldt' },
    { group: 'F', rank: 2, code: 'JPN', fbrefCode: 'jp', team: 'Japan', squad: 'jp Japan', mp: 1, wins: 0, draws: 1, losses: 0, gf: 2, ga: 2, gd: '0', pts: 1, last5: 'W W W W D', topTeamScorer: 'Daichi Kamada, Keito Nakamura - 1', goalkeeper: 'Zion Suzuki' },
    { group: 'F', rank: 3, code: 'NED', fbrefCode: 'nl', team: 'Netherlands', squad: 'nl Netherlands', mp: 1, wins: 0, draws: 1, losses: 0, gf: 2, ga: 2, gd: '0', pts: 1, last5: 'W D L W D', topTeamScorer: 'Virgil van Dijk, Crysencio Summerville - 1', goalkeeper: 'Bart Verbruggen' },
    { group: 'F', rank: 4, code: 'TUN', fbrefCode: 'tn', team: 'Tunisia', squad: 'tn Tunisia', mp: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 5, gd: '-4', pts: 0, last5: 'W D L L L', topTeamScorer: 'Omar Rekik - 1', goalkeeper: 'Mouhib Chamakh' },
  ],
  G: [
    { group: 'G', rank: 1, code: 'BEL', fbrefCode: 'be', team: 'Belgium', squad: 'be Belgium', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W D W W' },
    { group: 'G', rank: 2, code: 'EGY', fbrefCode: 'eg', team: 'Egypt', squad: 'eg Egypt', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'D W D W L' },
    { group: 'G', rank: 3, code: 'IRI', fbrefCode: 'ir', team: 'IR Iran', squad: 'ir IR Iran', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W L W W W' },
    { group: 'G', rank: 4, code: 'NZL', fbrefCode: 'nz', team: 'New Zealand', squad: 'nz New Zealand', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'D L L L L' },
  ],
  H: [
    { group: 'H', rank: 1, code: 'KSA', fbrefCode: 'sa', team: 'Saudi Arabia', squad: 'sa Saudi Arabia', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L L L W D' },
    { group: 'H', rank: 2, code: 'ESP', fbrefCode: 'es', team: 'Spain', squad: 'es Spain', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'D W D D W' },
    { group: 'H', rank: 3, code: 'URU', fbrefCode: 'uy', team: 'Uruguay', squad: 'uy Uruguay', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D L D D' },
    { group: 'H', rank: 4, code: 'CPV', fbrefCode: 'cv', team: 'Cape Verde', squad: 'cv Cape Verde', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D W W W' },
  ],
  I: [
    { group: 'I', rank: 1, code: 'FRA', fbrefCode: 'fr', team: 'France', squad: 'fr France', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W W L W' },
    { group: 'I', rank: 2, code: 'IRQ', fbrefCode: 'iq', team: 'Iraq', squad: 'iq Iraq', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W W D L' },
    { group: 'I', rank: 3, code: 'NOR', fbrefCode: 'no', team: 'Norway', squad: 'no Norway', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W L D W D' },
    { group: 'I', rank: 4, code: 'SEN', fbrefCode: 'sn', team: 'Senegal', squad: 'sn Senegal', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W W L D' },
  ],
  J: [
    { group: 'J', rank: 1, code: 'DZA', fbrefCode: 'dz', team: 'Algeria', squad: 'dz Algeria', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L W D W W' },
    { group: 'J', rank: 2, code: 'ARG', fbrefCode: 'ar', team: 'Argentina', squad: 'ar Argentina', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W W W W' },
    { group: 'J', rank: 3, code: 'AUT', fbrefCode: 'at', team: 'Austria', squad: 'at Austria', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D W W W' },
    { group: 'J', rank: 4, code: 'JOR', fbrefCode: 'jo', team: 'Jordan', squad: 'jo Jordan', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L L D L L' },
  ],
  K: [
    { group: 'K', rank: 1, code: 'COL', fbrefCode: 'co', team: 'Colombia', squad: 'co Colombia', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W L L W W' },
    { group: 'K', rank: 2, code: 'POR', fbrefCode: 'pt', team: 'Portugal', squad: 'pt Portugal', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D W W W' },
    { group: 'K', rank: 3, code: 'COD', fbrefCode: 'cd', team: 'Congo DR', squad: 'cd Congo DR', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L W W D L' },
    { group: 'K', rank: 4, code: 'UZB', fbrefCode: 'uz', team: 'Uzbekistan', squad: 'uz Uzbekistan', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W L L L' },
  ],
  L: [
    { group: 'L', rank: 1, code: 'CRO', fbrefCode: 'hr', team: 'Croatia', squad: 'hr Croatia', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W W L L W' },
    { group: 'L', rank: 2, code: 'ENG', fbrefCode: 'eng', team: 'England', squad: 'eng England', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'W D L W W' },
    { group: 'L', rank: 3, code: 'GHA', fbrefCode: 'gh', team: 'Ghana', squad: 'gh Ghana', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'L L L L D' },
    { group: 'L', rank: 4, code: 'PAN', fbrefCode: 'pa', team: 'Panama', squad: 'pa Panama', mp: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: '0', pts: 0, last5: 'D W L W D' },
  ],
};

export const thirdPlacedRanking: WorldCupMasterStanding[] = [
  groupStandings.F[2],
  groupStandings.C[2],
  groupStandings.B[2],
  groupStandings.A[2],
  groupStandings.E[2],
  groupStandings.D[2],
  groupStandings.J[2],
  groupStandings.K[2],
  groupStandings.L[2],
  groupStandings.G[2],
  groupStandings.I[2],
  groupStandings.H[2],
];

export const leaderboards: Record<string, WorldCupMasterLeader[]> = {
  goals: [
    { player: 'Kai Havertz', team: 'Germany', value: 2 },
    { player: 'Yasin Ayari', team: 'Sweden', value: 2 },
    { player: 'Folarin Balogun', team: 'United States', value: 2 },
    { player: 'Hwang In-beom', team: 'Korea Republic', value: 1 },
    { player: 'Mattias Svanberg', team: 'Sweden', value: 1 },
    { player: 'Amad Diallo', team: "Côte d'Ivoire", value: 1 },
    { player: 'Raúl Jiménez', team: 'Mexico', value: 1 },
    { player: 'Julián Quiñones', team: 'Mexico', value: 1 },
    { player: 'Alexander Isak', team: 'Sweden', value: 1 },
    { player: 'Daichi Kamada', team: 'Japan', value: 1 },
  ],
  assists: [
    { player: 'Joshua Kimmich', team: 'Germany', value: 2 },
    { player: 'Deniz Undav', team: 'Germany', value: 2 },
    { player: 'Ryan Gravenberch', team: 'Netherlands', value: 2 },
    { player: 'Alexander Isak', team: 'Sweden', value: 2 },
    { player: 'Roberto Alvarado', team: 'Mexico', value: 1 },
    { player: 'Erik Lira', team: 'Mexico', value: 1 },
    { player: 'Takefusa Kubo', team: 'Japan', value: 1 },
    { player: 'Viktor Gyökeres', team: 'Sweden', value: 1 },
    { player: 'Christian Pulisic', team: 'United States', value: 1 },
    { player: 'Brahim Díaz', team: 'Morocco', value: 1 },
  ],
  goalsAssists: [
    { player: 'Alexander Isak', team: 'Sweden', value: 3 },
    { player: 'Deniz Undav', team: 'Germany', value: 3 },
    { player: 'Kai Havertz', team: 'Germany', value: 2 },
    { player: 'Yasin Ayari', team: 'Sweden', value: 2 },
    { player: 'Folarin Balogun', team: 'United States', value: 2 },
    { player: 'Ryan Gravenberch', team: 'Netherlands', value: 2 },
    { player: 'Viktor Gyökeres', team: 'Sweden', value: 2 },
  ],
  shotsTotal: [
    { player: 'Arda Güler', team: 'Türkiye', value: 8 },
    { player: 'Dan Ndoye', team: 'Switzerland', value: 6 },
    { player: 'Son Heung-min', team: 'Korea Republic', value: 6 },
    { player: 'Kenan Yıldız', team: 'Türkiye', value: 6 },
    { player: 'Folarin Balogun', team: 'United States', value: 5 },
    { player: 'Viktor Gyökeres', team: 'Sweden', value: 5 },
    { player: 'Julián Quiñones', team: 'Mexico', value: 5 },
    { player: 'Malik Tillman', team: 'United States', value: 5 },
    { player: 'Hakan Çalhanoğlu', team: 'Türkiye', value: 5 },
  ],
  shotsOnTarget: [
    { player: 'Arda Güler', team: 'Türkiye', value: 3 },
    { player: 'Felix Nmecha', team: 'Germany', value: 3 },
    { player: 'Folarin Balogun', team: 'United States', value: 3 },
    { player: 'Raúl Jiménez', team: 'Mexico', value: 2 },
    { player: 'Julián Quiñones', team: 'Mexico', value: 2 },
    { player: 'Viktor Gyökeres', team: 'Sweden', value: 2 },
    { player: 'Alexander Isak', team: 'Sweden', value: 2 },
    { player: 'Donyell Malen', team: 'Netherlands', value: 2 },
    { player: 'Yasin Ayari', team: 'Sweden', value: 2 },
  ],
  cleanSheets: [
    { player: 'Raúl Rangel', team: 'Mexico', value: 1 },
    { player: 'Patrick Beach', team: 'Australia', value: 1 },
    { player: 'Yahia Fofana', team: "Côte d'Ivoire", value: 1 },
    { player: 'Angus Gunn', team: 'Scotland', value: 1 },
  ],
  saves: [
    { player: 'Patrick Beach', team: 'Australia', value: 8 },
    { player: 'Mahmoud Abunada', team: 'Qatar', value: 5 },
    { player: 'Zion Suzuki', team: 'Japan', value: 4 },
    { player: 'Eloy Room', team: 'Curaçao', value: 4 },
    { player: 'Yassine Bounou', team: 'Morocco', value: 4 },
    { player: 'Matej Kovar', team: 'Czechia', value: 4 },
    { player: 'Orlando Gill', team: 'Paraguay', value: 3 },
    { player: 'Kim Seung-gyu', team: 'Korea Republic', value: 3 },
    { player: 'Hernán Galíndez', team: 'Ecuador', value: 3 },
    { player: 'Gregor Kobel', team: 'Switzerland', value: 3 },
  ],
  redCards: [
    { player: 'César Montes', team: 'Mexico', value: 1 },
    { player: 'Sphephelo Sithole', team: 'South Africa', value: 1 },
    { player: 'Themba Zwane', team: 'South Africa', value: 1 },
  ],
  crosses: [
    { player: 'Ruben Vargas', team: 'Switzerland', value: 11 },
    { player: 'Stephen Eustáquio', team: 'Canada', value: 9 },
    { player: 'Ricardo Rodríguez', team: 'Switzerland', value: 8 },
    { player: 'Antonee Robinson', team: 'United States', value: 7 },
    { player: 'Denis Zakaria', team: 'Switzerland', value: 7 },
    { player: 'Tijjani Reijnders', team: 'Netherlands', value: 7 },
  ],
  tacklesWon: [
    { player: 'Achraf Hakimi', team: 'Morocco', value: 6 },
    { player: 'Douglas Santos', team: 'Brazil', value: 5 },
    { player: 'Richie Laryea', team: 'Canada', value: 4 },
    { player: 'Nikola Katić', team: 'Bosnia-Herzegovina', value: 4 },
    { player: 'Andrés Cubas', team: 'Paraguay', value: 4 },
    { player: 'Yasin Ayari', team: 'Sweden', value: 3 },
  ],
  interceptions: [
    { player: 'Juninho Bacuna', team: 'Curaçao', value: 5 },
    { player: 'Livano Comenencia', team: 'Curaçao', value: 4 },
    { player: 'Tyler Adams', team: 'United States', value: 3 },
    { player: 'Nico Schlotterbeck', team: 'Germany', value: 3 },
    { player: 'Jesús Gallardo', team: 'Mexico', value: 3 },
    { player: 'Paul Okon-Engstler', team: 'Australia', value: 3 },
  ],
};

export function getAllWorldCupMasterStandings() {
  return Object.values(groupStandings).flat();
}

export function getWorldCupMasterTeam(identifier: string) {
  const normalized = identifier.trim().toUpperCase();
  return getAllWorldCupMasterStandings().find((row) => {
    const aliases = teamCodeAliases[row.code] || [row.code];
    return aliases.some((alias) => alias.toUpperCase() === normalized) || row.team.toUpperCase() === normalized;
  }) || null;
}

export function getTeamLeaderHighlights(team: string) {
  const normalized = team.toLowerCase();
  return Object.entries(leaderboards).flatMap(([category, rows]) =>
    rows
      .filter((row) => row.team.toLowerCase() === normalized)
      .map((row) => ({ category, ...row })),
  );
}

export function buildMasterStrengths(row: WorldCupMasterStanding) {
  const strengths: string[] = [];
  if (row.pts === 3) strengths.push('حقق الفوز في عينة المجموعة الحالية');
  if (row.gd && row.gd.startsWith('+')) strengths.push(`فارق أهداف إيجابي ${row.gd}`);
  if (row.ga === 0 && row.mp > 0) strengths.push('شباك نظيفة في المباراة المتاحة');
  if (row.gf !== null && row.gf >= 2) strengths.push(`سجل ${row.gf} أهداف في المباراة المتاحة`);
  if (getTeamLeaderHighlights(row.team).length > 0) strengths.push('يمتلك حضورًا في قوائم قادة البطولة داخل لقطة FBref');
  if (!strengths.length) strengths.push('لقطة Master توفر أساسًا منظمًا لتحديث صفحة المنتخب');
  return strengths.slice(0, 4);
}

export function buildMasterWeaknesses(row: WorldCupMasterStanding) {
  const weaknesses: string[] = [];
  if (row.mp === 0) weaknesses.push('لم يبدأ مشواره في مباريات المجموعة داخل هذه اللقطة');
  if (row.pts === 0 && row.mp > 0) weaknesses.push('لم يحصد نقاطًا في المباراة المتاحة');
  if (row.ga !== null && row.ga >= 4) weaknesses.push(`استقبل ${row.ga} أهداف في المباراة المتاحة`);
  if (row.gf === 0 && row.mp > 0) weaknesses.push('لم يسجل في المباراة المتاحة');
  if (!weaknesses.length) weaknesses.push('العينة قصيرة جدًا ولا تكفي لحكم نهائي');
  return weaknesses.slice(0, 4);
}

export function buildWorldCupMasterMetrics(row: WorldCupMasterStanding): Prisma.InputJsonValue {
  return {
    provider: 'FBREF_WORLD_CUP_MASTER_SNAPSHOT',
    source: worldCupMasterMeta,
    standing: row,
    thirdPlaceRank: thirdPlacedRanking.findIndex((candidate) => candidate.code === row.code) + 1 || null,
    leaderHighlights: getTeamLeaderHighlights(row.team),
  } as Prisma.InputJsonValue;
}

export function buildWorldCupMasterReportBody(row: WorldCupMasterStanding) {
  const leaderHighlights = getTeamLeaderHighlights(row.team);
  const leadersText = leaderHighlights.length
    ? leaderHighlights.map((item) => `${item.player} — ${item.category}: ${item.value}`).join('؛ ')
    : 'غير متوفر في قوائم القادة المرسلة.';

  return `بطاقة Master لكأس العالم 2026 — ${row.team}

المصدر: FBref copied World Cup Master page، آخر تحديث ظاهر في الصفحة: ${worldCupMasterMeta.siteLastUpdated}.

وضع المجموعة: المجموعة ${row.group}، المركز ${row.rank}، لعب ${row.mp}، فاز ${row.wins}، تعادل ${row.draws}، خسر ${row.losses}، له ${row.gf ?? 'غير متوفر في المصادر'}، عليه ${row.ga ?? 'غير متوفر في المصادر'}، الفارق ${row.gd ?? 'غير متوفر في المصادر'}، النقاط ${row.pts}، آخر 5: ${row.last5 || 'غير متوفر في المصادر'}.

هداف/هدافو الفريق في جدول البطولة: ${row.topTeamScorer || 'غير متوفر في المصادر'}.
حارس المرمى الظاهر في League Table: ${row.goalkeeper || 'غير متوفر في المصادر'}.

حضور المنتخب في قوائم قادة البطولة: ${leadersText}.

ملاحظة تحريرية: هذه لقطة إحصائية عامة من صفحة Master، تصلح لبطاقات الترتيب والمؤشرات السريعة، ولا تُستخدم وحدها لاختيار النجم الأبرز أو توقع التأهل. عند التعارض مع FIFA في القوائم الرسمية، تُعتمد FIFA للقائمة الرسمية وتبقى FBref مصدرًا للإحصاءات.`;
}
