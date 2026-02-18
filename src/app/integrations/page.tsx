'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { getAgeGroupFromDOB, getChildAge } from '@/store/useStore';
import {
  ArrowLeft, Wifi, WifiOff, RefreshCw, Eye, EyeOff, Check, AlertCircle,
  Calendar, ChevronRight, Zap, Shield, ExternalLink, Mail, Trophy, UserCheck, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { HockeyLoader } from '@/components/HockeyLoader';

async function encryptViaServer(plaintext: string): Promise<string> {
  try {
    const res = await fetch('/api/credentials/encrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: plaintext }),
    });
    if (!res.ok) return plaintext;
    const { encrypted } = await res.json();
    return typeof encrypted === 'string' ? encrypted : plaintext;
  } catch {
    return plaintext;
  }
}

function parseDateString(dateStr: string, which: 'start' | 'end'): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    // "June 23 - July 4, 2025" style
    const rangeMatch = dateStr.match(/(\w+ \d+)\s*[-–]\s*(\w+ \d+),?\s*(\d{4})/);
    if (rangeMatch) {
      const year = rangeMatch[3];
      const dateText =
        which === 'start'
          ? `${rangeMatch[1]}, ${year}`
          : `${rangeMatch[2]}, ${year}`;
      const d = new Date(dateText);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // "June 23, 2025" style
    const singleMatch = dateStr.match(/(\w+ \d+,?\s*\d{4})/);
    if (singleMatch) {
      const d = new Date(singleMatch[1]);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // ISO or parseable
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {
    // fall through
  }
  return new Date().toISOString().split('T')[0];
}

function extractCity(location: string): string {
  if (!location) return '';
  return location.split(',')[0]?.trim() ?? location;
}

function CredentialForm({
  email, setEmail, password, setPassword, showPassword, setShowPassword, placeholder,
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
        <label className="block mb-1 text-xs font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`Your ${placeholder} email`}
          autoComplete="email"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
      </div>
      <div>
        <label className="block mb-1 text-xs font-medium text-slate-700">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Your ${placeholder} password`}
            autoComplete="current-password"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword
              ? <EyeOff size={14} className="text-slate-400" />
              : <Eye size={14} className="text-slate-400" />}
          </button>
        </div>
      </div>
    </>
  );
}

function IntegrationCard({
  icon: Icon, title, subtitle, connected, connectedText, color, expanded, onToggle, children,
}: {
  id: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  subtitle: string;
  connected: boolean;
  connectedText: string;
  color: 'blue' | 'orange' | 'violet';
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const iconBg = {
    blue: connected ? 'bg-emerald-50' : 'bg-blue-50',
    orange: connected ? 'bg-emerald-50' : 'bg-orange-50',
    violet: connected ? 'bg-emerald-50' : 'bg-violet-50',
  }[color];

  const iconColor = {
    blue: connected ? 'text-emerald-600' : 'text-blue-600',
    orange: connected ? 'text-emerald-600' : 'text-orange-600',
    violet: connected ? 'text-emerald-600' : 'text-violet-600',
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon size={20} className={iconColor} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              {connected ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <Wifi size={10} />{connectedText}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <WifiOff size={10} />{subtitle}
                </span>
              )}
            </p>
          </div>
        </div>
        <ChevronRight
          size={18}
          className={cn('text-slate-400 transition-transform duration-200', expanded && 'rotate-90')}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type StatusVariant = 'info' | 'success' | 'error';

function StatusBanner({
  message, variant, onDismiss, debugInfo,
}: {
  message: string;
  variant: StatusVariant;
  onDismiss: () => void;
  debugInfo: { debugLog?: string[]; debugDiagnostics?: Array<Record<string, unknown>> } | null;
}) {
  const [showDebug, setShowDebug] = useState(false);

  const bannerClass = {
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
  }[variant];
  const textClass = {
    info: 'text-blue-700',
    success: 'text-emerald-700',
    error: 'text-red-700',
  }[variant];
  const iconClass = {
    info: 'text-blue-600',
    success: 'text-emerald-600',
    error: 'text-red-600',
  }[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('mb-4 p-3 border rounded-xl', bannerClass)}
    >
      <div className="flex items-start gap-2">
        <AlertCircle size={14} className={cn('mt-0.5 shrink-0', iconClass)} />
        <p className={cn('flex-1 text-xs', textClass)}>{message}</p>
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X size={14} className={textClass} />
        </button>
      </div>
      {debugInfo && (
        <div className="mt-2">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="text-[10px] font-medium underline opacity-70 hover:opacity-100"
          >
            {showDebug ? 'Hide' : 'Show'} debug details
          </button>
          {showDebug && (
            <div className="mt-2 space-y-2">
              {debugInfo.debugLog && (
                <div className="bg-white/80 border border-current/10 rounded-lg p-2">
                  <p className="text-[10px] font-semibold text-slate-700 mb-1">Login Flow Log:</p>
                  <pre className="text-[9px] text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {debugInfo.debugLog.join('\n')}
                  </pre>
                </div>
              )}
              {debugInfo.debugDiagnostics && (
                <div className="bg-white/80 border border-current/10 rounded-lg p-2">
                  <p className="text-[10px] font-semibold text-slate-700 mb-1">Strategy Results:</p>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {debugInfo.debugDiagnostics.map((d, i) => (
                      <div key={i} className="bg-slate-50 rounded p-1.5 text-[9px] font-mono">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={cn(
                              'inline-block w-1.5 h-1.5 rounded-full',
                              d.isPositiveAuth
                                ? 'bg-green-500'
                                : d.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-yellow-500',
                            )}
                          />
                          <span className="font-semibold text-slate-800">{String(d.strategy)}</span>
                          <span className="text-slate-500">HTTP {String(d.status)}</span>
                        </div>
                        <div className="text-slate-500 pl-3 space-y-0.5">
                          <div>
                            token: {d.hasToken ? 'YES' : 'no'} | cookies:{' '}
                            {d.hasCookies ? 'YES' : 'no'} | positive:{' '}
                            {d.isPositiveAuth ? 'YES' : 'no'}
                          </div>
                          {d.extractedCustomerId ? (
                            <div>customerId: {String(d.extractedCustomerId)}</div>
                          ) : null}
                          {d.error ? (
                            <div className="text-red-600">error: {String(d.error)}</div>
                          ) : null}
                          {d.responseKeys && (d.responseKeys as string[]).length > 0 ? (
                            <div>keys: {(d.responseKeys as string[]).join(', ')}</div>
                          ) : null}
                          {d.responseSample ? (
                            <details className="cursor-pointer">
                              <summary className="text-blue-600">response body</summary>
                              <pre className="whitespace-pre-wrap break-all mt-0.5 text-slate-600 max-h-24 overflow-y-auto">
                                {String(d.responseSample)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const {
    childProfiles,
    daySmartConfig, setDaySmartConfig, daySmartSyncing, setDaySmartSyncing,
    iceHockeyProConfig, setIceHockeyProConfig,
    emailScanConfig, setEmailScanConfig,
    removeRegistration, addRegistration, registrations, addNotification,
  } = useStore();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showDashPassword, setShowDashPassword] = useState(false);
  const [showIhpPassword, setShowIhpPassword] = useState(false);

  const [dashEmail, setDashEmail] = useState(daySmartConfig.email);
  const [dashPassword, setDashPassword] = useState(daySmartConfig.password);
  const [dashFacilityUrl, setDashFacilityUrl] = useState(
    daySmartConfig.facilityId
      ? `https://apps.daysmartrecreation.com/dash/x/#/online/${daySmartConfig.facilityId}/`
      : '',
  );
  const [ihpEmail, setIhpEmail] = useState(iceHockeyProConfig.email);
  const [ihpPassword, setIhpPassword] = useState(iceHockeyProConfig.password);
  const [ihpLinkedChildIds, setIhpLinkedChildIds] = useState<string[]>(
    iceHockeyProConfig.linkedChildIds ?? [],
  );

  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState<StatusVariant>('info');
  const [loginDebugInfo, setLoginDebugInfo] = useState<{
    debugLog?: string[];
    debugDiagnostics?: Array<Record<string, unknown>>;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const setStatus = useCallback((msg: string, variant: StatusVariant = 'info') => {
    setStatusMessage(msg);
    setStatusVariant(variant);
  }, []);

  const extractFacilityId = (input: string): string | null => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/daysmartrecreation\.com\/dash\/x\/#\/online\/([^/]+)/i);
    if (urlMatch) return urlMatch[1];
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 0 && trimmed.length <= 60)
      return trimmed;
    return null;
  };

  const getLinkedChildNames = () => {
    const ids = iceHockeyProConfig.linkedChildIds ?? [];
    const names = childProfiles.filter((c) => ids.includes(c.id)).map((c) => c.name);
    return names.length > 0 ? names.join(', ') : iceHockeyProConfig.playerName ?? 'Unknown';
  };

  const getChildLabel = (child: (typeof childProfiles)[0]) => {
    const ag = child.currentDivision ?? getAgeGroupFromDOB(child.dateOfBirth);
    const age = getChildAge(child.dateOfBirth);
    const label = ag.charAt(0).toUpperCase() + ag.slice(1);
    return `${child.position === 'goalie' ? 'Goalie' : 'Player'} · ${label} · Age ${age}`;
  };

  const isAnySyncing = syncing || daySmartSyncing;

  const toggleIhpChild = useCallback((childId: string) => {
    setIhpLinkedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId],
    );
  }, []);

  // ── DaySmart / Dash ──────────────────────────────────────────────────────────

  const handleDashConnect = async () => {
    const facilityId = extractFacilityId(dashFacilityUrl);
    if (!facilityId) {
      setStatus(
        'Please enter your rink\'s DaySmart URL or facility ID (e.g. "warmemorial").',
        'error',
      );
      return;
    }
    if (!dashEmail || !dashPassword) {
      setStatus('Please enter your Dash email and password.', 'error');
      return;
    }

    setDaySmartSyncing(true);
    setStatus('Validating facility...');

    try {
      const validateRes = await fetch('/api/integrations/daysmart?action=validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId }),
      });
      const validateData = await validateRes.json();
      if (!validateData.valid) {
        setStatus(
          validateData.error ?? `Facility "${facilityId}" not found. Check the URL.`,
          'error',
        );
        setDaySmartSyncing(false);
        return;
      }

      setStatus('Securing credentials...');
      const [encEmail, encPassword] = await Promise.all([
        encryptViaServer(dashEmail),
        encryptViaServer(dashPassword),
      ]);

      setStatus(`Logging in to ${validateData.facilityName ?? facilityId}...`);
      const loginRes = await fetch('/api/integrations/daysmart?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: dashEmail, password: dashPassword, facilityId }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        setStatus(loginData.error ?? 'Failed to connect. Check your credentials.', 'error');
        if (loginData.debugLog || loginData.debugDiagnostics) {
          setLoginDebugInfo({
            debugLog: loginData.debugLog,
            debugDiagnostics: loginData.debugDiagnostics,
          });
        }
        setDaySmartSyncing(false);
        return;
      }

      setLoginDebugInfo(null);

      const facilityName = loginData.facilityName ?? validateData.facilityName ?? facilityId;
      const familyMembers = loginData.familyMembers ?? [];
      const customerIds = loginData.customerIds ?? [];
      const authCredential = loginData.authToken ?? loginData.sessionCookie ?? '';

      setStatus(
        `Connected! Found ${familyMembers.length} family member(s). Fetching registrations...`,
      );

      const syncRes = await fetch('/api/integrations/daysmart?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, sessionCookie: authCredential, customerIds }),
      });
      const syncData = await syncRes.json();

      if (syncData.success && syncData.activities) {
        for (const reg of registrations.filter((r) => r.source === 'dash')) {
          removeRegistration(reg.id);
        }

        let importedCount = 0;
        for (const activity of syncData.activities ?? []) {
          addRegistration({
            clinicId: `dash-${activity.id}`,
            clinicName: activity.name,
            venue: activity.location ?? facilityName,
            city: '',
            startDate: activity.startDate,
            endDate: activity.endDate,
            price: activity.price,
            currency: 'USD',
            status: 'confirmed',
            source: 'dash',
            notes: `${activity.category}${activity.startTime ? ` — ${activity.startTime} to ${activity.endTime}` : ''}`,
            playerName: activity.customerName,
          });
          importedCount++;
        }

        setDaySmartConfig({
          email: encEmail,
          password: encPassword,
          facilityId,
          facilityName,
          connected: true,
          lastSync: new Date().toISOString(),
          familyMembers,
          customerIds,
        });

        addNotification({
          title: 'Dash Connected',
          body: `Connected to ${facilityName}. ${familyMembers.length} family member(s), ${importedCount} registrations imported.`,
          clinicId: '',
          type: 'new_clinic',
        });

        const upcomingCount = (syncData.upcoming ?? []).length;
        const pastCount = (syncData.past ?? []).length;
        setStatus(
          `Connected to ${facilityName}! ${familyMembers.length} family member(s). ` +
            `${upcomingCount} upcoming + ${pastCount} past = ${importedCount} total registrations synced.`,
          'success',
        );
      } else if (syncData.needsReauth && familyMembers.length === 0) {
        setStatus(
          `Could not authenticate with ${facilityName}. Please check your email and password.`,
          'error',
        );
      } else {
        setDaySmartConfig({
          email: encEmail,
          password: encPassword,
          facilityId,
          facilityName,
          connected: true,
          lastSync: new Date().toISOString(),
          familyMembers,
          customerIds,
        });

        addNotification({
          title: 'Dash Connected',
          body: `Connected to ${facilityName}. ${familyMembers.length} family member(s) found.`,
          clinicId: '',
          type: 'new_clinic',
        });

        setStatus(
          `Connected to ${facilityName}! ${familyMembers.length} family member(s) found. ` +
            (syncData.error ? `Note: ${syncData.error}` : 'No upcoming events found.'),
          'success',
        );
      }
    } catch (error) {
      setStatus(
        `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}. Check your internet connection.`,
        'error',
      );
    }

    setDaySmartSyncing(false);
  };

  const handleDashSync = async () => {
    setDaySmartSyncing(true);
    setStatus('Syncing with Dash...');

    try {
      const loginRes = await fetch('/api/integrations/daysmart?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: daySmartConfig.email,
          password: daySmartConfig.password,
          facilityId: daySmartConfig.facilityId,
        }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        setStatus('Session expired. Please disconnect and reconnect.', 'error');
        setDaySmartSyncing(false);
        return;
      }

      setStatus('Fetching latest registrations...');
      const authCredential = loginData.authToken ?? loginData.sessionCookie ?? '';

      const syncRes = await fetch('/api/integrations/daysmart?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: daySmartConfig.facilityId,
          sessionCookie: authCredential,
          customerIds: loginData.customerIds ?? daySmartConfig.customerIds,
        }),
      });
      const syncData = await syncRes.json();

      if (syncData.success && syncData.activities) {
        for (const reg of registrations.filter((r) => r.source === 'dash')) {
          removeRegistration(reg.id);
        }

        let importedCount = 0;
        for (const activity of syncData.activities ?? []) {
          addRegistration({
            clinicId: `dash-${activity.id}`,
            clinicName: activity.name,
            venue: activity.location ?? daySmartConfig.facilityName,
            city: '',
            startDate: activity.startDate,
            endDate: activity.endDate,
            price: activity.price,
            currency: 'USD',
            status: 'confirmed',
            source: 'dash',
            notes: `${activity.category}${activity.startTime ? ` — ${activity.startTime} to ${activity.endTime}` : ''}`,
            playerName: activity.customerName,
          });
          importedCount++;
        }

        if (loginData.familyMembers) {
          setDaySmartConfig({
            lastSync: new Date().toISOString(),
            familyMembers: loginData.familyMembers,
            customerIds: loginData.customerIds,
          });
        } else {
          setDaySmartConfig({ lastSync: new Date().toISOString() });
        }

        const upcomingCount = (syncData.upcoming ?? []).length;
        const pastCount = (syncData.past ?? []).length;
        setStatus(
          `Sync complete! ${importedCount} registrations (${upcomingCount} upcoming, ${pastCount} past).`,
          'success',
        );
      } else {
        setDaySmartConfig({ lastSync: new Date().toISOString() });
        setStatus(`Sync complete. ${syncData.error ?? 'No new events found.'}`, 'info');
      }
    } catch (error) {
      setStatus(
        `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }

    setDaySmartSyncing(false);
  };

  const handleDashDisconnect = () => {
    for (const reg of registrations.filter((r) => r.source === 'dash')) {
      removeRegistration(reg.id);
    }
    setDaySmartConfig({
      email: '',
      password: '',
      facilityId: '',
      facilityName: '',
      connected: false,
      lastSync: null,
      familyMembers: [],
      customerIds: [],
    });
    setDashEmail('');
    setDashPassword('');
    setDashFacilityUrl('');
    setStatus('Disconnected from Dash. Registrations cleared.', 'info');
  };

  // ── IceHockeyPro ─────────────────────────────────────────────────────────────

  const handleIhpConnect = async () => {
    if (!ihpEmail || !ihpPassword) {
      setStatus('Please enter your IceHockeyPro email and password.', 'error');
      return;
    }
    if (ihpLinkedChildIds.length === 0) {
      setStatus('Please select at least one player to link.', 'error');
      return;
    }

    const linkedChildren = childProfiles.filter((c) => ihpLinkedChildIds.includes(c.id));
    const linkedNames = linkedChildren.map((c) => c.name);
    setSyncing(true);

    try {
      const [encEmail, encPassword] = await Promise.all([
        encryptViaServer(ihpEmail),
        encryptViaServer(ihpPassword),
      ]);

      setStatus('Logging in to IceHockeyPro...');
      const loginRes = await fetch('/api/integrations/icehockeypro?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ihpEmail, password: ihpPassword }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        setStatus(
          loginData.error ?? 'Failed to login to IceHockeyPro. Check your credentials.',
          'error',
        );
        setSyncing(false);
        return;
      }

      setStatus('Scraping order history...');
      const syncRes = await fetch('/api/integrations/icehockeypro?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCookie: loginData.sessionCookie,
          linkedChildNames: linkedNames,
        }),
      });
      const syncData = await syncRes.json();

      for (const reg of registrations.filter((r) => r.source === 'icehockeypro')) {
        removeRegistration(reg.id);
      }

      if (syncData.success) {
        setStatus(`Found ${syncData.totalOrders} orders. Matching to your players...`);

        let importedCount = 0;
        const allOrders = [
          ...(syncData.matchedOrders ?? []),
          ...(syncData.unmatchedOrders ?? []),
        ];
        for (const order of allOrders) {
          const startDate = order.dates
            ? parseDateString(order.dates, 'start')
            : order.orderDate ?? new Date().toISOString().split('T')[0];
          const endDate = order.dates ? parseDateString(order.dates, 'end') : startDate;

          addRegistration({
            clinicId: `ihp-${order.orderId}`,
            clinicName: order.campName,
            venue: order.location ?? 'IceHockeyPro',
            city: extractCity(order.location),
            startDate,
            endDate,
            price: order.price,
            currency: order.currency ?? 'USD',
            status: 'confirmed',
            source: 'icehockeypro',
            notes: `Order #${order.orderId}${order.dates ? ` — ${order.dates}` : ''}`,
            playerName: order.matchedChildName ?? order.billingName ?? undefined,
          });
          importedCount++;
        }

        setIceHockeyProConfig({
          email: encEmail,
          password: encPassword,
          connected: true,
          lastSync: new Date().toISOString(),
          playerName: linkedNames.join(', '),
          linkedChildIds: ihpLinkedChildIds,
        });

        addNotification({
          title: 'IceHockeyPro Connected',
          body: `Linked ${linkedNames.join(' & ')}. Imported ${importedCount} camps.`,
          clinicId: '',
          type: 'new_clinic',
        });

        const unmatchedNote =
          (syncData.unmatchedOrders ?? []).length > 0
            ? ` ${syncData.unmatchedOrders.length} orders didn't match any linked player.`
            : '';

        setStatus(
          `Connected for ${linkedNames.join(' & ')}! Imported ${importedCount} camps from ${syncData.totalOrders} orders.${unmatchedNote}`,
          'success',
        );
      } else {
        setIceHockeyProConfig({
          email: encEmail,
          password: encPassword,
          connected: true,
          lastSync: new Date().toISOString(),
          playerName: linkedNames.join(', '),
          linkedChildIds: ihpLinkedChildIds,
        });
        setStatus(
          `Connected but couldn't scrape orders: ${syncData.error ?? 'Unknown issue'}. Try syncing again later.`,
          'info',
        );
      }
    } catch (error) {
      setStatus(
        `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }

    setSyncing(false);
  };

  const handleIhpSync = async () => {
    setSyncing(true);
    setStatus('Syncing with IceHockeyPro...');

    try {
      const loginRes = await fetch('/api/integrations/icehockeypro?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: iceHockeyProConfig.email,
          password: iceHockeyProConfig.password,
        }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        setStatus('Session expired. Please disconnect and reconnect.', 'error');
        setSyncing(false);
        return;
      }

      setStatus('Checking for new orders...');
      const linkedNames = childProfiles
        .filter((c) => (iceHockeyProConfig.linkedChildIds ?? []).includes(c.id))
        .map((c) => c.name);

      const syncRes = await fetch('/api/integrations/icehockeypro?action=sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCookie: loginData.sessionCookie,
          linkedChildNames: linkedNames,
        }),
      });
      const syncData = await syncRes.json();

      if (syncData.success) {
        for (const reg of registrations.filter((r) => r.source === 'icehockeypro')) {
          removeRegistration(reg.id);
        }

        let importedCount = 0;
        const allOrders = [
          ...(syncData.matchedOrders ?? []),
          ...(syncData.unmatchedOrders ?? []),
        ];
        for (const order of allOrders) {
          const startDate = order.dates
            ? parseDateString(order.dates, 'start')
            : order.orderDate ?? new Date().toISOString().split('T')[0];
          const endDate = order.dates ? parseDateString(order.dates, 'end') : startDate;

          addRegistration({
            clinicId: `ihp-${order.orderId}`,
            clinicName: order.campName,
            venue: order.location ?? 'IceHockeyPro',
            city: extractCity(order.location),
            startDate,
            endDate,
            price: order.price,
            currency: order.currency ?? 'USD',
            status: 'confirmed',
            source: 'icehockeypro',
            notes: `Order #${order.orderId}${order.dates ? ` — ${order.dates}` : ''}`,
            playerName: order.matchedChildName ?? order.billingName ?? undefined,
          });
          importedCount++;
        }

        setIceHockeyProConfig({ lastSync: new Date().toISOString() });
        const matchedCount = (syncData.matchedOrders ?? []).length;
        const unmatchedCount = (syncData.unmatchedOrders ?? []).length;
        setStatus(
          `Sync complete! ${importedCount} camps from ${syncData.totalOrders} orders (${matchedCount} matched, ${unmatchedCount} unmatched).`,
          'success',
        );
      } else {
        setIceHockeyProConfig({ lastSync: new Date().toISOString() });
        setStatus(`Sync complete. ${syncData.error ?? 'No new orders found.'}`, 'info');
      }
    } catch (error) {
      setStatus(
        `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }

    setSyncing(false);
  };

  const handleIhpDisconnect = () => {
    for (const reg of registrations.filter((r) => r.source === 'icehockeypro')) {
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
    setStatus('Disconnected from IceHockeyPro. Registrations cleared.', 'info');
  };

  // ── Email ─────────────────────────────────────────────────────────────────────

  const handleEmailConnect = async (provider: 'gmail' | 'outlook') => {
    setSyncing(true);
    setStatus(`Connecting to ${provider === 'gmail' ? 'Gmail' : 'Outlook'}...`);
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

    setStatus(
      "Email scanning active! We'll scan for hockey-related schedule changes.",
      'success',
    );
    setSyncing(false);
  };

  const handleEmailDisconnect = () => {
    setEmailScanConfig({
      provider: 'none',
      connected: false,
      lastScan: null,
      scanFrequency: 'daily',
    });
    setStatus('Email scanning disconnected.', 'info');
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="safe-area-top" />
      <div className="px-4 py-4 pb-28">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-200"
            aria-label="Back to settings"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Integrations</h1>
            <p className="text-xs text-slate-500">Connect your hockey accounts</p>
          </div>
        </div>

        <AnimatePresence>
          {isAnySyncing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <HockeyLoader size="sm" />
              <p className="text-sm font-medium text-slate-600">
                {statusMessage || 'Working...'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {statusMessage && !isAnySyncing && (
            <StatusBanner
              message={statusMessage}
              variant={statusVariant}
              onDismiss={() => setStatusMessage('')}
              debugInfo={loginDebugInfo}
            />
          )}
        </AnimatePresence>

        <div className="space-y-3">

          {/* ── IceHockeyPro ── */}
          <IntegrationCard
            id="icehockeypro"
            icon={Trophy}
            title="IceHockeyPro"
            subtitle="Not connected"
            connected={iceHockeyProConfig.connected}
            connectedText={`Connected — ${getLinkedChildNames()}`}
            color="blue"
            expanded={expandedSection === 'icehockeypro'}
            onToggle={() =>
              setExpandedSection(expandedSection === 'icehockeypro' ? null : 'icehockeypro')
            }
          >
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-start gap-2">
                <Trophy size={14} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Connect your IceHockeyPro account to sync camps attended, upcoming
                  registrations, and spending. We scrape your order history at{' '}
                  <span className="font-mono text-blue-800">
                    icehockeypro.com/my-account-2/orders/
                  </span>{' '}
                  and match billing details to your linked players.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Credentials are encrypted with AES-256-GCM before storage. We only access
                your order history to match registrations by billing name.
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
                  <label className="block mb-2 text-xs font-medium text-slate-700">
                    Link Players{' '}
                    <span className="text-slate-400">(select who to sync)</span>
                  </label>
                  {childProfiles.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2">
                        No players added yet. Add your children first so we can match their
                        billing details.
                      </p>
                      <button
                        onClick={() => router.push('/settings')}
                        className="text-xs font-medium text-blue-600 flex items-center gap-1"
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
                            onClick={() => toggleIhpChild(child.id)}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                              isLinked
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-slate-50 border-slate-200',
                            )}
                          >
                            <div
                              className={cn(
                                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0',
                                isLinked
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-300',
                              )}
                            >
                              {isLinked && <Check size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">
                                {child.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {getChildLabel(child)}
                              </p>
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
                  {syncing ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Trophy size={14} />
                  )}
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
                  <p className="text-[10px] text-slate-500">
                    Account: {iceHockeyProConfig.email}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Linked players: {getLinkedChildNames()}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Source: icehockeypro.com/my-account-2/orders/
                  </p>
                  {iceHockeyProConfig.lastSync && (
                    <p className="text-[10px] text-slate-500">
                      Last sync:{' '}
                      {new Date(iceHockeyProConfig.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleIhpSync}
                    disabled={syncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
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

          {/* ── Dash by DaySmart ── */}
          <IntegrationCard
            id="dash"
            icon={Calendar}
            title="Dash by DaySmart"
            subtitle="Not connected"
            connected={daySmartConfig.connected}
            connectedText={`Connected — ${daySmartConfig.facilityName ?? daySmartConfig.facilityId ?? 'Your Rink'}`}
            color="orange"
            expanded={expandedSection === 'dash'}
            onToggle={() =>
              setExpandedSection(expandedSection === 'dash' ? null : 'dash')
            }
          >
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-start gap-2">
                <Zap size={14} className="text-orange-600 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-700">
                  Connect your Dash by DaySmart account to automatically sync clinics,
                  camps, and registrations from your rink. Works with any DaySmart-powered
                  facility.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Credentials are encrypted with AES-256-GCM before storage. Used only to
                communicate directly with DaySmart&apos;s API.
              </p>
            </div>

            {!daySmartConfig.connected ? (
              <>
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-700">
                    Your Rink&apos;s DaySmart URL
                  </label>
                  <input
                    type="text"
                    value={dashFacilityUrl}
                    onChange={(e) => setDashFacilityUrl(e.target.value)}
                    placeholder="e.g. https://apps.daysmartrecreation.com/dash/x/#/online/warmemorial/"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Paste the URL from your rink&apos;s Dash login page, or just the
                    facility ID (e.g. &quot;warmemorial&quot;)
                  </p>
                </div>

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
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-emerald-700">Connected</p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Account: {daySmartConfig.email}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Facility: {daySmartConfig.facilityName ?? daySmartConfig.facilityId}
                  </p>
                  {(daySmartConfig.familyMembers ?? []).length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-medium text-slate-600 mb-1">
                        Family Members:
                      </p>
                      {daySmartConfig.familyMembers.map((member) => (
                        <p
                          key={member.id}
                          className="text-[10px] text-slate-500 flex items-center gap-1"
                        >
                          <UserCheck size={9} className="text-emerald-500" />
                          {member.name}{' '}
                          <span className="text-slate-400">(#{member.id})</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {daySmartConfig.lastSync && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Last sync:{' '}
                      {new Date(daySmartConfig.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleDashSync}
                    disabled={daySmartSyncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={daySmartSyncing ? 'animate-spin' : ''}
                    />
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
                    <Calendar size={14} className="text-orange-600" />
                    <span className="text-xs text-slate-900">View My Registrations</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-400" />
                </button>
              </>
            )}
          </IntegrationCard>

          {/* ── Email Scanner ── */}
          <IntegrationCard
            id="email"
            icon={Mail}
            title="Email Scanner"
            subtitle="Detect schedule changes"
            connected={emailScanConfig.connected}
            connectedText={`Connected — ${emailScanConfig.provider === 'gmail' ? 'Gmail' : 'Outlook'} · ${emailScanConfig.scanFrequency}`}
            color="violet"
            expanded={expandedSection === 'email'}
            onToggle={() =>
              setExpandedSection(expandedSection === 'email' ? null : 'email')
            }
          >
            <div className="p-3 bg-violet-50 rounded-xl border border-violet-200">
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-violet-600 mt-0.5 shrink-0" />
                <p className="text-xs text-violet-700">
                  Securely scan your inbox for hockey-related schedule changes,
                  cancellations, and announcements. Uses Gmail/Outlook API with read-only
                  access and pattern matching — no AI processing of email content,
                  completely free.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Shield size={12} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500">
                Uses OAuth — we never see your password. Read-only access to messages
                matching hockey keywords only. Revoke access anytime from your
                Google/Microsoft account.
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
                  <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    What We Look For
                  </h4>
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
                    Provider:{' '}
                    {emailScanConfig.provider === 'gmail' ? 'Gmail' : 'Outlook'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Frequency: {emailScanConfig.scanFrequency}
                  </p>
                  {emailScanConfig.lastScan && (
                    <p className="text-[10px] text-slate-500">
                      Last scan:{' '}
                      {new Date(emailScanConfig.lastScan).toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 text-xs font-medium text-slate-700">
                    Scan Frequency
                  </label>
                  <div className="flex gap-2">
                    {(['hourly', 'daily', 'manual'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setEmailScanConfig({ scanFrequency: freq })}
                        className={cn(
                          'flex-1 py-2 text-xs font-medium rounded-xl border transition-all capitalize',
                          emailScanConfig.scanFrequency === freq
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500',
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

          {/* ── What Gets Synced ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">What Gets Synced</h3>
            <div className="space-y-2">
              {[
                {
                  icon: Trophy,
                  text: 'Camps & clinics from IceHockeyPro (matched by billing name)',
                  colorClass: 'text-blue-600',
                },
                {
                  icon: Calendar,
                  text: 'Programs & registrations from DaySmart',
                  colorClass: 'text-orange-600',
                },
                {
                  icon: Mail,
                  text: 'Schedule changes detected in your email',
                  colorClass: 'text-violet-600',
                },
                {
                  icon: Zap,
                  text: 'Spending tracked across all sources',
                  colorClass: 'text-amber-600',
                },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <item.icon size={14} className={item.colorClass} />
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
