import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import type { PortfolioHistoryRow } from '@/lib/types';
import { periodBaselines, periodStat } from '@/lib/portfolio';

interface Props {
    marketValueTwd: number;
    netInvestedTwd: number;
    profitTwd: number;
    history: PortfolioHistoryRow[];
    pricesAsOf: string | null;
}

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const ntdSigned = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const pctFmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export default function SummaryCards({ marketValueTwd, netInvestedTwd, profitTwd, history, pricesAsOf }: Props) {
    const profitPct = netInvestedTwd > 0 ? (profitTwd / netInvestedTwd) * 100 : 0;
    const isProfit = profitTwd >= 0;

    const periods = periodBaselines().map((p) => ({
        ...p,
        stat: periodStat(profitTwd, history, p.date),
    }));

    return (
        <div className="space-y-3">
            {/* Net value (台幣) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Wallet size={14} />
                    <span>淨值（台幣）</span>
                </div>
                <div className="mt-2 text-3xl font-bold tracking-tight text-white">
                    NT$ {ntd.format(marketValueTwd)}
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isProfit ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span>{ntdSigned.format(profitTwd)}</span>
                    <span className="text-zinc-500">({pctFmt(profitPct)})</span>
                </div>
            </div>

            {/* 累計投入 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="text-xs text-zinc-400">累計投入</div>
                <div className="mt-1 text-lg font-semibold text-white">
                    NT$ {ntd.format(netInvestedTwd)}
                </div>
            </div>

            {/* 區間損益 / 報酬率 */}
            <div className="grid grid-cols-3 gap-2">
                {periods.map((p) => {
                    const ok = p.stat.hasData;
                    const positive = p.stat.pnlTwd >= 0;
                    const color = !ok
                        ? 'text-zinc-600'
                        : positive
                            ? 'text-emerald-400'
                            : 'text-rose-400';
                    return (
                        <div
                            key={p.key}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
                            title={ok && p.stat.baselineDate ? `自 ${p.stat.baselineDate}` : undefined}
                        >
                            <div className="text-[11px] text-zinc-500">{p.label}</div>
                            <div className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>
                                {ok ? ntdSigned.format(p.stat.pnlTwd) : '—'}
                            </div>
                            <div className={`mt-0.5 text-[11px] tabular-nums ${color}`}>
                                {ok ? pctFmt(p.stat.returnPct) : '—'}
                            </div>
                        </div>
                    );
                })}
            </div>

            {pricesAsOf && (
                <div className="text-right text-xs text-zinc-500">
                    報價更新：{pricesAsOf}
                </div>
            )}
        </div>
    );
}
