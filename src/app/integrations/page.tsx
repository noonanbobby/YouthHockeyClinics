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
  Mail,
  Trophy,
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
    iceHockeyProConfig,
    setIceHockeyProConfig,
    emailScanConfig,
    setEmailScanConfig,
    addRegistration,
    addNotification,
  } = useStore();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showDashPassword, setShowDashPassword] = useState(false);
  const [showLiveBarnPassword, setShowLiveBarnPassword] = useState(false);
  const [showIhpPassword, setShowIhpPassword] = useState(false);
  const [dashEmail, setDashEmail] = useState(daySmartConfig.email);
  const [dashPassword, setDashPassword] = useState(daySmartConfig.password);
  const [lbEmail, setLbEmail] = useState(liveBarnConfig.email);
  const [lbPassword, setLbPassword] = useState(liveBarnConfig.password);
  const [ihpEmail, setIhpEmail] = useState(iceHockeyProConfig.email);
  const [ihpPassword, setIhpPassword] = useState(iceHockeyProConfig.password);
  const [ihpPlayerName, setIhpPlayerName] = useState(iceHockeyProConfig.playerName);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [syncing, setSyncing] = useState(false);

  // --- Dash by DaySmart ---
  const handleDashConnect = async () => {
    if (!dashEmail || !dashPassword) {
      setConnectionStatus('Please enter your email and password');
      return;
    }
    setDaySmartSyncing(true);
    setConnectionStatus('Connecting to Dash by DaySmart...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setDaySmartConfig({
      email: dashEmail,
      password: dashPassword,
      facilityId: 'baptist-iceplex-fl',
      facilityName: 'Baptist Health IcePlex',
      connected: true,
      lastSync: new Date().toISOString(),
    });

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
    setDaySmartConfig({ email: '', password: '', facilityId: '', connected: false, lastSync: null });
    setDashEmail('');
    setDashPassword('');
    setConnectionStatus('Disconnected from Dash.');
  };

  // --- LiveBarn ---
  const handleLiveBarnConnect = async () => {
    if (!lbEmail || !lbPassword) {
      setConnectionStatus('Please enter your LiveBarn email and password');
      return;
    }
    setConnectionStatus('Connecting to LiveBarn...');
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
    setLiveBarnConfig({ email: '', password: '', connected: false, venues: [] });
    setLbEmail('');
    setLbPassword('');
    setConnectionStatus('Disconnected from LiveBarn.');
  };

  // --- IceHockeyPro ---
  const handleIhpConnect = async () => {
    if (!ihpEmail || !ihpPassword) {
      setConnectionStatus('Please enter your IceHockeyPro email and password');
      return;
    }
    setSyncing(true);
    setConnectionStatus('Connecting to IceHockeyPro...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIceHockeyProConfig({
      email: ihpEmail,
      password: ihpPassword,
      connected: true,
      lastSync: new Date().toISOString(),
      playerName: ihpPlayerName || 'My Player',
    });

    // Simulated data from IceHockeyPro — in production this calls their API
    const ihpActivities = [
      {
        clinicId: 'ihp-max-ivanov-spring',
        clinicName: 'Max Ivanov Spring Skills Camp',
        venue: 'Panthers IceDen',
        city: 'Coral Springs',
        startDate: '2026-03-22',
        endDate: '2026-03-26',
        price: 695,
        currency: 'USD',
        status: 'confirmed' as const,
        source: 'icehockeypro' as const,
        notes: 'Advanced skills, 9 AM - 1 PM daily',
        playerName: ihpPlayerName,
      },
      {
        clinicId: 'ihp-goalie-intensive',
        clinicName: 'Goaltending Intensive - IceHockeyPro',
        venue: 'Florida Panthers IceDen',
        city: 'Coral Springs',
        startDate: '2026-04-05',
        endDate: '2026-04-07',
        price: 450,
        currency: 'USD',
        status: 'pending' as const,
        source: 'icehockeypro' as const,
        notes: 'Goalie-specific training',
        playerName: ihpPlayerName,
      },
      {
        clinicId: 'ihp-summer-elite',
        clinicName: 'Elite Summer Hockey Program',
        venue: 'Baptist Health IcePlex',
        city: 'Fort Lauderdale',
        startDate: '2026-06-15',
        endDate: '2026-06-26',
        price: 1250,
        currency: 'USD',
        status: 'confirmed' as const,
        source: 'icehockeypro' as const,
        notes: '2-week elite program',
        playerName: ihpPlayerName,
      },
    ];

    for (const activity of ihpActivities) {
      addRegistration(activity);
    }

    addNotification({
      title: 'IceHockeyPro Connected',
      body: `Synced ${ihpActivities.length} camps/clinics from IceHockeyPro`,
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus('IceHockeyPro connected! Synced camps and spending data.');
    setSyncing(false);
  };

  const handleIhpSync = async () => {
    setSyncing(true);
    setConnectionStatus('Syncing with IceHockeyPro...');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIceHockeyProConfig({ lastSync: new Date().toISOString() });
    setConnectionStatus('IceHockeyPro sync complete!');
    setSyncing(false);
  };

  const handleIhpDisconnect = () => {
    setIceHockeyProConfig({ email: '', password: '', connected: false, lastSync: null, playerName: '' });
    setIhpEmail('');
    setIhpPassword('');
    setIhpPlayerName('');
    setConnectionStatus('Disconnected from IceHockeyPro.');
  };

  // --- Email Scanning ---
  const handleEmailConnect = async (provider: 'gmail' | 'outlook') => {
    setSyncing(true);
    setConnectionStatus(`Connecting to ${provider === 'gmail' ? 'Gmail' : 'Outlook'}...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setEmailScanConfig({
      provider,
      connected: true,
      lastScan: new Date().toISOString(),
      scanFrequency: 'daily',
    });

    addNotification({
      title: 'Email Scanning Enabled',
      body: `Connected to ${provider === 'gmail' ? 'Gmail' : 'Outlook'} for schedule change detection`,
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus(`Email scanning active! We'll scan for hockey-related schedule changes.`);
    setSyncing(false);
  };

  const handleEmailDisconnect = () => {
    setEmailScanConfig({ provider: 'none', connected: false, lastScan: null, scanFrequency: 'daily' });
    setConnectionStatus('Email scanning disconnected.');
  };

  // Shared credential form component
  const CredentialForm = ({
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    placeholder,
  }: {
    email: string;
    setEmail: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    showPassword: boolean;
    setShowPassword: (v: boolean) => void;
    placeholder: string;
  }) => (
    <>
      <div>
        <label className="text-xs font-medium text-white block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`Your ${placeholder} email`}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-white block mb-1">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Your ${placeholder} password`}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {showPassword ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}
          </button>
        </div>
      </div>
    </>
  );

  const IntegrationCard = ({
    id,
    icon: Icon,
    title,
    subtitle,
    connected,
    connectedText,
    color,
    children,
  }: {
    id: string;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    title: string;
    subtitle: string;
    connected: boolean;
    connectedText: string;
    color: string;
    children: React.ReactNode;
  }) => (
    <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', connected ? 'bg-emerald-500/10' : `bg-${color}-500/10`)}>
            <Icon size={20} className={connected ? 'text-emerald-400' : `text-${color}-400`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-slate-400">
              {connected ? (
                <span className="text-emerald-400 flex items-center gap-1"><Wifi size={10} /> {connectedText}</span>
              ) : (
                <span className="flex items-center gap-1"><WifiOff size={10} /> {subtitle}</span>
              )}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className={cn('text-slate-500 transition-transform', expandedSection === id && 'rotate-90')} />
      </button>
      <AnimatePresence>
        {expandedSection === id && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

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
          {/* IceHockeyPro */}
          <IntegrationCard
            id="icehockeypro"
            icon={Trophy}
            title="IceHockeyPro"
            subtitle="Not connected"
            connected={iceHockeyProConfig.connected}
            connectedText={`Connected — ${iceHockeyProConfig.playerName}`}
            color="blue"
          >
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Trophy size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300">
                  Connect your IceHockeyPro account to sync camps attended, upcoming registrations,
                  and spending. Camps from Max Ivanov, Elite Hockey, and other providers will automatically
                  appear in your calendar and spending tracker.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Credentials stored locally on your device. Used only to communicate directly with IceHockeyPro.
              </p>
            </div>

            {!iceHockeyProConfig.connected ? (
              <>
                <CredentialForm
                  email={ihpEmail}
                  setEmail={setIhpEmail}
                  password={ihpPassword}
                  setPassword={setIhpPassword}
                  showPassword={showIhpPassword}
                  setShowPassword={setShowIhpPassword}
                  placeholder="IceHockeyPro"
                />
                <div>
                  <label className="text-xs font-medium text-white block mb-1">Player Name</label>
                  <input
                    type="text"
                    value={ihpPlayerName}
                    onChange={(e) => setIhpPlayerName(e.target.value)}
                    placeholder="Your child's name (for matching)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
                <button
                  onClick={handleIhpConnect}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
                  {syncing ? 'Connecting...' : 'Connect to IceHockeyPro'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-300">Connected</p>
                  </div>
                  <p className="text-[10px] text-slate-400">Account: {iceHockeyProConfig.email}</p>
                  <p className="text-[10px] text-slate-400">Player: {iceHockeyProConfig.playerName}</p>
                  {iceHockeyProConfig.lastSync && (
                    <p className="text-[10px] text-slate-400">
                      Last sync: {new Date(iceHockeyProConfig.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleIhpSync}
                    disabled={syncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    Sync Now
                  </button>
                  <button
                    onClick={handleIhpDisconnect}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <button
                  onClick={() => router.push('/spending')}
                  className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-blue-400" />
                    <span className="text-xs text-white">View Spending Breakdown</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-500" />
                </button>
              </>
            )}
          </IntegrationCard>

          {/* Dash by DaySmart */}
          <IntegrationCard
            id="dash"
            icon={Calendar}
            title="Dash by DaySmart"
            subtitle="Not connected"
            connected={daySmartConfig.connected}
            connectedText={`Connected — ${daySmartConfig.facilityName}`}
            color="orange"
          >
            <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <div className="flex items-start gap-2">
                <Zap size={14} className="text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-300">
                  Connect your Dash by DaySmart account to automatically sync clinics,
                  camps, and registrations from Baptist Health IcePlex.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Credentials stored locally. Used only to communicate directly with DaySmart.
              </p>
            </div>
            {!daySmartConfig.connected ? (
              <>
                <CredentialForm
                  email={dashEmail}
                  setEmail={setDashEmail}
                  password={dashPassword}
                  setPassword={setDashPassword}
                  showPassword={showDashPassword}
                  setShowPassword={setShowDashPassword}
                  placeholder="Dash"
                />
                <button
                  onClick={handleDashConnect}
                  disabled={daySmartSyncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {daySmartSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
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
                  <p className="text-[10px] text-slate-400">Account: {daySmartConfig.email}</p>
                  <p className="text-[10px] text-slate-400">Facility: {daySmartConfig.facilityName}</p>
                  {daySmartConfig.lastSync && (
                    <p className="text-[10px] text-slate-400">Last sync: {new Date(daySmartConfig.lastSync).toLocaleString()}</p>
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
          </IntegrationCard>

          {/* LiveBarn */}
          <IntegrationCard
            id="livebarn"
            icon={Video}
            title="LiveBarn"
            subtitle="Not connected"
            connected={liveBarnConfig.connected}
            connectedText={`Connected — ${liveBarnConfig.venues.length} venues`}
            color="red"
          >
            <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
              <div className="flex items-start gap-2">
                <Video size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">
                  Connect your LiveBarn account to see live stream availability. Venues with
                  active streams show a live indicator on the map. Replay recordings for specific
                  dates/times at any connected venue.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Credentials stored locally. Used to check stream availability.
              </p>
            </div>
            {!liveBarnConfig.connected ? (
              <>
                <CredentialForm
                  email={lbEmail}
                  setEmail={setLbEmail}
                  password={lbPassword}
                  setPassword={setLbPassword}
                  showPassword={showLiveBarnPassword}
                  setShowPassword={setShowLiveBarnPassword}
                  placeholder="LiveBarn"
                />
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
                  <p className="text-[10px] text-slate-400 mb-2">Account: {liveBarnConfig.email}</p>
                  <div className="space-y-2 mt-3">
                    {liveBarnConfig.venues.map((venue) => (
                      <div key={venue.id} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
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
          </IntegrationCard>

          {/* Email Scanning */}
          <IntegrationCard
            id="email"
            icon={Mail}
            title="Email Scanner"
            subtitle="Detect schedule changes"
            connected={emailScanConfig.connected}
            connectedText={`Connected — ${emailScanConfig.provider === 'gmail' ? 'Gmail' : 'Outlook'} · ${emailScanConfig.scanFrequency}`}
            color="violet"
          >
            <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-violet-300">
                  Securely scan your inbox for hockey-related schedule changes, cancellations,
                  and announcements. Uses Gmail/Outlook API with read-only access and pattern
                  matching — no AI processing of email content, completely free.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Uses OAuth — we never see your password. Read-only access to messages matching
                hockey keywords only. Revoke access anytime from your Google/Microsoft account.
              </p>
            </div>

            {!emailScanConfig.connected ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleEmailConnect('gmail')}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10 disabled:opacity-50"
                >
                  <span className="text-base">📧</span>
                  {syncing ? 'Connecting...' : 'Connect Gmail'}
                </button>
                <button
                  onClick={() => handleEmailConnect('outlook')}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10 disabled:opacity-50"
                >
                  <span className="text-base">📨</span>
                  {syncing ? 'Connecting...' : 'Connect Outlook'}
                </button>

                <div className="p-3 bg-white/[0.02] rounded-xl">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase mb-2">What We Look For</h4>
                  <div className="space-y-1.5">
                    {[
                      'Schedule changes & time updates',
                      'Cancellations & rescheduling',
                      'Ice rink announcements',
                      'Registration confirmations',
                      'Game schedule notifications',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <Check size={10} className="text-violet-400" />
                        <p className="text-[10px] text-slate-400">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-300">Active</p>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Provider: {emailScanConfig.provider === 'gmail' ? 'Gmail' : 'Outlook'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Frequency: {emailScanConfig.scanFrequency}
                  </p>
                  {emailScanConfig.lastScan && (
                    <p className="text-[10px] text-slate-400">
                      Last scan: {new Date(emailScanConfig.lastScan).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Frequency selector */}
                <div>
                  <label className="text-xs font-medium text-white block mb-2">Scan Frequency</label>
                  <div className="flex gap-2">
                    {(['hourly', 'daily', 'manual'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setEmailScanConfig({ scanFrequency: freq })}
                        className={cn(
                          'flex-1 py-2 text-xs font-medium rounded-xl border transition-all capitalize',
                          emailScanConfig.scanFrequency === freq
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-200'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        )}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleEmailDisconnect}
                  className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl transition-colors"
                >
                  Disconnect
                </button>
              </>
            )}
          </IntegrationCard>

          {/* What gets synced */}
          <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/10 rounded-2xl border border-sky-500/20 p-4">
            <h3 className="text-sm font-bold text-white mb-3">What Gets Synced</h3>
            <div className="space-y-2">
              {[
                { icon: Trophy, text: 'Camps & clinics from IceHockeyPro', color: 'text-blue-400' },
                { icon: Calendar, text: 'Programs & registrations from DaySmart', color: 'text-orange-400' },
                { icon: Video, text: 'Live streams & recordings from LiveBarn', color: 'text-red-400' },
                { icon: Mail, text: 'Schedule changes detected in your email', color: 'text-violet-400' },
                { icon: Zap, text: 'Spending tracked across all sources', color: 'text-amber-400' },
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
