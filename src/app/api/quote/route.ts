import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { fetchLatestQuotes, type TickerKey } from '@/lib/quotes';
import { computePositions, FX_TICKER_NAME } from '@/lib/portfolio';
import type { Transaction } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

function makeClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

/**
 * Live quote refresh — does NOT write to DB. Returns a fresh positions array
 * computed from current transactions + just-fetched prices.
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

    const fxQuote = quotes.find((q) => q.ticker === FX_TICKER_NAME);
    const fxUsdTwd = fxQuote?.close ?? 32;
    const latestPrices = new Map<string, number>();
    for (const q of quotes) {
        if (q.ticker !== FX_TICKER_NAME) latestPrices.set(q.ticker, q.close);
    }

    const positions = computePositions({ transactions, latestPrices, fxUsdTwd });
    const asOf = quotes.reduce<string | null>((acc, q) => (acc && acc > q.asOfDate ? acc : q.asOfDate), null);

    return NextResponse.json({ ok: true, positions, fxUsdTwd, asOf });
}
