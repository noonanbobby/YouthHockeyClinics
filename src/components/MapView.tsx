'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useRouter } from 'next/navigation';
import { Clinic } from '@/types';
import { formatPrice, getCountryFlag, formatDateShort } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

export default function MapView() {
  const { filteredClinics, isLoading } = useStore();
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      const map = L.map(mapRef.current!, {
        center: [45, -30],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control to bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add attribution
      L.control.attribution({ position: 'bottomleft' }).addTo(map);
      map.attributionControl.addAttribution(
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      );

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
  }, []);

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

        // Custom icon
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            background: linear-gradient(135deg, #0ea5e9, #0284c7);
            width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid rgba(255,255,255,0.3);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-size: 14px;">🏒</span>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const marker = L.marker([lat, lng], { icon })
          .on('click', () => {
            setSelectedClinic(clinic);
            mapInstanceRef.current?.flyTo([lat, lng], 10, { duration: 0.8 });
          });

        markersRef.current!.addLayer(marker);
      });

      // Fit bounds if we have markers
      if (bounds.length > 0) {
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
  }, [filteredClinics, mapReady]);

  return (
    <div className="relative h-[calc(100vh-180px)]">
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full bg-slate-900" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-300">Scanning for clinics...</p>
          </div>
        </div>
      )}

      {/* Clinic count badge */}
      <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
        <p className="text-xs font-medium text-white">
          {filteredClinics.filter((c) => c.location.lat !== 0).length} clinics on map
        </p>
      </div>

      {/* Selected clinic popup */}
      {selectedClinic && (
        <div className="absolute bottom-4 left-3 right-3 z-20">
          <div
            onClick={() => router.push(`/clinic/${selectedClinic.id}`)}
            className="bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="flex">
              {selectedClinic.imageUrl && (
                <img
                  src={selectedClinic.imageUrl}
                  alt=""
                  className="w-24 h-24 object-cover"
                />
              )}
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {selectedClinic.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {getCountryFlag(selectedClinic.location.countryCode)}{' '}
                      {selectedClinic.location.city}, {selectedClinic.location.country}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClinic(null);
                    }}
                    className="text-slate-500 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-sky-400">
                    {formatDateShort(selectedClinic.dates.start)}
                    {selectedClinic.dates.start !== selectedClinic.dates.end &&
                      ` - ${formatDateShort(selectedClinic.dates.end)}`}
                  </span>
                  {selectedClinic.price.amount > 0 && (
                    <span className="text-xs font-bold text-white">
                      {formatPrice(selectedClinic.price.amount, selectedClinic.price.currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
