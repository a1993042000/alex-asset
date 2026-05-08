'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTransaction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Transaction } from '@/lib/types';

const num4 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 });
const intShares = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

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
            <div className="max-h-[60vh] divide-y divide-zinc-800/60 overflow-y-auto">
                {transactions.map((t) => (
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
                            {num4.format(t.shares * t.price)} {t.currency}
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
                ))}
            </div>
        </div>
    );
}
