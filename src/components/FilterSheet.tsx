'use client';

import { X, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn, getAgeGroupLabel, getSkillLevelLabel, getClinicTypeLabel } from '@/lib/utils';
import { AgeGroup, SkillLevel, ClinicType } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const AGE_GROUPS: AgeGroup[] = ['mites', 'squirts', 'peewee', 'bantam', 'midget', 'junior'];
const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'elite'];
const CLINIC_TYPES: ClinicType[] = ['camp', 'clinic', 'development', 'showcase', 'tournament'];
const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'price', label: 'Price' },
  { value: 'rating', label: 'Rating' },
  { value: 'name', label: 'Name' },
] as const;

export default function FilterSheet() {
  const {
    isFilterOpen,
    setFilterOpen,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    filteredClinics,
    clinics,
  } = useStore();

  const count = activeFilterCount();

  const toggleArrayFilter = <K extends 'ageGroups' | 'skillLevels' | 'clinicTypes'>(
    key: K,
    value: string
  ) => {
    const current = filters[key] as string[];
    if (current.includes(value)) {
      setFilter(key, current.filter((v) => v !== value) as typeof filters[K]);
    } else {
      setFilter(key, [...current, value] as typeof filters[K]);
    }
  };

  // Get available countries from data
  const countries = [...new Set(clinics.map((c) => c.location.country))].sort();

  return (
    <AnimatePresence>
      {isFilterOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFilterOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl max-h-[85vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Filters</h2>
                {count > 0 && (
                  <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 text-xs font-semibold rounded-full">
                    {count} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setFilterOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[70vh] p-5 space-y-6 pb-32">
              {/* Date Range */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Date Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">From</label>
                    <input
                      type="date"
                      value={filters.dateRange.start || ''}
                      onChange={(e) =>
                        setFilter('dateRange', { ...filters.dateRange, start: e.target.value || null })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">To</label>
                    <input
                      type="date"
                      value={filters.dateRange.end || ''}
                      onChange={(e) =>
                        setFilter('dateRange', { ...filters.dateRange, end: e.target.value || null })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Age Groups */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Age Groups</h3>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map((ag) => (
                    <button
                      key={ag}
                      onClick={() => toggleArrayFilter('ageGroups', ag)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.ageGroups.includes(ag)
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {getAgeGroupLabel(ag)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Levels */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Skill Level</h3>
                <div className="flex flex-wrap gap-2">
                  {SKILL_LEVELS.map((sl) => (
                    <button
                      key={sl}
                      onClick={() => toggleArrayFilter('skillLevels', sl)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.skillLevels.includes(sl)
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {getSkillLevelLabel(sl)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinic Types */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Type</h3>
                <div className="flex flex-wrap gap-2">
                  {CLINIC_TYPES.map((ct) => (
                    <button
                      key={ct}
                      onClick={() => toggleArrayFilter('clinicTypes', ct)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.clinicTypes.includes(ct)
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {getClinicTypeLabel(ct)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              {countries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Country</h3>
                  <select
                    value={filters.country || ''}
                    onChange={(e) => setFilter('country', e.target.value || null)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50 appearance-none"
                  >
                    <option value="">All Countries</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sort */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Sort By</h3>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilter('sortBy', opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.sortBy === opt.value
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {(['asc', 'desc'] as const).map((order) => (
                    <button
                      key={order}
                      onClick={() => setFilter('sortOrder', order)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.sortOrder === order
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      {order === 'asc' ? 'Ascending' : 'Descending'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-white">Spots Available Only</span>
                  <button
                    onClick={() => setFilter('spotsAvailable', !filters.spotsAvailable)}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative',
                      filters.spotsAvailable ? 'bg-sky-500' : 'bg-white/10'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                        filters.spotsAvailable ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-white">Featured Only</span>
                  <button
                    onClick={() => setFilter('featured', !filters.featured)}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative',
                      filters.featured ? 'bg-sky-500' : 'bg-white/10'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                        filters.featured ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-white/5 safe-area-bottom">
              <button
                onClick={() => setFilterOpen(false)}
                className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl transition-colors"
              >
                Show {filteredClinics.length} Result{filteredClinics.length !== 1 ? 's' : ''}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
