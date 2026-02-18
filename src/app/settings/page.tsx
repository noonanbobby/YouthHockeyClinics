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
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import TeamPicker from '@/components/TeamPicker';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.isAdmin || false;
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
    searchRadiusMiles,
    setSearchRadiusMiles,
    childProfiles,
    activeChildIds,
    addChildProfile,
    updateChildProfile,
    removeChildProfile,
    toggleActiveChild,
    setDaySmartConfig,
    setIceHockeyProConfig,
    removeRegistration,
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
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="safe-area-top" />
      <div className="px-4 py-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        </div>

        {/* Sync Status Banner — only show when signed in */}
        {session?.user && (
          <div className="mb-6 p-4 rounded-2xl border bg-white border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <RefreshCw size={18} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">Cloud Sync</p>
                <p className="text-[10px] text-slate-500 truncate">
                  Signed in as {session.user.email}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                Active
              </span>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => router.push('/favorites')}
            className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center">
              <Heart size={18} className="text-pink-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Saved</p>
              <p className="text-[10px] text-slate-500">Favorites</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/registrations')}
            className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' }}>
              <CalendarCheck size={18} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">My Clinics</p>
              <p className="text-[10px] text-slate-500">{upcomingRegs} upcoming</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/spending')}
            className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Spending</p>
              <p className="text-[10px] text-slate-500">${totalSpent.toLocaleString()}</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/integrations')}
            className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
              <Plug size={18} className="text-purple-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">Integrations</p>
              <p className="text-[10px] text-slate-500">
                {daySmartConfig.connected
                  ? 'Dash connected'
                  : 'Connect accounts'}
              </p>
            </div>
          </button>
        </div>

        {/* Integration status badges */}
        {daySmartConfig.connected && (
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full shrink-0">
              <Calendar size={12} className="text-orange-600" />
              <span className="text-[10px] text-orange-600 font-medium">Dash Connected</span>
            </div>
          </div>
        )}

        {/* ━━━ CHILD PROFILES ━━━ */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Users size={20} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">My Players</h3>
                <p className="text-[10px] text-slate-500">
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
              className="w-8 h-8 flex items-center justify-center rounded-full bg-violet-100 active:scale-90 transition-transform"
            >
              {showAddChild ? <X size={16} className="text-violet-600" /> : <UserPlus size={16} className="text-violet-600" />}
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
                <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Child's first name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
                  />
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={childDob}
                      onChange={(e) => setChildDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      min="2005-01-01"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-violet-400 [color-scheme:light]"
                    />
                  </div>
                  {/* Position selector */}
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Position</label>
                    <div className="flex gap-2">
                      {(['player', 'goalie'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setChildPosition(pos)}
                          className={cn(
                            'flex-1 py-2 text-xs font-medium rounded-xl border transition-all',
                            childPosition === pos
                              ? 'bg-violet-100 border-violet-300 text-violet-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          )}
                        >
                          {pos === 'player' ? '🏒 Player' : '🥅 Goalie'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Current Division override */}
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      Current Division {childDivision && childDob && childDivision !== getAgeGroupFromDOB(childDob) && (
                        <span className="text-amber-600 ml-1">(playing up)</span>
                      )}
                    </label>
                    <select
                      value={childDivision}
                      onChange={(e) => setChildDivision(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-violet-400 [color-scheme:light]"
                    >
                      {AGE_GROUP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-500 mt-1">
                      Override if your child plays in a different division than their age (e.g. playing up)
                    </p>
                  </div>
                  {childDob && childName && (
                    <div className="flex items-center gap-2 text-[10px] text-violet-600">
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
                    className="w-full py-2.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
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
                        ? 'bg-violet-50 border-violet-200'
                        : 'bg-slate-50 border-slate-200 hover:border-violet-200'
                    )}
                    onClick={() => toggleActiveChild(child.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold relative',
                          isActive ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
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
                            <p className="text-sm font-bold text-slate-900">{child.name}</p>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-violet-100 text-violet-600">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Cake size={10} /> Age {age}
                            </span>
                            <span className="text-slate-600">|</span>
                            <span className="text-violet-600 font-medium">
                              {getAgeGroupLabel(effectiveGroup)}
                              {playingUp && <span className="text-amber-600 ml-1">(up)</span>}
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
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-violet-100 transition-colors"
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
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={13} className="text-slate-500 hover:text-red-500" />
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
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
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
              <h3 className="text-sm font-bold text-slate-900">Search Engine Status</h3>
              <p className="text-[10px] text-slate-500">
                {clinics.length} clinics indexed
                {lastUpdated && ` · Updated ${new Date(lastUpdated).toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          {searchMeta && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-900">{searchMeta.sources.length}</p>
                <p className="text-[10px] text-slate-500">Sources</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-900">{searchMeta.totalRaw}</p>
                <p className="text-[10px] text-slate-500">Raw Results</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-900">
                  {(searchMeta.searchDuration / 1000).toFixed(1)}s
                </p>
                <p className="text-[10px] text-slate-500">Scan Time</p>
              </div>
            </div>
          )}
          <button
            onClick={() => refresh()}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-colors text-white"
            style={{ backgroundColor: 'var(--theme-primary)' }}
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
              className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-200 p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Shield size={18} className="text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">Admin Dashboard</p>
                  <p className="text-xs text-slate-500">API keys, server config, users</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          )}

          {/* Auto-refresh */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <RefreshCw size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Auto-Refresh</p>
                <p className="text-xs text-slate-500">
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
                      ? 'text-white border-transparent'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  )}
                  style={autoRefreshInterval === minutes ? {
                    backgroundColor: 'var(--theme-primary)',
                  } : undefined}
                >
                  {minutes === 0 ? 'Off' : `${minutes}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Bell size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Push Notifications</p>
                  <p className="text-xs text-slate-500">Reminders, new clinics, price drops</p>
                </div>
              </div>
              <button
                onClick={handleNotificationToggle}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  notificationsEnabled ? '' : 'bg-slate-200'
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
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                <p className="text-[10px] text-slate-500">You&apos;ll receive alerts for:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['New clinics found', 'Registration reminders', 'Spots running low', 'Price drops', 'Child age matches'].map((label) => (
                    <span key={label} className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-purple-50 text-purple-600 border border-purple-200">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Home Location — Tiered Search */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Home size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Home Location</p>
                <p className="text-xs text-slate-500">
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
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-green-500/50"
              />
              <button
                onClick={() => geocodeHome(homeInput)}
                disabled={isGeolocating || !homeInput.trim()}
                className="px-4 py-2.5 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                {isGeolocating ? <Loader2 size={14} className="animate-spin" /> : 'Set'}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={useGPSForHome}
                disabled={isGeolocating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 hover:text-red-500 transition-colors"
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
                  ? 'text-emerald-600'
                  : locationStatus.includes('error') || locationStatus.includes('not found')
                  ? 'text-red-500'
                  : 'text-slate-500'
              )}>
                {locationStatus}
              </p>
            )}

            {homeLocation && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-[10px] text-slate-500 font-medium mb-1">SEARCH PRIORITY</p>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: 'var(--theme-primary)' }}>
                    1. {homeLocation.city}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                    2. {homeLocation.state}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500">
                    3. {homeLocation.country}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-slate-500">
                    4. Global
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Search Radius */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
                <Navigation size={18} className="text-cyan-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Search Radius</p>
                <p className="text-xs text-slate-500">
                  Ice Time searches within {searchRadiusMiles} miles
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 25, 50].map((miles) => (
                <button
                  key={miles}
                  onClick={() => setSearchRadiusMiles(miles)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium rounded-lg transition-colors border',
                    searchRadiusMiles === miles
                      ? 'text-white border-transparent'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  )}
                  style={searchRadiusMiles === miles ? {
                    backgroundColor: 'var(--theme-primary)',
                  } : undefined}
                >
                  {miles} mi
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Controls the search radius for stick & puck, open hockey, and public skate sessions.
            </p>
          </div>

          {/* About */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <Info size={18} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">About</p>
                <p className="text-xs text-slate-500">Noonan Hockey v2.0</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Noonan Hockey — your all-in-one hockey hub. Scans the internet in real-time to discover
              youth hockey clinics, camps, showcases, and development programs worldwide. Integrates
              with Dash by DaySmart for local rink management. Track your registrations, spending,
              and never miss an opportunity.
            </p>
            <div className="mt-3 pt-3 border-t border-slate-200">
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
                <p className="text-sm font-bold text-slate-900">Install on iPhone</p>
                <p className="text-xs text-slate-500">Add to your home screen</p>
              </div>
            </div>
            <ol className="space-y-2 text-xs text-slate-600">
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

          {/* Reset & Troubleshooting */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Reset & Troubleshooting</p>
                <p className="text-xs text-slate-500">Fix display issues or start fresh</p>
              </div>
            </div>

            <div className="space-y-2">
              {/* Clear cache - soft */}
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && 'caches' in window) {
                    caches.keys().then((names) => {
                      for (const name of names) caches.delete(name);
                    });
                  }
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then((regs) => {
                      for (const reg of regs) reg.unregister();
                    });
                  }
                  window.location.reload();
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-slate-500" />
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-900">Clear Cache & Reload</p>
                    <p className="text-[10px] text-slate-400">Fixes stale UI. Keeps your data.</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>

              {/* Reset integrations */}
              <button
                onClick={() => {
                  if (confirm('Disconnect all integrations and clear imported registrations?')) {
                    setDaySmartConfig({
                      email: '', password: '', facilityId: '', facilityName: '',
                      connected: false, lastSync: null, familyMembers: [], customerIds: [],
                    });
                    setIceHockeyProConfig({
                      email: '', password: '', connected: false, lastSync: null,
                      playerName: '', linkedChildIds: [],
                    });
                    const synced = registrations.filter((r) => r.source === 'dash' || r.source === 'icehockeypro');
                    for (const reg of synced) removeRegistration(reg.id);
                    window.location.reload();
                  }
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plug size={14} className="text-orange-500" />
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-900">Reset All Integrations</p>
                    <p className="text-[10px] text-slate-400">Disconnects DaySmart & IceHockeyPro, clears imported data.</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>

              {/* Full factory reset */}
              <button
                onClick={() => {
                  if (confirm('This will erase ALL your data — favorites, registrations, children, settings, everything. Are you sure?')) {
                    if (confirm('Really? This cannot be undone.')) {
                      localStorage.removeItem('hockey-clinics-storage');
                      if (typeof window !== 'undefined' && 'caches' in window) {
                        caches.keys().then((names) => {
                          for (const name of names) caches.delete(name);
                        });
                      }
                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistrations().then((regs) => {
                          for (const reg of regs) reg.unregister();
                        });
                      }
                      window.location.reload();
                    }
                  }
                }}
                className="w-full flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trash2 size={14} className="text-red-500" />
                  <div className="text-left">
                    <p className="text-xs font-medium text-red-700">Factory Reset</p>
                    <p className="text-[10px] text-red-400">Erases everything. Start completely fresh.</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
