'use client';

import { useStore } from '@/store/useStore';
import ClinicCard from './ClinicCard';
import { RefreshCw, Key, Wifi, Loader2, Globe, Radio, ArrowRight } from 'lucide-react';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function ListView() {
  const { filteredClinics, isLoading, isRefreshing, error, lastUpdated, searchMeta } = useStore();
  const { refresh } = useClinicSearch();
  const router = useRouter();

  const hasApiKeys = searchMeta?.hasApiKeys &&
    (searchMeta.hasApiKeys.serpApi || searchMeta.hasApiKeys.googleCse || searchMeta.hasApiKeys.bing);

  // Loading state
  if (isLoading && filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="absolute inset-0 theme-gradient-radial pointer-events-none" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mb-4"
        >
          <Globe size={48} style={{ color: 'var(--theme-primary)' }} />
        </motion.div>
        <h3 className="text-lg font-bold text-white mb-2">Scanning the Internet</h3>
        <p className="text-sm text-slate-400 text-center max-w-xs mb-4">
          Searching hockey organizations, event platforms, and training centers worldwide...
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Radio size={12} className="animate-pulse" style={{ color: 'var(--theme-primary)' }} />
          <span>This may take up to 30 seconds on first load</span>
        </div>
        <div className="mt-2 space-y-2 w-full max-w-sm">
          {['USA Hockey', 'Hockey Canada', 'IIHF', 'Eventbrite', 'Swedish Hockey'].map(
            (source, i) => (
              <motion.div
                key={source}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.3 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 5%, transparent)' }}
              >
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
                <span className="text-xs text-slate-400">Searching {source}...</span>
              </motion.div>
            )
          )}
        </div>
      </div>
    );
  }

  // Error or no results state
  if (filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="absolute inset-0 theme-gradient-radial pointer-events-none" />
        {error ? (
          <>
            <Wifi size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              {error.includes('timed out') ? 'Search Timed Out' : 'No Results Yet'}
            </h3>
            <p className="text-sm text-slate-400 text-center max-w-xs mb-2">{error}</p>
          </>
        ) : (
          <>
            <Globe size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Clinics Found</h3>
            <p className="text-sm text-slate-400 text-center max-w-xs mb-2">
              Try adjusting your filters or adding search API keys for more results.
            </p>
          </>
        )}

        <div className="w-full max-w-sm mt-6 space-y-3">
          {!hasApiKeys && (
            <div className="p-4 rounded-2xl border"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-primary) 8%, transparent)',
                borderColor: 'var(--theme-card-border)',
              }}>
              <div className="flex items-center gap-2 mb-2">
                <Key size={16} style={{ color: 'var(--theme-primary)' }} />
                <p className="text-sm font-semibold text-white">Unlock More Results</p>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Add a free SerpAPI key to dramatically improve clinic discovery.
              </p>
              <button
                onClick={() => router.push('/settings')}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-colors theme-bg-primary-20 hover:opacity-90"
                style={{ color: 'var(--theme-primary)' }}
              >
                Add API Keys <ArrowRight size={14} />
              </button>
            </div>
          )}

          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 theme-bg-primary text-white hover:opacity-90"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Scanning...' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-4 py-4 pb-24 space-y-3">
      {/* Radial glow */}
      <div className="fixed inset-0 theme-gradient-radial pointer-events-none z-0" />

      {/* Status bar */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            {filteredClinics.length} clinic{filteredClinics.length !== 1 ? 's' : ''} found
          </p>
          {searchMeta && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              Scanned {searchMeta.sources.length} sources in {(searchMeta.searchDuration / 1000).toFixed(1)}s
            </p>
          )}
        </div>
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
            color: 'var(--theme-primary)',
          }}
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {lastUpdated && (
        <p className="relative z-10 text-[10px] text-slate-600">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}

      {/* Clinic cards */}
      <div className="relative z-10 space-y-3">
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
          <p className="text-xs font-semibold text-white mb-2">Data Sources</p>
          <div className="space-y-1">
            {searchMeta.sources
              .filter((s) => s.count > 0)
              .map((source, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{source.name}</span>
                  <span className={source.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                    {source.count} results
                  </span>
                </div>
              ))}
          </div>
          {!hasApiKeys && (
            <p className="text-[10px] mt-2" style={{ color: 'color-mix(in srgb, var(--theme-primary) 60%, transparent)' }}>
              Add search API keys in Settings to unlock more sources
            </p>
          )}
        </div>
      )}
    </div>
  );
}
