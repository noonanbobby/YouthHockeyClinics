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
} from 'lucide-react';
import { useStore } from '@/store/useStore';
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

  return (
    <motion.aside
      initial={{ x: -240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col z-40"
      style={{
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--theme-card-border)',
        boxShadow: '1px 0 8px rgba(0,0,0,0.03)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' }}
          >
            &#127954;
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight" style={{ color: 'var(--theme-text)' }}>
              Noonan Hockey
            </h1>
            <p className="text-[10px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
              Youth Hockey Clinics
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                color: active ? 'var(--theme-primary)' : '#475569',
                backgroundColor: active
                  ? 'color-mix(in srgb, var(--theme-primary) 8%, #ffffff)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#475569';
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
              <item.icon size={18} strokeWidth={active ? 2.2 : 1.5} />
              <span>{item.label}</span>

              {item.label === 'Alerts' && unreadCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5">
                  {unreadCount}
                </span>
              )}

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

      {/* Footer branding */}
      <div
        className="px-5 py-4"
        style={{ borderTop: '1px solid var(--theme-card-border)' }}
      >
        <p className="text-[10px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
          Powered by AI search
        </p>
      </div>
    </motion.aside>
  );
}
