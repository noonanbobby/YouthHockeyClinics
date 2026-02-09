'use client';

import { useStore } from '@/store/useStore';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { useNotificationEngine } from '@/hooks/useNotificationEngine';
import Header from '@/components/Header';
import ListView from '@/components/ListView';
import SearchOverlay from '@/components/SearchOverlay';
import FilterSheet from '@/components/FilterSheet';
import { HockeyLoadingScreen } from '@/components/HockeyLoader';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-220px)]" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <HockeyLoadingScreen message="Loading map..." />
    </div>
  ),
});

export default function Home() {
  const { viewMode } = useStore();

  useServiceWorker();
  useClinicSearch();
  useNotificationEngine();

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <Header />
      <div>
        {/* Desktop: side-by-side Airbnb-style split */}
        <div className={cn(
          'lg:flex',
          viewMode === 'list' ? 'lg:flex-row' : ''
        )}>
          {/* List panel — scrollable */}
          {viewMode === 'list' && (
            <div className="w-full lg:w-1/2 pb-20 lg:pb-0 lg:overflow-y-auto lg:h-[calc(100vh-140px)]">
              <ListView />
            </div>
          )}

          {/* Map panel — sticky */}
          <div className={cn(
            viewMode === 'map'
              ? 'w-full'
              : 'hidden lg:block lg:w-1/2 lg:h-[calc(100vh-140px)] lg:sticky lg:top-[140px]'
          )}>
            <MapView />
          </div>
        </div>
      </div>
      <SearchOverlay />
      <FilterSheet />
    </main>
  );
}
