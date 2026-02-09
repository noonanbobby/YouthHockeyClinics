'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useStore, getAgeGroupFromDOB, getChildAge } from '@/store/useStore';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { requestNotificationPermission } from '@/hooks/useServiceWorker';
import { getAgeGroupLabel } from '@/lib/utils';
import {
  ArrowLeft,
  Bell,
  Check,
  RefreshCw,
  Database,
  Info,
  Heart,
  CalendarCheck,
  DollarSign,
  Plug,
  Video,
  Calendar,
  Home,
  Navigation,
  Loader2,
  X,
  UserPlus,
  Users,
  Baby,
  Trash2,
  Cake,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import TeamPicker from '@/components/TeamPicker';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = (session as any)?.isAdmin || false;
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    setLocationEnabled,
    setUserLocation,
    homeLocation,
    setHomeLocation,
    autoRefreshInterval,
    setAutoRefreshInterval,
    searchMeta,
    lastUpdated,
    clinics,
    registrations,
    daySmartConfig,
    liveBarnConfig,
    childProfiles,
    activeChildIds,
    addChildProfile,
    updateChildProfile,
    removeChildProfile,
    toggleActiveChild,
  } = useStore();
  const { refresh } = useClinicSearch();
  const [homeInput, setHomeInput] = useState(homeLocation ? `${homeLocation.city}, ${homeLocation.state}` : '');
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  // Child profile form
  const [childName, setChildName] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childPosition, setChildPosition] = useState<'player' | 'goalie'>('player');
  const [childDivision, setChildDivision] = useState<string>('');
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);

  const AGE_GROUP_OPTIONS = [
    { value: '', label: 'Auto (from DOB)' },
    { value: 'mites', label: 'Mites (8U)' },
    { value: 'squirts', label: 'Squirts (10U)' },
    { value: 'peewee', label: 'Peewee (12U)' },
    { value: 'bantam', label: 'Bantam (14U)' },
    { value: 'midget', label: 'Midget (18U)' },
    { value: 'junior', label: 'Junior (20U)' },
  ];

  const startEditChild = (child: typeof childProfiles[0]) => {
    setEditingChildId(child.id);
    setChildName(child.name);
    setChildDob(child.dateOfBirth);
    setChildPosition(child.position);
    setChildDivision(child.currentDivision || '');
    setShowAddChild(true);
  };

  const resetForm = () => {
    setChildName('');
    setChildDob('');
    setChildPosition('player');
    setChildDivision('');
    setEditingChildId(null);
    setShowAddChild(false);
  };

  const geocodeHome = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setIsGeolocating(true);
    setLocationStatus('Looking up location...');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
          q: input, format: 'json', limit: '1', addressdetails: '1',
        })}`
      );
      const data = await res.json();
      if (data.length > 0) {
        const r = data[0];
        const city = r.address?.city || r.address?.town || r.address?.village || r.address?.county || input.split(',')[0].trim();
        const state = r.address?.state || '';
        const country = r.address?.country || '';
        setHomeLocation({
          city, state, country,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        });
        setHomeInput(`${city}, ${state}`);
        setLocationStatus(`Set to ${city}, ${state}, ${country}`);
        setTimeout(() => setLocationStatus(''), 3000);
      } else {
        setLocationStatus('Location not found. Try a different city name.');
        setTimeout(() => setLocationStatus(''), 3000);
      }
    } catch {
      setLocationStatus('Network error. Try again.');
      setTimeout(() => setLocationStatus(''), 3000);
    } finally {
      setIsGeolocating(false);
    }
  }, [setHomeLocation]);

  const useGPSForHome = useCallback(async () => {
    setIsGeolocating(true);
    setLocationStatus('Getting GPS location...');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setUserLocation({ lat, lng });
      setLocationEnabled(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
          lat: lat.toString(), lon: lng.toString(), format: 'json',
        })}`
      );
      const data = await res.json();
      const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
      const state = data.address?.state || '';
      const country = data.address?.country || '';
      setHomeLocation({ city, state, country, lat, lng });
      setHomeInput(`${city}, ${state}`);
      setLocationStatus(`Located: ${city}, ${state}`);
      setTimeout(() => setLocationStatus(''), 3000);
    } catch {
      setLocationStatus('GPS unavailable. Enter your city manually.');
      setTimeout(() => setLocationStatus(''), 3000);
    } finally {
      setIsGeolocating(false);
    }
  }, [setUserLocation, setLocationEnabled, setHomeLocation]);

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleSaveChild = () => {
    if (!childName.trim() || !childDob) return;
    const divisionValue = childDivision || undefined;
    if (editingChildId) {
      updateChildProfile(editingChildId, {
        name: childName.trim(),
        dateOfBirth: childDob,
        position: childPosition,
        currentDivision: divisionValue as typeof childProfiles[0]['currentDivision'],
      });
    } else {
      addChildProfile({
        name: childName.trim(),
        dateOfBirth: childDob,
        position: childPosition,
        currentDivision: divisionValue as typeof childProfiles[0]['currentDivision'],
      });
    }
    resetForm();
  };

  const upcomingRegs = registrations.filter(
    (r) => r.status !== 'cancelled' && r.endDate >= new Date().toISOString().split('T')[0]
  ).length;
  const totalSpent = registrations
    .filter((r) => r.status !== 'cancelled')
    .reduce((sum, r) => sum + r.price, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="safe-area-top" />
      <div className="px-4 py-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5"
          >
            <ArrowLeft size={18} className="text-slate-300" />
          </button>
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => router.push('/favorites')}
            className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 flex items-center justify-center">
              <Heart size={18} className="text-pink-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Saved</p>
              <p className="text-[10px] text-slate-400">Favorites</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/registrations')}
            className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' }}>
              <CalendarCheck size={18} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">My Clinics</p>
              <p className="text-[10px] text-slate-400">{upcomingRegs} upcoming</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/spending')}
            className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Spending</p>
              <p className="text-[10px] text-slate-400">${totalSpent.toLocaleString()}</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/integrations')}
            className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-2xl border border-white/5 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Plug size={18} className="text-purple-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Integrations</p>
              <p className="text-[10px] text-slate-400">
                {daySmartConfig.connected || liveBarnConfig.connected
                  ? `${[daySmartConfig.connected && 'Dash', liveBarnConfig.connected && 'LiveBarn'].filter(Boolean).join(', ')}`
                  : 'Connect accounts'}
              </p>
            </div>
          </button>
        </div>

        {/* Integration status badges */}
        {(daySmartConfig.connected || liveBarnConfig.connected) && (
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {daySmartConfig.connected && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full shrink-0">
                <Calendar size={12} className="text-orange-400" />
                <span className="text-[10px] text-orange-300 font-medium">Dash Connected</span>
              </div>
            )}
            {liveBarnConfig.connected && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full shrink-0">
                <Video size={12} className="text-red-400" />
                <span className="text-[10px] text-red-300 font-medium">LiveBarn Active</span>
              </div>
            )}
          </div>
        )}

        {/* ━━━ CHILD PROFILES ━━━ */}
        <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-2xl p-4 border border-violet-500/20 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Users size={20} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">My Players</h3>
                <p className="text-[10px] text-slate-400">
                  {childProfiles.length === 0
                    ? 'Add your child to personalize searches'
                    : `${childProfiles.length} player${childProfiles.length > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (showAddChild) resetForm();
                else setShowAddChild(true);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-violet-500/20 active:scale-90 transition-transform"
            >
              {showAddChild ? <X size={16} className="text-violet-300" /> : <UserPlus size={16} className="text-violet-300" />}
            </button>
          </div>

          {/* Add child form */}
          <AnimatePresence>
            {showAddChild && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-black/20 rounded-xl p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Child's first name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                  />
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={childDob}
                      onChange={(e) => setChildDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      min="2005-01-01"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
                    />
                  </div>
                  {/* Position selector */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Position</label>
                    <div className="flex gap-2">
                      {(['player', 'goalie'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setChildPosition(pos)}
                          className={cn(
                            'flex-1 py-2 text-xs font-medium rounded-xl border transition-all',
                            childPosition === pos
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                              : 'bg-white/5 border-white/10 text-slate-400'
                          )}
                        >
                          {pos === 'player' ? '🏒 Player' : '🥅 Goalie'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Current Division override */}
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Current Division {childDivision && childDob && childDivision !== getAgeGroupFromDOB(childDob) && (
                        <span className="text-amber-400 ml-1">(playing up)</span>
                      )}
                    </label>
                    <select
                      value={childDivision}
                      onChange={(e) => setChildDivision(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 [color-scheme:dark]"
                    >
                      {AGE_GROUP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-500 mt-1">
                      Override if your child plays in a different division than their age (e.g. playing up)
                    </p>
                  </div>
                  {childDob && childName && (
                    <div className="flex items-center gap-2 text-[10px] text-violet-300">
                      <Baby size={12} />
                      <span>
                        Age {getChildAge(childDob)} — {getAgeGroupLabel(childDivision ? childDivision as Parameters<typeof getAgeGroupLabel>[0] : getAgeGroupFromDOB(childDob))} division
                        {childDivision && childDivision !== getAgeGroupFromDOB(childDob) && ' (playing up)'}
                        {' · '}{childPosition === 'goalie' ? '🥅 Goalie' : '🏒 Player'}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleSaveChild}
                    disabled={!childName.trim() || !childDob}
                    className="w-full py-2.5 bg-violet-500/30 hover:bg-violet-500/40 text-violet-200 text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
                  >
                    {editingChildId ? 'Save Changes' : 'Add Player'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Child profiles list */}
          {childProfiles.length > 0 && (
            <div className="space-y-2">
              {childProfiles.map((child) => {
                const age = getChildAge(child.dateOfBirth);
                const naturalGroup = getAgeGroupFromDOB(child.dateOfBirth);
                const effectiveGroup = child.currentDivision || naturalGroup;
                const isActive = activeChildIds.includes(child.id);
                const playingUp = child.currentDivision && child.currentDivision !== naturalGroup;
                const childRegs = registrations.filter(
                  (r) => r.childId === child.id && r.status !== 'cancelled' && r.endDate >= new Date().toISOString().split('T')[0]
                );

                return (
                  <motion.div
                    key={child.id}
                    layout
                    className={cn(
                      'relative p-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98]',
                      isActive
                        ? 'bg-violet-500/15 border-violet-500/30'
                        : 'bg-black/20 border-white/5 hover:border-violet-500/20'
                    )}
                    onClick={() => toggleActiveChild(child.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold relative',
                          isActive ? 'bg-violet-500/30 text-violet-200' : 'bg-white/10 text-slate-300'
                        )}>
                          {child.name.charAt(0).toUpperCase()}
                          {isActive && (
                            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-violet-500 flex items-center justify-center">
                              <Check size={8} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{child.name}</p>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-violet-500/30 text-violet-300">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Cake size={10} /> Age {age}
                            </span>
                            <span className="text-slate-600">|</span>
                            <span className="text-violet-400 font-medium">
                              {getAgeGroupLabel(effectiveGroup)}
                              {playingUp && <span className="text-amber-400 ml-1">(up)</span>}
                            </span>
                            <span className="text-slate-600">|</span>
                            <span>{child.position === 'goalie' ? '🥅 Goalie' : '🏒 Player'}</span>
                            {childRegs.length > 0 && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span>{childRegs.length} upcoming</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditChild(child);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-violet-500/20 transition-colors"
                          title="Edit"
                        >
                          <span className="text-[11px]">✏️</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove ${child.name}?`)) {
                              removeChildProfile(child.id);
                            }
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 size={13} className="text-slate-500 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {childProfiles.length > 0 && (
            <p className="text-[10px] text-slate-500 mt-2">
              Tap to select/deselect. Select both players to see clinics for everyone. Tap ✏️ to edit.
            </p>
          )}
        </div>

        {/* Team Color Theme */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 mb-6">
          <TeamPicker />
        </div>

        {/* Search Status */}
        <div className="rounded-2xl p-4 border mb-6"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 10%, transparent), color-mix(in srgb, var(--theme-secondary) 10%, transparent))',
            borderColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
          }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' }}>
              <Database size={20} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Search Engine Status</h3>
              <p className="text-[10px] text-slate-400">
                {clinics.length} clinics indexed
                {lastUpdated && ` · Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          {searchMeta && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{searchMeta.sources.length}</p>
                <p className="text-[10px] text-slate-400">Sources</p>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">{searchMeta.totalRaw}</p>
                <p className="text-[10px] text-slate-400">Raw Results</p>
              </div>
              <div className="bg-black/20 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-white">
                  {(searchMeta.searchDuration / 1000).toFixed(1)}s
                </p>
                <p className="text-[10px] text-slate-400">Scan Time</p>
              </div>
            </div>
          )}
          <button
            onClick={() => refresh()}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-colors"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
              color: 'var(--theme-accent)',
            }}
          >
            <RefreshCw size={14} />
            Scan Now
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {/* Admin Dashboard Link — only visible to admins */}
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Shield size={18} className="text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Admin Dashboard</p>
                  <p className="text-xs text-slate-400">API keys, server config, users</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          )}

          {/* Auto-refresh */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <RefreshCw size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Auto-Refresh</p>
                <p className="text-xs text-slate-400">
                  Automatically re-scan for new clinics
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {[15, 30, 60, 0].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setAutoRefreshInterval(minutes)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium rounded-lg transition-colors border',
                    autoRefreshInterval === minutes
                      ? 'border-transparent'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  )}
                  style={autoRefreshInterval === minutes ? {
                    backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                    color: 'var(--theme-accent)',
                    borderColor: 'color-mix(in srgb, var(--theme-primary) 30%, transparent)',
                  } : undefined}
                >
                  {minutes === 0 ? 'Off' : `${minutes}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Bell size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Push Notifications</p>
                  <p className="text-xs text-slate-400">Reminders, new clinics, price drops</p>
                </div>
              </div>
              <button
                onClick={handleNotificationToggle}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  notificationsEnabled ? '' : 'bg-white/10'
                )}
                style={notificationsEnabled ? { backgroundColor: 'var(--theme-primary)' } : undefined}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                    notificationsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
            {notificationsEnabled && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                <p className="text-[10px] text-slate-500">You&apos;ll receive alerts for:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['New clinics found', 'Registration reminders', 'Spots running low', 'Price drops', 'Child age matches'].map((label) => (
                    <span key={label} className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Home Location — Tiered Search */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Home size={18} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Home Location</p>
                <p className="text-xs text-slate-400">
                  {homeLocation
                    ? `${homeLocation.city}, ${homeLocation.state}, ${homeLocation.country}`
                    : 'Set your location for local clinic priority'}
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
              Clinics near you appear first. Search expands outward: your city → region → state → country → global.
              Outstanding clinics always surface regardless of distance.
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={homeInput}
                onChange={(e) => setHomeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') geocodeHome(homeInput);
                }}
                placeholder="Enter city (e.g. Fort Lauderdale, FL)"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
              />
              <button
                onClick={() => geocodeHome(homeInput)}
                disabled={isGeolocating || !homeInput.trim()}
                className="px-3 py-2.5 text-white text-xs font-medium rounded-xl disabled:opacity-40 transition-colors"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                {isGeolocating ? <Loader2 size={14} className="animate-spin" /> : 'Set'}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={useGPSForHome}
                disabled={isGeolocating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-40"
              >
                <Navigation size={12} />
                Use GPS
              </button>
              {homeLocation && (
                <button
                  onClick={() => {
                    setHomeLocation(null);
                    setHomeInput('');
                    setLocationStatus('Location cleared');
                    setTimeout(() => setLocationStatus(''), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>

            {locationStatus && (
              <p className={cn(
                'text-[10px] mt-2 transition-colors',
                locationStatus.includes('Set to') || locationStatus.includes('Located')
                  ? 'text-emerald-400'
                  : locationStatus.includes('error') || locationStatus.includes('not found')
                  ? 'text-red-400'
                  : 'text-slate-400'
              )}>
                {locationStatus}
              </p>
            )}

            {homeLocation && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-slate-500 font-medium mb-1">SEARCH PRIORITY</p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                      color: 'var(--theme-accent)',
                    }}>
                    1. {homeLocation.city}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-slate-300">
                    2. {homeLocation.state}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400">
                    3. {homeLocation.country}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.03] text-slate-500">
                    4. Global
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* About */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-500/10 flex items-center justify-center">
                <Info size={18} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">About</p>
                <p className="text-xs text-slate-400">Noonan Hockey v2.0</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Noonan Hockey — your all-in-one hockey hub. Scans the internet in real-time to discover
              youth hockey clinics, camps, showcases, and development programs worldwide. Integrates
              with Dash by DaySmart for local rink management and LiveBarn for live streaming. Track
              your registrations, spending, and never miss an opportunity.
            </p>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[10px] text-slate-600">
                Data is sourced from publicly available websites. Verify all information directly
                with the clinic organizer before registering.
              </p>
            </div>
          </div>

          {/* PWA Install Instructions */}
          <div className="rounded-2xl border p-4"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 10%, transparent), color-mix(in srgb, var(--theme-secondary) 10%, transparent))',
              borderColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
            }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-sm font-bold text-white">Install on iPhone</p>
                <p className="text-xs text-slate-400">Add to your home screen</p>
              </div>
            </div>
            <ol className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="font-bold" style={{ color: 'var(--theme-primary)' }}>1.</span>
                <span>
                  Tap the <strong>Share</strong> button (box with arrow) in Safari
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold" style={{ color: 'var(--theme-primary)' }}>2.</span>
                <span>
                  Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold" style={{ color: 'var(--theme-primary)' }}>3.</span>
                <span>
                  Tap <strong>&quot;Add&quot;</strong> — the app icon will appear on your home screen
                </span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
