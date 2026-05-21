'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, List, LineChart as LineChartIcon } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import SummaryCards from './SummaryCards';
import PositionsTable from './PositionsTable';
import TransactionForm from './TransactionForm';
import TransactionsTable from './TransactionsTable';
import NetValueChart from './NetValueChart';
import ProfitChart from './ProfitChart';
import RefreshButton from './RefreshButton';
import BackfillButton from './BackfillButton';

type TabType = 'positions' | 'transactions' | 'curves';
type ChartPeriod = '30d' | '60d' | '120d' | 'ytd' | 'all';

const PERIOD_BUTTONS: { id: ChartPeriod; label: string }[] = [
    { id: '30d', label: '30天' },
    { id: '60d', label: '60天' },
    { id: '120d', label: '120天' },
    { id: 'ytd', label: 'YTD' },
    { id: 'all', label: 'ALL' },
];

function periodCutoff(period: ChartPeriod): string | null {
    if (period === 'all') return null;
    const now = new Date();
    if (period === 'ytd') {
        return `${now.getFullYear()}-01-01`;
    }
    const days = period === '30d' ? 30 : period === '60d' ? 60 : 120;
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export default function DashboardManager({ data }: { data: DashboardData }) {
    const [activeTab, setActiveTab] = useState<TabType>('positions');
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('120d');
    const [livePositions, setLivePositions] = useState(data.positions);
    const [liveAsOf, setLiveAsOf] = useState<string | null>(data.pricesAsOf);

    const chartHistory = useMemo(() => {
        const cutoff = periodCutoff(chartPeriod);
        return cutoff ? data.history.filter(h => h.date >= cutoff) : data.history;
    }, [data.history, chartPeriod]);

    const tabs = [
        { id: 'positions' as TabType, name: '持有部位', icon: <LayoutGrid size={18} /> },
        { id: 'transactions' as TabType, name: '交易紀錄', icon: <List size={18} /> },
        { id: 'curves' as TabType, name: '淨值與損益', icon: <LineChartIcon size={18} /> },
    ];

    const summary = livePositions.reduce(
        (acc, p) => {
            acc.mv += p.market_value_twd;
            acc.ni += p.net_invested_twd;
            return acc;
        },
        { mv: 0, ni: 0 }
    );
    const profit = summary.mv - summary.ni;

    return (
        <div className="flex flex-col min-h-full">
            <nav className="flex items-center justify-center p-4 border-b border-zinc-800/50 bg-zinc-950">
                <div className="flex w-full max-w-lg rounded-xl bg-zinc-900/50 p-1">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                                    }`}
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.name}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            <div className="flex-1">
                <main className="mx-auto max-w-5xl px-4 pt-6 pb-24">
                    <SummaryCards
                        marketValueTwd={summary.mv}
                        netInvestedTwd={summary.ni}
                        profitTwd={profit}
                        history={data.history}
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                        {liveAsOf && (
                            <span className="text-xs text-zinc-500">報價更新：{liveAsOf}</span>
                        )}
                        <RefreshButton
                            onUpdate={(positions, asOf) => {
                                setLivePositions(positions);
                                setLiveAsOf(asOf);
                            }}
                        />
                    </div>

                    <div className="mt-6">
                        {activeTab === 'positions' && (
                            <PositionsTable positions={livePositions} fxUsdTwd={data.fxUsdTwd} />
                        )}
                        {activeTab === 'transactions' && (
                            <div className="space-y-6">
                                <TransactionForm />
                                <TransactionsTable transactions={data.transactions} fxUsdTwd={data.fxUsdTwd} />
                            </div>
                        )}
                        {activeTab === 'curves' && (
                            <div className="space-y-6">
                                <div className="flex flex-wrap gap-2">
                                    {PERIOD_BUTTONS.map(({ id, label }) => {
                                        const active = chartPeriod === id;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => setChartPeriod(id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active
                                                    ? 'bg-zinc-700 text-white'
                                                    : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <NetValueChart history={chartHistory} />
                                <ProfitChart history={chartHistory} />
                                <div className="flex justify-end">
                                    <BackfillButton />
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
