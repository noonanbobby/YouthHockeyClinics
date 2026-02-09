'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { ArrowLeft, BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

type NotifFilter = 'all' | 'new_clinic' | 'spots_low' | 'price_drop' | 'reminder' | 'registration_reminder' | 'child_match';

const FILTER_LABELS: Record<NotifFilter, string> = {
  all: 'All',
  new_clinic: 'New Clinics',
  child_match: 'Player Matches',
  registration_reminder: 'Reminders',
  spots_low: 'Spots Low',
  price_drop: 'Price Drops',
  reminder: 'General',
};

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useStore();
  const router = useRouter();
  const [filter, setFilter] = useState<NotifFilter>('all');

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  // Count by type for filter badges
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<NotifFilter, number>> = {};
    for (const n of notifications) {
      counts[n.type as NotifFilter] = (counts[n.type as NotifFilter] || 0) + 1;
    }
    return counts;
  }, [notifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_clinic':
        return '🏒';
      case 'spots_low':
        return '🔥';
      case 'price_drop':
        return '💰';
      case 'reminder':
        return '📢';
      case 'registration_reminder':
        return '⏰';
      case 'child_match':
        return '⭐';
      default:
        return '📢';
    }
  };

  const getAccentColor = (type: string) => {
    switch (type) {
      case 'new_clinic':
        return { bg: 'bg-sky-50', border: 'border-sky-200', dot: 'bg-sky-500' };
      case 'spots_low':
        return { bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' };
      case 'price_drop':
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
      case 'registration_reminder':
        return { bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' };
      case 'child_match':
        return { bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' };
      default:
        return { bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400' };
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="safe-area-top" />
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--theme-surface)' }}
            >
              <ArrowLeft size={18} className="theme-text-secondary" />
            </button>
            <div>
              <h1 className="text-xl font-bold theme-text">Alerts</h1>
              <p className="text-xs theme-text-secondary">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
                color: 'var(--theme-primary)',
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        {notifications.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 scrollbar-hide">
            {(Object.keys(FILTER_LABELS) as NotifFilter[]).map((key) => {
              if (key !== 'all' && !typeCounts[key]) return null;
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 text-[11px] font-medium rounded-full border transition-colors',
                    isActive
                      ? 'border-transparent'
                      : 'theme-text-secondary'
                  )}
                  style={isActive ? {
                    backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--theme-primary) 30%, transparent)',
                    color: 'var(--theme-primary)',
                  } : {
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-card-border)',
                  }}
                >
                  {FILTER_LABELS[key]}
                  {key !== 'all' && typeCounts[key] && (
                    <span className="ml-1 text-[9px] opacity-60">({typeCounts[key]})</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BellOff size={48} className="theme-text-muted mb-4" />
            <h3 className="text-lg font-bold theme-text mb-2">
              {filter === 'all' ? 'No Alerts Yet' : `No ${FILTER_LABELS[filter]}`}
            </h3>
            <p className="text-sm theme-text-secondary text-center max-w-xs">
              {filter === 'all'
                ? "You'll receive alerts when new clinics are discovered, spots are running low, or prices drop."
                : 'No notifications of this type yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-24">
            {filteredNotifications.map((notif, i) => {
              const accent = getAccentColor(notif.type);
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    markAsRead(notif.id);
                    if (notif.clinicId) {
                      router.push(`/clinic/${notif.clinicId}`);
                    }
                  }}
                  className={cn(
                    'relative p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98]',
                    notif.read
                      ? ''
                      : `${accent.bg} ${accent.border}`
                  )}
                  style={notif.read ? {
                    backgroundColor: 'var(--theme-card-bg)',
                    borderColor: 'var(--theme-card-border)',
                  } : undefined}
                >
                  {!notif.read && (
                    <div className={cn('absolute top-4 right-4 w-2 h-2 rounded-full', accent.dot)} />
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getIcon(notif.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold', notif.read ? 'theme-text-secondary' : 'theme-text')}>
                        {notif.title}
                      </p>
                      <p className="text-xs theme-text-secondary mt-0.5 line-clamp-2">{notif.body}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-[10px] theme-text-muted">
                          {formatDistanceToNow(parseISO(notif.timestamp), { addSuffix: true })}
                        </p>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded theme-text-muted"
                          style={{ backgroundColor: 'var(--theme-surface)' }}
                        >
                          {notif.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
