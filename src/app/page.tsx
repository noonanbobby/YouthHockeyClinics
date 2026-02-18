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
    <div className="flex h-[calc(100vh-220px)] items-center justify-center bg-slate-900">
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
    <main className="min-h-screen bg-slate-900">
      <Header />

      <div>
        {/* Desktop: Airbnb-style side-by-side split */}
        <div className={cn('lg:flex', viewMode === 'list' && 'lg:flex-row')}>

          {/* List panel — scrollable on desktop */}
          {viewMode === 'list' && (
            <div className="w-full pb-20 lg:h-[calc(100vh-140px)] lg:w-1/2 lg:overflow-y-auto lg:pb-0">
              <ListView />
            </div>
          )}

          {/* Map panel — sticky on desktop, full-screen on mobile */}
          <div
            className={cn(
              viewMode === 'map'
                ? 'w-full'
                : 'hidden lg:sticky lg:top-[140px] lg:block lg:h-[calc(100vh-140px)] lg:w-1/2',
            )}
          >
            <MapView />
          </div>
        </div>
      </div>

      <SearchOverlay />
      <FilterSheet />
    </main>
  );
}
