'use client';

import { Search, SlidersHorizontal, UserCircle, ChevronDown, Check } from 'lucide-react';
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
    activeChildIds,
    toggleActiveChild,
    setActiveChildren,
    homeLocation,
  } = useStore();
  const filterCount = activeFilterCount();
  const { data: session } = useSession();
  const router = useRouter();
  const [showChildPicker, setShowChildPicker] = useState(false);

  const activeChildren = childProfiles.filter((c) => activeChildIds.includes(c.id));
  const allSelected = activeChildIds.length === childProfiles.length && childProfiles.length > 0;

  let pillLabel = 'Select player';
  if (activeChildren.length === 1) {
    const child = activeChildren[0];
    const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
    pillLabel = `${child.name} · ${getAgeGroupLabel(ag)} · Age ${getChildAge(child.dateOfBirth)}`;
  } else if (activeChildren.length === childProfiles.length && childProfiles.length > 1) {
    pillLabel = `All Players (${childProfiles.length})`;
  } else if (activeChildren.length > 1) {
    pillLabel = activeChildren.map((c) => c.name).join(' & ');
  }

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="safe-area-top" />
      <div className="relative px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          {/* Mobile: App title */}
          <div className="lg:hidden">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2" style={{ color: '#0f172a' }}>
              <span
                className="text-xl font-black tracking-tighter"
                style={{ color: 'var(--theme-primary)' }}
              >
                NH
              </span>
              Noonan Hockey
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {homeLocation
                ? `${homeLocation.city}, ${homeLocation.state}`
                : 'Discover youth hockey worldwide'}
            </p>
          </div>
          {/* Desktop: location only (sidebar has title) */}
          <div className="hidden lg:block">
            <p className="text-sm font-medium" style={{ color: '#475569' }}>
              {homeLocation
                ? `${homeLocation.city}, ${homeLocation.state}`
                : 'Discover youth hockey worldwide'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-slate-100"
              style={{ backgroundColor: '#f1f5f9' }}
            >
              <Search size={18} style={{ color: '#475569' }} />
            </button>
            <button
              onClick={() => setFilterOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-slate-100"
              style={{ backgroundColor: '#f1f5f9' }}
            >
              <SlidersHorizontal size={18} style={{ color: '#475569' }} />
              {filterCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-white text-[10px] font-bold rounded-full px-1"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                  {filterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => router.push(session ? '/settings' : '/login')}
              className="w-9 h-9 flex items-center justify-center rounded-xl overflow-hidden transition-colors hover:bg-slate-100"
              style={{ backgroundColor: '#f1f5f9' }}
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-full h-full object-cover rounded-xl" />
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
                backgroundColor: activeChildren.length > 0
                  ? 'color-mix(in srgb, var(--theme-primary) 8%, #ffffff)'
                  : '#f8fafc',
                borderColor: activeChildren.length > 0
                  ? 'color-mix(in srgb, var(--theme-primary) 25%, #e2e8f0)'
                  : '#e2e8f0',
              }}
            >
              <div className="flex -space-x-1.5">
                {activeChildren.length > 0 ? (
                  activeChildren.slice(0, 3).map((child) => (
                    <div
                      key={child.id}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2"
                      style={{ backgroundColor: 'var(--theme-primary)', borderColor: '#ffffff' }}
                    >
                      {child.name.charAt(0)}
                    </div>
                  ))
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px]" style={{ color: '#94a3b8' }}>
                    ?
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium" style={{ color: '#475569' }}>{pillLabel}</span>
              <ChevronDown
                size={12}
                className={cn('transition-transform', showChildPicker && 'rotate-180')}
                style={{ color: '#94a3b8' }}
              />
            </button>

            <AnimatePresence>
              {showChildPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-2 p-1.5 rounded-xl border"
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      boxShadow: 'var(--theme-shadow-md)',
                    }}
                  >
                    <button
                      onClick={() => {
                        if (allSelected) setActiveChildren([]);
                        else setActiveChildren(childProfiles.map((c) => c.id));
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-slate-50"
                      style={allSelected ? { backgroundColor: '#f8fafc' } : undefined}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs">
                        {allSelected ? '✅' : '👥'}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium" style={{ color: '#475569' }}>
                          {allSelected ? 'Deselect All' : 'Select All Players'}
                        </p>
                        <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                          {allSelected ? 'Clear selection' : 'Show clinics for everyone'}
                        </p>
                      </div>
                    </button>

                    {childProfiles.map((child) => {
                      const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
                      const isActive = activeChildIds.includes(child.id);
                      return (
                        <button
                          key={child.id}
                          onClick={() => toggleActiveChild(child.id)}
                          className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-slate-50"
                          style={isActive ? { backgroundColor: 'color-mix(in srgb, var(--theme-primary) 5%, #ffffff)' } : undefined}
                        >
                          <div
                            className={cn(
                              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                              isActive ? 'text-white' : ''
                            )}
                            style={
                              isActive
                                ? { backgroundColor: 'var(--theme-primary)' }
                                : { backgroundColor: '#f1f5f9', color: '#64748b' }
                            }
                          >
                            {child.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium" style={{ color: isActive ? '#0f172a' : '#475569' }}>
                              {child.name}
                            </p>
                            <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                              Age {getChildAge(child.dateOfBirth)} · {getAgeGroupLabel(ag)}
                              {child.currentDivision && child.currentDivision !== getAgeGroupFromDOB(child.dateOfBirth) && (
                                <span className="text-amber-500"> (playing up)</span>
                              )}
                              {' · '}{child.position === 'goalie' ? '🥅' : '🏒'}
                            </p>
                          </div>
                          {isActive && (
                            <Check size={14} style={{ color: 'var(--theme-primary)' }} />
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

        {/* View Toggle — mobile only */}
        <div className="flex rounded-xl p-1 lg:hidden" style={{ backgroundColor: '#f1f5f9' }}>
          {(['list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'relative flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize'
              )}
              style={{ color: viewMode === mode ? '#0f172a' : '#94a3b8' }}
            >
              {viewMode === mode && (
                <motion.div
                  layoutId="view-toggle"
                  className="absolute inset-0 rounded-lg border"
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    boxShadow: 'var(--theme-shadow-sm)',
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
