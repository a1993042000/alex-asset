'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createTransaction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Action, Currency, Market } from '@/lib/types';

function todayTaipei(): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(new Date()); // YYYY-MM-DD
}

export default function TransactionForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [market, setMarket] = useState<Market>('US');
    const [action, setAction] = useState<Action>('buy');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    function handleSubmit(formData: FormData) {
        setError(null);
        setSuccess(null);

        const ticker = (formData.get('ticker') as string)?.trim();
        const sharesStr = formData.get('shares') as string;
        const priceStr = formData.get('price') as string;
        const tradeDate = (formData.get('trade_date') as string) || todayTaipei();

        if (!ticker) return setError('請輸入標的代號');
        const shares = parseFloat(sharesStr);
        const price = parseFloat(priceStr);
        if (!Number.isFinite(shares) || shares <= 0) return setError('股數需為正數');
        if (!Number.isFinite(price) || price <= 0) return setError('單價需為正數');

        const currency: Currency = market === 'US' ? 'USD' : 'TWD';

        startTransition(async () => {
            const res = await createTransaction({
                trade_date: tradeDate,
                ticker,
                market,
                action,
                shares,
                price,
                currency,
            });
            if (res?.error) setError(res.error);
            else {
                setSuccess('已新增');
                router.refresh();
                const form = document.getElementById('tx-form') as HTMLFormElement | null;
                form?.reset();
            }
        });
    }

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">新增交易</h2>
            <form id="tx-form" action={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMarket('US')}
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${market === 'US' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40' : 'bg-zinc-800/60 text-zinc-400'}`}
                    >
                        美股 (USD)
                    </button>
                    <button
                        type="button"
                        onClick={() => setMarket('TW')}
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${market === 'TW' ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40' : 'bg-zinc-800/60 text-zinc-400'}`}
                    >
                        台股 (TWD)
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setAction('buy')}
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${action === 'buy' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' : 'bg-zinc-800/60 text-zinc-400'}`}
                    >
                        買進
                    </button>
                    <button
                        type="button"
                        onClick={() => setAction('sell')}
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${action === 'sell' ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40' : 'bg-zinc-800/60 text-zinc-400'}`}
                    >
                        賣出
                    </button>
                </div>

                <div>
                    <label className="mb-1 block text-xs text-zinc-400">標的代號</label>
                    <input
                        name="ticker"
                        type="text"
                        autoComplete="off"
                        placeholder={market === 'US' ? 'AAPL、TSLA…' : '2330、0050…'}
                        required
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 font-mono text-base uppercase text-white focus:border-emerald-500 focus:outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="mb-1 block text-xs text-zinc-400">股數</label>
                        <input
                            name="shares"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            required
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-zinc-400">單價 ({market === 'US' ? 'USD' : 'TWD'})</label>
                        <input
                            name="price"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            required
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs text-zinc-400">交易日期</label>
                    <input
                        name="trade_date"
                        type="date"
                        defaultValue={todayTaipei()}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                    />
                </div>

                {error && (
                    <div className="rounded-lg bg-rose-500/10 p-2.5 text-sm text-rose-400 border border-rose-500/20">{error}</div>
                )}
                {success && (
                    <div className="rounded-lg bg-emerald-500/10 p-2.5 text-sm text-emerald-400 border border-emerald-500/20">{success}</div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 p-3 font-semibold text-white transition-colors hover:bg-emerald-500 active:scale-[.98] disabled:opacity-50"
                >
                    <Plus size={16} />
                    {isPending ? '送出中…' : '新增'}
                </button>
            </form>
        </div>
    );
}
