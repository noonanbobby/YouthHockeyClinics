'use client';

import { Clinic } from '@/types';
import { formatDateRange, formatPrice, getClinicTypeLabel, getSpotsColor, getCountryFlag, cn, timeUntil } from '@/lib/utils';
import { Calendar, MapPin, Users, Star, Heart, Clock, ChevronRight, Award, AlertTriangle } from 'lucide-react';
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
    getEffectiveLocation,
    childProfiles,
    activeChildIds,
    registrations,
  } = useStore();
  const router = useRouter();
  const fav = isFavorite(clinic.id);

  // Distance from user
  const userLoc = getEffectiveLocation();
  let distanceLabel = '';
  if (userLoc && clinic.location.lat !== 0 && clinic.location.lng !== 0) {
    const km = calculateDistance(userLoc.lat, userLoc.lng, clinic.location.lat, clinic.location.lng);
    const mi = km * 0.621371;
    distanceLabel = mi < 100 ? `${Math.round(mi)} mi` : `${Math.round(mi).toLocaleString()} mi`;
  }

  // Child age group match
  const activeChildren = childProfiles.filter((c) => activeChildIds.includes(c.id));
  const matchingChildren = activeChildren.filter((child) => {
    const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
    return clinic.ageGroups.includes(ag) || clinic.ageGroups.includes('all');
  });
  const isAgeMatch = matchingChildren.length > 0;

  // Schedule overlap detection
  const activeRegs = registrations.filter((r) => r.status !== 'cancelled');
  const overlappingRegs = activeRegs.filter((r) => {
    return clinic.dates.start <= r.endDate && r.startDate <= clinic.dates.end;
  });
  const hasOverlap = overlappingRegs.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      onClick={() => router.push(`/clinic/${clinic.id}`)}
      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.995]"
      style={{
        backgroundColor: 'var(--theme-card-bg)',
        border: '1px solid var(--theme-card-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* Team-colored left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 z-10"
        style={{ background: 'linear-gradient(180deg, var(--theme-primary), var(--theme-secondary))' }}
      />

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1px var(--theme-primary), 0 0 20px color-mix(in srgb, var(--theme-primary) 15%, transparent)' }}
      />

      <div className="relative pl-5 pr-4 py-4 lg:pl-6 lg:pr-5 lg:py-5">
        {/* Row 1: Type badge + countdown + favorite */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, transparent)',
                color: 'var(--theme-accent)',
              }}
            >
              {TYPE_ICONS[clinic.type] || '🏒'} {getClinicTypeLabel(clinic.type)}
            </span>
            {clinic.featured && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400">
                <Award size={12} /> Featured
              </span>
            )}
            {clinic.isNew && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400">
                New
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
              {timeUntil(clinic.dates.start)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(clinic.id);
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 8%, transparent)' }}
            >
              <Heart
                size={18}
                className={cn('transition-all', fav ? 'fill-red-500 text-red-500 scale-110' : '')}
                style={!fav ? { color: 'var(--theme-text-muted)' } : undefined}
              />
            </button>
          </div>
        </div>

        {/* Title — large and bold */}
        <h3
          className="text-lg lg:text-xl font-bold leading-tight line-clamp-2 mb-1"
          style={{ color: 'var(--theme-text)' }}
        >
          {clinic.name}
        </h3>

        {/* Venue name */}
        {clinic.location.venue && clinic.location.venue !== 'Venue TBD' && clinic.location.venue !== 'Multiple Locations' && (
          <p className="text-sm mb-2" style={{ color: 'var(--theme-text-muted)' }}>
            at {clinic.location.venue}
          </p>
        )}

        {/* Description */}
        {clinic.description && (
          <p
            className="text-sm leading-relaxed line-clamp-2 mb-4"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            {clinic.description}
          </p>
        )}

        {/* Key info rows */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
              {clinic.location.city}{clinic.location.state ? `, ${clinic.location.state}` : ''}
            </span>
            {distanceLabel && (
              <span
                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--theme-primary) 12%, transparent)',
                  color: 'var(--theme-primary)',
                }}
              >
                {distanceLabel}
              </span>
            )}
            <span className="text-base shrink-0">{getCountryFlag(clinic.location.countryCode)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={16} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
              {formatDateRange(clinic.dates.start, clinic.dates.end)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock size={16} className="shrink-0" style={{ color: 'var(--theme-primary)' }} />
            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
              {clinic.duration}
            </span>
          </div>
        </div>

        {/* Age match + overlap banners */}
        {(isAgeMatch || hasOverlap) && (
          <div className="space-y-2 mb-4">
            {isAgeMatch && matchingChildren.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
                  color: 'var(--theme-primary)',
                }}
              >
                <Users size={15} />
                Great fit for {matchingChildren.map((c) => c.name).join(' & ')}
              </div>
            )}
            {hasOverlap && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-400">
                <AlertTriangle size={15} />
                Schedule overlap with {overlappingRegs[0].clinicName}
              </div>
            )}
          </div>
        )}

        {/* Footer: Price + Rating + Spots */}
        <div
          className="flex items-center justify-between pt-4 border-t"
          style={{ borderColor: 'var(--theme-card-border)' }}
        >
          <div className="flex items-center gap-4">
            <span className="text-xl font-extrabold" style={{ color: 'var(--theme-accent)' }}>
              {clinic.price.amount > 0
                ? formatPrice(clinic.price.amount, clinic.price.currency)
                : 'Free'}
            </span>
            {clinic.rating > 0 && (
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-secondary)' }}>
                  {clinic.rating}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Users
                size={14}
                className={getSpotsColor(clinic.spotsRemaining, clinic.maxParticipants)}
              />
              <span
                className={cn(
                  'text-sm font-semibold',
                  getSpotsColor(clinic.spotsRemaining, clinic.maxParticipants)
                )}
              >
                {clinic.spotsRemaining} spots left
              </span>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--theme-primary)' }} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
