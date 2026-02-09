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
import { HockeyLoadingScreen } from '@/components/HockeyLoader';

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
    activeChildIds,
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

  // Child age group match — any active child
  const activeChildren = childProfiles.filter((c) => activeChildIds.includes(c.id));
  const matchingChildren = clinic ? activeChildren.filter((child) => {
    const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
    return clinic.ageGroups.includes(ag) || clinic.ageGroups.includes('all');
  }) : [];
  const isAgeMatch = matchingChildren.length > 0;
  const activeChild = activeChildren[0] || null;

  if (!clinic) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <HockeyLoadingScreen message="Loading clinic details..." />
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
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#f0f4f8' }}>
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
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #f0f4f8, rgba(240,244,248,0.4), transparent)' }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 safe-area-top">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-slate-200"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddToCalendar}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-slate-200"
                title="Add to Calendar"
              >
                <CalendarPlus size={18} className="text-white" />
              </button>
              <button
                onClick={handleShare}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-slate-200"
              >
                <Share2 size={18} className="text-white" />
              </button>
              <button
                onClick={() => toggleFavorite(clinic.id)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-slate-200"
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
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              New
            </span>
          )}
          {clinic.featured && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Featured
            </span>
          )}
          {isAgeMatch && matchingChildren.length > 0 && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              Fits {matchingChildren.map((c) => c.name).join(' & ')}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-2 relative z-10">
        {/* Title section */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#0f172a' }}>{clinic.name}</h1>
          <div className="flex items-center gap-3 text-sm flex-wrap" style={{ color: '#475569' }}>
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
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <Calendar size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-500">Dates</p>
            <p className="text-sm font-semibold text-slate-900">
              {formatDateRange(clinic.dates.start, clinic.dates.end)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--theme-primary)' }}>
              {timeUntil(clinic.dates.start)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <Clock size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-500">Duration</p>
            <p className="text-sm font-semibold text-slate-900">{clinic.duration}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <DollarSign size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-500">Price</p>
            <p className="text-sm font-semibold text-slate-900">
              {clinic.price.amount > 0
                ? formatPrice(clinic.price.amount, clinic.price.currency)
                : 'Contact for pricing'}
            </p>
            {clinic.price.earlyBird && (
              <p className="text-[10px] text-emerald-600 mt-0.5">
                Early bird: {formatPrice(clinic.price.earlyBird.amount, clinic.price.currency)}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
            <Users size={16} style={{ color: 'var(--theme-primary)' }} className="mb-1.5" />
            <p className="text-xs text-slate-500">Availability</p>
            <p className="text-sm font-semibold text-slate-900">
              {clinic.spotsRemaining > 0
                ? `${clinic.spotsRemaining} spots left`
                : 'Waitlist'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">of {clinic.maxParticipants} total</p>
          </div>
        </div>

        {/* Rating section */}
        {clinic.rating > 0 && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-slate-900">{clinic.rating}</p>
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
                <p className="text-xs text-slate-600 font-medium">
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
                <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-slate-100">
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
        <div className="flex rounded-xl p-1 mb-4" style={{ backgroundColor: '#e8edf2' }}>
          {(['overview', 'schedule', 'coaches'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-colors relative',
                activeTab === tab ? 'text-slate-900' : 'text-slate-500'
              )}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="detail-tab"
                  className="absolute inset-0 rounded-lg bg-white border border-slate-200 shadow-sm"
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
              <h3 className="text-sm font-semibold mb-2">About</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {clinic.longDescription || clinic.description}
              </p>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Location</h3>
              <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <MapPin size={16} style={{ color: 'var(--theme-primary)' }} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{clinic.location.venue}</p>
                    {clinic.location.address && (
                      <p className="text-xs text-slate-500 mt-0.5">{clinic.location.address}</p>
                    )}
                    <p className="text-xs text-slate-500">
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
              <h3 className="text-sm font-semibold mb-2">Who It&apos;s For</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Age Groups</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clinic.ageGroups.map((ag) => {
                      const matchNames = activeChildren
                        .filter((child) => {
                          const cag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
                          return ag === cag || ag === 'all';
                        })
                        .map((c) => c.name);
                      const matches = matchNames.length > 0;
                      return (
                        <span
                          key={ag}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-full border',
                            matches
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          )}
                        >
                          {getAgeGroupLabel(ag)}
                          {matches && (
                            <span className="ml-1 text-[9px]">({matchNames.join(', ')})</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Skill Levels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clinic.skillLevels.map((sl) => (
                      <span
                        key={sl}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200"
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
                <h3 className="text-sm font-semibold mb-2">What&apos;s Included</h3>
                <div className="grid grid-cols-2 gap-2">
                  {clinic.includes.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check size={12} className="text-emerald-600 shrink-0" />
                      <span className="text-xs text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {clinic.amenities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {clinic.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-slate-50 text-slate-600 text-xs rounded-full border border-slate-200"
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
                <h3 className="text-sm font-semibold mb-2">Contact</h3>
                <div className="space-y-2">
                  {clinic.contactEmail && (
                    <a
                      href={`mailto:${clinic.contactEmail}`}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <Mail size={16} style={{ color: 'var(--theme-primary)' }} />
                      <span className="text-sm text-slate-600">{clinic.contactEmail}</span>
                    </a>
                  )}
                  {clinic.contactPhone && (
                    <a
                      href={`tel:${clinic.contactPhone}`}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <Phone size={16} style={{ color: 'var(--theme-primary)' }} />
                      <span className="text-sm text-slate-600">{clinic.contactPhone}</span>
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
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--theme-primary)' }}>{item.day}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.startTime}-{item.endTime}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">{item.activity}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Clock size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
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
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {coach.photoUrl ? (
                        <img
                          src={coach.photoUrl}
                          alt={coach.name}
                          className="w-12 h-12 rounded-full object-cover border-2"
                          style={{ borderColor: 'color-mix(in srgb, var(--theme-primary) 30%, white)' }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 15%, white)' }}>
                          <Award size={20} style={{ color: 'var(--theme-primary)' }} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-900">{coach.name}</p>
                        <p className="text-xs" style={{ color: 'var(--theme-primary)' }}>{coach.title}</p>
                      </div>
                    </div>
                    {coach.bio && (
                      <p className="text-xs text-slate-500 mb-2">{coach.bio}</p>
                    )}
                    {coach.credentials.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {coach.credentials.map((cred, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-full border border-amber-200"
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
                <p className="text-sm text-slate-500">
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
                  className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] rounded-full"
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
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Similar Clinics</h3>
            <div className="space-y-2">
              {relatedClinics.map((rc) => (
                <button
                  key={rc.id}
                  onClick={() => router.push(`/clinic/${rc.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--theme-primary) 12%, white)' }}>
                    <span className="text-lg">
                      {rc.type === 'camp' ? '🏕️' : rc.type === 'tournament' ? '🏆' : '🏒'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{rc.name}</p>
                    <p className="text-[10px] text-slate-500">
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
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Globe size={10} />
            <span>Source: {clinic.source || (() => { try { return new URL(clinic.websiteUrl || 'https://example.com').hostname; } catch { return 'curated'; } })()}</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 backdrop-blur-xl border-t safe-area-bottom"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e2e8f0' }}>
        <div className="flex gap-3">
          {/* Track Registration / Already Registered */}
          <button
            onClick={handleTrackRegistration}
            disabled={isRegistered}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl transition-colors border',
              isRegistered
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
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
