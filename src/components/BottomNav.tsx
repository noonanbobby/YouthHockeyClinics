'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Map, List, Bell, CalendarCheck, Settings } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const navItems = [
  { href: '/', icon: List, label: 'Explore', matchExact: true },
  { href: '/?view=map', icon: Map, label: 'Map', matchParam: 'map' },
  { href: '/registrations', icon: CalendarCheck, label: 'My Clinics' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/settings', icon: Settings, label: 'More' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { viewMode, setViewMode, unreadCount, registrations } = useStore();

  const upcomingCount = registrations.filter(
    (r) => r.status !== 'cancelled' && r.endDate >= new Date().toISOString().split('T')[0]
  ).length;

  const isActive = (item: typeof navItems[0]) => {
    if (item.matchParam === 'map') return viewMode === 'map' && pathname === '/';
    if (item.matchExact) return pathname === '/' && viewMode === 'list';
    return pathname === item.href;
  };

  const handleNav = (item: typeof navItems[0]) => {
    if (item.matchParam === 'map') {
      if (pathname !== '/') router.push('/');
      setViewMode('map');
      return;
    }
    if (item.matchExact) {
      if (pathname !== '/') router.push('/');
      setViewMode('list');
      return;
    }
    router.push(item.href);
  };

  const isMoreActive = pathname === '/settings' || pathname === '/integrations' ||
    pathname === '/spending' || pathname === '/favorites';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t safe-area-bottom lg:hidden"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--theme-nav-bg) 95%, transparent)',
        borderColor: 'var(--theme-card-border)',
      }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const active = item.label === 'More' ? isMoreActive : isActive(item);
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className="relative flex flex-col items-center justify-center w-16 h-full gap-0.5 transition-colors"
              style={{ color: active ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-3 right-3 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative">
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                {item.label === 'Alerts' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount}
                  </span>
                )}
                {item.label === 'My Clinics' && upcomingCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center theme-bg-primary text-white text-[10px] font-bold rounded-full px-1">
                    {upcomingCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px]', active ? 'font-semibold' : 'font-medium')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
