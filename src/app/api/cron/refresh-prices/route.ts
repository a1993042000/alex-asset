import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchLatestQuotes, type TickerKey } from '@/lib/quotes';
import { buildLatestPriceMap, computePositions, summarizePositions, FX_TICKER_NAME } from '@/lib/portfolio';
import type { Transaction } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

export async function GET(req: Request) {
    // Vercel Cron sends 'Authorization: Bearer <CRON_SECRET>' if env var is set.
    // Allow any caller in dev; require the bearer token in prod when CRON_SECRET is configured.
    const expected = process.env.CRON_SECRET;
    if (expected) {
        const got = req.headers.get('authorization');
        if (got !== `Bearer ${expected}`) {
            // Vercel Cron is also identified by 'x-vercel-cron' header in some plans.
            const isVercelCron = req.headers.get('x-vercel-cron') === '1';
            if (!isVercelCron) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
    }

    const supabase = makeClient();

    // Determine which tickers we currently care about.
    const { data: txData, error: txErr } = await supabase
        .from('asset_transactions')
        .select('*')
        .order('trade_date', { ascending: true });
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    const transactions = (txData || []) as Transaction[];

    const heldKeys = new Map<string, TickerKey>();
    for (const t of transactions) {
        const key = `${t.market}:${t.ticker}`;
        if (!heldKeys.has(key)) heldKeys.set(key, { ticker: t.ticker, market: t.market });
    }
    const tickers = Array.from(heldKeys.values());

    // No transactions yet: just write today's FX so dashboard has a sane FX rate.
    let quotes;
    try {
        quotes = await fetchLatestQuotes(tickers);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: 'quote fetch failed: ' + msg }, { status: 502 });
    }

    if (quotes.length === 0) {
        return NextResponse.json({ ok: true, message: 'no quotes returned' });
    }

    // Upsert daily prices (key: ticker + date)
    const priceRows = quotes.map((q) => ({
        ticker: q.ticker,
        date: q.asOfDate,
        close_price: q.close,
        updated_at: new Date().toISOString(),
    }));
    const { error: priceErr } = await supabase
        .from('asset_daily_prices')
        .upsert(priceRows, { onConflict: 'ticker,date' });
    if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 500 });

    // Compute today's portfolio snapshot
    const today = todayInTaipei();
    const fxQuote = quotes.find((q) => q.ticker === FX_TICKER_NAME);
    const fxUsdTwd = fxQuote?.close ?? 32;
    const stockPrices = new Map<string, number>();
    for (const q of quotes) {
        if (q.ticker !== FX_TICKER_NAME) stockPrices.set(q.ticker, q.close);
    }

    // For ticker-level positions we still need full price history map (fallback to most recent on file).
    const { data: allPriceRows } = await supabase
        .from('asset_daily_prices')
        .select('ticker, date, close_price')
        .order('date', { ascending: false })
        .limit(2000);
    const { map: latestMap } = buildLatestPriceMap((allPriceRows || []) as { ticker: string; date: string; close_price: number }[]);
    // Make sure today's just-fetched values win.
    for (const [k, v] of stockPrices) latestMap.set(k, v);
    latestMap.delete(FX_TICKER_NAME);

    const positions = computePositions({ transactions, latestPrices: latestMap, fxUsdTwd });
    const summary = summarizePositions(positions);

    const { error: histErr } = await supabase
        .from('asset_portfolio_history')
        .upsert({
            date: today,
            market_value_twd: summary.market_value_twd,
            net_invested_twd: summary.net_invested_twd,
            fx_usd_twd: fxUsdTwd,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'date' });
    if (histErr) return NextResponse.json({ error: histErr.message }, { status: 500 });

    return NextResponse.json({
        ok: true,
        tickers_fetched: quotes.length,
        snapshot: {
            date: today,
            market_value_twd: summary.market_value_twd,
            net_invested_twd: summary.net_invested_twd,
            profit_twd: summary.profit_twd,
            fx_usd_twd: fxUsdTwd,
        },
    });
}
