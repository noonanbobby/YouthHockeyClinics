'use client';

import { useStore } from '@/store/useStore';
import { ArrowLeft, BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useStore();
  const router = useRouter();

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_clinic':
        return '🏒';
      case 'spots_low':
        return '🔥';
      case 'price_drop':
        return '💰';
      case 'reminder':
        return '⏰';
      default:
        return '📢';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="safe-area-top" />
      <div className="px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5"
            >
              <ArrowLeft size={18} className="text-slate-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Alerts</h1>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 text-sky-400 text-xs font-medium rounded-full"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BellOff size={48} className="text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Alerts Yet</h3>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              You&apos;ll receive alerts when new clinics are discovered, spots are running low, or
              prices drop.
            </p>
          </div>
        ) : (
          <div className="space-y-2 pb-24">
            {notifications.map((notif, i) => (
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
                className={`relative p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.98] ${
                  notif.read
                    ? 'bg-white/[0.02] border-white/5'
                    : 'bg-sky-500/5 border-sky-500/20'
                }`}
              >
                {!notif.read && (
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-sky-400" />
                )}
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.body}</p>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      {formatDistanceToNow(parseISO(notif.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
