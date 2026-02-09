'use client';

import { Clinic } from '@/types';
import { formatDateRange, formatPrice, getClinicTypeLabel, getSpotsColor, getCountryFlag, cn, timeUntil } from '@/lib/utils';
import { Calendar, MapPin, Users, Star, Heart, Clock, ChevronRight, Video, Award } from 'lucide-react';
import { useStore, getAgeGroupFromDOB } from '@/store/useStore';
import { calculateDistance } from '@/lib/geocoder';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface ClinicCardProps {
  clinic: Clinic;
  index: number;
}

const TYPE_ICONS: Record<string, string> = {
  camp: '🏕️',
  clinic: '🏒',
  tournament: '🏆',
  showcase: '⭐',
  development: '📚',
};

export default function ClinicCard({ clinic, index }: ClinicCardProps) {
  const {
    toggleFavorite,
    isFavorite,
    liveBarnConfig,
    getEffectiveLocation,
    childProfiles,
    activeChildIds,
  } = useStore();
  const router = useRouter();
  const fav = isFavorite(clinic.id);

  const hasLiveStream = clinic.hasLiveStream || (
    liveBarnConfig.connected &&
    liveBarnConfig.venues.some(
      (v) => v.isLive && clinic.location.venue.toLowerCase().includes(v.name.toLowerCase().split(' ')[0])
    )
  );

  const hasImage = clinic.imageUrl && clinic.imageUrl.length > 5;

  // Distance from user
  const userLoc = getEffectiveLocation();
  let distanceLabel = '';
  if (userLoc && clinic.location.lat !== 0 && clinic.location.lng !== 0) {
    const km = calculateDistance(userLoc.lat, userLoc.lng, clinic.location.lat, clinic.location.lng);
    const mi = km * 0.621371;
    distanceLabel = mi < 100 ? `${Math.round(mi)} mi` : `${Math.round(mi).toLocaleString()} mi`;
  }

  // Child age group match — check all active children
  const activeChildren = childProfiles.filter((c) => activeChildIds.includes(c.id));
  const matchingChildren = activeChildren.filter((child) => {
    const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
    return clinic.ageGroups.includes(ag) || clinic.ageGroups.includes('all');
  });
  const isAgeMatch = matchingChildren.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.5) }}
      onClick={() => router.push(`/clinic/${clinic.id}`)}
      className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-[var(--theme-primary)]/30 transition-all duration-300 cursor-pointer active:scale-[0.98]"
      style={{ backgroundColor: 'var(--theme-card-bg, rgba(15,23,42,0.8))' }}
    >
      {/* Top accent strip */}
      <div className="relative h-3">
        <div className="absolute inset-0 opacity-80" style={{
          backgroundImage: `linear-gradient(to right, var(--theme-primary), var(--theme-secondary))`
        }} />
      </div>

      {/* Image */}
      {hasImage && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={clinic.imageUrl}
            alt={clinic.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
      )}

      {/* Card Body */}
      <div className="p-4">
        {/* Top row: badges */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, transparent)',
                color: 'var(--theme-accent)',
              }}>
              {TYPE_ICONS[clinic.type] || '🏒'} {getClinicTypeLabel(clinic.type)}
            </span>
            {clinic.featured && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400">
                <Award size={9} /> Featured
              </span>
            )}
            {clinic.isNew && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
                New
              </span>
            )}
            {isAgeMatch && matchingChildren.length > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-300">
                Fits {matchingChildren.map((c) => c.name).join(' & ')}
              </span>
            )}
            {hasLiveStream && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <Video size={9} /> Live
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(clinic.id);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shrink-0"
          >
            <Heart
              size={16}
              className={cn('transition-all', fav ? 'fill-red-500 text-red-500' : 'text-white/40')}
            />
          </button>
        </div>

        {/* Clinic Name */}
        <h3 className="text-[15px] font-bold text-white mb-1 leading-tight line-clamp-2">
          {clinic.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">{clinic.description}</p>

        {/* Info rows */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={12} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="text-xs text-slate-300 truncate">
              {clinic.location.venue !== 'Venue TBD' && clinic.location.venue !== 'Multiple Locations'
                ? `${clinic.location.venue}, `
                : ''}
              {clinic.location.city}{clinic.location.state ? `, ${clinic.location.state}` : ''}
            </span>
            {distanceLabel && (
              <span className="text-[10px] font-medium text-slate-500 shrink-0">{distanceLabel}</span>
            )}
            <span className="ml-auto text-sm shrink-0">{getCountryFlag(clinic.location.countryCode)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={12} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="text-xs text-slate-300">{formatDateRange(clinic.dates.start, clinic.dates.end)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="text-xs text-slate-300">{clinic.duration}</span>
            <span className="text-[10px] text-slate-500 ml-1">{timeUntil(clinic.dates.start)}</span>
          </div>
        </div>

        {/* Footer: Price + Rating + Spots */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold" style={{ color: 'var(--theme-accent)' }}>
              {clinic.price.amount > 0 ? formatPrice(clinic.price.amount, clinic.price.currency) : 'Free'}
            </span>
            {clinic.rating > 0 && (
              <div className="flex items-center gap-0.5">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-slate-300">{clinic.rating}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Users size={12} className={getSpotsColor(clinic.spotsRemaining, clinic.maxParticipants)} />
              <span className={cn('text-[11px] font-medium', getSpotsColor(clinic.spotsRemaining, clinic.maxParticipants))}>
                {clinic.spotsRemaining} left
              </span>
            </div>
            <ChevronRight size={14} className="text-slate-600" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
