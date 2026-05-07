import { ArrowDownRight, ArrowUpRight, DollarSign, Wallet } from 'lucide-react';

interface Props {
    marketValueTwd: number;
    netInvestedTwd: number;
    profitTwd: number;
    fxUsdTwd: number;
    pricesAsOf: string | null;
}

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const ntdSigned = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
const pct = (n: number) => (Math.abs(n) >= 0.01 ? n.toFixed(2) : '0.00');

export default function SummaryCards({ marketValueTwd, netInvestedTwd, profitTwd, fxUsdTwd, pricesAsOf }: Props) {
    const profitPct = netInvestedTwd > 0 ? (profitTwd / netInvestedTwd) * 100 : 0;
    const isProfit = profitTwd >= 0;

    return (
        <div className="space-y-3">
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
                    <span className="text-zinc-500">({pct(profitPct)}%)</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="text-xs text-zinc-400">累計投入</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                        NT$ {ntd.format(netInvestedTwd)}
                    </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <DollarSign size={12} />
                        <span>USD/TWD</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                        {fxUsdTwd.toFixed(3)}
                    </div>
                </div>
            </div>

            {pricesAsOf && (
                <div className="text-right text-xs text-zinc-500">
                    報價更新：{pricesAsOf}
                </div>
            )}
        </div>
    );
}
