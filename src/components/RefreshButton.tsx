'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { PositionRow } from '@/lib/types';

interface Props {
    onUpdate: (positions: PositionRow[], asOf: string | null) => void;
}

export default function RefreshButton({ onUpdate }: Props) {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function handleClick() {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch('/api/quote', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            onUpdate(data.positions as PositionRow[], data.asOf as string | null);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : '無法取得即時報價');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            {err && <span className="text-xs text-rose-400">{err}</span>}
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                {loading ? '更新中…' : '即時報價'}
            </button>
        </div>
    );
}
