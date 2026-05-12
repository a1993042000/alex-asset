'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once on the client. Only runs in production builds
 * because dev mode service workers tend to cause stale-asset confusion.
 */
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator)) return;
        if (process.env.NODE_ENV !== 'production') return;
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            // Non-fatal; PWA install just won't be offered if this fails.
            console.warn('SW register failed:', err);
        });
    }, []);
    return null;
}
