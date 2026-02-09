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
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl max-h-[85vh] overflow-hidden"
            style={{ boxShadow: '0 -4px 30px rgba(0,0,0,0.12)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">Filters</h2>
                {count > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full text-white"
                    style={{ backgroundColor: 'var(--theme-primary)' }}>
                    {count} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setFilterOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100"
                >
                  <X size={18} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[70vh] p-5 space-y-6 pb-32">
              {/* Date Range */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Date Range</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">From</label>
                    <input
                      type="date"
                      value={filters.dateRange.start || ''}
                      onChange={(e) =>
                        setFilter('dateRange', { ...filters.dateRange, start: e.target.value || null })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 [color-scheme:light]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">To</label>
                    <input
                      type="date"
                      value={filters.dateRange.end || ''}
                      onChange={(e) =>
                        setFilter('dateRange', { ...filters.dateRange, end: e.target.value || null })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 [color-scheme:light]"
                    />
                  </div>
                </div>
              </div>

              {/* Age Groups */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Age Groups</h3>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map((ag) => (
                    <button
                      key={ag}
                      onClick={() => toggleArrayFilter('ageGroups', ag)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.ageGroups.includes(ag)
                          ? 'text-white border-transparent'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                      style={filters.ageGroups.includes(ag) ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                    >
                      {getAgeGroupLabel(ag)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Levels */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Skill Level</h3>
                <div className="flex flex-wrap gap-2">
                  {SKILL_LEVELS.map((sl) => (
                    <button
                      key={sl}
                      onClick={() => toggleArrayFilter('skillLevels', sl)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.skillLevels.includes(sl)
                          ? 'text-white border-transparent'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                      style={filters.skillLevels.includes(sl) ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                    >
                      {getSkillLevelLabel(sl)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinic Types */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Type</h3>
                <div className="flex flex-wrap gap-2">
                  {CLINIC_TYPES.map((ct) => (
                    <button
                      key={ct}
                      onClick={() => toggleArrayFilter('clinicTypes', ct)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.clinicTypes.includes(ct)
                          ? 'text-white border-transparent'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                      style={filters.clinicTypes.includes(ct) ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                    >
                      {getClinicTypeLabel(ct)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              {countries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Country</h3>
                  <select
                    value={filters.country || ''}
                    onChange={(e) => setFilter('country', e.target.value || null)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 appearance-none [color-scheme:light]"
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
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Sort By</h3>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilter('sortBy', opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        filters.sortBy === opt.value
                          ? 'text-white border-transparent'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                      style={filters.sortBy === opt.value ? { backgroundColor: 'var(--theme-primary)' } : undefined}
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
                          ? 'text-white border-transparent'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                      style={filters.sortOrder === order ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                    >
                      {order === 'asc' ? 'Ascending' : 'Descending'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-900">🥅 Goalie Clinics Only</span>
                  </div>
                  <button
                    onClick={() => setFilter('goalieOnly', !filters.goalieOnly)}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative',
                      filters.goalieOnly ? '' : 'bg-slate-200'
                    )}
                    style={filters.goalieOnly ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm',
                        filters.goalieOnly ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-900">Spots Available Only</span>
                  <button
                    onClick={() => setFilter('spotsAvailable', !filters.spotsAvailable)}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative',
                      filters.spotsAvailable ? '' : 'bg-slate-200'
                    )}
                    style={filters.spotsAvailable ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm',
                        filters.spotsAvailable ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-900">Featured Only</span>
                  <button
                    onClick={() => setFilter('featured', !filters.featured)}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative',
                      filters.featured ? '' : 'bg-slate-200'
                    )}
                    style={filters.featured ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm',
                        filters.featured ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 safe-area-bottom">
              <button
                onClick={() => setFilterOpen(false)}
                className="w-full py-3 text-white font-semibold rounded-xl transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--theme-primary)' }}
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
