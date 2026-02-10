'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { StickAndPuckSession, SessionType } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Filter,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Navigation,
  Users,
  ExternalLink,
  Star,
  Snowflake,
  AlertCircle,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { format, addDays, isSameDay, isToday, isTomorrow, startOfDay } from 'date-fns';

type SessionWithDistance = StickAndPuckSession & { distance: number | null };

const SESSION_TYPE_CONFIG: Record<SessionType, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  'stick-and-puck': { label: 'Stick & Puck', emoji: '🏒', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'open-hockey': { label: 'Open Hockey', emoji: '🥅', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'public-skate': { label: 'Public Skate', emoji: '⛸️', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  'drop-in': { label: 'Drop-In', emoji: '🎯', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDistance(km: number): string {
  const miles = km * 0.621371;
  return miles < 1 ? `${(miles * 5280).toFixed(0)} ft` : `${miles.toFixed(1)} mi`;
}

export default function StickAndPuckPage() {
  const router = useRouter();
  const { homeLocation, userLocation } = useStore();
  const effectiveLocation = useMemo(() => {
    return userLocation || (homeLocation ? { lat: homeLocation.lat, lng: homeLocation.lng } : null);
  }, [userLocation, homeLocation]);

  const [sessions, setSessions] = useState<SessionWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<{ daysmart: number; daysmartSessions: number; seed: number } | null>(null);

  // Filter state
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedType, setSelectedType] = useState<SessionType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Date range for horizontal scroll (7 days)
  const [dateRangeStart, setDateRangeStart] = useState<Date>(startOfDay(new Date()));
  const dateRange = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(dateRangeStart, i));
  }, [dateRangeStart]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (effectiveLocation) {
        params.set('lat', effectiveLocation.lat.toString());
        params.set('lng', effectiveLocation.lng.toString());
      }
      if (selectedType !== 'all') {
        params.set('type', selectedType);
      }

      const res = await fetch(`/api/stick-and-puck?${params}`);
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
      if (data.sources) setSources(data.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [effectiveLocation, selectedType]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Group sessions by the selected date
  const sessionsForDate = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return sessions
      .filter(s => s.date === dateStr)
      .sort((a, b) => {
        // Sort by time, then by distance
        const timeComp = a.startTime.localeCompare(b.startTime);
        if (timeComp !== 0) return timeComp;
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return 0;
      });
  }, [sessions, selectedDate]);

  // Group sessions by rink for the selected date
  const sessionsByRink = useMemo(() => {
    const map = new Map<string, { rinkName: string; location: SessionWithDistance['location']; distance: number | null; sessions: SessionWithDistance[] }>();
    for (const s of sessionsForDate) {
      const existing = map.get(s.rinkId);
      if (existing) {
        existing.sessions.push(s);
      } else {
        map.set(s.rinkId, {
          rinkName: s.rinkName,
          location: s.location,
          distance: s.distance,
          sessions: [s],
        });
      }
    }
    // Sort rinks by distance
    return [...map.values()].sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      return a.rinkName.localeCompare(b.rinkName);
    });
  }, [sessionsForDate]);

  // Count sessions by type for the selected date
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sessionsForDate.length };
    for (const s of sessionsForDate) {
      counts[s.sessionType] = (counts[s.sessionType] || 0) + 1;
    }
    return counts;
  }, [sessionsForDate]);

  // All session types that exist in the data
  const availableTypes = useMemo(() => {
    const types = new Set(sessions.map(s => s.sessionType));
    return [...types] as SessionType[];
  }, [sessions]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="safe-area-top" />
      <div className="pb-28">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => router.push('/')}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft size={18} className="text-slate-600" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-900">Ice Time</h1>
                <p className="text-[11px] text-slate-500">
                  {sources && sources.daysmartSessions > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Radio size={9} className="text-green-500" />
                      <span className="text-green-600 font-medium">Live</span>
                      {' · '}Stick & puck, open hockey, public skate
                    </span>
                  ) : (
                    <>Stick & puck, open hockey, public skate
                    {effectiveLocation && ' · South Florida rinks'}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setSessions([]); fetchSessions(); }}
                disabled={loading}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                title="Refresh schedule"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-full transition-colors',
                  showFilters ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100',
                )}
              >
                <Filter size={18} />
              </button>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDateRangeStart(addDays(dateRangeStart, -7))}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex-1 flex gap-1 overflow-hidden">
                {dateRange.map((date) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const hasSessions = sessions.some(s => s.date === format(date, 'yyyy-MM-dd'));
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        'flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all text-center min-w-0',
                        isSelected
                          ? 'text-white shadow-sm'
                          : hasSessions
                          ? 'bg-white text-slate-700 hover:bg-slate-50'
                          : 'text-slate-400'
                      )}
                      style={isSelected ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                    >
                      <span className="text-[10px] font-medium">
                        {isToday(date) ? 'Today' : isTomorrow(date) ? 'Tmrw' : DAY_NAMES[date.getDay()]}
                      </span>
                      <span className={cn('text-sm font-bold', !isSelected && !hasSessions && 'opacity-50')}>
                        {format(date, 'd')}
                      </span>
                      {hasSessions && !isSelected && (
                        <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: 'var(--theme-primary)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setDateRangeStart(addDays(dateRangeStart, 7))}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-100"
              >
                <div className="px-4 py-3">
                  <p className="text-[10px] text-slate-500 font-medium uppercase mb-2">Session Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedType('all')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        selectedType === 'all'
                          ? 'text-white border-transparent'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                      )}
                      style={selectedType === 'all' ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                    >
                      All ({typeCounts.all || 0})
                    </button>
                    {availableTypes.map((type) => {
                      const config = SESSION_TYPE_CONFIG[type];
                      const count = typeCounts[type] || 0;
                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedType(type)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                            selectedType === type
                              ? `${config.bg} ${config.color} ${config.border}`
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                          )}
                        >
                          {config.emoji} {config.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="px-4 pt-4">
          {/* No location warning */}
          {!effectiveLocation && !loading && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Set your location</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Go to <button onClick={() => router.push('/settings')} className="underline font-medium">Settings</button> to set your home location for distance info.
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Finding ice time near you...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={fetchSessions} className="mt-2 text-xs text-red-600 underline">Try again</button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && sessionsForDate.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Snowflake size={40} className="text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">No sessions on {format(selectedDate, 'EEEE, MMM d')}</p>
              <p className="text-xs text-slate-500 mt-1">
                Try a different day or select a different session type above.
              </p>
            </div>
          )}

          {/* Sessions by rink */}
          {!loading && !error && sessionsByRink.length > 0 && (
            <div className="space-y-4">
              {/* Day summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">
                  {format(selectedDate, 'EEEE, MMMM d')}
                </p>
                <p className="text-xs text-slate-500">
                  {sessionsForDate.length} session{sessionsForDate.length !== 1 ? 's' : ''} at {sessionsByRink.length} rink{sessionsByRink.length !== 1 ? 's' : ''}
                </p>
              </div>

              {sessionsByRink.map((rink) => (
                <div key={rink.rinkName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Rink header */}
                  <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 12%, transparent)' }}>
                          <Snowflake size={16} style={{ color: 'var(--theme-primary)' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{rink.rinkName}</h3>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <MapPin size={10} />
                              {rink.location.city}, {rink.location.state}
                            </span>
                            {rink.distance != null && (
                              <span className="flex items-center gap-0.5 font-medium" style={{ color: 'var(--theme-primary)' }}>
                                <Navigation size={10} />
                                {formatDistance(rink.distance)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                        {rink.sessions.length} session{rink.sessions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Sessions */}
                  <div className="divide-y divide-slate-50">
                    {rink.sessions.map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────
function SessionCard({ session }: { session: SessionWithDistance }) {
  const [expanded, setExpanded] = useState(false);
  const config = SESSION_TYPE_CONFIG[session.sessionType];

  return (
    <div className="px-4 py-3">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-center gap-3">
          {/* Time block */}
          <div className="w-16 shrink-0 text-center">
            <p className="text-sm font-bold text-slate-900">{formatTime(session.startTime)}</p>
            <p className="text-[10px] text-slate-400">{formatTime(session.endTime)}</p>
          </div>

          {/* Session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', config.bg, config.color, config.border)}>
                {config.emoji} {config.label}
              </span>
              {session.source === 'daysmart' && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-0.5">
                  <Radio size={8} /> Live
                </span>
              )}
              {session.goaliesFree && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                  Goalies Free
                </span>
              )}
            </div>
            <p className="text-[13px] font-medium text-slate-800 truncate">{session.name}</p>
          </div>

          {/* Price */}
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-slate-900">${session.price}</p>
            {session.maxSkaters && (
              <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
                <Users size={9} /> Max {session.maxSkaters}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
              {session.ageRestriction && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Users size={12} className="text-slate-400" />
                  <span>Ages: {session.ageRestriction}</span>
                </div>
              )}
              {session.equipmentRequired && session.equipmentRequired.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Star size={12} className="text-slate-400" />
                  <span>{session.equipmentRequired.join(', ')}</span>
                </div>
              )}
              {session.notes && (
                <p className="text-xs text-slate-500 italic">{session.notes}</p>
              )}
              {session.recurring && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={12} className="text-slate-400" />
                  <span>
                    Recurring: every {session.recurring.days.map(d => DAY_NAMES[d]).join(', ')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <MapPin size={10} />
                <span>{session.location.address}, {session.location.city}, {session.location.state}</span>
              </div>
              {session.registrationUrl && (
                <a
                  href={session.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium mt-1"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  <ExternalLink size={12} />
                  Register Online
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
