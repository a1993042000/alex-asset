'use client';

import { useRef, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createTransaction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import type { Action, Currency, Market } from '@/lib/types';

function parseCompactDate(s: string): string | null {
    const m = s.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    const [, y, mo, d] = m;
    const iso = `${y}-${mo}-${d}`;
    const date = new Date(iso + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return null;
    if (date.toISOString().slice(0, 10) !== iso) return null; // rejects bad days like 02/30
    return iso;
}

function detectMarket(ticker: string): Market {
    return /^\d/.test(ticker.trim()) ? 'TW' : 'US';
}

function parseAction(s: string): Action | null {
    const c = s.trim().toUpperCase();
    if (c === 'B') return 'buy';
    if (c === 'S') return 'sell';
    return null;
}

export default function TransactionForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const dateRef = useRef<HTMLInputElement>(null);

    function handleSubmit(formData: FormData) {
        setError(null);
        setSuccess(null);

        const dateStr = (formData.get('date') as string) || '';
        const ticker = ((formData.get('ticker') as string) || '').trim().toUpperCase();
        const actionStr = (formData.get('action') as string) || '';
        const sharesStr = (formData.get('shares') as string) || '';
        const priceStr = (formData.get('price') as string) || '';

        const trade_date = parseCompactDate(dateStr);
        if (!trade_date) return setError('日期格式錯誤（YYYYMMDD）');
        if (!ticker) return setError('請輸入標的代號');
        const action = parseAction(actionStr);
        if (!action) return setError('買賣只能填 B 或 S');
        const shares = parseFloat(sharesStr);
        if (!Number.isFinite(shares) || shares <= 0) return setError('股數需為正數');
        const price = parseFloat(priceStr);
        if (!Number.isFinite(price) || price <= 0) return setError('單價需為正數');

        const market = detectMarket(ticker);
        const currency: Currency = market === 'US' ? 'USD' : 'TWD';

        startTransition(async () => {
            const res = await createTransaction({
                trade_date,
                ticker,
                market,
                action,
                shares,
                price,
                currency,
            });
            if (res?.error) setError(res.error);
            else {
                setSuccess(`已新增 ${ticker} ${action === 'buy' ? '買進' : '賣出'} ${shares}`);
                router.refresh();
                formRef.current?.reset();
                dateRef.current?.focus();
            }
        });
    }

    const baseInput =
        'rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50';

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">新增交易</h2>
            <form
                ref={formRef}
                action={handleSubmit}
                className="grid grid-cols-[7rem_1fr_3rem_5rem_5rem_auto] items-end gap-2"
            >
                <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">日期</label>
                    <input
                        ref={dateRef}
                        name="date"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{8}"
                        maxLength={8}
                        autoComplete="off"
                        placeholder="YYYYMMDD"
                        required
                        className={`${baseInput} w-full font-mono text-sm`}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">代號</label>
                    <input
                        name="ticker"
                        type="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        placeholder="2330 / AAPL"
                        required
                        className={`${baseInput} w-full font-mono text-sm uppercase`}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">B/S</label>
                    <input
                        name="action"
                        type="text"
                        maxLength={1}
                        autoComplete="off"
                        autoCapitalize="characters"
                        placeholder="B"
                        required
                        className={`${baseInput} w-full text-center font-mono text-sm uppercase`}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">股數</label>
                    <input
                        name="shares"
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min="1"
                        required
                        className={`${baseInput} w-full text-sm`}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">單價</label>
                    <input
                        name="price"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        required
                        className={`${baseInput} w-full text-sm`}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex h-[42px] items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 active:scale-[.98] disabled:opacity-50"
                >
                    <Plus size={14} />
                    {isPending ? '送出中' : '新增'}
                </button>
            </form>

            {(error || success) && (
                <div className="mt-2 text-sm">
                    {error && (
                        <span className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-400 border border-rose-500/20">{error}</span>
                    )}
                    {success && (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-400 border border-emerald-500/20">{success}</span>
                    )}
                </div>
            )}

        </div>
    );
}
