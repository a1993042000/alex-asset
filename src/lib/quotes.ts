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

interface YahooChartResp {
    chart: {
        result?: Array<{
            meta?: {
                symbol?: string;
                regularMarketPrice?: number;
                regularMarketTime?: number;
                chartPreviousClose?: number;
            };
            timestamp?: number[];
            indicators?: {
                quote?: Array<{ close?: Array<number | null> }>;
            };
        }>;
        error?: { code: string; description: string } | null;
    };
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
    if (!r || !r.meta) return null;
    const close = r.meta.regularMarketPrice ?? r.meta.chartPreviousClose;
    if (typeof close !== 'number') return null;
    const ts = r.meta.regularMarketTime ? r.meta.regularMarketTime * 1000 : Date.now();
    const asOfDate = dateInTaipei(ts);
    const sym = r.meta.symbol ?? symbol;

    if (sym === YAHOO_FX_SYMBOL) {
        return { ticker: FX_TICKER_NAME, yahooSymbol: sym, market: 'FX', close, asOfDate };
    }
    const market: Market = /\.(TW|TWO)$/i.test(sym) ? 'TW' : 'US';
    return { ticker: fromYahooSymbol(sym), yahooSymbol: sym, market, close, asOfDate };
}

/**
 * Fetch latest close prices for the given tickers + USD/TWD FX rate.
 * Each ticker is fetched in parallel; failures for individual tickers are skipped.
 */
export async function fetchLatestQuotes(tickers: TickerKey[]): Promise<QuoteResult[]> {
    const symbols = [
        ...tickers.map((t) => toYahooSymbol(t.ticker, t.market)),
        YAHOO_FX_SYMBOL,
    ];
    const settled = await Promise.allSettled(symbols.map((s) => fetchOneLatest(s)));
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
    return fetchHistoricalRaw(symbol, from, to);
}

export async function fetchHistoricalFx(from: string, to: string) {
    return fetchHistoricalRaw(YAHOO_FX_SYMBOL, from, to);
}

async function fetchHistoricalRaw(symbol: string, from: string, to: string) {
    const period1 = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000);
    const period2 = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000) + 86400;
    const j = await yahooChart(symbol, { interval: '1d', period1, period2 });
    const r = j.chart.result?.[0];
    if (!r) return [];
    const ts = r.timestamp ?? [];
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const rows: { date: string; close: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number') continue;
        rows.push({ date: dateInTaipei(ts[i] * 1000), close: c });
    }
    return rows;
}
