export type Market = 'US' | 'TW';
export type Action = 'buy' | 'sell';
export type Currency = 'USD' | 'TWD';

export interface Transaction {
    id: string;
    trade_date: string;
    ticker: string;
    market: Market;
    action: Action;
    shares: number;
    price: number;
    currency: Currency;
    note: string | null;
    created_at: string;
}

export interface DailyPrice {
    ticker: string;
    date: string;
    close_price: number;
}

export interface PortfolioHistoryRow {
    date: string;
    market_value_twd: number;
    net_invested_twd: number;
    profit_twd: number;
    fx_usd_twd: number;
}

export interface PositionRow {
    ticker: string;
    market: Market;
    currency: Currency;
    shares: number;                  // current net shares held
    avg_cost: number;                // FIFO avg cost of remaining lots (original currency)
    last_price: number | null;       // latest close in original currency
    market_value_twd: number;
    net_invested_twd: number;        // (buy − sell) cumulative in TWD using current FX
    realized_profit_twd: number;     // realized P&L from FIFO-matched sells, in TWD
    unrealized_profit_twd: number;   // (last_price − avg_cost) × shares × FX
    profit_twd: number;              // realized + unrealized (≡ market_value − net_invested)
}

export interface DashboardData {
    positions: PositionRow[];
    history: PortfolioHistoryRow[];
    transactions: Transaction[];
    fxUsdTwd: number;
    todayMarketValueTwd: number;
    todayProfitTwd: number;
    todayInvestedTwd: number;
    pricesAsOf: string | null;  // latest date in daily_prices
}
