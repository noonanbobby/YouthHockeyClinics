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
} from 'lucide-react';
import { useMemo } from 'react';

interface MonthlyData {
  month: string;
  monthLabel: string;
  total: number;
  count: number;
}


export default function SpendingPage() {
  const router = useRouter();
  const registrations = useStore((state) => state.registrations);
  const preferredCurrency = useStore((state) => state.preferredCurrency);

  // Filter out cancelled registrations for spending calculations
  const activeRegistrations = useMemo(
    () => registrations.filter((r) => r.status !== 'cancelled'),
    [registrations]
  );

  // Calculate summary stats
  const summary = useMemo(() => {
    const total = activeRegistrations.reduce((sum, r) => sum + r.price, 0);
    const count = activeRegistrations.length;
    const average = count > 0 ? total / count : 0;

    // This month's spend
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonth = activeRegistrations
      .filter((r) => {
        const regDate = parseISO(r.registeredAt);
        return isAfter(regDate, thisMonthStart);
      })
      .reduce((sum, r) => sum + r.price, 0);

    // Average monthly spend (last 6 months)
    const sixMonthsAgo = startOfMonth(subMonths(now, 6));
    const recentRegs = activeRegistrations.filter((r) => {
      const regDate = parseISO(r.registeredAt);
      return isAfter(regDate, sixMonthsAgo);
    });
    const recentTotal = recentRegs.reduce((sum, r) => sum + r.price, 0);
    const avgMonthly = recentTotal / 6;

    return { total, count, average, thisMonth, avgMonthly };
  }, [activeRegistrations]);

  // Calculate monthly breakdown (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: MonthlyData[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthKey = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM');

      const monthRegs = activeRegistrations.filter((r) => {
        const regDate = parseISO(r.registeredAt);
        return format(regDate, 'yyyy-MM') === monthKey;
      });

      const total = monthRegs.reduce((sum, r) => sum + r.price, 0);

      months.push({
        month: monthKey,
        monthLabel,
        total,
        count: monthRegs.length,
      });
    }

    return months;
  }, [activeRegistrations]);

  // Calculate category breakdown (based on clinic type from registration source)
  const categoryData = useMemo(() => {
    // We'll infer categories from clinic names and sources
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
      if (name.includes('camp')) {
        categories.Camps.total += r.price;
        categories.Camps.count++;
      } else if (name.includes('tournament')) {
        categories.Tournaments.total += r.price;
        categories.Tournaments.count++;
      } else if (name.includes('showcase')) {
        categories.Showcases.total += r.price;
        categories.Showcases.count++;
      } else if (name.includes('development')) {
        categories.Development.total += r.price;
        categories.Development.count++;
      } else if (name.includes('clinic')) {
        categories.Clinics.total += r.price;
        categories.Clinics.count++;
      } else {
        categories.Other.total += r.price;
        categories.Other.count++;
      }
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

  // Calculate cost per hour insight
  const costPerHour = useMemo(() => {
    // Estimate: average clinic is 3 hours per day for 3 days = 9 hours
    // Camps are typically 5 days x 6 hours = 30 hours
    // Tournaments are typically 2 days x 8 hours = 16 hours
    let totalHours = 0;

    activeRegistrations.forEach((r) => {
      const name = r.clinicName.toLowerCase();
      if (name.includes('camp')) {
        totalHours += 30; // 5 days x 6 hours
      } else if (name.includes('tournament')) {
        totalHours += 16; // 2 days x 8 hours
      } else {
        totalHours += 9; // 3 days x 3 hours
      }
    });

    return totalHours > 0 ? summary.total / totalHours : 0;
  }, [activeRegistrations, summary.total]);

  // Recent transactions (last 10)
  const recentTransactions = useMemo(() => {
    return [...registrations]
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      .slice(0, 10);
  }, [registrations]);

  // Get max value for bar chart scaling
  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  // Trend indicator
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-sm text-slate-400">Total Spent</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{formatCurrency(summary.total)}</p>
            <p className="text-xs text-slate-500 mt-1">{summary.count} registrations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">This Month</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">{formatCurrency(summary.thisMonth)}</p>
            {trend !== 0 && (
              <div className="flex items-center gap-1 mt-1">
                {trend > 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-green-400" />
                )}
                <span className={cn('text-xs', trend > 0 ? 'text-red-400' : 'text-green-400')}>
                  {Math.abs(trend).toFixed(0)}% vs last month
                </span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-slate-400">Avg Monthly</span>
            </div>
            <p className="text-3xl font-bold text-purple-400">{formatCurrency(summary.avgMonthly)}</p>
            <p className="text-xs text-slate-500 mt-1">Last 6 months</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-slate-400">Cost per Hour</span>
            </div>
            <p className="text-3xl font-bold text-orange-400">{formatCurrency(costPerHour)}</p>
            <p className="text-xs text-slate-500 mt-1">Estimated ice time</p>
          </motion.div>
        </div>

        {/* Monthly Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold">Monthly Breakdown</h2>
          </div>

          <div className="space-y-4">
            {monthlyData.map((month, idx) => (
              <motion.div
                key={month.month}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.05 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{month.monthLabel}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{month.count} registrations</span>
                    <span className="font-semibold text-white">{formatCurrency(month.total)}</span>
                  </div>
                </div>
                <div className="relative h-8 bg-slate-800 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(month.total / maxMonthly) * 100}%` }}
                    transition={{ delay: 0.7 + idx * 0.05, duration: 0.5 }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg"
                  />
                  {month.total > 0 && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-semibold text-white drop-shadow-lg">
                        {formatCurrency(month.total)}
                      </span>
                    </div>
                  )}
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
            transition={{ delay: 0.8 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold">Category Breakdown</h2>
            </div>

            <div className="space-y-4">
              {categoryData.map((cat, idx) => (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + idx * 0.05 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{cat.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{cat.count} events</span>
                      <span className="font-semibold text-white">{formatCurrency(cat.total)}</span>
                    </div>
                  </div>
                  <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ delay: 1.0 + idx * 0.05, duration: 0.5 }}
                      className={cn('absolute inset-y-0 left-0 bg-gradient-to-r rounded-lg', cat.color)}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs font-semibold text-white drop-shadow-lg">
                        {cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Receipt className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold">Recent Transactions</h2>
          </div>

          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No transactions yet</p>
            ) : (
              recentTransactions.map((reg, idx) => (
                <motion.div
                  key={reg.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + idx * 0.03 }}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border transition-all',
                    reg.status === 'confirmed' && 'bg-green-500/5 border-green-500/20',
                    reg.status === 'pending' && 'bg-yellow-500/5 border-yellow-500/20',
                    reg.status === 'waitlisted' && 'bg-blue-500/5 border-blue-500/20',
                    reg.status === 'cancelled' && 'bg-red-500/5 border-red-500/20 opacity-50'
                  )}
                >
                  <div className="flex-1">
                    <h3
                      className={cn(
                        'font-semibold text-white',
                        reg.status === 'cancelled' && 'line-through'
                      )}
                    >
                      {reg.clinicName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                      <span>{reg.city}</span>
                      <span>•</span>
                      <span>{format(parseISO(reg.startDate), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-lg font-bold',
                          reg.status === 'confirmed' && 'text-green-400',
                          reg.status === 'pending' && 'text-yellow-400',
                          reg.status === 'waitlisted' && 'text-blue-400',
                          reg.status === 'cancelled' && 'text-red-400'
                        )}
                      >
                        {formatCurrency(reg.price)}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{reg.status}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Empty State */}
        {registrations.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-16"
          >
            <Receipt className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No spending data yet</h3>
            <p className="text-slate-500">
              Register for clinics and camps to start tracking your hockey expenses
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
