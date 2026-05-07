'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Action, Currency, Market } from '@/lib/types';

function makeClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

async function requireAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return false;
    return true;
}

export async function login(formData: FormData) {
    const username = formData.get('username');
    const password = formData.get('password');

    if (
        username === process.env.APP_USER &&
        password === process.env.APP_PASSWORD
    ) {
        const cookieStore = await cookies();
        cookieStore.set('auth_token', 'authenticated', {
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });
        redirect('/');
    }

    return { error: '帳號或密碼錯誤' };
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    redirect('/login');
}

export interface NewTransactionInput {
    trade_date: string;     // YYYY-MM-DD
    ticker: string;
    market: Market;
    action: Action;
    shares: number;
    price: number;
    currency: Currency;
    note?: string;
}

export async function createTransaction(input: NewTransactionInput) {
    if (!(await requireAuth())) return { error: '未經授權的請求' };

    const supabase = makeClient();
    const { error } = await supabase.from('asset_transactions').insert([{
        trade_date: input.trade_date,
        ticker: input.ticker.trim().toUpperCase(),
        market: input.market,
        action: input.action,
        shares: input.shares,
        price: input.price,
        currency: input.currency,
        note: input.note?.trim() || null,
    }]);

    if (error) return { error: '新增失敗：' + error.message };
    revalidatePath('/');
    return { success: true };
}

export async function deleteTransaction(id: string) {
    if (!(await requireAuth())) return { error: '未經授權的請求' };

    const supabase = makeClient();
    const { error } = await supabase.from('asset_transactions').delete().eq('id', id);
    if (error) return { error: '刪除失敗：' + error.message };
    revalidatePath('/');
    return { success: true };
}

export async function updateTransaction(id: string, updates: Partial<NewTransactionInput>) {
    if (!(await requireAuth())) return { error: '未經授權的請求' };

    const supabase = makeClient();
    const patch: Record<string, unknown> = { ...updates };
    if (typeof patch.ticker === 'string') patch.ticker = (patch.ticker as string).trim().toUpperCase();
    if (typeof patch.note === 'string') patch.note = (patch.note as string).trim() || null;

    const { error } = await supabase.from('asset_transactions').update(patch).eq('id', id);
    if (error) return { error: '更新失敗：' + error.message };
    revalidatePath('/');
    return { success: true };
}
