import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { fetchLatestQuotes, type TickerKey } from '@/lib/quotes';
import { buildLatestPriceMap, computePositions, summarizePositions, FX_TICKER_NAME } from '@/lib/portfolio';
import type { Transaction } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

/**
 * Live quote refresh. Fetches fresh quotes, persists them to
 * asset_daily_prices, updates today's asset_portfolio_history snapshot,
 * and returns the recomputed positions for optimistic UI.
 */
export async function GET() {
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

    const heldKeys = new Map<string, TickerKey>();
    for (const t of transactions) {
        const key = `${t.market}:${t.ticker}`;
        if (!heldKeys.has(key)) heldKeys.set(key, { ticker: t.ticker, market: t.market });
    }

    let quotes;
    try {
        quotes = await fetchLatestQuotes(Array.from(heldKeys.values()));
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 502 });
    }

    // Persist quotes to asset_daily_prices so subsequent page loads see them.
    if (quotes.length > 0) {
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
    }

    const fxQuote = quotes.find((q) => q.ticker === FX_TICKER_NAME);
    const fxUsdTwd = fxQuote?.close ?? 32;

    const stockPrices = new Map<string, number>();
    for (const q of quotes) {
        if (q.ticker !== FX_TICKER_NAME) stockPrices.set(q.ticker, q.close);
    }

    // For positions we need every held ticker's latest price even if we
    // didn't get a fresh quote for it this call — fall back to whatever
    // asset_daily_prices already has on file.
    const { data: allPriceRows } = await supabase
        .from('asset_daily_prices')
        .select('ticker, date, close_price')
        .order('date', { ascending: false })
        .limit(2000);
    const { map: latestMap } = buildLatestPriceMap((allPriceRows || []) as { ticker: string; date: string; close_price: number }[]);
    for (const [k, v] of stockPrices) latestMap.set(k, v); // today's wins
    latestMap.delete(FX_TICKER_NAME);

    const positions = computePositions({ transactions, latestPrices: latestMap, fxUsdTwd });
    const summary = summarizePositions(positions);

    // Snapshot today's row so the curves tab reflects this refresh too.
    const today = todayInTaipei();
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

    const asOf = quotes.reduce<string | null>((acc, q) => (acc && acc > q.asOfDate ? acc : q.asOfDate), null);

    return NextResponse.json({ ok: true, positions, fxUsdTwd, asOf });
}
