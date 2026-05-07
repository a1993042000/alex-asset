import DashboardManager from '@/components/DashboardManager';
import { supabase } from '@/lib/supabase';
import { buildLatestPriceMap, computePositions, summarizePositions, FX_TICKER_NAME } from '@/lib/portfolio';
import type { DailyPrice, PortfolioHistoryRow, Transaction, DashboardData } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getDashboardData(): Promise<DashboardData> {
    const [txRes, priceRes, histRes] = await Promise.all([
        supabase.from('asset_transactions').select('*').order('trade_date', { ascending: false }),
        supabase.from('asset_daily_prices').select('*').order('date', { ascending: false }).limit(2000),
        supabase.from('asset_portfolio_history').select('*').order('date', { ascending: true }),
    ]);

    const transactions = (txRes.data || []) as Transaction[];
    const prices = (priceRes.data || []) as DailyPrice[];
    const history = (histRes.data || []) as PortfolioHistoryRow[];

    const { map: latestPrices, maxDate } = buildLatestPriceMap(prices);
    const fxUsdTwd = latestPrices.get(FX_TICKER_NAME) ?? 32; // sane fallback if cron hasn't run yet
    const stockPrices = new Map(latestPrices);
    stockPrices.delete(FX_TICKER_NAME);

    const positions = computePositions({
        transactions,
        latestPrices: stockPrices,
        fxUsdTwd,
    });
    const summary = summarizePositions(positions);

    return {
        positions,
        history,
        transactions,
        fxUsdTwd,
        todayMarketValueTwd: summary.market_value_twd,
        todayProfitTwd: summary.profit_twd,
        todayInvestedTwd: summary.net_invested_twd,
        pricesAsOf: maxDate,
    };
}

export default async function Home() {
    const data = await getDashboardData();
    return <DashboardManager data={data} />;
}
