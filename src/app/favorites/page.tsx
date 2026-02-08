'use client';

import { useStore } from '@/store/useStore';
import ClinicCard from '@/components/ClinicCard';
import { Heart, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FavoritesPage() {
  const { clinics, favoriteIds } = useStore();
  const router = useRouter();

  const favoriteClinics = clinics.filter((c) => favoriteIds.includes(c.id));

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="safe-area-top" />
      <div className="px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5"
          >
            <ArrowLeft size={18} className="text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Saved Clinics</h1>
            <p className="text-xs text-slate-400">{favoriteClinics.length} saved</p>
          </div>
        </div>

        {favoriteClinics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Heart size={48} className="text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Saved Clinics</h3>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              Tap the heart icon on any clinic to save it here for quick access.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {favoriteClinics.map((clinic, i) => (
              <ClinicCard key={clinic.id} clinic={clinic} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
