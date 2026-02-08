'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore, getAgeGroupFromDOB } from '@/store/useStore';
import { Clinic } from '@/types';
import {
  formatDateRange,
  formatPrice,
  getAgeGroupLabel,
  getSkillLevelLabel,
  getClinicTypeLabel,
  getClinicTypeColor,
  getCountryFlag,
  cn,
  timeUntil,
} from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  MapPin,
  Users,
  Star,
  Heart,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  Share2,
  Check,
  Globe,
  DollarSign,
  Award,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { calculateDistance } from '@/lib/geocoder';

export default function ClinicDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const {
    clinics,
    toggleFavorite,
    isFavorite,
    addRegistration,
    registrations,
    childProfiles,
    activeChildId,
    getEffectiveLocation,
  } = useStore();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'coaches'>('overview');
  const [showShareToast, setShowShareToast] = useState(false);
  const [showRegisteredToast, setShowRegisteredToast] = useState(false);

  useEffect(() => {
    const found = clinics.find((c) => c.id === id);
    setClinic(found || null);
  }, [clinics, id]);

  // Check if already registered
  const isRegistered = useMemo(() => {
    if (!clinic) return false;
    return registrations.some(
      (r) => r.clinicId === clinic.id && r.status !== 'cancelled'
    );
  }, [clinic, registrations]);

  // Related clinics — same region, same type, or same age group
  const relatedClinics = useMemo(() => {
    if (!clinic) return [];
    return clinics
      .filter((c) => {
        if (c.id === clinic.id) return false;
        const sameCity = c.location.city === clinic.location.city;
        const sameState = c.location.state === clinic.location.state;
        const sameType = c.type === clinic.type;
        const sameAgeGroup = c.ageGroups.some((ag) => clinic.ageGroups.includes(ag));
        return sameCity || sameState || sameType || sameAgeGroup;
      })
      .slice(0, 4);
  }, [clinic, clinics]);

  // Distance from user
  const distanceLabel = useMemo(() => {
    if (!clinic) return '';
    const userLoc = getEffectiveLocation();
    if (!userLoc || clinic.location.lat === 0) return '';
    const km = calculateDistance(userLoc.lat, userLoc.lng, clinic.location.lat, clinic.location.lng);
    const mi = km * 0.621371;
    return mi < 100 ? `${Math.round(mi)} mi away` : `${Math.round(mi).toLocaleString()} mi away`;
  }, [clinic, getEffectiveLocation]);

  // Child age group match
  const activeChild = childProfiles.find((c) => c.id === activeChildId);
  const childAgeGroup = activeChild ? getAgeGroupFromDOB(activeChild.dateOfBirth) : null;
  const isAgeMatch = clinic && childAgeGroup
    ? clinic.ageGroups.includes(childAgeGroup) || clinic.ageGroups.includes('all')
    : false;

  if (!clinic) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
          <p className="text-slate-400">Loading clinic details...</p>
        </div>
      </div>
    );
  }

  const fav = isFavorite(clinic.id);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: clinic.name,
        text: clinic.description,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    }
  };

  const handleAddToCalendar = () => {
    const start = clinic.dates.start.replace(/-/g, '');
    const end = clinic.dates.end.replace(/-/g, '');

    // Generate .ics file for maximum compatibility (iOS, Android, desktop)
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Noonan Hockey//EN',
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${clinic.name}`,
      `DESCRIPTION:${clinic.description.replace(/\n/g, '\\n')}`,
      `LOCATION:${clinic.location.venue}, ${clinic.location.city}`,
      `URL:${clinic.websiteUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clinic.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTrackRegistration = () => {
    if (isRegistered) return;
    addRegistration({
      clinicId: clinic.id,
      clinicName: clinic.name,
      venue: clinic.location.venue,
      city: clinic.location.city,
      startDate: clinic.dates.start,
      endDate: clinic.dates.end,
      price: clinic.price.amount,
      currency: clinic.price.currency,
      status: 'pending',
      source: 'manual',
      notes: '',
      playerName: activeChild?.name || '',
      childId: activeChild?.id || undefined,
    });
    setShowRegisteredToast(true);
    setTimeout(() => setShowRegisteredToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-28">
      {/* Hero Image */}
      <div className="relative h-64">
        {clinic.imageUrl ? (
          <img src={clinic.imageUrl} alt={clinic.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' }}>
            <span className="text-6xl">🏒</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 safe-area-top">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddToCalendar}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
                title="Add to Calendar"
              >
                <CalendarPlus size={18} className="text-white" />
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
              >
                <Share2 size={18} className="text-white" />
              </button>
              <button
                onClick={() => toggleFavorite(clinic.id)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
              >
                <Heart
                  size={18}
                  className={cn(fav ? 'fill-red-500 text-red-500' : 'text-white')}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="absolute bottom-4 left-4 flex gap-2 flex-wrap">
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
          {isAgeMatch && activeChild && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Fits {activeChild.name}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-2 relative z-10">
        {/* Title section */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white mb-1">{clinic.name}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400 flex-wrap">
            <span>
              {getCountryFlag(clinic.location.countryCode)} {clinic.location.city},{' '}
              {clinic.location.country}
            </span>
            {distanceLabel && (
              <span className="text-[11px] text-slate-500">{distanceLabel}</span>
            )}
            {clinic.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {clinic.rating} ({clinic.reviewCount} reviews)
              </span>
            )}
          </div>
        </div>

        {/* Quick info cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <Calendar size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-400">Dates</p>
            <p className="text-sm font-semibold text-white">
              {formatDateRange(clinic.dates.start, clinic.dates.end)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--theme-accent)' }}>
              {timeUntil(clinic.dates.start)}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <Clock size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-400">Duration</p>
            <p className="text-sm font-semibold text-white">{clinic.duration}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <DollarSign size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-400">Price</p>
            <p className="text-sm font-semibold text-white">
              {clinic.price.amount > 0
                ? formatPrice(clinic.price.amount, clinic.price.currency)
                : 'Contact for pricing'}
            </p>
            {clinic.price.earlyBird && (
              <p className="text-[10px] text-emerald-400 mt-0.5">
                Early bird: {formatPrice(clinic.price.earlyBird.amount, clinic.price.currency)}
              </p>
            )}
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <Users size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-400">Availability</p>
            <p className="text-sm font-semibold text-white">
              {clinic.spotsRemaining > 0
                ? `${clinic.spotsRemaining} spots left`
                : 'Waitlist'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">of {clinic.maxParticipants} total</p>
          </div>
        </div>

        {/* Rating section */}
        {clinic.rating > 0 && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{clinic.rating}</p>
                <div className="flex gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={12}
                      className={cn(
                        star <= Math.round(clinic.rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-600'
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-300 font-medium">
                  {clinic.reviewCount} {clinic.reviewCount === 1 ? 'review' : 'reviews'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {clinic.rating >= 4.5
                    ? 'Exceptional program'
                    : clinic.rating >= 4.0
                    ? 'Highly rated'
                    : clinic.rating >= 3.5
                    ? 'Well reviewed'
                    : 'Good option'}
                </p>
                {/* Rating bar visualization */}
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(clinic.rating / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-4">
          {(['overview', 'schedule', 'coaches'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-colors relative',
                activeTab === tab ? 'text-white' : 'text-slate-500'
              )}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="detail-tab"
                  className="absolute inset-0 rounded-lg border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--theme-primary) 30%, transparent)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">About</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {clinic.longDescription || clinic.description}
              </p>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Location</h3>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-start gap-3">
                  <MapPin size={16} style={{ color: 'var(--theme-primary)' }} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">{clinic.location.venue}</p>
                    {clinic.location.address && (
                      <p className="text-xs text-slate-400 mt-0.5">{clinic.location.address}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {clinic.location.city}
                      {clinic.location.state ? `, ${clinic.location.state}` : ''},{' '}
                      {clinic.location.country}
                    </p>
                    {distanceLabel && (
                      <p className="text-[10px] text-slate-500 mt-1">{distanceLabel}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Age groups & skill levels */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Who It&apos;s For</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Age Groups</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clinic.ageGroups.map((ag) => {
                      const matches = childAgeGroup && (ag === childAgeGroup || ag === 'all');
                      return (
                        <span
                          key={ag}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-full border',
                            matches
                              ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                              : 'border-white/10 text-slate-300'
                          )}
                          style={!matches ? {
                            backgroundColor: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)',
                            color: 'var(--theme-accent)',
                            borderColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)',
                          } : undefined}
                        >
                          {getAgeGroupLabel(ag)}
                          {matches && activeChild && (
                            <span className="ml-1 text-[9px]">({activeChild.name})</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">Skill Levels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clinic.skillLevels.map((sl) => (
                      <span
                        key={sl}
                        className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 text-xs rounded-full border border-emerald-500/20"
                      >
                        {getSkillLevelLabel(sl)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Includes */}
            {clinic.includes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">What&apos;s Included</h3>
                <div className="grid grid-cols-2 gap-2">
                  {clinic.includes.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check size={12} className="text-emerald-400 shrink-0" />
                      <span className="text-xs text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {clinic.amenities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {clinic.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-white/5 text-slate-300 text-xs rounded-full border border-white/10"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact */}
            {(clinic.contactEmail || clinic.contactPhone) && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Contact</h3>
                <div className="space-y-2">
                  {clinic.contactEmail && (
                    <a
                      href={`mailto:${clinic.contactEmail}`}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
                    >
                      <Mail size={16} style={{ color: 'var(--theme-primary)' }} />
                      <span className="text-sm text-slate-300">{clinic.contactEmail}</span>
                    </a>
                  )}
                  {clinic.contactPhone && (
                    <a
                      href={`tel:${clinic.contactPhone}`}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
                    >
                      <Phone size={16} style={{ color: 'var(--theme-primary)' }} />
                      <span className="text-sm text-slate-300">{clinic.contactPhone}</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'schedule' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {clinic.schedule.length > 0 ? (
              <div className="space-y-3">
                {clinic.schedule.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--theme-primary)' }}>{item.day}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.startTime}-{item.endTime}
                      </p>
                    </div>
                    <p className="text-sm text-slate-300">{item.activity}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Clock size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  Schedule details not yet available. Visit the clinic website for more info.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'coaches' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {clinic.coaches.length > 0 ? (
              <div className="space-y-3">
                {clinic.coaches.map((coach) => (
                  <div
                    key={coach.id}
                    className="p-4 bg-white/5 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {coach.photoUrl ? (
                        <img
                          src={coach.photoUrl}
                          alt={coach.name}
                          className="w-12 h-12 rounded-full object-cover border-2"
                          style={{ borderColor: 'color-mix(in srgb, var(--theme-primary) 30%, transparent)' }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' }}>
                          <Award size={20} style={{ color: 'var(--theme-primary)' }} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white">{coach.name}</p>
                        <p className="text-xs" style={{ color: 'var(--theme-accent)' }}>{coach.title}</p>
                      </div>
                    </div>
                    {coach.bio && (
                      <p className="text-xs text-slate-400 mb-2">{coach.bio}</p>
                    )}
                    {coach.credentials.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {coach.credentials.map((cred, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-[10px] rounded-full border border-amber-500/20"
                          >
                            {cred}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Users size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  Coaching staff details not yet available. Visit the clinic website for more info.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Tags */}
        {clinic.tags.length > 0 && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-1.5">
              {clinic.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-white/5 text-slate-500 text-[10px] rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related Clinics */}
        {relatedClinics.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-white mb-3">Similar Clinics</h3>
            <div className="space-y-2">
              {relatedClinics.map((rc) => (
                <button
                  key={rc.id}
                  onClick={() => router.push(`/clinic/${rc.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' }}>
                    <span className="text-lg">
                      {rc.type === 'camp' ? '🏕️' : rc.type === 'tournament' ? '🏆' : '🏒'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{rc.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {rc.location.city} · {formatDateRange(rc.dates.start, rc.dates.end)}
                      {rc.price.amount > 0 && ` · ${formatPrice(rc.price.amount, rc.price.currency)}`}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Source info */}
        <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Globe size={10} />
            <span>Source: {clinic.source || (() => { try { return new URL(clinic.websiteUrl || 'https://example.com').hostname; } catch { return 'curated'; } })()}</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-slate-950/95 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
        <div className="flex gap-3">
          {/* Track Registration / Already Registered */}
          <button
            onClick={handleTrackRegistration}
            disabled={isRegistered}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl transition-colors border',
              isRegistered
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            )}
          >
            {isRegistered ? (
              <>
                <ClipboardCheck size={16} />
                Tracked
              </>
            ) : (
              <>
                <ClipboardCheck size={16} />
                Track
              </>
            )}
          </button>
          {/* Register Now */}
          <a
            href={clinic.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-[2] flex items-center justify-center gap-2 py-3.5 text-white font-bold rounded-xl transition-colors"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            <ExternalLink size={16} />
            Register Now
            <ChevronRight size={16} />
          </a>
        </div>
      </div>

      {/* Share toast */}
      {showShareToast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full"
        >
          Link copied!
        </motion.div>
      )}

      {/* Registration tracked toast */}
      {showRegisteredToast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-white text-sm font-medium rounded-full"
          style={{ backgroundColor: 'var(--theme-primary)' }}
        >
          Registration tracked! View in My Clinics.
        </motion.div>
      )}
    </div>
  );
}
