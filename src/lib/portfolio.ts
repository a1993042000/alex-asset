import type { PositionRow, Transaction } from './types';

const FX_TICKER = 'USDTWD';

export interface ComputeInput {
    transactions: Transaction[];
    latestPrices: Map<string, number>;   // ticker -> latest close (in original currency)
    fxUsdTwd: number;                    // latest USD/TWD rate
}

/**
 * Aggregate transactions by ticker into PositionRow[] using the
 * net-cash-flow profit method (no FIFO, no average cost basis).
 *
 *   profit = current market value + cumulative sells − cumulative buys
 *
 * All TWD-denominated outputs use the latest FX rate for USD ⇄ TWD.
 */
export function computePositions(input: ComputeInput): PositionRow[] {
    const { transactions, latestPrices, fxUsdTwd } = input;
    const groups = new Map<string, Transaction[]>();
    for (const t of transactions) {
        const key = `${t.market}:${t.ticker}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
    }

    const out: PositionRow[] = [];
    for (const txs of groups.values()) {
        const first = txs[0];
        const ticker = first.ticker;
        const market = first.market;
        const currency = first.currency;

        let shares = 0;
        let totalBoughtShares = 0;
        let totalBoughtAmount = 0;
        let netCashflow = 0; // sells − buys (in original currency)

        for (const t of txs) {
            const amount = t.shares * t.price;
            if (t.action === 'buy') {
                shares += t.shares;
                totalBoughtShares += t.shares;
                totalBoughtAmount += amount;
                netCashflow -= amount;
            } else {
                shares -= t.shares;
                netCashflow += amount;
            }
        }

        const lastPrice = latestPrices.get(ticker) ?? null;
        const fx = currency === 'USD' ? fxUsdTwd : 1;
        const marketValueLocal = lastPrice != null ? shares * lastPrice : 0;
        const marketValueTwd = marketValueLocal * fx;
        const netInvestedTwd = -netCashflow * fx;       // (buys − sells) in TWD
        const profitTwd = marketValueTwd - netInvestedTwd;
        const avgCost = totalBoughtShares > 0 ? totalBoughtAmount / totalBoughtShares : 0;

        out.push({
            ticker,
            market,
            currency,
            shares,
            avg_cost: avgCost,
            last_price: lastPrice,
            market_value_twd: marketValueTwd,
            net_invested_twd: netInvestedTwd,
            profit_twd: profitTwd,
        });
    }

    out.sort((a, b) => Math.abs(b.market_value_twd) - Math.abs(a.market_value_twd));
    return out;
}

/**
 * Compute today's overall numbers from a positions list.
 */
export function summarizePositions(positions: PositionRow[]) {
    let mv = 0, ni = 0;
    for (const p of positions) {
        mv += p.market_value_twd;
        ni += p.net_invested_twd;
    }
    return {
        market_value_twd: mv,
        net_invested_twd: ni,
        profit_twd: mv - ni,
    };
}

/**
 * Build the latestPrices map from a flat list of (ticker, close) pairs,
 * keeping only the most recent date per ticker.
 */
export function buildLatestPriceMap(rows: { ticker: string; date: string; close_price: number }[]) {
    const latest = new Map<string, { date: string; close: number }>();
    for (const r of rows) {
        const cur = latest.get(r.ticker);
        if (!cur || r.date > cur.date) latest.set(r.ticker, { date: r.date, close: r.close_price });
    }
    const map = new Map<string, number>();
    let maxDate: string | null = null;
    for (const [k, v] of latest) {
        map.set(k, v.close);
        if (!maxDate || v.date > maxDate) maxDate = v.date;
    }
    return { map, maxDate };
}

export const FX_TICKER_NAME = FX_TICKER;

/**
 * Convert a stock ticker into its yahoo-finance2 query symbol.
 * - US stocks: same symbol (e.g. AAPL)
 * - TW stocks: append .TW (e.g. 2330 -> 2330.TW)
 * - If the ticker already carries a .TW or .TWO suffix, return as-is.
 *
 * For TW OTC (上櫃) tickers, the fetcher in quotes.ts auto-falls back from
 * .TW to .TWO when the .TW lookup returns stale/archived data, so callers
 * never need a hardcoded list.
 */
export function toYahooSymbol(ticker: string, market: 'US' | 'TW'): string {
    const t = ticker.trim().toUpperCase();
    if (market === 'US') return t;
    if (t.endsWith('.TW') || t.endsWith('.TWO')) return t;
    return `${t}.TW`;
}

/**
 * Reverse: stored ticker (without market suffix) from yahoo symbol.
 */
export function fromYahooSymbol(yahooSymbol: string): string {
    return yahooSymbol.replace(/\.(TW|TWO)$/i, '');
}
