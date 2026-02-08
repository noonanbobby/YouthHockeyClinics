'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { format, parseISO, startOfMonth, subMonths, isAfter } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  PieChart,
  Receipt,
  Clock,
  MapPin,
  Tag,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface MonthlyData {
  month: string;
  monthLabel: string;
  total: number;
  count: number;
}

type ViewTab = 'overview' | 'venues' | 'sources';

export default function SpendingPage() {
  const router = useRouter();
  const registrations = useStore((state) => state.registrations);
  const preferredCurrency = useStore((state) => state.preferredCurrency);
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');

  const activeRegistrations = useMemo(
    () => registrations.filter((r) => r.status !== 'cancelled'),
    [registrations]
  );

  // Summary stats
  const summary = useMemo(() => {
    const total = activeRegistrations.reduce((sum, r) => sum + r.price, 0);
    const count = activeRegistrations.length;
    const average = count > 0 ? total / count : 0;
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonth = activeRegistrations
      .filter((r) => isAfter(parseISO(r.registeredAt), thisMonthStart))
      .reduce((sum, r) => sum + r.price, 0);
    const sixMonthsAgo = startOfMonth(subMonths(now, 6));
    const recentTotal = activeRegistrations
      .filter((r) => isAfter(parseISO(r.registeredAt), sixMonthsAgo))
      .reduce((sum, r) => sum + r.price, 0);
    const avgMonthly = recentTotal / 6;
    return { total, count, average, thisMonth, avgMonthly };
  }, [activeRegistrations]);

  // Monthly breakdown (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthKey = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM');
      const monthRegs = activeRegistrations.filter(
        (r) => format(parseISO(r.registeredAt), 'yyyy-MM') === monthKey
      );
      months.push({
        month: monthKey,
        monthLabel,
        total: monthRegs.reduce((sum, r) => sum + r.price, 0),
        count: monthRegs.length,
      });
    }
    return months;
  }, [activeRegistrations]);

  // Venue/Organization grouping
  const venueData = useMemo(() => {
    const venueMap: Record<string, { total: number; count: number; items: typeof activeRegistrations }> = {};

    activeRegistrations.forEach((r) => {
      // Normalize venue name for grouping
      const venue = r.venue || 'Other';
      if (!venueMap[venue]) {
        venueMap[venue] = { total: 0, count: 0, items: [] };
      }
      venueMap[venue].total += r.price;
      venueMap[venue].count++;
      venueMap[venue].items.push(r);
    });

    const grandTotal = Object.values(venueMap).reduce((sum, v) => sum + v.total, 0);

    return Object.entries(venueMap)
      .map(([venue, data]) => ({
        venue,
        total: data.total,
        count: data.count,
        items: data.items,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [activeRegistrations]);

  // Source grouping (Dash vs IceHockeyPro vs Manual)
  const sourceData = useMemo(() => {
    const sourceMap: Record<string, { total: number; count: number; label: string; color: string }> = {
      dash: { total: 0, count: 0, label: 'Dash / DaySmart', color: 'from-orange-500 to-orange-600' },
      icehockeypro: { total: 0, count: 0, label: 'IceHockeyPro', color: 'from-blue-500 to-blue-600' },
      manual: { total: 0, count: 0, label: 'Manual Entry', color: 'from-slate-500 to-slate-600' },
    };

    activeRegistrations.forEach((r) => {
      const src = r.source || 'manual';
      if (sourceMap[src]) {
        sourceMap[src].total += r.price;
        sourceMap[src].count++;
      }
    });

    const grandTotal = Object.values(sourceMap).reduce((sum, v) => sum + v.total, 0);

    return Object.entries(sourceMap)
      .map(([key, data]) => ({
        key,
        ...data,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [activeRegistrations]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const categories: Record<string, { total: number; count: number; color: string }> = {
      Camps: { total: 0, count: 0, color: 'from-blue-500 to-blue-600' },
      Clinics: { total: 0, count: 0, color: 'from-cyan-500 to-cyan-600' },
      Tournaments: { total: 0, count: 0, color: 'from-orange-500 to-orange-600' },
      Showcases: { total: 0, count: 0, color: 'from-purple-500 to-purple-600' },
      Development: { total: 0, count: 0, color: 'from-green-500 to-green-600' },
      Other: { total: 0, count: 0, color: 'from-slate-500 to-slate-600' },
    };

    activeRegistrations.forEach((r) => {
      const name = r.clinicName.toLowerCase();
      if (name.includes('camp')) { categories.Camps.total += r.price; categories.Camps.count++; }
      else if (name.includes('tournament')) { categories.Tournaments.total += r.price; categories.Tournaments.count++; }
      else if (name.includes('showcase')) { categories.Showcases.total += r.price; categories.Showcases.count++; }
      else if (name.includes('development')) { categories.Development.total += r.price; categories.Development.count++; }
      else if (name.includes('clinic')) { categories.Clinics.total += r.price; categories.Clinics.count++; }
      else { categories.Other.total += r.price; categories.Other.count++; }
    });

    const total = Object.values(categories).reduce((sum, cat) => sum + cat.total, 0);
    return Object.entries(categories)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
        color: data.color,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [activeRegistrations]);

  // Cost per hour estimate
  const costPerHour = useMemo(() => {
    let totalHours = 0;
    activeRegistrations.forEach((r) => {
      const name = r.clinicName.toLowerCase();
      if (name.includes('camp')) totalHours += 30;
      else if (name.includes('tournament')) totalHours += 16;
      else totalHours += 9;
    });
    return totalHours > 0 ? summary.total / totalHours : 0;
  }, [activeRegistrations, summary.total]);

  // Recent transactions
  const recentTransactions = useMemo(() => {
    return [...registrations]
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      .slice(0, 10);
  }, [registrations]);

  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  const trend = useMemo(() => {
    if (monthlyData.length < 2) return 0;
    const thisMonth = monthlyData[monthlyData.length - 1].total;
    const lastMonth = monthlyData[monthlyData.length - 2].total;
    if (lastMonth === 0) return thisMonth > 0 ? 100 : 0;
    return ((thisMonth - lastMonth) / lastMonth) * 100;
  }, [monthlyData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: preferredCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Venue color palette
  const venueColors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-purple-500 to-purple-600',
    'from-amber-500 to-amber-600',
    'from-red-500 to-red-600',
    'from-cyan-500 to-cyan-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800"
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Spending</h1>
            <p className="text-sm text-slate-400">Track your hockey expenses</p>
          </div>
          <DollarSign className="w-8 h-8 text-green-400" />
        </div>
      </motion.header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-[10px] text-slate-400 uppercase">Total</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.total)}</p>
            <p className="text-[10px] text-slate-500">{summary.count} registrations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] text-slate-400 uppercase">This Month</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.thisMonth)}</p>
            {trend !== 0 && (
              <div className="flex items-center gap-1">
                {trend > 0 ? <TrendingUp className="w-3 h-3 text-red-400" /> : <TrendingDown className="w-3 h-3 text-green-400" />}
                <span className={cn('text-[10px]', trend > 0 ? 'text-red-400' : 'text-green-400')}>
                  {Math.abs(trend).toFixed(0)}% vs last
                </span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] text-slate-400 uppercase">Avg Monthly</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{formatCurrency(summary.avgMonthly)}</p>
            <p className="text-[10px] text-slate-500">Last 6 months</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-[10px] text-slate-400 uppercase">Per Hour</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">{formatCurrency(costPerHour)}</p>
            <p className="text-[10px] text-slate-500">Est. ice time</p>
          </motion.div>
        </div>

        {/* View Tabs */}
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
          {([
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'venues', label: 'By Venue', icon: MapPin },
            { key: 'sources', label: 'By Source', icon: Tag },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all',
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Monthly Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold">Monthly Breakdown</h2>
              </div>
              <div className="space-y-3">
                {monthlyData.map((month, idx) => (
                  <motion.div
                    key={month.month}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{month.monthLabel}</span>
                      <span className="font-semibold text-white">{formatCurrency(month.total)}</span>
                    </div>
                    <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(month.total / maxMonthly) * 100}%` }}
                        transition={{ delay: 0.2 + idx * 0.05, duration: 0.5 }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Category Breakdown */}
            {categoryData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base font-bold">By Category</h2>
                </div>
                <div className="space-y-3">
                  {categoryData.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-medium">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{cat.count}</span>
                          <span className="font-semibold text-white">{formatCurrency(cat.total)}</span>
                        </div>
                      </div>
                      <div className="relative h-5 bg-slate-800 rounded-lg overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.percentage}%` }}
                          transition={{ duration: 0.5 }}
                          className={cn('absolute inset-y-0 left-0 bg-gradient-to-r rounded-lg', cat.color)}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-white drop-shadow">
                          {cat.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Venues Tab */}
        {activeTab === 'venues' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {venueData.length === 0 ? (
              <div className="text-center py-16">
                <MapPin className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No venue spending data yet</p>
              </div>
            ) : (
              venueData.map((venue, idx) => (
                <motion.div
                  key={venue.venue}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
                >
                  {/* Venue header */}
                  <div className="p-4 border-b border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br',
                          venueColors[idx % venueColors.length]
                        )}>
                          <MapPin size={14} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{venue.venue}</h3>
                          <p className="text-[10px] text-slate-500">{venue.count} registrations</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{formatCurrency(venue.total)}</p>
                        <p className="text-[10px] text-slate-500">{venue.percentage.toFixed(0)}% of total</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 relative h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${venue.percentage}%` }}
                        transition={{ delay: 0.2 + idx * 0.05, duration: 0.5 }}
                        className={cn('absolute inset-y-0 left-0 bg-gradient-to-r rounded-full', venueColors[idx % venueColors.length])}
                      />
                    </div>
                  </div>
                  {/* Individual items */}
                  <div className="divide-y divide-slate-800/50">
                    {venue.items.map((reg) => (
                      <div key={reg.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-300">{reg.clinicName}</p>
                          <p className="text-[10px] text-slate-500">
                            {format(parseISO(reg.startDate), 'MMM d, yyyy')}
                            {reg.source !== 'manual' && (
                              <span className="ml-2 text-slate-600">via {reg.source}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs font-bold',
                            reg.status === 'confirmed' ? 'text-green-400' :
                            reg.status === 'pending' ? 'text-yellow-400' : 'text-slate-400'
                          )}>
                            {formatCurrency(reg.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {sourceData.length === 0 ? (
              <div className="text-center py-16">
                <Tag className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No spending data by source yet</p>
              </div>
            ) : (
              sourceData.map((src, idx) => (
                <motion.div
                  key={src.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-slate-400" />
                      <h3 className="text-sm font-bold text-white">{src.label}</h3>
                      <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                        {src.count} items
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">{formatCurrency(src.total)}</p>
                  </div>
                  <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${src.percentage}%` }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className={cn('absolute inset-y-0 left-0 bg-gradient-to-r rounded-full', src.color)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{src.percentage.toFixed(0)}% of total spending</p>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold">Recent Transactions</h2>
          </div>
          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-sm">No transactions yet</p>
            ) : (
              recentTransactions.map((reg) => (
                <div
                  key={reg.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all',
                    reg.status === 'confirmed' && 'bg-green-500/5 border-green-500/20',
                    reg.status === 'pending' && 'bg-yellow-500/5 border-yellow-500/20',
                    reg.status === 'waitlisted' && 'bg-blue-500/5 border-blue-500/20',
                    reg.status === 'cancelled' && 'bg-red-500/5 border-red-500/20 opacity-50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className={cn('text-xs font-semibold text-white truncate', reg.status === 'cancelled' && 'line-through')}>
                      {reg.clinicName}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{reg.venue || reg.city}</span>
                      <span>·</span>
                      <span>{format(parseISO(reg.startDate), 'MMM d')}</span>
                      {reg.source !== 'manual' && (
                        <>
                          <span>·</span>
                          <span className="text-slate-500">{reg.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className={cn(
                      'text-sm font-bold',
                      reg.status === 'confirmed' && 'text-green-400',
                      reg.status === 'pending' && 'text-yellow-400',
                      reg.status === 'waitlisted' && 'text-blue-400',
                      reg.status === 'cancelled' && 'text-red-400'
                    )}>
                      {formatCurrency(reg.price)}
                    </p>
                    <p className="text-[9px] text-slate-500 capitalize">{reg.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Empty State */}
        {registrations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <Receipt className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No spending data yet</h3>
            <p className="text-slate-500 text-sm">
              Connect IceHockeyPro or Dash to automatically track expenses, or register for clinics manually.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
