'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  MapPin,
  DollarSign,
  Clock,
  User,
  FileText,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Hourglass,
  Users,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isPast,
  isFuture,
  isValid,
} from 'date-fns';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import type { Registration } from '@/types';

type ViewMode = 'list' | 'calendar';
type DisplayStatus = 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
type SortBy = 'date' | 'price' | 'name';

// ── Grouped registration (merges children for same clinic) ────
interface RegistrationGroup {
  key: string;
  clinicName: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  currency: string;
  source: string;
  displayStatus: DisplayStatus;
  children: Array<{ name: string; price: number; regId: string }>;
  notes: string;
  registrations: Registration[];
}

// ── Helpers ───────────────────────────────────────────────────
function safeParse(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (isValid(d)) return d;
  d = new Date(dateStr.replace(/-/g, '/'));
  if (isValid(d)) return d;
  return null;
}

function safeFormat(dateStr: string | undefined | null, fmt: string, fallback = 'TBD'): string {
  const d = safeParse(dateStr);
  if (!d) return fallback;
  try { return format(d, fmt); } catch { return fallback; }
}

function getDisplayStatus(reg: Registration): DisplayStatus {
  if (reg.status === 'cancelled') return 'cancelled';
  const start = safeParse(reg.startDate);
  const end = safeParse(reg.endDate);
  if (end && isPast(end)) return 'completed';
  if (start && isFuture(start)) return 'upcoming';
  if (start && end && isPast(start) && !isPast(end)) return 'in-progress';
  return 'upcoming';
}

function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case 'upcoming': return 'Upcoming';
    case 'in-progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
  }
}

function statusStyle(s: DisplayStatus): string {
  switch (s) {
    case 'upcoming': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'in-progress': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'completed': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'cancelled': return 'bg-red-50 text-red-600 border-red-200';
  }
}

// Generic names that should NOT be used for grouping — treat each as its own card
const GENERIC_CLINIC_NAMES = new Set([
  'camp', 'camps', 'event', 'class', 'program', 'session', 'registration',
  'product', 'item', 'ticket', 'unknown camp', 'icehockeypro',
]);

function isGenericName(name: string): boolean {
  return GENERIC_CLINIC_NAMES.has(name.toLowerCase().trim());
}

function parseDateString(dateStr: string, which: 'start' | 'end'): string {
  try {
    const rangeMatch = dateStr.match(/(\w+ \d+)\s*-\s*(\w+ \d+),?\s*(\d{4})/);
    if (rangeMatch) {
      const year = rangeMatch[3];
      const dateText = which === 'start' ? `${rangeMatch[1]}, ${year}` : `${rangeMatch[2]}, ${year}`;
      const d = new Date(dateText);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch { /* fall through */ }
  return new Date().toISOString().split('T')[0];
}

function extractCity(location: string): string {
  if (!location) return '';
  const parts = location.split(',');
  return parts[0]?.trim() || location;
}

function groupRegistrations(registrations: Registration[]): RegistrationGroup[] {
  const map = new Map<string, RegistrationGroup>();

  for (const reg of registrations) {
    const name = reg.clinicName.toLowerCase().trim();
    const venue = reg.venue.toLowerCase().trim();

    // Group key strategy:
    // - Real names: name + startDate + venue → naturally merges siblings in the same camp
    // - Generic names ("Camp"): startDate + notes/dates info + source → merges siblings
    //   who bought the same camp (same date range, same source) while keeping
    //   different camps separate (different dates = different key).
    //   We use the notes field because it often contains the actual camp date range
    //   from the scraper (e.g. "Order #12345 — December 20 - 23, 2025").
    let key: string;
    if (isGenericName(name)) {
      // Extract date info from notes to distinguish different camps
      const noteDates = reg.notes?.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+/i)?.[0] || '';
      key = `generic::${reg.startDate}::${noteDates}::${reg.source || ''}`;
    } else {
      key = `${name}::${reg.startDate}::${venue}`;
    }

    const ds = getDisplayStatus(reg);

    if (map.has(key)) {
      const group = map.get(key)!;
      group.totalPrice += typeof reg.price === 'number' ? reg.price : 0;
      if (reg.playerName) {
        // Don't add duplicate children (same name already in group)
        const alreadyHasChild = group.children.some(
          c => c.name.toLowerCase() === reg.playerName!.toLowerCase()
        );
        if (!alreadyHasChild) {
          group.children.push({ name: reg.playerName, price: reg.price, regId: reg.id });
        }
      }
      group.registrations.push(reg);
      if (!group.notes && reg.notes) group.notes = reg.notes;
    } else {
      map.set(key, {
        key,
        clinicName: reg.clinicName,
        venue: reg.venue,
        city: reg.city,
        startDate: reg.startDate,
        endDate: reg.endDate,
        totalPrice: typeof reg.price === 'number' ? reg.price : 0,
        currency: reg.currency || 'USD',
        source: reg.source,
        displayStatus: ds,
        children: reg.playerName ? [{ name: reg.playerName, price: reg.price, regId: reg.id }] : [],
        notes: reg.notes || '',
        registrations: [reg],
      });
    }
  }

  return [...map.values()];
}

// ── Main Page ─────────────────────────────────────────────────
export default function RegistrationsPage() {
  const router = useRouter();
  const {
    registrations, addRegistration, updateRegistration, removeRegistration,
    iceHockeyProConfig, setIceHockeyProConfig,
    daySmartConfig, setDaySmartConfig, setDaySmartSyncing,
    childProfiles,
  } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Filters
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filterChild, setFilterChild] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Stale data detection: >24h since any integration last synced
  const isStale = useMemo(() => {
    const now = Date.now();
    const STALE_MS = 24 * 60 * 60 * 1000;
    const hasAnyIntegration = iceHockeyProConfig.connected || daySmartConfig.connected;
    if (!hasAnyIntegration) return false;
    const ihpLast = iceHockeyProConfig.lastSync ? new Date(iceHockeyProConfig.lastSync).getTime() : 0;
    const dashLast = daySmartConfig.lastSync ? new Date(daySmartConfig.lastSync).getTime() : 0;
    const latest = Math.max(ihpLast, dashLast);
    return latest > 0 && (now - latest) > STALE_MS;
  }, [iceHockeyProConfig, daySmartConfig]);

  const hasAnyIntegration = iceHockeyProConfig.connected || daySmartConfig.connected;

  // ── Sync all connected integrations ──
  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncStatus('Starting sync...');
    let totalImported = 0;

    try {
      // Sync IceHockeyPro if connected
      if (iceHockeyProConfig.connected && iceHockeyProConfig.email && iceHockeyProConfig.password) {
        setSyncStatus('Logging in to IceHockeyPro...');
        const loginRes = await fetch('/api/integrations/icehockeypro?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: iceHockeyProConfig.email, password: iceHockeyProConfig.password }),
        });
        const loginData = await loginRes.json();

        if (loginRes.ok && loginData.success) {
          setSyncStatus('Syncing IceHockeyPro orders...');
          const linkedNames = childProfiles
            .filter(c => (iceHockeyProConfig.linkedChildIds || []).includes(c.id))
            .map(c => c.name);

          const syncRes = await fetch('/api/integrations/icehockeypro?action=sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionCookie: loginData.sessionCookie, linkedChildNames: linkedNames }),
          });
          const syncData = await syncRes.json();

          if (syncData.success) {
            const oldIhpRegs = registrations.filter(r => r.source === 'icehockeypro');
            for (const reg of oldIhpRegs) removeRegistration(reg.id);

            const allOrders = [...(syncData.matchedOrders || []), ...(syncData.unmatchedOrders || [])];

            for (const order of allOrders) {
              const startDate = order.dates ? parseDateString(order.dates, 'start') : order.orderDate || new Date().toISOString().split('T')[0];
              const endDate = order.dates ? parseDateString(order.dates, 'end') : startDate;
              addRegistration({
                clinicId: `ihp-${order.orderId}`,
                clinicName: order.campName,
                venue: order.location || 'IceHockeyPro',
                city: extractCity(order.location),
                startDate, endDate,
                price: order.price,
                currency: order.currency || 'USD',
                status: 'confirmed',
                source: 'icehockeypro',
                notes: `Order #${order.orderId}${order.dates ? ` — ${order.dates}` : ''}`,
                playerName: order.matchedChildName || order.billingName || undefined,
              });
              totalImported++;
            }
            setIceHockeyProConfig({ lastSync: new Date().toISOString() });

            // Run debug endpoint for diagnostic data (no-op in production)
            try {
              await fetch('/api/integrations/icehockeypro/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionCookie: loginData.sessionCookie }),
              });
            } catch { /* debug is optional */ }
          }
        }
      }

      // Sync DaySmart if connected
      if (daySmartConfig.connected && daySmartConfig.email && daySmartConfig.password) {
        setSyncStatus('Logging in to DaySmart...');
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

        if (loginRes.ok && loginData.success) {
          setSyncStatus('Syncing DaySmart registrations...');
          setDaySmartSyncing(true);
          const syncRes = await fetch('/api/integrations/daysmart?action=sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facilityId: daySmartConfig.facilityId,
              sessionCookie: loginData.sessionCookie,
              customerIds: loginData.customerIds || daySmartConfig.customerIds,
            }),
          });
          const syncData = await syncRes.json();

          if (syncData.success && syncData.activities) {
            const oldDashRegs = registrations.filter(r => r.source === 'dash');
            for (const reg of oldDashRegs) removeRegistration(reg.id);

            for (const activity of syncData.activities) {
              addRegistration({
                clinicId: `dash-${activity.id}`,
                clinicName: activity.name,
                venue: activity.location || daySmartConfig.facilityName,
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
              totalImported++;
            }
            if (loginData.familyMembers) {
              setDaySmartConfig({ lastSync: new Date().toISOString(), familyMembers: loginData.familyMembers, customerIds: loginData.customerIds });
            } else {
              setDaySmartConfig({ lastSync: new Date().toISOString() });
            }
          }
          setDaySmartSyncing(false);
        }
      }

      setSyncStatus(`Sync complete! ${totalImported} registrations refreshed.`);
    } catch (error) {
      setSyncStatus(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setSyncing(false);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  // Unique children from registrations
  const childNames = useMemo(() => {
    const names = new Set<string>();
    registrations.forEach(r => {
      if (r.playerName) r.playerName.split(/[,&/]/).forEach(n => names.add(n.trim()));
    });
    return [...names].sort();
  }, [registrations]);

  // Sources
  const sources = useMemo(() => {
    const s = new Set<string>();
    registrations.forEach(r => s.add(r.source));
    return [...s].sort();
  }, [registrations]);

  // Filter → Group → Sort
  const { upcoming, completed, cancelled } = useMemo(() => {
    // 1. Filter
    let filtered = registrations;
    if (filterChild !== 'all') {
      filtered = filtered.filter(r => r.playerName?.toLowerCase().includes(filterChild.toLowerCase()));
    }
    if (filterSource !== 'all') {
      filtered = filtered.filter(r => r.source === filterSource);
    }

    // 2. Group
    const groups = groupRegistrations(filtered);

    // 3. Sort
    groups.sort((a, b) => {
      if (sortBy === 'date') {
        const da = safeParse(a.startDate)?.getTime() || 0;
        const db = safeParse(b.startDate)?.getTime() || 0;
        return da - db;
      }
      if (sortBy === 'price') return b.totalPrice - a.totalPrice;
      return a.clinicName.localeCompare(b.clinicName);
    });

    // 4. Bucket
    const upcoming: RegistrationGroup[] = [];
    const completed: RegistrationGroup[] = [];
    const cancelled: RegistrationGroup[] = [];

    for (const g of groups) {
      if (g.displayStatus === 'cancelled') cancelled.push(g);
      else if (g.displayStatus === 'completed') completed.push(g);
      else upcoming.push(g);
    }

    // Upcoming: soonest first. Completed: most recent first.
    if (sortBy === 'date') completed.reverse();

    return { upcoming, completed, cancelled };
  }, [registrations, filterChild, filterSource, sortBy]);

  const totalGroups = upcoming.length + completed.length + cancelled.length;

  // Calendar helpers
  const getRegistrationsForDay = (day: Date) =>
    registrations.filter(reg => {
      const start = safeParse(reg.startDate);
      const end = safeParse(reg.endDate);
      if (!start || !end) return false;
      return day >= start && day <= end;
    });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  }, [currentMonth]);

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e2e8f0' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h1 className="text-xl font-bold text-slate-900">My Clinics</h1>
              <span className="px-2.5 py-0.5 text-sm font-medium rounded-full"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 12%, white)', color: 'var(--theme-primary)' }}>
                {totalGroups}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sync button */}
              {hasAnyIntegration && (
                <button
                  onClick={handleSyncAll}
                  disabled={syncing}
                  className={cn('p-2 rounded-lg transition-colors', syncing ? 'bg-blue-50' : 'hover:bg-slate-100')}
                  title="Refresh data from connected integrations"
                >
                  {syncing
                    ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    : <RefreshCw className="w-5 h-5 text-slate-600" />
                  }
                </button>
              )}

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn('p-2 rounded-lg transition-colors', showFilters ? 'bg-slate-200' : 'hover:bg-slate-100')}
              >
                <Filter className="w-5 h-5 text-slate-600" />
              </button>

              {/* View Toggle */}
              <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: '#f1f5f9' }}>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn('p-2 rounded-md transition-all', viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn('p-2 rounded-md transition-all', viewMode === 'calendar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters bar */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 pb-3 text-sm">
                  {/* Sort */}
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                      className="bg-slate-100 border-0 rounded-md px-2 py-1 text-slate-700 text-xs font-medium">
                      <option value="date">Date</option>
                      <option value="price">Price</option>
                      <option value="name">Name</option>
                    </select>
                  </div>

                  {/* Child filter */}
                  {childNames.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <select value={filterChild} onChange={e => setFilterChild(e.target.value)}
                        className="bg-slate-100 border-0 rounded-md px-2 py-1 text-slate-700 text-xs font-medium">
                        <option value="all">All Players</option>
                        {childNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Source filter */}
                  {sources.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                        className="bg-slate-100 border-0 rounded-md px-2 py-1 text-slate-700 text-xs font-medium">
                        <option value="all">All Sources</option>
                        {sources.map(s => <option key={s} value={s}>{s === 'icehockeypro' ? 'IceHockeyPro' : s === 'dash' ? 'DaySmart' : 'Manual'}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Sync status bar */}
        <AnimatePresence>
          {syncStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2',
                syncing ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200',
              )}>
                {syncing && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                {!syncing && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {syncStatus}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stale data banner */}
        {isStale && !syncing && !syncStatus && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Data may be stale</p>
              <p className="text-xs text-amber-600 mt-0.5">Last synced more than 24 hours ago.</p>
            </div>
            <button
              onClick={handleSyncAll}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
            >
              Refresh
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div key="list" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              {totalGroups === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <CalendarDays className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Registrations Yet</h3>
                  <p className="text-slate-500 mb-6 max-w-md">
                    {hasAnyIntegration
                      ? 'Tap the refresh button to sync your latest registrations, or add one manually.'
                      : 'Connect your IceHockeyPro or DaySmart account in Integrations, or add registrations manually.'
                    }
                  </p>
                  {hasAnyIntegration ? (
                    <button
                      onClick={handleSyncAll}
                      disabled={syncing}
                      className="px-6 py-2.5 text-white rounded-xl font-medium text-sm hover:opacity-90 flex items-center gap-2"
                      style={{ backgroundColor: 'var(--theme-primary)' }}
                    >
                      <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/integrations')}
                      className="px-6 py-2.5 text-white rounded-xl font-medium text-sm hover:opacity-90"
                      style={{ backgroundColor: 'var(--theme-primary)' }}
                    >
                      Connect Integrations
                    </button>
                  )}
                </div>
              )}

              {upcoming.length > 0 && (
                <Section title="Upcoming" count={upcoming.length} icon={Hourglass} color="sky">
                  {upcoming.map(g => (
                    <GroupCard key={g.key} group={g} isExpanded={expandedCard === g.key}
                      onToggle={() => setExpandedCard(expandedCard === g.key ? null : g.key)}
                      onUpdate={updateRegistration} />
                  ))}
                </Section>
              )}

              {completed.length > 0 && (
                <Section title="Completed" count={completed.length} icon={CheckCircle2} color="slate">
                  {completed.map(g => (
                    <GroupCard key={g.key} group={g} isExpanded={expandedCard === g.key}
                      onToggle={() => setExpandedCard(expandedCard === g.key ? null : g.key)}
                      onUpdate={updateRegistration} />
                  ))}
                </Section>
              )}

              {cancelled.length > 0 && (
                <Section title="Cancelled" count={cancelled.length} icon={XCircle} color="red">
                  {cancelled.map(g => (
                    <GroupCard key={g.key} group={g} isExpanded={expandedCard === g.key}
                      onToggle={() => setExpandedCard(expandedCard === g.key ? null : g.key)}
                      onUpdate={updateRegistration} />
                  ))}
                </Section>
              )}
            </motion.div>
          ) : (
            <CalendarView
              key="calendar"
              currentMonth={currentMonth}
              calendarDays={calendarDays}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              handlePrevMonth={() => setCurrentMonth(subMonths(currentMonth, 1))}
              handleNextMonth={() => setCurrentMonth(addMonths(currentMonth, 1))}
              getRegistrationsForDay={getRegistrationsForDay}
            />
          )}
        </AnimatePresence>
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-20 right-6 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 text-white"
        style={{ backgroundColor: 'var(--theme-primary)' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      <AddRegistrationModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={addRegistration} />
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, count, icon: Icon, color, children }: {
  title: string; count: number; icon: React.ElementType; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className={cn('w-4.5 h-4.5', color === 'sky' ? 'text-sky-500' : color === 'red' ? 'text-red-400' : 'text-slate-400')} />
        <h2 className="text-base font-semibold text-slate-700">{title}</h2>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Group Card (merges children for the same clinic) ──────────
function GroupCard({ group, isExpanded, onToggle, onUpdate }: {
  group: RegistrationGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: Partial<Registration>) => void;
}) {
  const hasMultipleChildren = group.children.length > 1;

  return (
    <motion.div layout className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button onClick={onToggle} className="w-full p-4 text-left focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title + Status */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-slate-900 truncate text-[15px]">{group.clinicName}</h3>
              <span className={cn('px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 uppercase tracking-wide', statusStyle(group.displayStatus))}>
                {statusLabel(group.displayStatus)}
              </span>
            </div>

            <div className="space-y-1 text-sm text-slate-500">
              {/* Venue */}
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{group.venue}{group.city ? `, ${group.city}` : ''}</span>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span>
                  {safeFormat(group.startDate, 'MMM d')}
                  {group.startDate !== group.endDate && <> &ndash; {safeFormat(group.endDate, 'MMM d, yyyy')}</>}
                  {group.startDate === group.endDate && <>, {safeFormat(group.startDate, 'yyyy')}</>}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-700">
                  {group.currency} {group.totalPrice.toFixed(2)}
                  {hasMultipleChildren && <span className="text-slate-400 font-normal"> ({group.children.length} players)</span>}
                </span>
              </div>

              {/* Children pills */}
              {group.children.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5">
                  <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <div className="flex flex-wrap gap-1.5">
                    {group.children.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, white)',
                          color: 'var(--theme-primary)',
                          border: '1px solid color-mix(in srgb, var(--theme-primary) 20%, white)',
                        }}>
                        {c.name.split(/\s+/)[0]}
                        {hasMultipleChildren && <span className="text-[10px] opacity-70"> ${c.price}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <ChevronDown className={cn('w-5 h-5 text-slate-300 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100">
            <div className="p-4 space-y-3">
              {/* Source badge */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Source: {group.source === 'icehockeypro' ? 'IceHockeyPro' : group.source === 'dash' ? 'DaySmart' : 'Manual'}</span>
                {group.registrations[0]?.registeredAt && (
                  <span>· Added {safeFormat(group.registrations[0].registeredAt, 'MMM d, yyyy')}</span>
                )}
              </div>

              {/* Per-child breakdown */}
              {hasMultipleChildren && (
                <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Per Player</div>
                  {group.children.map((c, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-600">{c.name}</span>
                      <span className="font-medium text-slate-700">${c.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {group.notes && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div className="text-slate-500">{group.notes}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {group.displayStatus !== 'cancelled' && (
                  <button
                    onClick={() => group.registrations.forEach(r => onUpdate(r.id, { status: 'cancelled' }))}
                    className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    const notes = prompt('Notes:', group.notes);
                    if (notes !== null) group.registrations.forEach(r => onUpdate(r.id, { notes }));
                  }}
                  className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {group.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Calendar View ─────────────────────────────────────────────
function CalendarView({ currentMonth, calendarDays, selectedDay, setSelectedDay, handlePrevMonth, handleNextMonth, getRegistrationsForDay }: {
  currentMonth: Date; calendarDays: Date[]; selectedDay: Date | null; setSelectedDay: (d: Date | null) => void;
  handlePrevMonth: () => void; handleNextMonth: () => void; getRegistrationsForDay: (d: Date) => Registration[];
}) {
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((day, i) => (
            <div key={i} className="text-center text-sm font-medium text-slate-400 pb-2">{day}</div>
          ))}
          {calendarDays.map((day, index) => {
            const dayRegs = getRegistrationsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = !!(selectedDay && isSameDay(day, selectedDay));
            return (
              <button key={index} onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn('aspect-square p-2 rounded-lg text-sm transition-all relative', isCurrentMonth ? 'text-slate-900 hover:bg-slate-100' : 'text-slate-400', isSelected && 'text-white', !isSelected && dayRegs.length > 0 && 'font-semibold')}
                style={isSelected ? { backgroundColor: 'var(--theme-primary)', color: 'white' } : undefined}>
                {format(day, 'd')}
                {dayRegs.length > 0 && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayRegs.slice(0, 3).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--theme-primary)' }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">{format(selectedDay, 'EEEE, MMMM d, yyyy')}</h3>
              <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            {(() => {
              const dayRegs = getRegistrationsForDay(selectedDay);
              if (dayRegs.length === 0) return <p className="text-slate-500 text-sm">No registrations on this day</p>;
              return (
                <div className="space-y-2">
                  {dayRegs.map(reg => (
                    <div key={reg.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                      <div className="font-medium text-slate-900 mb-1">{reg.clinicName}</div>
                      <div className="text-slate-500">{reg.venue}{reg.city ? `, ${reg.city}` : ''}</div>
                      {reg.playerName && <div className="text-slate-400 mt-1">{reg.playerName}</div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Add Registration Modal ────────────────────────────────────
function AddRegistrationModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean; onClose: () => void; onAdd: (reg: Registration) => void;
}) {
  const [formData, setFormData] = useState({
    clinicName: '', venue: '', city: '', startDate: '', endDate: '', price: '',
    status: 'confirmed' as Registration['status'], playerName: '', notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: `manual-${Date.now()}`,
      clinicId: '',
      clinicName: formData.clinicName,
      venue: formData.venue,
      city: formData.city,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      price: parseFloat(formData.price) || 0,
      currency: 'USD',
      registeredAt: new Date().toISOString(),
      status: formData.status,
      source: 'manual',
      notes: formData.notes,
      playerName: formData.playerName || undefined,
    });
    onClose();
    setFormData({ clinicName: '', venue: '', city: '', startDate: '', endDate: '', price: '', status: 'confirmed', playerName: '', notes: '' });
  };

  if (!isOpen) return null;

  const inputCls = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-900">Add Registration</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Clinic Name *</label>
            <input type="text" required value={formData.clinicName} onChange={e => setFormData({ ...formData, clinicName: e.target.value })}
              className={inputCls} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} placeholder="Summer Hockey Camp" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Venue *</label>
              <input type="text" required value={formData.venue} onChange={e => setFormData({ ...formData, venue: e.target.value })}
                className={inputCls} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} placeholder="Ice Arena" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City *</label>
              <input type="text" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })}
                className={inputCls} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} placeholder="Boston" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
              <input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                className={cn(inputCls, '[color-scheme:light]')} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
              <input type="date" required value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                className={cn(inputCls, '[color-scheme:light]')} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Price (USD) *</label>
              <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}
                className={inputCls} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} placeholder="299.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Player Name</label>
              <input type="text" value={formData.playerName} onChange={e => setFormData({ ...formData, playerName: e.target.value })}
                className={inputCls} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2}
              className={cn(inputCls, 'resize-none')} style={{ '--tw-ring-color': 'var(--theme-primary)' } as React.CSSProperties} placeholder="Optional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 text-white rounded-lg font-medium text-sm hover:opacity-90" style={{ backgroundColor: 'var(--theme-primary)' }}>Add</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
