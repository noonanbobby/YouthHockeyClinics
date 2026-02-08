'use client';

import { useStore } from '@/store/useStore';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useClinicSearch } from '@/hooks/useClinicSearch';
import { useNotificationEngine } from '@/hooks/useNotificationEngine';
import Header from '@/components/Header';
import ListView from '@/components/ListView';
import SearchOverlay from '@/components/SearchOverlay';
import FilterSheet from '@/components/FilterSheet';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-180px)] bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const { viewMode } = useStore();

  useServiceWorker();
  useClinicSearch();
  useNotificationEngine();

  return (
    <main className="min-h-screen bg-slate-950">
      <Header />
      {viewMode === 'list' ? <ListView /> : <MapView />}
      <SearchOverlay />
      <FilterSheet />
    </main>
  );
}
