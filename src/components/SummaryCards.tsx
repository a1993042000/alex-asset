import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import type { PortfolioHistoryRow } from '@/lib/types';
import { periodBaselines, periodStat } from '@/lib/portfolio';

interface Props {
    marketValueTwd: number;
    netInvestedTwd: number;
    profitTwd: number;
    history: PortfolioHistoryRow[];
}

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const ntdSigned = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const pctFmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export default function SummaryCards({ marketValueTwd, netInvestedTwd, profitTwd, history }: Props) {
    const profitPct = netInvestedTwd > 0 ? (profitTwd / netInvestedTwd) * 100 : 0;
    const isProfit = profitTwd >= 0;

    const periods = periodBaselines().map((p) => ({
        ...p,
        stat: periodStat(profitTwd, history, p.date),
    }));

    return (
        <div className="space-y-4">
            {/* 淨值卡片 */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Wallet size={14} />
                    <span>淨值（台幣）</span>
                </div>
                <div className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                    NT$ {ntd.format(marketValueTwd)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                    <div className={`flex items-center gap-1.5 font-medium tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span>{ntdSigned.format(profitTwd)}</span>
                        <span className="text-zinc-500">({pctFmt(profitPct)})</span>
                    </div>
                    <span className="text-zinc-700">·</span>
                    <div className="text-zinc-400">
                        累計投入 <span className="ml-1 font-medium text-zinc-200 tabular-nums">NT$ {ntd.format(netInvestedTwd)}</span>
                    </div>
                </div>
            </div>

            {/* 區間損益 */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
                <div className="text-xs text-zinc-400">區間損益</div>
                <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
                    {periods.map((p) => {
                        const ok = p.stat.hasData;
                        const positive = p.stat.pnlTwd >= 0;
                        const pctColor = !ok
                            ? 'text-zinc-600 bg-zinc-800/50'
                            : positive
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10';
                        const valueColor = ok ? 'text-zinc-100' : 'text-zinc-600';
                        return (
                            <div
                                key={p.key}
                                title={ok && p.stat.baselineDate ? `自 ${p.stat.baselineDate}` : undefined}
                            >
                                <div className="text-xs text-zinc-500">{p.label}</div>
                                <div className={`mt-2 text-lg sm:text-xl font-semibold tabular-nums ${valueColor}`}>
                                    {ok ? ntdSigned.format(p.stat.pnlTwd) : '—'}
                                </div>
                                <div className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${pctColor}`}>
                                    {ok && (positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />)}
                                    <span>{ok ? pctFmt(p.stat.returnPct) : '—'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
