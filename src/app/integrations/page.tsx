'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Video,
  Calendar,
  ChevronRight,
  Zap,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function IntegrationsPage() {
  const router = useRouter();
  const {
    daySmartConfig,
    setDaySmartConfig,
    daySmartSyncing,
    setDaySmartSyncing,
    liveBarnConfig,
    setLiveBarnConfig,
    addRegistration,
    addNotification,
  } = useStore();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showDashPassword, setShowDashPassword] = useState(false);
  const [showLiveBarnPassword, setShowLiveBarnPassword] = useState(false);
  const [dashEmail, setDashEmail] = useState(daySmartConfig.email);
  const [dashPassword, setDashPassword] = useState(daySmartConfig.password);
  const [lbEmail, setLbEmail] = useState(liveBarnConfig.email);
  const [lbPassword, setLbPassword] = useState(liveBarnConfig.password);
  const [connectionStatus, setConnectionStatus] = useState('');

  const handleDashConnect = async () => {
    if (!dashEmail || !dashPassword) {
      setConnectionStatus('Please enter your email and password');
      return;
    }

    setDaySmartSyncing(true);
    setConnectionStatus('Connecting to Dash by DaySmart...');

    // Simulate connection — in production this would hit the DaySmart API
    // DaySmart uses a REST API at https://app.daysmart.com/api/
    // The flow would be:
    // 1. POST /auth/login with email/password to get session token
    // 2. GET /facilities to find Baptist Health IcePlex
    // 3. GET /activities?facilityId=XXX to list clinics/camps
    // 4. GET /registrations?facilityId=XXX to get registered activities
    // 5. GET /calendar?facilityId=XXX for calendar data

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setDaySmartConfig({
      email: dashEmail,
      password: dashPassword,
      facilityId: 'baptist-iceplex-fl',
      facilityName: 'Baptist Health IcePlex',
      connected: true,
      lastSync: new Date().toISOString(),
    });

    // Add sample IcePlex activities that would come from the API
    const icePlexClinics = [
      {
        clinicId: 'dash-skating-101',
        clinicName: 'Learn to Skate - Session 3',
        venue: 'Baptist Health IcePlex',
        city: 'Fort Lauderdale',
        startDate: '2026-03-01',
        endDate: '2026-04-05',
        price: 189,
        currency: 'USD',
        status: 'confirmed' as const,
        source: 'dash' as const,
        notes: 'Sundays 10:00 AM',
        playerName: '',
      },
      {
        clinicId: 'dash-power-skating',
        clinicName: 'Power Skating Clinic',
        venue: 'Baptist Health IcePlex',
        city: 'Fort Lauderdale',
        startDate: '2026-02-15',
        endDate: '2026-02-15',
        price: 45,
        currency: 'USD',
        status: 'confirmed' as const,
        source: 'dash' as const,
        notes: 'Saturday 2:00 PM - 3:30 PM',
        playerName: '',
      },
      {
        clinicId: 'dash-spring-camp',
        clinicName: 'Spring Break Hockey Camp',
        venue: 'Baptist Health IcePlex',
        city: 'Fort Lauderdale',
        startDate: '2026-03-16',
        endDate: '2026-03-20',
        price: 425,
        currency: 'USD',
        status: 'pending' as const,
        source: 'dash' as const,
        notes: 'Full day camp 9 AM - 3 PM',
        playerName: '',
      },
    ];

    for (const clinic of icePlexClinics) {
      addRegistration(clinic);
    }

    addNotification({
      title: 'Dash Connected',
      body: `Synced ${icePlexClinics.length} activities from Baptist Health IcePlex`,
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus('Connected! Synced activities from Baptist Health IcePlex.');
    setDaySmartSyncing(false);
  };

  const handleDashSync = async () => {
    setDaySmartSyncing(true);
    setConnectionStatus('Syncing with Dash...');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setDaySmartConfig({ lastSync: new Date().toISOString() });
    setConnectionStatus('Sync complete!');
    setDaySmartSyncing(false);
  };

  const handleDashDisconnect = () => {
    setDaySmartConfig({
      email: '',
      password: '',
      facilityId: '',
      connected: false,
      lastSync: null,
    });
    setDashEmail('');
    setDashPassword('');
    setConnectionStatus('Disconnected from Dash.');
  };

  const handleLiveBarnConnect = async () => {
    if (!lbEmail || !lbPassword) {
      setConnectionStatus('Please enter your LiveBarn email and password');
      return;
    }

    setConnectionStatus('Connecting to LiveBarn...');

    // In production, this would authenticate with LiveBarn's API
    // LiveBarn provides streaming URLs for specific venues/surfaces
    // The flow:
    // 1. POST /api/auth with credentials
    // 2. GET /api/venues to list available venues
    // 3. GET /api/venues/:id/streams for active streams
    // 4. Match venue names/locations to clinics in our database

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setLiveBarnConfig({
      email: lbEmail,
      password: lbPassword,
      connected: true,
      venues: [
        {
          id: 'lb-baptist-iceplex-1',
          name: 'Baptist Health IcePlex',
          surfaceName: 'Rink 1 - Panthers',
          isLive: true,
          streamUrl: 'https://livebarn.com/en/venue/baptist-health-iceplex/1',
        },
        {
          id: 'lb-baptist-iceplex-2',
          name: 'Baptist Health IcePlex',
          surfaceName: 'Rink 2 - Community',
          isLive: false,
          streamUrl: 'https://livebarn.com/en/venue/baptist-health-iceplex/2',
        },
      ],
    });

    addNotification({
      title: 'LiveBarn Connected',
      body: 'Live stream access enabled for Baptist Health IcePlex',
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus('LiveBarn connected! Live streams available.');
  };

  const handleLiveBarnDisconnect = () => {
    setLiveBarnConfig({
      email: '',
      password: '',
      connected: false,
      venues: [],
    });
    setLbEmail('');
    setLbPassword('');
    setConnectionStatus('Disconnected from LiveBarn.');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="safe-area-top" />
      <div className="px-4 py-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5"
          >
            <ArrowLeft size={18} className="text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Integrations</h1>
            <p className="text-xs text-slate-400">Connect your hockey accounts</p>
          </div>
        </div>

        {/* Status Banner */}
        <AnimatePresence>
          {connectionStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-sky-400 shrink-0" />
                <p className="text-xs text-sky-300">{connectionStatus}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {/* Dash by DaySmart */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'dash' ? null : 'dash')}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  daySmartConfig.connected ? 'bg-emerald-500/10' : 'bg-orange-500/10'
                )}>
                  <Calendar size={20} className={daySmartConfig.connected ? 'text-emerald-400' : 'text-orange-400'} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Dash by DaySmart</p>
                  <p className="text-xs text-slate-400">
                    {daySmartConfig.connected ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wifi size={10} /> Connected — {daySmartConfig.facilityName}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <WifiOff size={10} /> Not connected
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className={cn(
                  'text-slate-500 transition-transform',
                  expandedSection === 'dash' && 'rotate-90'
                )}
              />
            </button>

            <AnimatePresence>
              {expandedSection === 'dash' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {/* Info banner */}
                    <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <div className="flex items-start gap-2">
                        <Zap size={14} className="text-orange-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-orange-300">
                          Connect your Dash by DaySmart account to automatically sync clinics,
                          camps, and registrations from Baptist Health IcePlex. Your registered
                          activities and calendar will appear in the app.
                        </p>
                      </div>
                    </div>

                    {/* Security note */}
                    <div className="flex items-start gap-2">
                      <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-slate-500">
                        Your credentials are stored locally on your device and never sent to our servers.
                        They&apos;re used only to communicate directly with DaySmart.
                      </p>
                    </div>

                    {!daySmartConfig.connected ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-white block mb-1">Email</label>
                          <input
                            type="email"
                            value={dashEmail}
                            onChange={(e) => setDashEmail(e.target.value)}
                            placeholder="Your Dash login email"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-white block mb-1">Password</label>
                          <div className="relative">
                            <input
                              type={showDashPassword ? 'text' : 'password'}
                              value={dashPassword}
                              onChange={(e) => setDashPassword(e.target.value)}
                              placeholder="Your Dash password"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                            />
                            <button
                              onClick={() => setShowDashPassword(!showDashPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                              {showDashPassword ? (
                                <EyeOff size={14} className="text-slate-500" />
                              ) : (
                                <Eye size={14} className="text-slate-500" />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleDashConnect}
                          disabled={daySmartSyncing}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                        >
                          {daySmartSyncing ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Wifi size={14} />
                          )}
                          {daySmartSyncing ? 'Connecting...' : 'Connect to Dash'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Check size={14} className="text-emerald-400" />
                            <p className="text-xs font-semibold text-emerald-300">Connected</p>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Account: {daySmartConfig.email}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Facility: {daySmartConfig.facilityName}
                          </p>
                          {daySmartConfig.lastSync && (
                            <p className="text-[10px] text-slate-400">
                              Last sync: {new Date(daySmartConfig.lastSync).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleDashSync}
                            disabled={daySmartSyncing}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={14} className={daySmartSyncing ? 'animate-spin' : ''} />
                            Sync Now
                          </button>
                          <button
                            onClick={handleDashDisconnect}
                            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>

                        <button
                          onClick={() => router.push('/registrations')}
                          className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-sky-400" />
                            <span className="text-xs text-white">View My Registrations</span>
                          </div>
                          <ExternalLink size={14} className="text-slate-500" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* LiveBarn */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'livebarn' ? null : 'livebarn')}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  liveBarnConfig.connected ? 'bg-emerald-500/10' : 'bg-red-500/10'
                )}>
                  <Video size={20} className={liveBarnConfig.connected ? 'text-emerald-400' : 'text-red-400'} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">LiveBarn</p>
                  <p className="text-xs text-slate-400">
                    {liveBarnConfig.connected ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wifi size={10} /> Connected — {liveBarnConfig.venues.length} venues
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <WifiOff size={10} /> Not connected
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className={cn(
                  'text-slate-500 transition-transform',
                  expandedSection === 'livebarn' && 'rotate-90'
                )}
              />
            </button>

            <AnimatePresence>
              {expandedSection === 'livebarn' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                      <div className="flex items-start gap-2">
                        <Video size={14} className="text-red-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-300">
                          Connect your LiveBarn account to see live stream availability
                          for rinks. Venues with active streams will show a live indicator
                          icon in the clinic listings and map view.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-slate-500">
                        Credentials stored locally only. Used to check stream availability.
                      </p>
                    </div>

                    {!liveBarnConfig.connected ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-white block mb-1">Email</label>
                          <input
                            type="email"
                            value={lbEmail}
                            onChange={(e) => setLbEmail(e.target.value)}
                            placeholder="Your LiveBarn email"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-white block mb-1">Password</label>
                          <div className="relative">
                            <input
                              type={showLiveBarnPassword ? 'text' : 'password'}
                              value={lbPassword}
                              onChange={(e) => setLbPassword(e.target.value)}
                              placeholder="Your LiveBarn password"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                            />
                            <button
                              onClick={() => setShowLiveBarnPassword(!showLiveBarnPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                              {showLiveBarnPassword ? (
                                <EyeOff size={14} className="text-slate-500" />
                              ) : (
                                <Eye size={14} className="text-slate-500" />
                              )}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleLiveBarnConnect}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium rounded-xl transition-colors"
                        >
                          <Video size={14} />
                          Connect to LiveBarn
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Check size={14} className="text-emerald-400" />
                            <p className="text-xs font-semibold text-emerald-300">Connected</p>
                          </div>
                          <p className="text-[10px] text-slate-400 mb-2">
                            Account: {liveBarnConfig.email}
                          </p>

                          {/* Venue list */}
                          <div className="space-y-2 mt-3">
                            {liveBarnConfig.venues.map((venue) => (
                              <div
                                key={venue.id}
                                className="flex items-center justify-between p-2 bg-black/20 rounded-lg"
                              >
                                <div>
                                  <p className="text-xs text-white font-medium">{venue.surfaceName}</p>
                                  <p className="text-[10px] text-slate-500">{venue.name}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {venue.isLive ? (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                      <span className="text-[10px] text-red-400 font-medium">LIVE</span>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-slate-600">Offline</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleLiveBarnDisconnect}
                          className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* What gets synced */}
          <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/10 rounded-2xl border border-sky-500/20 p-4">
            <h3 className="text-sm font-bold text-white mb-3">What Gets Synced</h3>
            <div className="space-y-2">
              {[
                { icon: Calendar, text: 'Clinics, camps & programs from your rink', color: 'text-sky-400' },
                { icon: Check, text: 'Your registered activities & schedule', color: 'text-emerald-400' },
                { icon: Video, text: 'Live stream availability at venues', color: 'text-red-400' },
                { icon: Zap, text: 'New clinic alerts from connected facilities', color: 'text-amber-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <item.icon size={14} className={item.color} />
                  <p className="text-xs text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
