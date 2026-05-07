import { logout } from '@/app/actions';
import { LogOut, Wallet } from 'lucide-react';

export default function Header() {
    return (
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
                <Wallet size={20} className="text-emerald-400" />
                <h1 className="text-xl font-bold text-white tracking-tight">Alex Asset</h1>
            </div>
            <form action={logout}>
                <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg py-2 px-3 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                    <LogOut size={16} />
                    <span>登出</span>
                </button>
            </form>
        </header>
    );
}
