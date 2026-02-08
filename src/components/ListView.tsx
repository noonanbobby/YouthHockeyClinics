'use client';

import { useStore } from '@/store/useStore';
import ClinicCard from './ClinicCard';
import { RefreshCw, SearchX, Wifi, Loader2, Globe, Radio } from 'lucide-react';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { motion } from 'framer-motion';

export default function ListView() {
  const { filteredClinics, isLoading, isRefreshing, error, lastUpdated, searchMeta } = useStore();
  const { refresh } = useClinicSearch();

  if (isLoading && filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mb-4"
        >
          <Globe size={48} className="text-sky-400" />
        </motion.div>
        <h3 className="text-lg font-bold text-white mb-2">Scanning the Internet</h3>
        <p className="text-sm text-slate-400 text-center max-w-xs mb-4">
          Searching hockey organizations, event platforms, and training centers worldwide...
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Radio size={12} className="animate-pulse text-sky-400" />
          <span>Scraping {searchMeta?.sources?.length || 0} sources</span>
        </div>
        <div className="mt-6 space-y-2 w-full max-w-sm">
          {['USA Hockey', 'Hockey Canada', 'IIHF', 'Eventbrite', 'Swedish Hockey'].map(
            (source, i) => (
              <motion.div
                key={source}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.3 }}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg"
              >
                <Loader2 size={12} className="animate-spin text-sky-400" />
                <span className="text-xs text-slate-400">Searching {source}...</span>
              </motion.div>
            )
          )}
        </div>
      </div>
    );
  }

  if (error && filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <Wifi size={48} className="text-slate-600 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Connection Issue</h3>
        <p className="text-sm text-slate-400 text-center max-w-xs mb-4">
          Unable to scan for clinics right now. Check your internet connection and try again.
        </p>
        <p className="text-xs text-red-400/60 mb-4 text-center max-w-xs">{error}</p>
        <button
          onClick={() => refresh()}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-xl transition-colors"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  if (filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <SearchX size={48} className="text-slate-600 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">No Clinics Found</h3>
        <p className="text-sm text-slate-400 text-center max-w-xs">
          Try adjusting your filters or search query to find more clinics.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
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
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs text-slate-300 font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-[10px] text-slate-600">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}

      {/* Clinic cards */}
      {filteredClinics.map((clinic, i) => (
        <ClinicCard key={clinic.id} clinic={clinic} index={i} />
      ))}

      {/* Source info footer */}
      {searchMeta && (
        <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/5">
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
          {!searchMeta.hasApiKeys.serpApi && !searchMeta.hasApiKeys.googleCse && (
            <p className="text-[10px] text-amber-400/60 mt-2">
              Add search API keys in Settings to unlock more sources
            </p>
          )}
        </div>
      )}
    </div>
  );
}
