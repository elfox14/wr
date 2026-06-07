import { create } from 'zustand';

export interface Asset {
  id: string;
  type: string;
  name: string;
  code: string;
  image: string;
  current_price: number;
  fairValue?: number;
  marketPrice?: number;
  high_price: number;
  low_price: number;
  market_cap: string;
  volume: string;
  change: number;
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
  
  fetchAssets: () => Promise<void>;
  fetchMatches: () => Promise<void>;
  fetchPortfolio: () => Promise<void>;
  fetchPortfolioAnalytics: () => Promise<void>;
  buyAsset: (assetId: string, quantity: number) => Promise<void>;
  sellAsset: (assetId: string, quantity: number) => Promise<void>;
  setCaptain: (assetId: string) => Promise<void>;
  addNotification: (msg: string) => void;
  clearNotifications: () => void;
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

  fetchAssets: async () => {
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      set({ assets: data });
    } catch (err) {
      console.error(err);
    }
  },

  fetchMatches: async () => {
    try {
      const res = await fetch('/api/matches');
      const data = await res.json();
      set({ matches: data });
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
        body: JSON.stringify({ assetId, type: 'BUY', quantity }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        get().addNotification(data.message);
        await get().fetchPortfolio();
      } else {
        get().addNotification(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  },

  sellAsset: async (assetId: string, quantity: number) => {
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        body: JSON.stringify({ assetId, type: 'SELL', quantity }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        get().addNotification(data.message);
        await get().fetchPortfolio();
      } else {
        get().addNotification(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  },

  setCaptain: async (assetId: string) => {
    try {
      const res = await fetch('/api/portfolio/captain', {
        method: 'POST',
        body: JSON.stringify({ assetId }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.success) {
        get().addNotification(data.message);
        await get().fetchPortfolio(); // Refresh state
      } else {
        get().addNotification(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  },

  addNotification: (msg: string) => {
    set(state => ({ notifications: [...state.notifications, msg] }));
    setTimeout(() => {
      set(state => ({ notifications: state.notifications.slice(1) }));
    }, 5000);
  },

  clearNotifications: () => set({ notifications: [] }),
}));
