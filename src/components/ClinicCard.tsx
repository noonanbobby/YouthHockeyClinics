'use client';

import { Clinic } from '@/types';
import { formatDateRange, formatPrice, getClinicTypeLabel, getClinicTypeColor, getSpotsColor, getCountryFlag, cn, timeUntil } from '@/lib/utils';
import { Calendar, MapPin, Users, Star, Heart, Clock, ChevronRight, Video } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface ClinicCardProps {
  clinic: Clinic;
  index: number;
}

export default function ClinicCard({ clinic, index }: ClinicCardProps) {
  const { toggleFavorite, isFavorite, liveBarnConfig } = useStore();
  const router = useRouter();
  const fav = isFavorite(clinic.id);

  // Check if this clinic's venue has a LiveBarn stream
  const hasLiveStream = clinic.hasLiveStream || (
    liveBarnConfig.connected &&
    liveBarnConfig.venues.some(
      (v) => v.isLive && clinic.location.venue.toLowerCase().includes(v.name.toLowerCase().split(' ')[0])
    )
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => router.push(`/clinic/${clinic.id}`)}
      className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl overflow-hidden border border-white/5 hover:theme-border-primary transition-all duration-300 cursor-pointer active:scale-[0.98]"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={clinic.imageUrl}
          alt={clinic.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={cn('px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border', getClinicTypeColor(clinic.type))}>
            {getClinicTypeLabel(clinic.type)}
          </span>
          {clinic.isNew && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              New
            </span>
          )}
          {clinic.featured && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Featured
            </span>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(clinic.id);
          }}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 transition-all active:scale-90"
        >
          <Heart
            size={18}
            className={cn(
              'transition-all',
              fav ? 'fill-red-500 text-red-500' : 'text-white/80'
            )}
          />
        </button>

        {/* Live Stream Badge */}
        {hasLiveStream && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <Video size={10} className="text-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Live</span>
          </div>
        )}

        {/* Rating */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          <span className="text-xs font-semibold text-white">{clinic.rating}</span>
          <span className="text-[10px] text-slate-400">({clinic.reviewCount})</span>
        </div>

        {/* Country flag */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
          <span className="text-sm">{getCountryFlag(clinic.location.countryCode)}</span>
          <span className="text-xs font-medium text-white">{clinic.location.country}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-bold text-white mb-1 line-clamp-1 group-hover:theme-primary transition-colors">
          {clinic.name}
        </h3>
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{clinic.description}</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin size={13} className="theme-primary shrink-0" />
            <span className="text-xs truncate">{clinic.location.venue}, {clinic.location.city}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar size={13} className="theme-primary shrink-0" />
            <span className="text-xs">{formatDateRange(clinic.dates.start, clinic.dates.end)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock size={13} className="theme-primary shrink-0" />
            <span className="text-xs">{clinic.duration} &middot; Starts {timeUntil(clinic.dates.start)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <div>
            <span className="text-lg font-bold text-white">{formatPrice(clinic.price.amount, clinic.price.currency)}</span>
            {clinic.price.earlyBird && (
              <span className="ml-1.5 text-[10px] text-emerald-400 font-medium">
                Early bird available
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Users size={13} className={getSpotsColor(clinic.spotsRemaining, clinic.maxParticipants)} />
              <span className={cn('text-xs font-semibold', getSpotsColor(clinic.spotsRemaining, clinic.maxParticipants))}>
                {clinic.spotsRemaining} spots
              </span>
            </div>
            <ChevronRight size={16} className="text-slate-500" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
