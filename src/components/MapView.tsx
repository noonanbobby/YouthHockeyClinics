'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';
import { Clinic, LiveBarnVenue, Registration } from '@/types';
import { formatPrice, getCountryFlag, formatDateShort, cn } from '@/lib/utils';
import { X, ChevronRight, Video, MapPin, Calendar, Users, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LiveBarnLauncher from '@/components/LiveBarnLauncher';
import type { VenueMarkerData } from './LeafletMap';

// Dynamic import — SSR-safe. MapLibre GL must not render on the server.
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
    </div>
  ),
});

interface VenueGroup {
  key: string;
  venue: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  clinics: Clinic[];
}

export default function MapView() {
  const { filteredClinics, isLoading, liveBarnConfig, homeLocation, registrations, childProfiles, activeChildIds } = useStore();
  const router = useRouter();
  const [selectedVenueKey, setSelectedVenueKey] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [launchVenue, setLaunchVenue] = useState<LiveBarnVenue | null>(null);

  // ─── Group clinics by venue ───────────────────────────
  const venueGroups = useMemo(() => {
    const groups = new Map<string, VenueGroup>();
    filteredClinics
      .filter((c) => c.location.lat !== 0 && c.location.lng !== 0)
      .forEach((clinic) => {
        const key = clinic.location.venue
          ? clinic.location.venue.toLowerCase().trim()
          : `${clinic.location.lat.toFixed(3)},${clinic.location.lng.toFixed(3)}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            venue: clinic.location.venue || clinic.location.city,
            city: clinic.location.city,
            country: clinic.location.country,
            countryCode: clinic.location.countryCode,
            lat: clinic.location.lat,
            lng: clinic.location.lng,
            clinics: [],
          });
        }
        groups.get(key)!.clinics.push(clinic);
      });
    return groups;
  }, [filteredClinics]);

  // ─── LiveBarn helpers ─────────────────────────────────
  const liveVenueNames = useMemo(
    () =>
      liveBarnConfig.connected
        ? liveBarnConfig.venues.filter((v) => v.isLive).map((v) => v.name.toLowerCase())
        : [],
    [liveBarnConfig.connected, liveBarnConfig.venues]
  );

  const isVenueNameLive = useCallback(
    (venueName: string) => {
      if (!liveBarnConfig.connected) return false;
      const v = venueName.toLowerCase();
      return liveVenueNames.some((lv) => v.includes(lv) || lv.includes(v));
    },
    [liveBarnConfig.connected, liveVenueNames]
  );

  const isGroupLive = useCallback(
    (group: VenueGroup) =>
      isVenueNameLive(group.venue) || group.clinics.some((c) => c.hasLiveStream),
    [isVenueNameLive]
  );

  const getLiveBarnVenuesForName = useCallback(
    (venueName: string): LiveBarnVenue[] => {
      if (!liveBarnConfig.connected) return [];
      const v = venueName.toLowerCase();
      return liveBarnConfig.venues.filter((lbv) => {
        const n = lbv.name.toLowerCase();
        return v.includes(n) || n.includes(v);
      });
    },
    [liveBarnConfig.connected, liveBarnConfig.venues]
  );

  // ─── Build marker data for LeafletMap ─────────────────
  const markerData: VenueMarkerData[] = useMemo(() => {
    const result: VenueMarkerData[] = [];
    venueGroups.forEach((group) => {
      result.push({
        key: group.key,
        lat: group.lat,
        lng: group.lng,
        count: group.clinics.length,
        isLive: isGroupLive(group),
      });
    });
    return result;
  }, [venueGroups, isGroupLive]);

  // ─── Map config ───────────────────────────────────────
  const mapCenter: [number, number] = homeLocation
    ? [homeLocation.lat, homeLocation.lng]
    : [45, -30];
  const mapZoom = homeLocation ? 8 : 2;

  // ─── Selected venue derived data ──────────────────────
  const selectedVenue = useMemo(
    () => (selectedVenueKey ? venueGroups.get(selectedVenueKey) || null : null),
    [selectedVenueKey, venueGroups]
  );

  const activeChildren = useMemo(
    () => childProfiles.filter((c) => activeChildIds.includes(c.id)),
    [childProfiles, activeChildIds]
  );

  const getRegistrationForClinic = useCallback(
    (clinic: Clinic, childId: string): Registration | undefined => {
      const child = childProfiles.find((c) => c.id === childId);
      if (!child) return undefined;
      return registrations.find((r) => {
        const nameMatch =
          r.clinicName.toLowerCase().includes(clinic.name.toLowerCase().slice(0, 20)) ||
          clinic.name.toLowerCase().includes(r.clinicName.toLowerCase().slice(0, 20));
        const childMatch =
          r.playerName?.toLowerCase() === child.name.toLowerCase() || r.childId === childId;
        return nameMatch && childMatch;
      });
    },
    [registrations, childProfiles]
  );

  const getOverlappingRegistrations = useCallback(
    (clinic: Clinic): Registration[] =>
      registrations.filter(
        (r) => r.status !== 'cancelled' && clinic.dates.start <= r.endDate && r.startDate <= clinic.dates.end
      ),
    [registrations]
  );

  const selectedLiveBarnVenues = useMemo(
    () => (selectedVenue ? getLiveBarnVenuesForName(selectedVenue.venue) : []),
    [selectedVenue, getLiveBarnVenuesForName]
  );
  const venueIsLive = selectedVenue ? isGroupLive(selectedVenue) : false;
  const liveStreams = useMemo(() => selectedLiveBarnVenues.filter((v) => v.isLive), [selectedLiveBarnVenues]);
  const replayStreams = useMemo(() => selectedLiveBarnVenues.filter((v) => !v.isLive), [selectedLiveBarnVenues]);

  // ─── Handlers ─────────────────────────────────────────
  const dismissCard = useCallback(() => {
    setShowCard(false);
    setTimeout(() => setSelectedVenueKey(null), 300);
  }, []);

  const handleMarkerClick = useCallback((key: string) => {
    setSelectedVenueKey(key);
    setShowCard(true);
  }, []);

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="relative h-[calc(100vh-180px)]">
      {/* The react-leaflet map — handles all touch, pinch, zoom natively.
          No overlay/backdrop EVER covers the map — that would block pinch/zoom.
          Instead, tapping the map background fires onMapClick to dismiss the sheet. */}
      <LeafletMap
        markers={markerData}
        center={mapCenter}
        zoom={mapZoom}
        selectedKey={showCard ? selectedVenueKey : null}
        onMarkerClick={handleMarkerClick}
        onMapClick={dismissCard}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm text-slate-300">Scanning for clinics...</p>
          </div>
        </div>
      )}

      {/* Top info bar — pointer-events-none on container, auto on pills */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10 pointer-events-auto">
          <p className="text-xs font-medium text-white">
            {venueGroups.size} venues · {filteredClinics.filter((c) => c.location.lat !== 0).length} clinics
          </p>
        </div>

        {liveBarnConfig.connected && liveVenueNames.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-red-500/30 flex items-center gap-1.5 pointer-events-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <p className="text-xs font-medium text-red-400">
              {liveVenueNames.length} Live
            </p>
          </div>
        )}
      </div>

      {/* Venue bottom sheet — NO full-screen backdrop. Dismissing is handled by
          tapping the map background (via onMapClick) or the X button. */}
      <AnimatePresence>
        {showCard && selectedVenue && (
          <motion.div
            key="venue-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                'mx-2 mb-2 rounded-2xl border overflow-hidden',
                venueIsLive && 'ring-1 ring-red-500/40'
              )}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-bg) 97%, transparent)',
                borderColor: venueIsLive ? 'rgba(239,68,68,0.3)' : 'var(--theme-card-border)',
                backdropFilter: 'blur(20px)',
                animation: venueIsLive ? 'live-glow 2s ease-in-out infinite' : undefined,
              }}
            >
              {/* Header */}
              <div className="relative px-4 pt-3 pb-2">
                <div className="flex justify-center mb-2">
                  <div className="w-12 h-1.5 rounded-full bg-white/20" />
                </div>
                <button
                  onClick={dismissCard}
                  className="absolute top-2 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 z-30 transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
                <div className="pr-10">
                  <h3 className="text-base font-bold text-white leading-tight">{selectedVenue.venue}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-slate-500 shrink-0" />
                    <p className="text-[11px] text-slate-400">
                      {getCountryFlag(selectedVenue.countryCode)} {selectedVenue.city}, {selectedVenue.country}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-4 pb-4">
                {/* LIVE banner */}
                {venueIsLive && (
                  <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live Now at This Venue</span>
                    <Video size={12} className="text-red-400 ml-auto" />
                  </div>
                )}

                {/* LiveBarn streams */}
                {liveStreams.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {liveStreams.map((lbv) => (
                      <button key={lbv.id} onClick={() => setLaunchVenue(lbv)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 active:bg-red-500/20 transition-colors text-left">
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                          <Video size={20} className="text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">Watch Live — {lbv.surfaceName}</p>
                          <p className="text-[10px] text-red-400/70">{lbv.name}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="relative flex h-2 w-2 mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                          <ExternalLink size={12} className="text-red-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {replayStreams.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {replayStreams.map((lbv) => (
                      <button key={lbv.id} onClick={() => setLaunchVenue(lbv)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/10 transition-colors text-left">
                        <Video size={14} className="text-slate-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-400">{lbv.surfaceName} — Watch Replay</p>
                        </div>
                        <ExternalLink size={10} className="text-slate-500" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Clinics list */}
                <div className="flex items-center justify-between mb-2 mt-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {selectedVenue.clinics.length} Camp{selectedVenue.clinics.length !== 1 ? 's' : ''} at This Venue
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedVenue.clinics.map((clinic) => {
                    const childStatuses = activeChildren.map((child) => ({
                      child,
                      registration: getRegistrationForClinic(clinic, child.id),
                    }));
                    const anyRegistered = childStatuses.some((s) => s.registration);
                    const overlaps = getOverlappingRegistrations(clinic);
                    const hasOverlap = overlaps.length > 0 && !anyRegistered;

                    return (
                      <button
                        key={clinic.id}
                        onClick={() => router.push(`/clinic/${clinic.id}`)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border transition-colors',
                          anyRegistered
                            ? 'bg-emerald-500/[0.06] border-emerald-500/20 active:bg-emerald-500/10'
                            : 'bg-white/[0.03] border-white/5 active:bg-white/[0.06]'
                        )}
                      >
                        <div className="flex gap-3">
                          {clinic.imageUrl && (
                            <img // eslint-disable-line @next/next/no-img-element
                              src={clinic.imageUrl} alt=""
                              className="w-14 h-14 rounded-lg object-cover shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white leading-tight line-clamp-2">{clinic.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar size={9} className="text-slate-500" />
                                <span className="text-[10px]" style={{ color: 'var(--theme-primary)' }}>
                                  {formatDateShort(clinic.dates.start)}
                                  {clinic.dates.start !== clinic.dates.end && ` – ${formatDateShort(clinic.dates.end)}`}
                                </span>
                              </div>
                              {clinic.spotsRemaining > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users size={9} className="text-slate-500" />
                                  <span className={cn('text-[10px]', clinic.spotsRemaining <= 5 ? 'text-red-400' : 'text-slate-400')}>
                                    {clinic.spotsRemaining} spots
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Registration status per child */}
                            {activeChildren.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {childStatuses.map(({ child, registration }) => (
                                  <span key={child.id}
                                    className={cn(
                                      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold',
                                      registration ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-500'
                                    )}>
                                    {registration ? <CheckCircle2 size={8} /> : null}
                                    {child.name}{registration ? ' Registered' : ''}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Schedule overlap */}
                            {hasOverlap && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle size={9} className="text-amber-400" />
                                <span className="text-[9px] text-amber-400 font-medium">
                                  Overlaps with {overlaps[0].clinicName}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {clinic.price.amount > 0 ? (
                                  <span className="text-sm font-bold text-white">
                                    {formatPrice(clinic.price.amount, clinic.price.currency)}
                                  </span>
                                ) : (
                                  <span className="text-sm font-bold text-emerald-400">Free</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--theme-primary)' }}>
                                View Details <ChevronRight size={12} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* live-glow animation for venue card */}
      <style jsx global>{`
        @keyframes live-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 24px 6px rgba(239, 68, 68, 0.12); }
        }
      `}</style>

      {/* LiveBarn launcher modal */}
      {launchVenue && (
        <LiveBarnLauncher venue={launchVenue} onClose={() => setLaunchVenue(null)} />
      )}
    </div>
  );
}
