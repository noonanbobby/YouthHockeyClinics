'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

const trendingSearches = [
  'Summer camps 2026',
  'Goaltending',
  'Power skating',
  'Canada',
  'Elite showcase',
  'Beginner friendly',
];

export default function SearchOverlay() {
  const {
    isSearchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    filteredClinics,
  } = useStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setLocalQuery(searchQuery);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isSearchOpen, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    addRecentSearch(query);
    setSearchOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      handleSearch(localQuery.trim());
    }
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/98 backdrop-blur-xl"
        >
          <div className="safe-area-top" />
          <div className="p-4">
            {/* Search input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 mb-6">
              <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={localQuery}
                  onChange={(e) => {
                    setLocalQuery(e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                  placeholder="Search clinics, locations, coaches..."
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 outline-none"
                />
                {localQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalQuery('');
                      setSearchQuery('');
                    }}
                    className="text-slate-400"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  if (!localQuery.trim()) setSearchQuery('');
                }}
                className="text-sky-400 text-sm font-medium"
              >
                Cancel
              </button>
            </form>

            {/* Live results count */}
            {localQuery && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-slate-400 mb-4"
              >
                {filteredClinics.length} {filteredClinics.length === 1 ? 'result' : 'results'} found
              </motion.p>
            )}

            {/* Live results */}
            {localQuery && filteredClinics.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 space-y-1"
              >
                {filteredClinics.slice(0, 5).map((clinic) => (
                  <button
                    key={clinic.id}
                    onClick={() => handleSearch(localQuery)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <img
                      src={clinic.imageUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{clinic.name}</p>
                      <p className="text-xs text-slate-400 truncate">{clinic.location.city}, {clinic.location.country}</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-500 shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}

            {/* Recent searches */}
            {!localQuery && recentSearches.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    Recent Searches
                  </h3>
                  <button
                    onClick={clearRecentSearches}
                    className="text-xs text-sky-400 font-medium"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setLocalQuery(search);
                        handleSearch(search);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                    >
                      <Clock size={14} className="text-slate-500" />
                      <span className="text-sm text-slate-300">{search}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            {!localQuery && (
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-sky-400" />
                  Trending Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map((search) => (
                    <button
                      key={search}
                      onClick={() => {
                        setLocalQuery(search);
                        handleSearch(search);
                      }}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-300 transition-colors"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
