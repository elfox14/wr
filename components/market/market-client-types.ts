import type { Asset } from '@/lib/store';

export type MarketAssetType = 'TEAM' | 'PLAYER';
export type MarketTypeFilter = 'ALL' | MarketAssetType | 'WATCHLIST';
export type MarketViewMode = 'CARDS' | 'TABLE' | 'HEATMAP';

export type MarketSmartFilter =
  | 'ALL'
  | 'UNDERVALUED'
  | 'HIGH_MOMENTUM'
  | 'HIGH_DEMAND'
  | 'LOW_RISK'
  | 'TOP_GAINERS'
  | 'TOP_LOSERS'
  | 'BLUE_CHIPS'
  | 'SPECULATIVE';

export type MarketSortField =
  | 'OPPORTUNITY'
  | 'SCORE'
  | 'PRICE'
  | 'FAIR_VALUE'
  | 'PREMIUM_DISCOUNT'
  | 'MOMENTUM'
  | 'DEMAND'
  | 'VOLATILITY'
  | 'CHANGE'
  | 'OWNERS';

export type MarketSortDirection = 'asc' | 'desc';

export type MarketMatchTeam = {
  id?: string;
  name?: string | null;
  image?: string | null;
};

export type MarketNextMatch = {
  id: string;
  homeTeam?: MarketMatchTeam | null;
  awayTeam?: MarketMatchTeam | null;
} | null;

export type MarketNewsItem = {
  id?: string;
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  createdAt?: string | Date | null;
};

export type ProcessedMarketAsset = Asset & {
  marketPrice: number;
  fairValue: number;
  premiumDiscountPercent: number;
  opportunityScore: number;
  momentum: number;
  marketDemand: number;
  volatilityScore: number;
  score: number;
  ownersCount: number;
  change: number;
};

export type MarketClientProps = {
  usersCount?: number;
  todayVolume?: number;
  todayTradesCount?: number;
  assetsCount?: number;
  teamsCount?: number;
  playersCount?: number;
  nextMatchDate?: string | null;
  nextMatch?: MarketNextMatch;
  recentNews?: MarketNewsItem[];
};
