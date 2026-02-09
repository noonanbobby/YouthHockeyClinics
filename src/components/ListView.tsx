'use client';

import { useStore } from '@/store/useStore';
import ClinicCard from './ClinicCard';
import { HockeyLoader, ClinicListSkeleton } from './HockeyLoader';
import { RefreshCw, MapPin, UserPlus, ArrowRight } from 'lucide-react';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function ListView() {
  const {
    filteredClinics,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    searchMeta,
    homeLocation,
    childProfiles,
  } = useStore();
  const { refresh } = useClinicSearch();
  const router = useRouter();

  // Check if user needs onboarding (no location AND no children)
  const needsSetup = !homeLocation && childProfiles.length === 0;

  // Loading state — hockey-themed
  if (isLoading && filteredClinics.length === 0) {
    return (
      <div className="relative px-4 py-6 pb-24">
        {/* removed dark gradient */}

        {/* Hockey loader + scanning message */}
        <div className="flex flex-col items-center py-8 mb-6 relative z-10">
          <HockeyLoader size="lg" message="Scanning rinks worldwide..." />
          <div className="mt-6 space-y-2 w-full max-w-sm">
            {['USA Hockey', 'Hockey Canada', 'IIHF', 'European Leagues', 'Event Platforms'].map(
              (source, i) => (
                <motion.div
                  key={source}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ delay: i * 0.4, duration: 2, repeat: Infinity }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 5%, transparent)' }}
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.3 }}
                    className="text-sm"
                  >
                    🏒
                  </motion.span>
                  <span className="text-xs theme-text-secondary">Searching {source}...</span>
                </motion.div>
              )
            )}
          </div>
        </div>

        {/* Skeleton cards preview */}
        <ClinicListSkeleton count={3} />
      </div>
    );
  }

  // Empty / error state — hockey-themed
  if (filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <div className="fixed inset-0 theme-gradient-radial pointer-events-none" />
        {error ? (
          <div className="relative z-10 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-4"
            >
              <span className="text-6xl">🥅</span>
            </motion.div>
            <h3 className="text-lg font-bold theme-text mb-2">
              {error.includes('timed out') ? 'Shot Blocked!' : 'Empty Net'}
            </h3>
            <p className="text-sm theme-text-secondary text-center max-w-xs mb-2">{error}</p>
          </div>
        ) : (
          <div className="relative z-10 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-4"
            >
              <span className="text-6xl">🏒</span>
            </motion.div>
            <h3 className="text-lg font-bold theme-text mb-2">No Clinics Found</h3>
            <p className="text-sm theme-text-secondary text-center max-w-xs mb-2">
              Try adjusting your filters or adding search API keys for more results.
            </p>
          </div>
        )}

        <div className="relative z-10 w-full max-w-sm mt-4 space-y-3">
          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 theme-bg-primary text-white hover:opacity-90"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Scanning...' : 'Drop the Puck'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-4 py-4 pb-24 lg:px-6 lg:py-5">

      {/* Welcome / setup card for new users */}
      {needsSetup && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 rounded-2xl p-4 border overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 12%, transparent), color-mix(in srgb, var(--theme-secondary) 8%, transparent))',
            borderColor: 'color-mix(in srgb, var(--theme-primary) 25%, transparent)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">👋</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold theme-text mb-1">Welcome to Noonan Hockey!</h3>
              <p className="text-[11px] theme-text-secondary mb-3 leading-relaxed">
                Personalize your experience to find the perfect clinics for your player.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/settings')}
                  className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-xl text-left active:scale-[0.98] transition-transform border border-slate-200"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' }}>
                    <UserPlus size={14} style={{ color: 'var(--theme-primary)' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold theme-text">Add Your Player</p>
                    <p className="text-[10px] theme-text-muted">Name & DOB for age-matched results</p>
                  </div>
                  <ArrowRight size={12} className="theme-text-muted ml-auto" />
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  className="w-full flex items-center gap-2.5 p-2.5 bg-white rounded-xl text-left active:scale-[0.98] transition-transform border border-slate-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <MapPin size={14} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold theme-text">Set Home Location</p>
                    <p className="text-[10px] theme-text-muted">Local clinics show up first</p>
                  </div>
                  <ArrowRight size={12} className="theme-text-muted ml-auto" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-base font-bold theme-text">
            {filteredClinics.length} clinic{filteredClinics.length !== 1 ? 's' : ''} found
          </p>
          {searchMeta && (
            <p className="text-xs theme-text-muted mt-0.5">
              Scanned {searchMeta.sources.length} sources in {(searchMeta.searchDuration / 1000).toFixed(1)}s
              {lastUpdated && ` · Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
            </p>
          )}
        </div>
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-primary) 12%, transparent)',
            color: 'var(--theme-primary)',
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {/* Clinic cards — single column for readability */}
      <div className="relative z-10 flex flex-col gap-4 lg:gap-5 mt-4">
        {filteredClinics.map((clinic, i) => (
          <ClinicCard key={clinic.id} clinic={clinic} index={i} />
        ))}
      </div>

      {/* Source info footer */}
      {searchMeta && (
        <div className="relative z-10 mt-6 p-4 rounded-xl border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-primary) 3%, transparent)',
            borderColor: 'var(--theme-card-border)',
          }}>
          <p className="text-xs font-semibold theme-text mb-2">Data Sources</p>
          <div className="space-y-1">
            {searchMeta.sources
              .filter((s) => s.count > 0)
              .map((source, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="theme-text-secondary">{source.name}</span>
                  <span className={source.status === 'success' ? 'text-emerald-600' : 'text-red-500'}>
                    {source.count} results
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
