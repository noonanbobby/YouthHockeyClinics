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

  // Loading state — but with a real timer so the user knows it won't hang
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
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Radio size={12} className="animate-pulse text-sky-400" />
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

  // Error or no results state
  if (filteredClinics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        {error ? (
          <>
            <Wifi size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              {error.includes('timed out') ? 'Search Timed Out' : 'No Results Yet'}
            </h3>
            <p className="text-sm text-slate-400 text-center max-w-xs mb-2">
              {error}
            </p>
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

        {/* Actionable help */}
        <div className="w-full max-w-sm mt-6 space-y-3">
          {!hasApiKeys && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Key size={16} className="text-amber-400" />
                <p className="text-sm font-semibold text-amber-300">Unlock More Results</p>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                The search engine works best with API keys. A free SerpAPI key
                gets you 100 searches/month and dramatically improves results.
              </p>
              <button
                onClick={() => router.push('/settings')}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium rounded-xl transition-colors"
              >
                Add API Keys
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Scanning...' : 'Try Again'}
          </button>
        </div>

        {/* Show source results if available */}
        {searchMeta && searchMeta.sources.length > 0 && (
          <div className="w-full max-w-sm mt-6 p-4 bg-white/5 rounded-xl border border-white/5">
            <p className="text-xs font-semibold text-white mb-2">
              Attempted {searchMeta.sources.length} Sources
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {searchMeta.sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 truncate mr-2">{source.name}</span>
                  <span className={source.status === 'success' && source.count > 0 ? 'text-green-400' : 'text-slate-600'}>
                    {source.count > 0 ? `${source.count} found` : source.status === 'error' ? 'failed' : '0'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">
              Completed in {(searchMeta.searchDuration / 1000).toFixed(1)}s
            </p>
          </div>
        )}
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
          {!hasApiKeys && (
            <p className="text-[10px] text-amber-400/60 mt-2">
              Add search API keys in Settings to unlock more sources
            </p>
          )}
        </div>
      )}
    </div>
  );
}
