'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { getAgeGroupFromDOB, getChildAge } from '@/store/useStore';
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Calendar,
  ChevronRight,
  Zap,
  Shield,
  ExternalLink,
  Mail,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function CredentialForm({
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
}) {
  return (
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
}

function IntegrationCard({
  icon: Icon,
  title,
  subtitle,
  connected,
  connectedText,
  color,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  subtitle: string;
  connected: boolean;
  connectedText: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
      <button
        onClick={onToggle}
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
        <ChevronRight size={18} className={cn('text-slate-500 transition-transform', expanded && 'rotate-90')} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const {
    childProfiles,
    daySmartConfig,
    setDaySmartConfig,
    daySmartSyncing,
    setDaySmartSyncing,
    iceHockeyProConfig,
    setIceHockeyProConfig,
    emailScanConfig,
    setEmailScanConfig,
    addRegistration,
    removeRegistration,
    registrations,
    addNotification,
  } = useStore();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showDashPassword, setShowDashPassword] = useState(false);
  const [showIhpPassword, setShowIhpPassword] = useState(false);
  const [dashEmail, setDashEmail] = useState(daySmartConfig.email);
  const [dashPassword, setDashPassword] = useState(daySmartConfig.password);
  const [ihpEmail, setIhpEmail] = useState(iceHockeyProConfig.email);
  const [ihpPassword, setIhpPassword] = useState(iceHockeyProConfig.password);
  const [ihpLinkedChildIds, setIhpLinkedChildIds] = useState<string[]>(
    iceHockeyProConfig.linkedChildIds || []
  );
  const [connectionStatus, setConnectionStatus] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Get linked children names for display
  const getLinkedChildNames = () => {
    const ids = iceHockeyProConfig.linkedChildIds || [];
    const names = childProfiles
      .filter((c) => ids.includes(c.id))
      .map((c) => c.name);
    return names.length > 0 ? names.join(', ') : iceHockeyProConfig.playerName || 'Unknown';
  };

  // Helper for age group display
  const getChildLabel = (child: typeof childProfiles[0]) => {
    const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
    const age = getChildAge(child.dateOfBirth);
    const label = ag.charAt(0).toUpperCase() + ag.slice(1);
    return `${child.position === 'goalie' ? 'Goalie' : 'Player'} · ${label} · Age ${age}`;
  };

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

  // --- IceHockeyPro ---
  const handleIhpConnect = async () => {
    if (!ihpEmail || !ihpPassword) {
      setConnectionStatus('Please enter your IceHockeyPro email and password');
      return;
    }
    if (ihpLinkedChildIds.length === 0) {
      setConnectionStatus('Please select at least one player to link');
      return;
    }

    const linkedChildren = childProfiles.filter((c) => ihpLinkedChildIds.includes(c.id));
    setSyncing(true);

    // Step 1: Login
    setConnectionStatus('Logging in to IceHockeyPro...');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Step 2: Navigate to orders
    setConnectionStatus('Navigating to My Account → Orders...');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Step 2b: Clear old IHP registrations before adding fresh ones
    const oldIhpRegs = registrations.filter((r) => r.source === 'icehockeypro');
    for (const reg of oldIhpRegs) {
      removeRegistration(reg.id);
    }

    // Step 3: Scrape order list
    const totalOrders = linkedChildren.length * 2 + 3; // Simulate finding extra orders for other families
    setConnectionStatus(`Found ${totalOrders} orders. Clicking "View" on each to check billing details...`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Step 4: Match billing details to linked children
    // In production: scrape /my-account-2/orders/ → click "view" on each order →
    // read billing details → match child name → import only matching orders
    setConnectionStatus('Matching billing details to your players...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const matchedActivities: Array<{
      clinicId: string;
      clinicName: string;
      venue: string;
      city: string;
      startDate: string;
      endDate: string;
      price: number;
      currency: string;
      status: 'confirmed' | 'pending';
      source: 'icehockeypro';
      notes: string;
      playerName: string;
      childId: string;
    }> = [];

    linkedChildren.forEach((child, idx) => {
      // Each linked child has a Max Ivanov Spring Skills registration
      matchedActivities.push({
        clinicId: `ihp-max-ivanov-spring-${child.id}`,
        clinicName: 'Max Ivanov Spring Skills Camp',
        venue: 'Panthers IceDen',
        city: 'Coral Springs',
        startDate: '2026-03-22',
        endDate: '2026-03-26',
        price: 695,
        currency: 'USD',
        status: 'confirmed',
        source: 'icehockeypro',
        notes: `Order #IHP-2026-${142 + idx} · Billing: ${child.name} · Advanced skills, 9 AM - 1 PM daily`,
        playerName: child.name,
        childId: child.id,
      });

      // Each linked child has an Elite Summer registration
      matchedActivities.push({
        clinicId: `ihp-summer-elite-${child.id}`,
        clinicName: 'Elite Summer Hockey Program',
        venue: 'Baptist Health IcePlex',
        city: 'Fort Lauderdale',
        startDate: '2026-06-15',
        endDate: '2026-06-26',
        price: 1250,
        currency: 'USD',
        status: 'confirmed',
        source: 'icehockeypro',
        notes: `Order #IHP-2026-${156 + idx} · Billing: ${child.name} · 2-week elite program`,
        playerName: child.name,
        childId: child.id,
      });
    });

    // Skipped orders (other families' registrations on the account)
    const skippedOrders = totalOrders - matchedActivities.length;

    setIceHockeyProConfig({
      email: ihpEmail,
      password: ihpPassword,
      connected: true,
      lastSync: new Date().toISOString(),
      playerName: linkedChildren.map((c) => c.name).join(', '),
      linkedChildIds: ihpLinkedChildIds,
    });

    for (const activity of matchedActivities) {
      addRegistration(activity);
    }

    addNotification({
      title: 'IceHockeyPro Connected',
      body: `Synced ${matchedActivities.length} registrations for ${linkedChildren.map((c) => c.name).join(' & ')}`,
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus(
      `Synced ${matchedActivities.length} registrations for ${linkedChildren.map((c) => c.name).join(' & ')}. ` +
      `Skipped ${skippedOrders} order(s) not matching your players.`
    );
    setSyncing(false);
  };

  const handleIhpSync = async () => {
    setSyncing(true);
    setConnectionStatus('Syncing with IceHockeyPro...');
    await new Promise((resolve) => setTimeout(resolve, 800));
    setConnectionStatus('Checking /my-account-2/orders/ for new orders...');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIceHockeyProConfig({ lastSync: new Date().toISOString() });
    setConnectionStatus('IceHockeyPro sync complete! No new orders found.');
    setSyncing(false);
  };

  const handleIhpDisconnect = () => {
    // Remove all IHP-sourced registrations
    const ihpRegs = registrations.filter((r) => r.source === 'icehockeypro');
    for (const reg of ihpRegs) {
      removeRegistration(reg.id);
    }
    setIceHockeyProConfig({
      email: '',
      password: '',
      connected: false,
      lastSync: null,
      playerName: '',
      linkedChildIds: [],
    });
    setIhpEmail('');
    setIhpPassword('');
    setIhpLinkedChildIds([]);
    setConnectionStatus('Disconnected from IceHockeyPro. Registrations cleared.');
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
            connectedText={`Connected — ${getLinkedChildNames()}`}
            color="blue"
            expanded={expandedSection === 'icehockeypro'}
            onToggle={() => setExpandedSection(expandedSection === 'icehockeypro' ? null : 'icehockeypro')}
          >
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Trophy size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300">
                  Connect your IceHockeyPro account to sync camps attended, upcoming registrations,
                  and spending. We scrape your order history at{' '}
                  <span className="font-mono text-blue-200">icehockeypro.com/my-account-2/orders/</span>{' '}
                  and match billing details to your linked players.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Credentials stored locally on your device. We only access your order history to match registrations by billing name.
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

                {/* Multi-child selector */}
                <div>
                  <label className="text-xs font-medium text-white block mb-2">
                    Link Players <span className="text-slate-500">(select who to sync)</span>
                  </label>
                  {childProfiles.length === 0 ? (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-xs text-slate-400 mb-2">
                        No players added yet. Add your children first so we can match their billing details.
                      </p>
                      <button
                        onClick={() => router.push('/settings')}
                        className="text-xs font-medium text-sky-400 flex items-center gap-1"
                      >
                        Add players in Settings <ChevronRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {childProfiles.map((child) => {
                        const isLinked = ihpLinkedChildIds.includes(child.id);
                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              setIhpLinkedChildIds((prev) =>
                                isLinked
                                  ? prev.filter((id) => id !== child.id)
                                  : [...prev, child.id]
                              );
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                              isLinked
                                ? 'bg-blue-500/10 border-blue-500/30'
                                : 'bg-white/5 border-white/10'
                            )}
                          >
                            <div
                              className={cn(
                                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0',
                                isLinked
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-600'
                              )}
                            >
                              {isLinked && <Check size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium">{child.name}</p>
                              <p className="text-[10px] text-slate-400">{getChildLabel(child)}</p>
                            </div>
                            {isLinked && (
                              <UserCheck size={14} className="text-blue-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleIhpConnect}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
                  {syncing ? 'Connecting...' : 'Connect & Sync Orders'}
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
                  <p className="text-[10px] text-slate-400">
                    Linked players: {getLinkedChildNames()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Source: icehockeypro.com/my-account-2/orders/ → View → Billing Details
                  </p>
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
            expanded={expandedSection === 'dash'}
            onToggle={() => setExpandedSection(expandedSection === 'dash' ? null : 'dash')}
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

          {/* Email Scanning */}
          <IntegrationCard
            id="email"
            icon={Mail}
            title="Email Scanner"
            subtitle="Detect schedule changes"
            connected={emailScanConfig.connected}
            connectedText={`Connected — ${emailScanConfig.provider === 'gmail' ? 'Gmail' : 'Outlook'} · ${emailScanConfig.scanFrequency}`}
            color="violet"
            expanded={expandedSection === 'email'}
            onToggle={() => setExpandedSection(expandedSection === 'email' ? null : 'email')}
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
                { icon: Trophy, text: 'Camps & clinics from IceHockeyPro (matched by billing name)', color: 'text-blue-400' },
                { icon: Calendar, text: 'Programs & registrations from DaySmart', color: 'text-orange-400' },
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
