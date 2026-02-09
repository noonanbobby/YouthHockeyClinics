'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  List,
  Map,
  CalendarCheck,
  Heart,
  DollarSign,
  Link2,
  Bell,
  Settings,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';

const navItems = [
  { href: '/', icon: List, label: 'Explore', matchExact: true },
  { href: '/?view=map', icon: Map, label: 'Map', matchParam: 'map' },
  { href: '/registrations', icon: CalendarCheck, label: 'My Clinics' },
  { href: '/favorites', icon: Heart, label: 'Favorites' },
  { href: '/spending', icon: DollarSign, label: 'Spending' },
  { href: '/integrations', icon: Link2, label: 'Integrations' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { viewMode, setViewMode, unreadCount, registrations } = useStore();
  const { theme, setTheme } = useTheme();

  const upcomingCount = registrations.filter(
    (r) => r.status !== 'cancelled' && r.endDate >= new Date().toISOString().split('T')[0]
  ).length;

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.matchParam === 'map') return viewMode === 'map' && pathname === '/';
    if (item.matchExact) return pathname === '/' && viewMode === 'list';
    return pathname === item.href;
  };

  const handleNav = (item: (typeof navItems)[0]) => {
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

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <motion.aside
      initial={{ x: -240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col z-40"
      style={{
        backgroundColor: 'var(--theme-nav-bg)',
        borderRight: '1px solid var(--theme-card-border)',
      }}
    >
      {/* Logo / App Name — arena spotlight effect */}
      <div className="px-5 pt-7 pb-5 arena-spotlight">
        <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--theme-primary)' }}>
          <span className="mr-2">&#127954;</span>
          Noonan Hockey
        </h1>
        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--theme-text-muted)' }}>
          Youth Hockey Clinics
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group"
              style={{
                color: active ? 'var(--theme-primary)' : 'var(--theme-text-secondary)',
                backgroundColor: active
                  ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor =
                    'color-mix(in srgb, var(--theme-primary) 5%, transparent)';
                  e.currentTarget.style.color = 'var(--theme-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--theme-text-secondary)';
                }
              }}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <item.icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              <span>{item.label}</span>

              {/* Badge for Alerts */}
              {item.label === 'Alerts' && unreadCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5">
                  {unreadCount}
                </span>
              )}

              {/* Badge for My Clinics */}
              {item.label === 'My Clinics' && upcomingCount > 0 && (
                <span
                  className="ml-auto min-w-[20px] h-5 flex items-center justify-center text-white text-[11px] font-bold rounded-full px-1.5"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                  {upcomingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle at Bottom */}
      <div
        className="px-4 py-4 mt-auto"
        style={{ borderTop: '1px solid var(--theme-card-border)' }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-wider mb-2 px-1"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          Theme
        </p>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
                style={{
                  color: isSelected ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--theme-primary) 12%, var(--theme-card-bg))'
                    : 'transparent',
                }}
              >
                <opt.icon size={14} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.aside>
  );
}
