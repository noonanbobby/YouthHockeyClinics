'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Compass, Map, CalendarCheck, Heart, Menu } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';

const navItems = [
  { icon: Compass, label: 'Explore', href: '/', matchExact: true },
  { icon: Map, label: 'Map', href: '/?view=map', matchParam: 'map' },
  { icon: CalendarCheck, label: 'My Clinics', href: '/registrations' },
  { icon: Heart, label: 'Favorites', href: '/favorites' },
  { icon: Menu, label: 'More', href: '/settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { viewMode, setViewMode } = useStore();

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.matchParam === 'map') return pathname === '/' && viewMode === 'map';
    if (item.matchExact) return pathname === '/' && viewMode === 'list';
    return pathname === item.href;
  };

  const isMoreActive = ['/settings', '/integrations', '/spending', '/notifications', '/admin'].includes(pathname);

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
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t safe-area-bottom"
      style={{
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        boxShadow: '0 -1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const active = item.label === 'More' ? isMoreActive : isActive(item);
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className="relative flex flex-col items-center justify-center w-16 h-full gap-0.5 transition-colors"
              style={{ color: active ? 'var(--theme-primary)' : '#94a3b8' }}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-3 right-3 h-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <item.icon size={22} strokeWidth={active ? 2.2 : 1.5} />
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
