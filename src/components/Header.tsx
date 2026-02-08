'use client';

import { Search, SlidersHorizontal, UserCircle, ChevronDown } from 'lucide-react';
import { useStore, getAgeGroupFromDOB, getChildAge } from '@/store/useStore';
import { getAgeGroupLabel, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Header() {
  const {
    setSearchOpen,
    setFilterOpen,
    activeFilterCount,
    viewMode,
    setViewMode,
    childProfiles,
    activeChildId,
    setActiveChild,
    homeLocation,
  } = useStore();
  const filterCount = activeFilterCount();
  const { data: session } = useSession();
  const router = useRouter();
  const [showChildPicker, setShowChildPicker] = useState(false);

  const activeChild = childProfiles.find((c) => c.id === activeChildId);
  const childAgeGroup = activeChild ? getAgeGroupFromDOB(activeChild.dateOfBirth) : null;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl border-b"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--theme-header-bg) 95%, transparent)',
        borderColor: 'var(--theme-card-border)',
      }}>
      <div className="absolute inset-0 theme-gradient-radial pointer-events-none" />
      <div className="safe-area-top" />
      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-2xl">🏒</span>
              Noonan Hockey
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {homeLocation
                ? `${homeLocation.city}, ${homeLocation.state}`
                : 'Discover youth hockey worldwide'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }}
            >
              <Search size={18} className="text-slate-300" />
            </button>
            <button
              onClick={() => setFilterOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }}
            >
              <SlidersHorizontal size={18} className="text-slate-300" />
              {filterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center theme-bg-primary text-white text-[10px] font-bold rounded-full px-1">
                  {filterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push(session ? '/settings' : '/login')}
              className="w-9 h-9 flex items-center justify-center rounded-full overflow-hidden transition-colors"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' }}
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <UserCircle size={18} style={{ color: session ? 'var(--theme-primary)' : '#94a3b8' }} />
              )}
            </button>
          </div>
        </div>

        {/* Active child context pill */}
        {childProfiles.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowChildPicker(!showChildPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-[0.97]"
              style={{
                backgroundColor: activeChild
                  ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)'
                  : 'rgba(255,255,255,0.03)',
                borderColor: activeChild
                  ? 'color-mix(in srgb, var(--theme-primary) 25%, transparent)'
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                activeChild ? 'text-white' : 'bg-white/10 text-slate-400'
              )}
                style={activeChild ? { backgroundColor: 'var(--theme-primary)' } : undefined}
              >
                {activeChild ? activeChild.name.charAt(0) : '?'}
              </div>
              <span className="text-[11px] font-medium text-slate-300">
                {activeChild
                  ? `${activeChild.name} · ${getAgeGroupLabel(childAgeGroup!)} · Age ${getChildAge(activeChild.dateOfBirth)}`
                  : 'Select player'}
              </span>
              <ChevronDown size={12} className={cn('text-slate-500 transition-transform', showChildPicker && 'rotate-180')} />
            </button>

            {/* Dropdown child picker */}
            <AnimatePresence>
              {showChildPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-1.5 rounded-xl border bg-slate-900/90 backdrop-blur-xl"
                    style={{ borderColor: 'var(--theme-card-border)' }}>
                    {/* No filter option */}
                    <button
                      onClick={() => { setActiveChild(null); setShowChildPicker(false); }}
                      className={cn(
                        'w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors',
                        !activeChildId ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">
                        🌐
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-300">All Players</p>
                        <p className="text-[10px] text-slate-500">Show clinics for everyone</p>
                      </div>
                    </button>
                    {childProfiles.map((child) => {
                      const ag = getAgeGroupFromDOB(child.dateOfBirth);
                      const isActive = child.id === activeChildId;
                      return (
                        <button
                          key={child.id}
                          onClick={() => { setActiveChild(child.id); setShowChildPicker(false); }}
                          className={cn(
                            'w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors',
                            isActive ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                          )}
                        >
                          <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                            isActive ? 'text-white' : 'bg-white/10 text-slate-300'
                          )}
                            style={isActive ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                          >
                            {child.name.charAt(0)}
                          </div>
                          <div>
                            <p className={cn('text-xs font-medium', isActive ? 'text-white' : 'text-slate-300')}>
                              {child.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Age {getChildAge(child.dateOfBirth)} · {getAgeGroupLabel(ag)}
                            </p>
                          </div>
                          {isActive && (
                            <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                                color: 'var(--theme-accent)',
                              }}>Active</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 8%, transparent)' }}>
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
                  className="absolute inset-0 rounded-lg border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--theme-primary) 30%, transparent)',
                  }}
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
