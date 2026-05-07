'use client';

import type { PositionRow } from '@/lib/types';

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const ntdSigned = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const num4 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 });

interface Props {
    positions: PositionRow[];
    fxUsdTwd: number;
}

export default function PositionsTable({ positions }: Props) {
    const visible = positions.filter((p) => Math.abs(p.shares) > 1e-9);

    if (visible.length === 0) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-500">
                目前沒有持有部位
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
            <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm font-semibold text-white">
                持有部位
            </div>
            <div className="divide-y divide-zinc-800/60">
                {visible.map((p) => {
                    const isProfit = p.profit_twd >= 0;
                    const pctVal = p.net_invested_twd > 0 ? (p.profit_twd / p.net_invested_twd) * 100 : 0;
                    return (
                        <div key={`${p.market}:${p.ticker}`} className="px-4 py-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-base font-semibold text-white">{p.ticker}</span>
                                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${p.market === 'US' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                        {p.market}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-semibold text-white">NT$ {ntd.format(p.market_value_twd)}</div>
                                    <div className={`text-sm font-medium ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {ntdSigned.format(p.profit_twd)}
                                        <span className="ml-1 text-xs text-zinc-500">({pctVal.toFixed(2)}%)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
                                <div>
                                    {num4.format(p.shares)} 股 × {p.last_price != null ? num4.format(p.last_price) : '—'} {p.currency}
                                </div>
                                <div>
                                    成本 {num4.format(p.avg_cost)} {p.currency}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
