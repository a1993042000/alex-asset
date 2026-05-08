import { fromYahooSymbol, toYahooSymbol, FX_TICKER_NAME } from './portfolio';
import type { Market } from './types';

/**
 * Yahoo Finance v8 chart endpoint. No API key, no crumb required.
 *
 *   GET https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
 *     ?interval=1d
 *     &period1=<unix_seconds>     (optional)
 *     &period2=<unix_seconds>     (optional)
 *     &range=5d                   (optional, alternative to period1/period2)
 *
 * Response shape (only the fields we use):
 *   { chart: { result: [ { meta: { regularMarketPrice, regularMarketTime, symbol },
 *                          timestamp: number[],
 *                          indicators: { quote: [{ close: (number|null)[] }] } } ] } }
 */

const YAHOO_FX_SYMBOL = 'TWD=X';
const UA = 'Mozilla/5.0 (compatible; AlexAsset/1.0)';

interface YahooChartMeta {
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    chartPreviousClose?: number;
    exchangeName?: string;     // e.g. 'TAI' (TWSE), 'TWO' (TPEx OTC), 'YHD' (Yahoo archive – stale!)
    firstTradeDate?: number | null;
}

interface YahooChartResult {
    meta?: YahooChartMeta;
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }> };
}

interface YahooChartResp {
    chart: {
        result?: YahooChartResult[];
        error?: { code: string; description: string } | null;
    };
}

/**
 * Yahoo sometimes returns a stale archived row on the pseudo-exchange "YHD"
 * for OTC tickers queried with a `.TW` suffix. Those rows have ancient
 * regularMarketTime values (years old) and must not be trusted.
 */
function isStaleResult(r: YahooChartResult | undefined): boolean {
    if (!r || !r.meta) return true;
    if (r.meta.exchangeName === 'YHD') return true;
    if (r.meta.firstTradeDate == null) return true;
    return false;
}

async function yahooChart(symbol: string, params: Record<string, string | number>): Promise<YahooChartResp> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs.toString()}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
    return (await res.json()) as YahooChartResp;
}

function dateInTaipei(d: Date | number): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(new Date(d));
}

export interface TickerKey {
    ticker: string;
    market: Market;
}

export interface QuoteResult {
    ticker: string;       // stored ticker (without .TW suffix), or 'USDTWD' for FX
    yahooSymbol: string;
    market: Market | 'FX';
    close: number;
    asOfDate: string;     // YYYY-MM-DD (Asia/Taipei)
}

async function fetchOneLatest(symbol: string): Promise<QuoteResult | null> {
    const j = await yahooChart(symbol, { interval: '1d', range: '5d' });
    const r = j.chart.result?.[0];
    if (isStaleResult(r)) return null;
    const meta = r!.meta!;
    const close = meta.regularMarketPrice ?? meta.chartPreviousClose;
    if (typeof close !== 'number') return null;
    const ts = meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();
    const asOfDate = dateInTaipei(ts);
    const sym = meta.symbol ?? symbol;

    if (sym === YAHOO_FX_SYMBOL) {
        return { ticker: FX_TICKER_NAME, yahooSymbol: sym, market: 'FX', close, asOfDate };
    }
    const market: Market = /\.(TW|TWO)$/i.test(sym) ? 'TW' : 'US';
    return { ticker: fromYahooSymbol(sym), yahooSymbol: sym, market, close, asOfDate };
}

/**
 * Try Yahoo with `.TW` first; if that returns no data, fall back to `.TWO`
 * (上櫃/櫃買 stocks). For US tickers no fallback is attempted.
 */
async function tryWithTwFallback<T>(
    primarySymbol: string,
    fetcher: (symbol: string) => Promise<T | null | undefined>,
    isEmpty: (v: T | null | undefined) => boolean,
): Promise<T | null> {
    const first = await fetcher(primarySymbol);
    if (!isEmpty(first)) return first as T;
    if (primarySymbol.endsWith('.TW')) {
        const alt = primarySymbol.slice(0, -3) + '.TWO';
        const second = await fetcher(alt);
        if (!isEmpty(second)) return second as T;
    }
    return null;
}

/**
 * Fetch latest close prices for the given tickers + USD/TWD FX rate.
 * Each ticker is fetched in parallel; failures for individual tickers are skipped.
 */
export async function fetchLatestQuotes(tickers: TickerKey[]): Promise<QuoteResult[]> {
    const stockJobs = tickers.map((t) =>
        tryWithTwFallback(
            toYahooSymbol(t.ticker, t.market),
            (s) => fetchOneLatest(s),
            (v) => v == null,
        ),
    );
    const fxJob = fetchOneLatest(YAHOO_FX_SYMBOL);
    const settled = await Promise.allSettled([...stockJobs, fxJob]);
    const out: QuoteResult[] = [];
    for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) out.push(r.value);
    }
    return out;
}

export async function fetchHistorical(
    ticker: string,
    market: Market,
    from: string,
    to: string,
): Promise<{ date: string; close: number }[]> {
    const symbol = toYahooSymbol(ticker, market);
    const result = await tryWithTwFallback(
        symbol,
        (s) => fetchHistoricalRaw(s, from, to),
        (v) => !v || v.length === 0,
    );
    return result ?? [];
}

export async function fetchHistoricalFx(from: string, to: string) {
    return fetchHistoricalRaw(YAHOO_FX_SYMBOL, from, to);
}

async function fetchHistoricalRaw(symbol: string, from: string, to: string) {
    const period1 = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000);
    const period2 = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000) + 86400;
    const j = await yahooChart(symbol, { interval: '1d', period1, period2 });
    const r = j.chart.result?.[0];
    if (isStaleResult(r)) return [];
    const ts = r!.timestamp ?? [];
    const closes = r!.indicators?.quote?.[0]?.close ?? [];
    const rows: { date: string; close: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number') continue;
        rows.push({ date: dateInTaipei(ts[i] * 1000), close: c });
    }
    return rows;
}
