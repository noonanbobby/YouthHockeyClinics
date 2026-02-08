'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { requestNotificationPermission } from '@/hooks/useServiceWorker';
import {
  ArrowLeft,
  Key,
  Bell,
  MapPin,
  RefreshCw,
  Database,
  Zap,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  Info,
  Heart,
  CalendarCheck,
  DollarSign,
  Plug,
  Video,
  Calendar,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import TeamPicker from '@/components/TeamPicker';

export default function SettingsPage() {
  const router = useRouter();
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    locationEnabled,
    setLocationEnabled,
    setUserLocation,
    apiKeys,
    setApiKey,
    autoRefreshInterval,
    setAutoRefreshInterval,
    searchMeta,
    lastUpdated,
    clinics,
    registrations,
    daySmartConfig,
    liveBarnConfig,
  } = useStore();
  const { refresh } = useClinicSearch();
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  const handleLocationToggle = async () => {
    if (!locationEnabled) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationEnabled(true);
      } catch {
        alert('Location access denied. Please enable it in your device settings.');
      }
    } else {
      setLocationEnabled(false);
      setUserLocation(null);
    }
  };

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    } else {
      setNotificationsEnabled(false);
    }
  };

  const saveApiKey = (key: keyof typeof apiKeys, value: string) => {
    setApiKey(key, value);
    setSavedMessage(`${key} saved!`);
    setTimeout(() => setSavedMessage(''), 2000);
  };

  const apiKeyConfigs = [
    {
      key: 'serpApiKey' as const,
      label: 'SerpAPI Key',
      description: 'Enables Google search results scraping. Get a key at serpapi.com',
      placeholder: 'Enter your SerpAPI key',
    },
    {
      key: 'googleApiKey' as const,
      label: 'Google Custom Search API Key',
      description: 'Enables Google Custom Search. Get a key at console.cloud.google.com',
      placeholder: 'Enter your Google API key',
    },
    {
      key: 'googleCseId' as const,
      label: 'Google CSE ID',
      description: 'Your Custom Search Engine ID from programmablesearchengine.google.com',
      placeholder: 'Enter your CSE ID',
    },
    {
      key: 'bingApiKey' as const,
      label: 'Bing Search API Key',
      description: 'Enables Bing web search. Get a key at azure.microsoft.com',
      placeholder: 'Enter your Bing API key',
    },
    {
      key: 'eventbriteApiKey' as const,
      label: 'Eventbrite API Key',
      description: 'Enables searching Eventbrite for hockey events. Get a key at eventbrite.com/platform',
      placeholder: 'Enter your Eventbrite API key',
    },
  ];

  const configuredKeyCount = Object.values(apiKeys).filter((v) => v).length;
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
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <CalendarCheck size={18} className="text-sky-400" />
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

        {/* Team Color Theme */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 mb-6">
          <TeamPicker />
        </div>

        {/* Search Status */}
        <div className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 rounded-2xl p-4 border border-sky-500/20 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
              <Database size={20} className="text-sky-400" />
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
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-sm font-medium rounded-xl transition-colors"
          >
            <RefreshCw size={14} />
            Scan Now
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {/* Search API Keys */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'api' ? null : 'api')}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Key size={18} className="text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Search API Keys</p>
                  <p className="text-xs text-slate-400">
                    {configuredKeyCount} of {apiKeyConfigs.length} configured
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className={cn(
                  'text-slate-500 transition-transform',
                  expandedSection === 'api' && 'rotate-90'
                )}
              />
            </button>

            <AnimatePresence>
              {expandedSection === 'api' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <Zap size={14} className="text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-300">
                          Adding search API keys dramatically increases the number of clinics
                          discovered. Without keys, the engine scrapes known hockey organization
                          websites. With keys, it searches the entire internet.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowApiKeys(!showApiKeys)}
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {showApiKeys ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showApiKeys ? 'Hide keys' : 'Show keys'}
                    </button>

                    {apiKeyConfigs.map((config) => (
                      <div key={config.key}>
                        <label className="text-xs font-medium text-white block mb-1">
                          {config.label}
                          {apiKeys[config.key] && (
                            <Check size={12} className="inline text-emerald-400 ml-1" />
                          )}
                        </label>
                        <p className="text-[10px] text-slate-500 mb-1.5">{config.description}</p>
                        <div className="flex gap-2">
                          <input
                            type={showApiKeys ? 'text' : 'password'}
                            value={apiKeys[config.key]}
                            onChange={(e) => saveApiKey(config.key, e.target.value)}
                            placeholder={config.placeholder}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                          />
                        </div>
                      </div>
                    ))}

                    {savedMessage && (
                      <p className="text-xs text-emerald-400">{savedMessage}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
                    'flex-1 py-2 text-xs font-medium rounded-lg transition-colors',
                    autoRefreshInterval === minutes
                      ? 'theme-bg-primary-20 theme-primary theme-border-primary'
                      : 'bg-white/5 text-slate-400 border border-white/10'
                  )}
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
                  <p className="text-xs text-slate-400">Alerts for new clinics</p>
                </div>
              </div>
              <button
                onClick={handleNotificationToggle}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  notificationsEnabled ? 'theme-bg-primary' : 'bg-white/10'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                    notificationsEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <MapPin size={18} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Location Services</p>
                  <p className="text-xs text-slate-400">Sort by distance</p>
                </div>
              </div>
              <button
                onClick={handleLocationToggle}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  locationEnabled ? 'theme-bg-primary' : 'bg-white/10'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                    locationEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
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
          <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/10 rounded-2xl border border-sky-500/20 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-sm font-bold text-white">Install on iPhone</p>
                <p className="text-xs text-slate-400">Add to your home screen</p>
              </div>
            </div>
            <ol className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">1.</span>
                <span>
                  Tap the <strong>Share</strong> button (box with arrow) in Safari
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">2.</span>
                <span>
                  Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">3.</span>
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
