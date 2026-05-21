'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PortfolioHistoryRow } from '@/lib/types';

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });

const fmtMillion = (v: number) => {
    const m = v / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
};

const fmtMonth = (s: string) => {
    const [y, m] = s.split('-');
    return `${y.slice(2)}/${m}`;
};

const monthTicks = (rows: { date: string }[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
        const ym = r.date.slice(0, 7);
        if (!seen.has(ym)) {
            seen.add(ym);
            out.push(r.date);
        }
    }
    return out;
};

export default function ProfitChart({ history }: { history: PortfolioHistoryRow[] }) {
    if (history.length === 0) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-500">
                尚無歷史資料
            </div>
        );
    }

    const data = history.map((h) => ({
        date: h.date,
        profit: Number(h.profit_twd) || 0,
    }));
    const ticks = monthTicks(data);

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-2 text-sm font-semibold text-white">損益曲線</h2>
            <div className="h-64 w-full">
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="pr-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} ticks={ticks} tickFormatter={fmtMonth} />
                        <YAxis stroke="#71717a" fontSize={11} width={36} domain={['auto', 'auto']} tickFormatter={fmtMillion} />
                        <ReferenceLine y={0} stroke="#52525b" strokeDasharray="2 4" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                            labelStyle={{ color: '#a1a1aa' }}
                            formatter={(v) => [`NT$ ${ntd.format(Number(v))}`, '損益']}
                        />
                        <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} fill="url(#pr-fill)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
