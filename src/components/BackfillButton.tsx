'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BackfillButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function handleClick() {
        if (!confirm('回填會重建所有歷史快照（從第一筆交易日到今天），可能需要 10–60 秒。繼續？')) return;
        setLoading(true);
        setMsg(null);
        try {
            const res = await fetch('/api/admin/backfill-history', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setMsg(`✓ 已回填 ${data.days} 天（${data.from} → ${data.to}）`);
            router.refresh();
        } catch (e: unknown) {
            setMsg('✗ ' + (e instanceof Error ? e.message : '失敗'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            >
                <History size={14} />
                {loading ? '回填中…' : '回填歷史快照'}
            </button>
            {msg && <div className="text-xs text-zinc-400">{msg}</div>}
        </div>
    );
}
