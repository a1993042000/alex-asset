'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PortfolioHistoryRow } from '@/lib/types';

const ntd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

// Y axis: NT$ -> M (millions). Hide decimals when the tick is an integer million.
const fmtMillion = (v: number) => {
    const m = v / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
};

// X axis label: "2026-05-..." -> "26/05" (year + month only)
const fmtMonth = (s: string) => {
    const [y, m] = s.split('-');
    return `${y.slice(2)}/${m}`;
};

// Pick one tick per month (first date of each month present in the data).
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

export default function NetValueChart({ history }: { history: PortfolioHistoryRow[] }) {
    if (history.length === 0) {
        return (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-10 text-center text-zinc-500">
                尚無歷史資料。觸發 cron 或執行回填後會出現曲線。
            </div>
        );
    }

    const data = history.map((h) => ({
        date: h.date,
        value: Number(h.market_value_twd) || 0,
    }));
    const ticks = monthTicks(data);

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h2 className="mb-2 text-sm font-semibold text-white">淨值曲線</h2>
            <div className="h-64 w-full">
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="nv-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} ticks={ticks} tickFormatter={fmtMonth} />
                        <YAxis stroke="#71717a" fontSize={11} width={36} domain={['auto', 'auto']} tickFormatter={fmtMillion} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                            labelStyle={{ color: '#a1a1aa' }}
                            formatter={(v) => [`NT$ ${ntd.format(Number(v))}`, '淨值']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#nv-fill)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
