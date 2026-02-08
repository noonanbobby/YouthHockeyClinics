'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';
import { Clinic } from '@/types';
import { formatPrice, getCountryFlag, formatDateShort, cn } from '@/lib/utils';
import { X, ChevronRight, Video, MapPin, Calendar, Users, Navigation } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import 'leaflet/dist/leaflet.css';

export default function MapView() {
  const { filteredClinics, isLoading, liveBarnConfig, homeLocation } = useStore();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const dragControls = useDragControls();

  // LiveBarn connected venues for live indicators
  const liveVenueNames = useMemo(
    () =>
      liveBarnConfig.connected
        ? liveBarnConfig.venues.filter((v) => v.isLive).map((v) => v.name.toLowerCase())
        : [],
    [liveBarnConfig.connected, liveBarnConfig.venues]
  );

  const isVenueLive = useCallback(
    (clinic: Clinic) => {
      if (!liveBarnConfig.connected) return false;
      const venue = clinic.location.venue.toLowerCase();
      return liveVenueNames.some((lv) => venue.includes(lv) || lv.includes(venue));
    },
    [liveBarnConfig.connected, liveVenueNames]
  );

  const hasLiveStream = useCallback(
    (clinic: Clinic) => {
      return clinic.hasLiveStream || isVenueLive(clinic);
    },
    [isVenueLive]
  );

  // Select a clinic and show the card
  const selectClinic = useCallback((clinic: Clinic | null) => {
    if (clinic) {
      setSelectedClinic(clinic);
      setShowCard(true);
      mapInstanceRef.current?.flyTo([clinic.location.lat, clinic.location.lng], 12, {
        duration: 0.6,
      });
    } else {
      setShowCard(false);
      setTimeout(() => setSelectedClinic(null), 300);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      const defaultCenter: [number, number] = homeLocation
        ? [homeLocation.lat, homeLocation.lng]
        : [45, -30];
      const defaultZoom = homeLocation ? 8 : 2;

      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Zoom control bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Attribution
      L.control.attribution({ position: 'bottomleft' }).addTo(map);
      map.attributionControl.addAttribution(
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      );

      // Click on map to deselect
      map.on('click', () => {
        selectClinic(null);
      });

      mapInstanceRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when clinics change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersRef.current) return;

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default;
      markersRef.current!.clearLayers();

      const validClinics = filteredClinics.filter(
        (c) => c.location.lat !== 0 && c.location.lng !== 0
      );

      const bounds: [number, number][] = [];

      validClinics.forEach((clinic) => {
        const { lat, lng } = clinic.location;
        bounds.push([lat, lng]);

        const isLive = hasLiveStream(clinic);
        const isSelected = selectedClinic?.id === clinic.id;

        // Theme-colored marker with optional live indicator
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="position:relative;">
            <div style="
              background: ${isSelected ? 'var(--theme-primary)' : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))'};
              width: ${isSelected ? '38px' : '30px'};
              height: ${isSelected ? '38px' : '30px'};
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.3)'};
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              cursor: pointer;
              transition: all 0.2s;
            ">
              <span style="transform: rotate(45deg); font-size: ${isSelected ? '16px' : '13px'};">🏒</span>
            </div>
            ${isLive ? `<div style="
              position: absolute; top: -4px; right: -4px;
              width: 14px; height: 14px; border-radius: 50%;
              background: #ef4444; border: 2px solid #0f172a;
              display: flex; align-items: center; justify-content: center;
              animation: marker-pulse 2s infinite;
            "><span style="font-size: 6px; color: white; font-weight: bold;">●</span></div>` : ''}
          </div>`,
          iconSize: [isSelected ? 38 : 30, isSelected ? 38 : 30],
          iconAnchor: [isSelected ? 19 : 15, isSelected ? 38 : 30],
        });

        const marker = L.marker([lat, lng], { icon }).on('click', (e: L.LeafletEvent) => {
          L.DomEvent.stopPropagation(e as L.LeafletMouseEvent);
          selectClinic(clinic);
        });

        markersRef.current!.addLayer(marker);
      });

      // Fit bounds if we have markers and no clinic is selected
      if (bounds.length > 0 && !selectedClinic) {
        try {
          mapInstanceRef.current!.fitBounds(bounds as L.LatLngBoundsExpression, {
            padding: [50, 50],
            maxZoom: 12,
          });
        } catch {
          // Bounds error, ignore
        }
      }
    };

    updateMarkers();
  }, [filteredClinics, mapReady, selectedClinic, hasLiveStream, selectClinic]);

  return (
    <div className="relative h-[calc(100vh-180px)]">
      {/* Map container - full height */}
      <div ref={mapRef} className="w-full h-full bg-slate-900" />

      {/* Pulse animation for live markers */}
      <style jsx global>{`
        @keyframes marker-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
            <p className="text-sm text-slate-300">Scanning for clinics...</p>
          </div>
        </div>
      )}

      {/* Top info bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
        <div className="bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
          <p className="text-xs font-medium text-white">
            {filteredClinics.filter((c) => c.location.lat !== 0).length} clinics on map
          </p>
        </div>

        {liveBarnConfig.connected && liveVenueNames.length > 0 && (
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-red-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-xs font-medium text-red-400">
              {liveVenueNames.length} Live
            </p>
          </div>
        )}
      </div>

      {/* Re-center button */}
      {homeLocation && (
        <button
          onClick={() => {
            mapInstanceRef.current?.flyTo([homeLocation.lat, homeLocation.lng], 10, { duration: 0.6 });
          }}
          className="absolute bottom-24 right-3 z-10 bg-slate-900/90 backdrop-blur-sm rounded-full p-2.5 border border-white/10 active:scale-95 transition-transform"
          title="Re-center on home"
        >
          <Navigation size={16} className="text-slate-300" />
        </button>
      )}

      {/* Slide-up clinic card */}
      <AnimatePresence>
        {showCard && selectedClinic && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) selectClinic(null);
            }}
            className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom"
          >
            <div
              className="mx-2 mb-2 rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--theme-bg) 97%, transparent)',
                borderColor: 'var(--theme-card-border)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Drag handle */}
              <div
                className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Close button */}
              <button
                onClick={() => selectClinic(null)}
                className="absolute top-2 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 z-10"
              >
                <X size={16} className="text-slate-400" />
              </button>

              {/* Card content */}
              <div className="p-4 pt-1">
                {/* Live indicator if applicable */}
                {hasLiveStream(selectedClinic) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-red-400 uppercase">Live Now</span>
                    <Video size={10} className="text-red-400" />
                  </div>
                )}

                <div className="flex gap-3">
                  {/* Thumbnail */}
                  {selectedClinic.imageUrl && (
                    <img
                      src={selectedClinic.imageUrl}
                      alt=""
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">
                      {selectedClinic.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={10} className="text-slate-500 shrink-0" />
                      <p className="text-[11px] text-slate-400 truncate">
                        {getCountryFlag(selectedClinic.location.countryCode)}{' '}
                        {selectedClinic.location.venue || selectedClinic.location.city},{' '}
                        {selectedClinic.location.country}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Calendar size={10} className="text-slate-500" />
                        <span className="text-[11px]" style={{ color: 'var(--theme-primary)' }}>
                          {formatDateShort(selectedClinic.dates.start)}
                          {selectedClinic.dates.start !== selectedClinic.dates.end &&
                            ` – ${formatDateShort(selectedClinic.dates.end)}`}
                        </span>
                      </div>
                      {selectedClinic.spotsRemaining > 0 && (
                        <div className="flex items-center gap-1">
                          <Users size={10} className="text-slate-500" />
                          <span
                            className={cn(
                              'text-[11px]',
                              selectedClinic.spotsRemaining <= 5 ? 'text-red-400' : 'text-slate-400'
                            )}
                          >
                            {selectedClinic.spotsRemaining} spots
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price + CTA */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div>
                    {selectedClinic.price.amount > 0 ? (
                      <p className="text-base font-bold text-white">
                        {formatPrice(selectedClinic.price.amount, selectedClinic.price.currency)}
                      </p>
                    ) : (
                      <p className="text-base font-bold text-emerald-400">Free</p>
                    )}
                    {selectedClinic.rating > 0 && (
                      <p className="text-[10px] text-slate-500">
                        {'★'.repeat(Math.round(selectedClinic.rating))}{' '}
                        {selectedClinic.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/clinic/${selectedClinic.id}`)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                  >
                    View Details
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
