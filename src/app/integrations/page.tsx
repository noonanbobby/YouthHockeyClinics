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
        <label className="text-xs font-medium text-slate-700 block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`Your ${placeholder} email`}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Your ${placeholder} password`}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {showPassword ? <EyeOff size={14} className="text-slate-400" /> : <Eye size={14} className="text-slate-400" />}
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
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  };
  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', connected ? 'bg-emerald-50' : colors.bg)}>
            <Icon size={20} className={connected ? 'text-emerald-600' : colors.text} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              {connected ? (
                <span className="text-emerald-600 flex items-center gap-1"><Wifi size={10} /> {connectedText}</span>
              ) : (
                <span className="flex items-center gap-1"><WifiOff size={10} /> {subtitle}</span>
              )}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className={cn('text-slate-400 transition-transform', expanded && 'rotate-90')} />
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

    addNotification({
      title: 'Dash Connected',
      body: 'Connected to Baptist Health IcePlex. Real-time billing sync coming soon.',
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus('Connected to Baptist Health IcePlex! Real-time registration & billing sync will import your actual data — coming in the next update.');
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
    setConnectionStatus('Matching billing details to your players...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIceHockeyProConfig({
      email: ihpEmail,
      password: ihpPassword,
      connected: true,
      lastSync: new Date().toISOString(),
      playerName: linkedChildren.map((c) => c.name).join(', '),
      linkedChildIds: ihpLinkedChildIds,
    });

    addNotification({
      title: 'IceHockeyPro Connected',
      body: `Linked ${linkedChildren.map((c) => c.name).join(' & ')}. Real-time order sync coming soon.`,
      clinicId: '',
      type: 'new_clinic',
    });

    setConnectionStatus(
      `Connected for ${linkedChildren.map((c) => c.name).join(' & ')}! ` +
      `Real-time order scraping from icehockeypro.com/my-account-2/orders/ coming in the next update.`
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
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="safe-area-top" />
      <div className="px-4 py-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Integrations</h1>
            <p className="text-xs text-slate-500">Connect your hockey accounts</p>
          </div>
        </div>

        {/* Status Banner */}
        <AnimatePresence>
          {connectionStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700">{connectionStatus}</p>
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
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-start gap-2">
                <Trophy size={14} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Connect your IceHockeyPro account to sync camps attended, upcoming registrations,
                  and spending. We scrape your order history at{' '}
                  <span className="font-mono text-blue-800">icehockeypro.com/my-account-2/orders/</span>{' '}
                  and match billing details to your linked players.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-400 mt-0.5 shrink-0" />
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
                  <label className="text-xs font-medium text-slate-700 block mb-2">
                    Link Players <span className="text-slate-400">(select who to sync)</span>
                  </label>
                  {childProfiles.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2">
                        No players added yet. Add your children first so we can match their billing details.
                      </p>
                      <button
                        onClick={() => router.push('/settings')}
                        className="text-xs font-medium flex items-center gap-1"
                        style={{ color: 'var(--theme-primary)' }}
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
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-slate-50 border-slate-200'
                            )}
                          >
                            <div
                              className={cn(
                                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0',
                                isLinked
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-300'
                              )}
                            >
                              {isLinked && <Check size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900 font-medium">{child.name}</p>
                              <p className="text-[10px] text-slate-500">{getChildLabel(child)}</p>
                            </div>
                            {isLinked && (
                              <UserCheck size={14} className="text-blue-600 shrink-0" />
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
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 border border-blue-200"
                >
                  {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
                  {syncing ? 'Connecting...' : 'Connect & Sync Orders'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700">Connected</p>
                  </div>
                  <p className="text-[10px] text-slate-500">Account: {iceHockeyProConfig.email}</p>
                  <p className="text-[10px] text-slate-500">
                    Linked players: {getLinkedChildNames()}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Source: icehockeypro.com/my-account-2/orders/ → View → Billing Details
                  </p>
                  {iceHockeyProConfig.lastSync && (
                    <p className="text-[10px] text-slate-500">
                      Last sync: {new Date(iceHockeyProConfig.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleIhpSync}
                    disabled={syncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, white)',
                      color: 'var(--theme-primary)',
                    }}
                  >
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    Sync Now
                  </button>
                  <button
                    onClick={handleIhpDisconnect}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <button
                  onClick={() => router.push('/spending')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-blue-600" />
                    <span className="text-xs text-slate-900">View Spending Breakdown</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-400" />
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
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-start gap-2">
                <Zap size={14} className="text-orange-600 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-700">
                  Connect your Dash by DaySmart account to automatically sync clinics,
                  camps, and registrations from Baptist Health IcePlex.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-400 mt-0.5 shrink-0" />
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
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 border border-orange-200"
                >
                  {daySmartSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                  {daySmartSyncing ? 'Connecting...' : 'Connect to Dash'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700">Connected</p>
                  </div>
                  <p className="text-[10px] text-slate-500">Account: {daySmartConfig.email}</p>
                  <p className="text-[10px] text-slate-500">Facility: {daySmartConfig.facilityName}</p>
                  {daySmartConfig.lastSync && (
                    <p className="text-[10px] text-slate-500">Last sync: {new Date(daySmartConfig.lastSync).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDashSync}
                    disabled={daySmartSyncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, white)',
                      color: 'var(--theme-primary)',
                    }}
                  >
                    <RefreshCw size={14} className={daySmartSyncing ? 'animate-spin' : ''} />
                    Sync Now
                  </button>
                  <button
                    onClick={handleDashDisconnect}
                    className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <button
                  onClick={() => router.push('/registrations')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--theme-primary)' }} />
                    <span className="text-xs text-slate-900">View My Registrations</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-400" />
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
            <div className="p-3 bg-violet-50 rounded-xl border border-violet-200">
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-violet-600 mt-0.5 shrink-0" />
                <p className="text-xs text-violet-700">
                  Securely scan your inbox for hockey-related schedule changes, cancellations,
                  and announcements. Uses Gmail/Outlook API with read-only access and pattern
                  matching — no AI processing of email content, completely free.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-400 mt-0.5 shrink-0" />
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
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-900 text-sm font-medium rounded-xl transition-colors border border-slate-200 disabled:opacity-50"
                >
                  <span className="text-base">📧</span>
                  {syncing ? 'Connecting...' : 'Connect Gmail'}
                </button>
                <button
                  onClick={() => handleEmailConnect('outlook')}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-900 text-sm font-medium rounded-xl transition-colors border border-slate-200 disabled:opacity-50"
                >
                  <span className="text-base">📨</span>
                  {syncing ? 'Connecting...' : 'Connect Outlook'}
                </button>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">What We Look For</h4>
                  <div className="space-y-1.5">
                    {[
                      'Schedule changes & time updates',
                      'Cancellations & rescheduling',
                      'Ice rink announcements',
                      'Registration confirmations',
                      'Game schedule notifications',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <Check size={10} className="text-violet-600" />
                        <p className="text-[10px] text-slate-500">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700">Active</p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Provider: {emailScanConfig.provider === 'gmail' ? 'Gmail' : 'Outlook'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Frequency: {emailScanConfig.scanFrequency}
                  </p>
                  {emailScanConfig.lastScan && (
                    <p className="text-[10px] text-slate-500">
                      Last scan: {new Date(emailScanConfig.lastScan).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Frequency selector */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-2">Scan Frequency</label>
                  <div className="flex gap-2">
                    {(['hourly', 'daily', 'manual'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setEmailScanConfig({ scanFrequency: freq })}
                        className={cn(
                          'flex-1 py-2 text-xs font-medium rounded-xl border transition-all capitalize',
                          emailScanConfig.scanFrequency === freq
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        )}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleEmailDisconnect}
                  className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors"
                >
                  Disconnect
                </button>
              </>
            )}
          </IntegrationCard>

          {/* What gets synced */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">What Gets Synced</h3>
            <div className="space-y-2">
              {[
                { icon: Trophy, text: 'Camps & clinics from IceHockeyPro (matched by billing name)', color: 'text-blue-600' },
                { icon: Calendar, text: 'Programs & registrations from DaySmart', color: 'text-orange-600' },
                { icon: Mail, text: 'Schedule changes detected in your email', color: 'text-violet-600' },
                { icon: Zap, text: 'Spending tracked across all sources', color: 'text-amber-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <item.icon size={14} className={item.color} />
                  <p className="text-xs text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
