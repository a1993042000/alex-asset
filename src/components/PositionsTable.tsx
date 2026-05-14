'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { PositionRow } from '@/lib/types';

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const ntdSigned = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const num4 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 });
const num2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const intShares = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatPrice(n: number, currency: 'USD' | 'TWD'): string {
    return currency === 'USD' ? `$${num2.format(n)}` : `${num2.format(n)} TWD`;
}

type SortKey =
    | 'ticker'
    | 'shares'
    | 'avg_cost'
    | 'last_price'
    | 'market_value_twd'
    | 'unrealized_profit_twd'
    | 'realized_profit_twd'
    | 'return_pct';
type SortDir = 'asc' | 'desc';

interface Props {
    positions: PositionRow[];
    fxUsdTwd: number;
}

function returnPctOf(p: PositionRow): number {
    if (p.last_price == null || p.avg_cost <= 0) return 0;
    return ((p.last_price - p.avg_cost) / p.avg_cost) * 100;
}

export default function PositionsTable({ positions }: Props) {
    const [sortKey, setSortKey] = useState<SortKey>('market_value_twd');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    function toggleSort(k: SortKey) {
        if (sortKey === k) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(k);
            setSortDir(k === 'ticker' ? 'asc' : 'desc');
        }
    }

    const visible = useMemo(
        () => positions.filter((p) => Math.abs(p.shares) > 1e-9),
        [positions],
    );

    const sorted = useMemo(() => {
        const arr = [...visible];
        arr.sort((a, b) => {
            let av: number | string;
            let bv: number | string;
            switch (sortKey) {
                case 'ticker':                 av = a.ticker;                 bv = b.ticker;                 break;
                case 'shares':                 av = a.shares;                 bv = b.shares;                 break;
                case 'avg_cost':               av = a.avg_cost;               bv = b.avg_cost;               break;
                case 'last_price':             av = a.last_price ?? -Infinity; bv = b.last_price ?? -Infinity; break;
                case 'market_value_twd':       av = a.market_value_twd;       bv = b.market_value_twd;       break;
                case 'unrealized_profit_twd':  av = a.unrealized_profit_twd;  bv = b.unrealized_profit_twd;  break;
                case 'realized_profit_twd':    av = a.realized_profit_twd;    bv = b.realized_profit_twd;    break;
                case 'return_pct':             av = returnPctOf(a);           bv = returnPctOf(b);           break;
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return arr;
    }, [visible, sortKey, sortDir]);

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
                持有部位（{visible.length}）
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                            <Th label="代號" col="ticker" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                            <Th label="股數" col="shares" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="成本" col="avg_cost" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="現價" col="last_price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="市值 (TWD)" col="market_value_twd" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="未實現 (TWD)" col="unrealized_profit_twd" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="報酬率" col="return_pct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="已實現 (TWD)" col="realized_profit_twd" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((p) => {
                            const pct = returnPctOf(p);
                            const unrealColor = p.unrealized_profit_twd >= 0 ? 'text-emerald-400' : 'text-rose-400';
                            const realColor = p.realized_profit_twd > 0
                                ? 'text-emerald-400'
                                : p.realized_profit_twd < 0
                                    ? 'text-rose-400'
                                    : 'text-zinc-600';
                            return (
                                <tr
                                    key={`${p.market}:${p.ticker}`}
                                    className="border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors"
                                >
                                    <td className="px-3 py-2.5">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="font-mono font-semibold text-white">{p.ticker}</span>
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.market === 'US' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                                {p.market}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{intShares.format(p.shares)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">
                                        {num4.format(p.avg_cost)} <span className="text-xs text-zinc-500">{p.currency}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">
                                        {p.last_price != null
                                            ? <>{num4.format(p.last_price)} <span className="text-xs text-zinc-500">{p.currency}</span></>
                                            : <span className="text-zinc-600">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-zinc-100">
                                        {ntd.format(p.market_value_twd)}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${unrealColor}`}>
                                        {ntdSigned.format(p.unrealized_profit_twd)}
                                    </td>
                                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${unrealColor}`}>
                                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                    </td>
                                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${realColor}`}>
                                        {p.realized_profit_twd === 0 ? '—' : ntdSigned.format(p.realized_profit_twd)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile card view — 3-row layout */}
            <div className="md:hidden divide-y divide-zinc-800/60">
                {sorted.map((p) => {
                    const isProfit = p.unrealized_profit_twd >= 0;
                    const pctVal = returnPctOf(p);
                    const hasRealized = Math.abs(p.realized_profit_twd) > 0.5;
                    const unrealColor = isProfit ? 'text-emerald-400' : 'text-rose-400';
                    const unrealPctColor = isProfit ? 'text-emerald-400/70' : 'text-rose-400/70';
                    const realColor = p.realized_profit_twd >= 0 ? 'text-emerald-300' : 'text-rose-300';
                    const pctStr = `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`;
                    return (
                        <div key={`${p.market}:${p.ticker}`} className="px-4 py-3.5">
                            {/* Row 1 — identity + market value */}
                            <div className="flex items-baseline justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-lg font-bold text-white">{p.ticker}</span>
                                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${p.market === 'US' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                        {p.market}
                                    </span>
                                </div>
                                <div className="text-lg font-bold text-white tabular-nums">
                                    NT$ {ntd.format(p.market_value_twd)}
                                </div>
                            </div>

                            {/* Row 2 — P&L (unrealized left · realized right) */}
                            <div className="mt-1.5 flex items-baseline justify-between gap-x-3 tabular-nums">
                                <div className="whitespace-nowrap text-sm">
                                    <span className={`font-semibold ${unrealColor}`}>{ntdSigned.format(p.unrealized_profit_twd)}</span>
                                    <span className={`ml-1 ${unrealPctColor}`}>({pctStr})</span>
                                </div>
                                {hasRealized && (
                                    <div className="whitespace-nowrap text-xs">
                                        <span className="text-zinc-500">已實現 </span>
                                        <span className={`font-semibold ${realColor}`}>{ntdSigned.format(p.realized_profit_twd)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Row 3 — supporting details (left · center · right) */}
                            <div className="mt-1 flex items-baseline justify-between gap-x-2 text-xs tabular-nums text-zinc-500">
                                <span><span className="text-zinc-300">{intShares.format(p.shares)}</span> 股</span>
                                <span>成本 <span className="text-zinc-300">{formatPrice(p.avg_cost, p.currency)}</span></span>
                                <span>現價 <span className="text-zinc-300">{p.last_price != null ? formatPrice(p.last_price, p.currency) : '—'}</span></span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface ThProps {
    label: string;
    col: SortKey;
    sortKey: SortKey;
    sortDir: SortDir;
    onClick: (k: SortKey) => void;
    align?: 'left' | 'right';
}

function Th({ label, col, sortKey, sortDir, onClick, align = 'left' }: ThProps) {
    const active = sortKey === col;
    return (
        <th className={`px-3 py-2.5 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
            <button
                type="button"
                onClick={() => onClick(col)}
                className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <span>{label}</span>
                {active && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </button>
        </th>
    );
}
