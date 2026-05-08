'use client';

import { useState } from 'react';
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

export default function DashboardManager({ data }: { data: DashboardData }) {
    const [activeTab, setActiveTab] = useState<TabType>('positions');
    const [livePositions, setLivePositions] = useState(data.positions);
    const [liveAsOf, setLiveAsOf] = useState<string | null>(data.pricesAsOf);

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
                <main className="mx-auto max-w-3xl px-4 pt-6 pb-24">
                    <SummaryCards
                        marketValueTwd={summary.mv}
                        netInvestedTwd={summary.ni}
                        profitTwd={profit}
                        fxUsdTwd={data.fxUsdTwd}
                        pricesAsOf={liveAsOf}
                    />
                    <div className="mt-3 flex justify-end">
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
                                <NetValueChart history={data.history} />
                                <ProfitChart history={data.history} />
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
