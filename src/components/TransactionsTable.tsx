'use client';

import { useMemo, useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { deleteTransaction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Transaction } from '@/lib/types';

const num4 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 });
const intShares = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const intTwd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

type SortKey = 'trade_date' | 'action' | 'ticker' | 'shares' | 'price' | 'total_twd';
type SortDir = 'asc' | 'desc';

interface Props {
    transactions: Transaction[];
    fxUsdTwd: number;
}

function totalTwdOf(t: Transaction, fxUsdTwd: number) {
    return t.shares * t.price * (t.currency === 'USD' ? fxUsdTwd : 1);
}

export default function TransactionsTable({ transactions, fxUsdTwd }: Props) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    const [sortKey, setSortKey] = useState<SortKey>('trade_date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    function toggleSort(k: SortKey) {
        if (sortKey === k) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(k);
            setSortDir(k === 'ticker' ? 'asc' : 'desc');
        }
    }

    function handleDelete(id: string) {
        if (!confirm('確定刪除這筆交易？')) return;
        setPendingId(id);
        startTransition(async () => {
            const res = await deleteTransaction(id);
            setPendingId(null);
            if (res?.error) alert(res.error);
            else router.refresh();
        });
    }

    const sorted = useMemo(() => {
        const arr = [...transactions];
        arr.sort((a, b) => {
            let av: number | string;
            let bv: number | string;
            switch (sortKey) {
                case 'trade_date': av = a.trade_date; bv = b.trade_date; break;
                case 'action':     av = a.action;     bv = b.action;     break;
                case 'ticker':     av = a.ticker;     bv = b.ticker;     break;
                case 'shares':     av = a.shares;     bv = b.shares;     break;
                case 'price':      av = a.price;      bv = b.price;      break;
                case 'total_twd':  av = totalTwdOf(a, fxUsdTwd); bv = totalTwdOf(b, fxUsdTwd); break;
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return arr;
    }, [transactions, sortKey, sortDir, fxUsdTwd]);

    if (transactions.length === 0) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center text-zinc-500">
                尚無交易紀錄
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
            <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm font-semibold text-white">
                交易紀錄（{transactions.length}）
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                            <Th label="日期" col="trade_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                            <Th label="買/賣" col="action" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                            <Th label="代號" col="ticker" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                            <Th label="股數" col="shares" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="單價" col="price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <Th label="總額 (TWD)" col="total_twd" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((t) => {
                            const totalTwd = totalTwdOf(t, fxUsdTwd);
                            return (
                                <tr key={t.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors">
                                    <td className="px-3 py-2.5 font-mono text-zinc-300">{t.trade_date}</td>
                                    <td className="px-3 py-2.5">
                                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.action === 'buy' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                            {t.action === 'buy' ? '買' : '賣'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="font-mono font-semibold text-white">{t.ticker}</span>
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.market === 'US' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                                {t.market}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">{intShares.format(t.shares)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">
                                        {num4.format(t.price)} <span className="text-xs text-zinc-500">{t.currency}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-zinc-100">
                                        {intTwd.format(totalTwd)}
                                    </td>
                                    <td className="px-2 py-2.5">
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            disabled={pendingId === t.id}
                                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
                                            aria-label="刪除"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-zinc-800/60">
                {sorted.map((t) => {
                    const totalTwd = totalTwdOf(t, fxUsdTwd);
                    return (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.action === 'buy' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                        {t.action === 'buy' ? '買' : '賣'}
                                    </span>
                                    <span className="font-mono text-sm font-semibold text-white">{t.ticker}</span>
                                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.market === 'US' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>
                                        {t.market}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                    {t.trade_date} ・ {intShares.format(t.shares)} × {num4.format(t.price)} {t.currency}
                                </div>
                            </div>
                            <div className="text-right text-sm font-medium text-zinc-200">
                                {intTwd.format(totalTwd)} TWD
                            </div>
                            <button
                                onClick={() => handleDelete(t.id)}
                                disabled={pendingId === t.id}
                                className="rounded-lg p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
                                aria-label="刪除"
                            >
                                <Trash2 size={16} />
                            </button>
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
