import type { PortfolioHistoryRow, PositionRow, Transaction } from './types';

const FX_TICKER = 'USDTWD';

export interface ComputeInput {
    transactions: Transaction[];
    latestPrices: Map<string, number>;   // ticker -> latest close (in original currency)
    fxUsdTwd: number;                    // latest USD/TWD rate
}

/**
 * Aggregate transactions by ticker into PositionRow[] using FIFO lot matching.
 *
 *   - avg_cost     : weighted average of remaining FIFO lots (after sells)
 *   - realized P&L : Σ(sell_price − lot_cost) × take, accumulated as sells deplete lots
 *   - unrealized   : (last_price − avg_cost) × remaining_shares
 *   - profit_twd   : realized + unrealized (mathematically ≡ market_value − net_invested)
 *
 * All TWD-denominated outputs use the latest FX rate for USD ⇄ TWD.
 * Over-sells (sells exceeding accumulated buys) leave the remaining FIFO lots
 * empty; the excess is treated as a zero-cost realized event so the books still
 * balance against the cash-flow method.
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

        // FIFO processing requires chronological order; tie-break by created_at
        // so multiple intra-day txns still match in entry order.
        const ordered = [...txs].sort((a, b) => {
            if (a.trade_date !== b.trade_date) return a.trade_date < b.trade_date ? -1 : 1;
            return a.created_at < b.created_at ? -1 : 1;
        });

        const lots: { shares: number; price: number }[] = [];
        let shares = 0;
        let netCashflow = 0;       // sells − buys (in original currency)
        let realizedLocal = 0;     // FIFO realized P&L in original currency

        for (const t of ordered) {
            const amount = t.shares * t.price;
            if (t.action === 'buy') {
                shares += t.shares;
                netCashflow -= amount;
                lots.push({ shares: t.shares, price: t.price });
            } else {
                shares -= t.shares;
                netCashflow += amount;
                let remaining = t.shares;
                while (remaining > 1e-9 && lots.length > 0) {
                    const lot = lots[0];
                    const take = Math.min(lot.shares, remaining);
                    realizedLocal += take * (t.price - lot.price);
                    lot.shares -= take;
                    remaining -= take;
                    if (lot.shares <= 1e-9) lots.shift();
                }
                // If `remaining > 0`, this is an over-sell. Treat the excess as a
                // zero-cost realized credit so realized+unrealized still equals
                // the cash-flow profit. (Realistically you can't sell what you
                // don't own; this branch keeps the math consistent for bad data.)
                if (remaining > 1e-9) {
                    realizedLocal += remaining * t.price;
                }
            }
        }

        const remainingShares = lots.reduce((s, l) => s + l.shares, 0);
        const remainingCost = lots.reduce((s, l) => s + l.shares * l.price, 0);
        const avgCost = remainingShares > 1e-9 ? remainingCost / remainingShares : 0;

        const lastPrice = latestPrices.get(ticker) ?? null;
        const fx = currency === 'USD' ? fxUsdTwd : 1;
        const marketValueLocal = lastPrice != null ? shares * lastPrice : 0;
        const marketValueTwd = marketValueLocal * fx;
        const netInvestedTwd = -netCashflow * fx;
        const unrealizedLocal = lastPrice != null && remainingShares > 1e-9
            ? (lastPrice - avgCost) * remainingShares
            : 0;
        const unrealizedTwd = unrealizedLocal * fx;
        const realizedTwd = realizedLocal * fx;
        const profitTwd = unrealizedTwd + realizedTwd;

        out.push({
            ticker,
            market,
            currency,
            shares,
            avg_cost: avgCost,
            last_price: lastPrice,
            market_value_twd: marketValueTwd,
            net_invested_twd: netInvestedTwd,
            realized_profit_twd: realizedTwd,
            unrealized_profit_twd: unrealizedTwd,
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

export interface PeriodStat {
    pnlTwd: number;
    returnPct: number;
    hasData: boolean;
    baselineDate: string | null;
}

/**
 * Period P&L: today's profit minus the profit on the latest snapshot at or
 * before baselineDate. Return % uses that snapshot's market_value as denom.
 */
export function periodStat(
    todayProfitTwd: number,
    history: PortfolioHistoryRow[],
    baselineDate: string,
): PeriodStat {
    if (history.length === 0) {
        return { pnlTwd: 0, returnPct: 0, hasData: false, baselineDate: null };
    }
    let baseline: PortfolioHistoryRow | null = null;
    for (const h of history) {
        if (h.date <= baselineDate) baseline = h;
        else break;
    }
    if (!baseline) {
        return { pnlTwd: 0, returnPct: 0, hasData: false, baselineDate: null };
    }
    const pnlTwd = todayProfitTwd - Number(baseline.profit_twd);
    const denom = Number(baseline.market_value_twd);
    const returnPct = denom > 0 ? (pnlTwd / denom) * 100 : 0;
    return { pnlTwd, returnPct, hasData: true, baselineDate: baseline.date };
}

/**
 * Baseline dates for the six standard periods, computed in Asia/Taipei.
 *
 * - 今日:   yesterday's close
 * - 7/30/60/120 天: N calendar days ago
 * - YTD:    last day of previous calendar year
 */
export function periodBaselines(
    todayInTaipei = new Date(),
): { key: 'today' | 'd7' | 'd30' | 'd60' | 'd120' | 'ytd'; label: string; date: string }[] {
    // Anchor to Asia/Taipei calendar so it matches the snapshot dates.
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todayStr = fmt.format(todayInTaipei); // YYYY-MM-DD in Taipei
    const todayDate = new Date(todayStr + 'T00:00:00Z');
    const back = (days: number) => {
        const d = new Date(todayDate);
        d.setUTCDate(d.getUTCDate() - days);
        return d.toISOString().slice(0, 10);
    };
    const year = parseInt(todayStr.slice(0, 4), 10);
    const yearStart = `${year - 1}-12-31`;
    return [
        { key: 'today', label: '今日', date: back(1) },
        { key: 'd7', label: '7 天', date: back(7) },
        { key: 'd30', label: '30 天', date: back(30) },
        { key: 'd60', label: '60 天', date: back(60) },
        { key: 'd120', label: '120 天', date: back(120) },
        { key: 'ytd', label: 'YTD', date: yearStart },
    ];
}

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
