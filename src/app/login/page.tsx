'use client';

import { useState } from 'react';
import { login } from '../actions';

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(formData: FormData) {
        const result = await login(formData);
        if (result?.error) {
            setError(result.error);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-8 shadow-xl">
                <h1 className="mb-2 text-center text-3xl font-bold text-white tracking-tight">Alex Asset</h1>
                <p className="mb-8 text-center text-zinc-400">個人資產追蹤器</p>

                <form action={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="username">
                            帳號
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            required
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="輸入帳號"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-300" htmlFor="password">
                            密碼
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="輸入密碼"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-500 border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="mt-2 w-full rounded-xl bg-emerald-600 p-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-95"
                    >
                        登入
                    </button>
                </form>
            </div>
        </div>
    );
}
