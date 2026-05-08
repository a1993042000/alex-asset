import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { fetchHistorical, fetchHistoricalFx } from '@/lib/quotes';
import { FX_TICKER_NAME } from '@/lib/portfolio';
import type { Transaction } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

function makeClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

function todayInTaipei(): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(new Date());
}

function* eachDate(from: string, to: string) {
    const start = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        yield d.toISOString().slice(0, 10);
    }
}

/**
 * One-time backfill of asset_daily_prices and asset_portfolio_history
 * from the earliest transaction date up to today.
 *
 * Idempotent: re-running overwrites existing rows.
 */
export async function POST() {
    const cookieStore = await cookies();
    if (!cookieStore.get('auth_token')?.value) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = makeClient();
    const { data: txData, error: txErr } = await supabase
        .from('asset_transactions')
        .select('*')
        .order('trade_date', { ascending: true });
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    const transactions = (txData || []) as Transaction[];
    if (transactions.length === 0) {
        return NextResponse.json({ ok: true, message: 'no transactions, nothing to backfill' });
    }

    const earliest = transactions[0].trade_date;
    const today = todayInTaipei();

    // 1. Pull historical prices for each unique ticker.
    const uniqueTickers = new Map<string, { ticker: string; market: 'US' | 'TW' }>();
    for (const t of transactions) {
        uniqueTickers.set(`${t.market}:${t.ticker}`, { ticker: t.ticker, market: t.market });
    }

    const priceByTickerByDate = new Map<string, Map<string, number>>(); // ticker -> date -> close
    const fetchedTickers: string[] = [];
    const failedTickers: { ticker: string; reason: string }[] = [];
    for (const { ticker, market } of uniqueTickers.values()) {
        try {
            const rows = await fetchHistorical(ticker, market, earliest, today);
            if (rows.length === 0) {
                failedTickers.push({ ticker, reason: 'no historical data returned' });
                continue;
            }
            const dateMap = new Map<string, number>();
            for (const r of rows) dateMap.set(r.date, r.close);
            priceByTickerByDate.set(ticker, dateMap);
            fetchedTickers.push(ticker);

            const upsertRows = rows.map((r) => ({
                ticker,
                date: r.date,
                close_price: r.close,
                updated_at: new Date().toISOString(),
            }));
            await supabase.from('asset_daily_prices').upsert(upsertRows, { onConflict: 'ticker,date' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            failedTickers.push({ ticker, reason: msg });
        }
    }

    // 2. Pull historical FX
    const fxByDate = new Map<string, number>();
    try {
        const fxRows = await fetchHistoricalFx(earliest, today);
        for (const r of fxRows) fxByDate.set(r.date, r.close);

        const fxUpsert = fxRows.map((r) => ({
            ticker: FX_TICKER_NAME,
            date: r.date,
            close_price: r.close,
            updated_at: new Date().toISOString(),
        }));
        if (fxUpsert.length > 0) {
            await supabase.from('asset_daily_prices').upsert(fxUpsert, { onConflict: 'ticker,date' });
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: `historical FX fetch failed: ${msg}` }, { status: 502 });
    }

    // 3. Walk each calendar day, replay transactions up to that day, value with that day's prices.
    const lastClose = new Map<string, number>();
    let lastFx = 32;

    type SnapshotRow = {
        date: string;
        market_value_twd: number;
        net_invested_twd: number;
        fx_usd_twd: number;
        updated_at: string;
    };
    const snapshots: SnapshotRow[] = [];

    type Position = { shares: number; market: 'US' | 'TW'; currency: 'USD' | 'TWD' };
    const positionByTicker = new Map<string, Position>();
    let netInvestedUsd = 0; // running sum (buys − sells) in USD
    let netInvestedTwd = 0; // running sum (buys − sells) in TWD

    let txIdx = 0;
    for (const day of eachDate(earliest, today)) {
        // Apply transactions on this day
        while (txIdx < transactions.length && transactions[txIdx].trade_date === day) {
            const t = transactions[txIdx];
            const sign = t.action === 'buy' ? 1 : -1;
            const sharesDelta = sign * t.shares;
            const cashOutLocal = sign * t.shares * t.price; // positive when buying
            const cur = positionByTicker.get(`${t.market}:${t.ticker}`) ?? { shares: 0, market: t.market, currency: t.currency };
            cur.shares += sharesDelta;
            positionByTicker.set(`${t.market}:${t.ticker}`, cur);
            if (t.currency === 'USD') netInvestedUsd += cashOutLocal;
            else netInvestedTwd += cashOutLocal;
            txIdx++;
        }

        // Update last-known close for each ticker
        for (const [tk, byDate] of priceByTickerByDate) {
            const px = byDate.get(day);
            if (typeof px === 'number') lastClose.set(tk, px);
        }
        const fxToday = fxByDate.get(day);
        if (typeof fxToday === 'number') lastFx = fxToday;

        // Compute snapshot at end of this day
        let mvTwd = 0;
        for (const [key, pos] of positionByTicker) {
            if (Math.abs(pos.shares) < 1e-9) continue;
            const ticker = key.split(':')[1];
            const px = lastClose.get(ticker);
            if (typeof px !== 'number') continue;
            const fx = pos.currency === 'USD' ? lastFx : 1;
            mvTwd += pos.shares * px * fx;
        }
        const investedTwd = netInvestedTwd + netInvestedUsd * lastFx;
        snapshots.push({
            date: day,
            market_value_twd: mvTwd,
            net_invested_twd: investedTwd,
            fx_usd_twd: lastFx,
            updated_at: new Date().toISOString(),
        });
    }

    // Batch upsert in chunks to avoid huge payloads
    const CHUNK = 500;
    for (let i = 0; i < snapshots.length; i += CHUNK) {
        const chunk = snapshots.slice(i, i + CHUNK);
        const { error } = await supabase
            .from('asset_portfolio_history')
            .upsert(chunk, { onConflict: 'date' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        from: earliest,
        to: today,
        days: snapshots.length,
        tickers_fetched: fetchedTickers,
        tickers_failed: failedTickers,
    });
}
