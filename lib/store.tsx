import { create } from 'zustand';
import { withTeamDisplay } from '@/lib/teamDisplay';

export interface Asset {
  id: string;
  type: string;
  name: string;
  code: string;
  image: string;
  current_price?: number;
  fairValue?: number;
  marketPrice?: number;
  high_price?: number;
  low_price?: number;
  market_cap?: string;
  volume?: string;
  change?: number;
  priceHistory?: { price: number; timestamp: string }[];
  group?: string | null;
  continent?: string | null;
  fifaRank?: number | null;
  position?: string | null;
  playerTier?: number | null;
  roleImportance?: number | null;
  score?: number | null;
  isAvailable?: boolean;
  age?: number | null;
  club?: string | null;
  coach?: string | null;
  participations?: number | null;
  injuries?: number | null;
  harmony?: number | null;
  riskIndex?: number | null;
  ownersCount?: number;
  globalMarketValue?: number | null;
  popularity?: number | null;
  momentum?: number | null;
  marketDemand?: number | null;
  worldCupLegacy?: number | null;
  fundamental?: number | null;
  volatilityScore?: number | null;
  teamId?: string | null;
  team?: Asset | null;
  players?: Asset[];
  news?: any[];
  marketNews?: any[];
  arabicName?: string | null;
  flagEmoji?: string | null;
  flagUrl?: string | null;
  displayName?: string | null;
  originalName?: string | null;
}

export interface Holding {
  id: string;
  assetId: string;
  quantity: number;
  avg_buy_price: number;
  positionType?: string;
  currentValue?: number;
  profitLoss?: number;
  profitLossPercent?: number;
  tradePrice?: number;
  fairValue?: number;
  costBasis?: number;
  pnl?: number;
  pnlPercent?: number;
  premiumDiscountPercent?: number;
  volatilityScore?: number;
  momentum?: number;
  marketDemand?: number;
  asset?: Asset;
}

export interface PortfolioAnalytics {
  balance: number;
  holdingsValue: number;
  netWorth: number;
  totalCostBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  bestPerformer: Holding | null;
  worstPerformer: Holding | null;
  allocationByType: { teams: number; players: number };
  allocationByPosition: { GK: number; DEF: number; MID: number; FWD: number };
  allocationByRisk: { low: number; medium: number; high: number };
  portfolioRisk: number;
  riskLabel: string;
  riskLabelAr: string;
  insights: string[];
  holdings: Holding[];
}

export interface UserStats {
  id: string;
  username: string;
  balance: number;
  total_profit: number;
  total_holdings_value: number;
  net_worth: number;
  referralCode?: string;
  referredById?: string;
  lastDailyReward?: string;
  lastWeeklyReward?: string;
}

export interface Achievement {
  id: string;
  badgeId: string;
  earnedAt: string;
}

export interface Match {
  id: string;
  homeTeam: Asset;
  awayTeam: Asset;
  matchDate: string;
  status: string;
  homeScore: number;
  awayScore: number;
  groupPhase: string;
}

type AssetFetchView = 'full' | 'groups' | 'market';
type MatchFetchFilter = 'today' | 'finished' | 'group' | 'groups';

interface AppState {
  assets: Asset[];
  matches: Match[];
  holdings: Holding[];
  userStats: UserStats | null;
  captainId: string | null;
  achievements: Achievement[];
  portfolioAnalytics: PortfolioAnalytics | null;
  loading: boolean;
  notifications: string[];
  
  fetchAssets: (view?: AssetFetchView) => Promise<void>;
  fetchMatches: (filter?: MatchFetchFilter, group?: string) => Promise<void>;
  fetchPortfolio: () => Promise<void>;
  fetchPortfolioAnalytics: () => Promise<void>;
  buyAsset: (assetId: string, quantity: number) => Promise<void>;
  sellAsset: (assetId: string, quantity: number) => Promise<void>;
  setCaptain: (assetId: string) => Promise<void>;
  addNotification: (msg: string) => void;
  clearNotifications: () => void;
  showInsufficientFundsModal: boolean;
  setShowInsufficientFundsModal: (show: boolean) => void;
}

function localizeAsset(asset: any) {
  if (asset?.type === 'TEAM' || asset?.group || asset?.fifaRank) return withTeamDisplay(asset);
  return asset;
}

function localizeMatch(match: any) {
  if (!match) return match;
  return {
    ...match,
    homeTeam: localizeAsset(match.homeTeam),
    awayTeam: localizeAsset(match.awayTeam),
  };
}

export const useStore = create<AppState>((set, get) => ({
  assets: [],
  matches: [],
  holdings: [],
  userStats: null,
  captainId: null,
  achievements: [],
  portfolioAnalytics: null,
  loading: true,
  notifications: [],
  showInsufficientFundsModal: false,
  setShowInsufficientFundsModal: (show) => set({ showInsufficientFundsModal: show }),

  fetchAssets: async (view = 'groups') => {
    try {
      const query = view === 'full' ? '' : `?view=${encodeURIComponent(view)}`;
      const res = await fetch(`/api/assets${query}`);
      const data = await res.json();
      set({ assets: Array.isArray(data) ? data.map(localizeAsset) : data });
    } catch (err) {
      console.error(err);
    }
  },

  fetchMatches: async (filter = 'today', group) => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'today') params.set('filter', filter);
      if (group) params.set('group', group);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/matches${query}`);
      const data = await res.json();
      set({ matches: Array.isArray(data) ? data.map(localizeMatch) : data });
    } catch (err) {
      console.error(err);
    }
  },

  fetchPortfolio: async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) {
        set({ holdings: [], userStats: null, captainId: null, achievements: [] });
        return;
      }
      const data = await res.json();
      set({ 
        holdings: data.holdings || [], 
        userStats: data.user || null,
        captainId: data.captain?.assetId || null,
        achievements: data.achievements || []
      });
    } catch (err) {
      console.error(err);
      set({ holdings: [], userStats: null, captainId: null, achievements: [] });
    }
  },

  fetchPortfolioAnalytics: async () => {
    try {
      const res = await fetch('/api/portfolio/analytics');
      if (!res.ok) {
        set({ portfolioAnalytics: null });
        return;
      }
      const data = await res.json();
      set({ portfolioAnalytics: data });
    } catch (err) {
      console.error(err);
      set({ portfolioAnalytics: null });
    }
  },

  buyAsset: async (assetId: string, quantity: number) => {
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, quantity, type: 'BUY' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === 'Insufficient funds') set({ showInsufficientFundsModal: true });
        throw new Error(data?.error || 'Trade failed');
      }
      await get().fetchPortfolio();
      get().addNotification('تم تنفيذ الشراء بنجاح');
    } catch (err) {
      console.error(err);
      get().addNotification('فشل تنفيذ الشراء');
    }
  },

  sellAsset: async (assetId: string, quantity: number) => {
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, quantity, type: 'SELL' })
      });
      if (!res.ok) throw new Error('Trade failed');
      await get().fetchPortfolio();
      get().addNotification('تم تنفيذ البيع بنجاح');
    } catch (err) {
      console.error(err);
      get().addNotification('فشل تنفيذ البيع');
    }
  },

  setCaptain: async (assetId: string) => {
    try {
      const res = await fetch('/api/captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      });
      if (!res.ok) throw new Error('Captain update failed');
      set({ captainId: assetId });
      get().addNotification('تم تعيين القائد بنجاح');
    } catch (err) {
      console.error(err);
      get().addNotification('فشل تعيين القائد');
    }
  },

  addNotification: (msg) => set((state) => ({ notifications: [...state.notifications, msg] })),
  clearNotifications: () => set({ notifications: [] }),
}));
