'use client';

import { Search, SlidersHorizontal, UserCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { setSearchOpen, setFilterOpen, activeFilterCount, viewMode, setViewMode } = useStore();
  const filterCount = activeFilterCount();
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-white/5">
      <div className="safe-area-top" />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-2xl">🏒</span>
              Hockey Clinics
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Discover youth hockey worldwide</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Search size={18} className="text-slate-300" />
            </button>
            <button
              onClick={() => setFilterOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <SlidersHorizontal size={18} className="text-slate-300" />
              {filterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-sky-500 text-white text-[10px] font-bold rounded-full px-1">
                  {filterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push(session ? '/settings' : '/login')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors overflow-hidden"
            >
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <UserCircle size={18} className={session ? 'text-sky-400' : 'text-slate-300'} />
              )}
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-white/5 rounded-xl p-1">
          {(['list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'relative flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize',
                viewMode === mode ? 'text-white' : 'text-slate-400'
              )}
            >
              {viewMode === mode && (
                <motion.div
                  layoutId="view-toggle"
                  className="absolute inset-0 bg-sky-500/20 border border-sky-500/30 rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{mode === 'list' ? '📋 List View' : '🗺️ Map View'}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
