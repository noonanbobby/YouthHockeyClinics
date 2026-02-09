'use client';

import { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, AttributionControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Types ──────────────────────────────────────────────
export interface VenueMarkerData {
  key: string;
  lat: number;
  lng: number;
  count: number;
  isLive: boolean;
}

interface LeafletMapProps {
  markers: VenueMarkerData[];
  center: [number, number];
  zoom: number;
  selectedKey: string | null;
  onMarkerClick: (key: string) => void;
  onMapClick?: () => void;
}

// ─── Marker Icon Factory ────────────────────────────────
// 48px outer touch target (exceeds iOS 44pt minimum), 34px visual circle.
// ALL inner elements use pointer-events:none so taps reach the Leaflet wrapper.
// touch-action:manipulation eliminates 300ms iOS tap delay.
function makeIcon(count: number, isLive: boolean, isSelected: boolean): L.DivIcon {
  const touch = 48;
  const vis = isSelected ? 40 : 34;
  const offset = (touch - vis) / 2;

  const bg = isLive
    ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
    : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))';

  const border = isSelected
    ? '3px solid #fff'
    : isLive
    ? '3px solid #fca5a5'
    : '2px solid rgba(255,255,255,0.35)';

  const shadow = isLive
    ? '0 0 20px rgba(239,68,68,0.5)'
    : isSelected
    ? '0 0 16px rgba(56,189,248,0.4)'
    : '0 2px 8px rgba(0,0,0,0.5)';

  const emoji = isLive ? '📹' : '🏒';
  const fontSize = isSelected ? '17px' : '14px';

  return L.divIcon({
    className: '',
    iconSize: [touch, touch],
    iconAnchor: [touch / 2, touch / 2],
    html: `<div style="width:${touch}px;height:${touch}px;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;">
      <div style="
        pointer-events:none;
        position:absolute;top:${offset}px;left:${offset}px;
        width:${vis}px;height:${vis}px;border-radius:50%;
        background:${bg};border:${border};
        display:flex;align-items:center;justify-content:center;
        box-shadow:${shadow};transition:transform 0.15s;
      "><span style="pointer-events:none;font-size:${fontSize};line-height:1;">${emoji}</span></div>
      ${count > 1 ? `<div style="
        pointer-events:none;
        position:absolute;top:0;right:0;
        min-width:20px;height:20px;border-radius:10px;
        background:var(--theme-primary,#0ea5e9);border:2px solid #0f172a;
        display:flex;align-items:center;justify-content:center;
        padding:0 4px;
      "><span style="pointer-events:none;font-size:9px;color:#fff;font-weight:800;">${count}</span></div>` : ''}
      ${isLive ? `<div style="
        pointer-events:none;
        position:absolute;top:${count > 1 ? '0' : '2px'};left:0;
        width:18px;height:18px;border-radius:50%;
        background:#ef4444;border:2px solid #0f172a;
        display:flex;align-items:center;justify-content:center;
        animation:lm-pulse 1.5s infinite;
        box-shadow:0 0 8px rgba(239,68,68,0.6);
      "><span style="pointer-events:none;font-size:5px;color:#fff;font-weight:900;">LIVE</span></div>` : ''}
    </div>`,
  });
}

// ─── Map click handler (dismiss card) ───────────────────
// Includes zoom guard: iOS fires spurious click events during pinch-zoom
// (Leaflet issue #7465). We suppress clicks that arrive while zooming.
function MapClickHandler({ onClick }: { onClick: () => void }) {
  const isZoomingRef = useRef(false);

  useMapEvents({
    zoomstart: () => { isZoomingRef.current = true; },
    zoomend: () => {
      setTimeout(() => { isZoomingRef.current = false; }, 300);
    },
    click: () => {
      if (!isZoomingRef.current) {
        onClick();
      }
    },
  });
  return null;
}

// ─── Auto-fit bounds when markers change ────────────────
function FitBounds({ markers, skip }: { markers: VenueMarkerData[]; skip: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (skip || markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [markers, skip, map]);

  return null;
}

// ─── Fly to selected marker ─────────────────────────────
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 13, { duration: 0.3 });
  }, [lat, lng, map]);
  return null;
}

// ─── Single Venue Marker ────────────────────────────────
// Uses DIRECT DOM event listeners instead of Leaflet's eventHandlers.
// This bypasses Leaflet's _findEventTargets / _draggableMoved which
// can swallow clicks after a map pan (Leaflet issue #2619) and has
// various iOS-specific quirks with pointer event translation.
function VenueMarker({
  data,
  isSelected,
  onClickRef,
}: {
  data: VenueMarkerData;
  isSelected: boolean;
  onClickRef: React.MutableRefObject<(key: string) => void>;
}) {
  const icon = useMemo(
    () => makeIcon(data.count, data.isLive, isSelected),
    [data.count, data.isLive, isSelected]
  );

  const markerRef = useRef<L.Marker>(null);
  const dataKeyRef = useRef(data.key);
  dataKeyRef.current = data.key;

  // Attach a direct DOM click listener to the marker's icon element.
  // This completely bypasses Leaflet's event pipeline, avoiding:
  // - _draggableMoved swallowing clicks after pan
  // - pointer event translation issues on iOS
  // - The 200ms tap handler legacy
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const el = marker.getElement();
    if (!el) return;

    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      touchStartTime = Date.now();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dt = Date.now() - touchStartTime;
      if (dt > 500) return; // not a tap (long press)

      const touch = e.changedTouches[0];
      const dx = Math.abs(touch.clientX - touchStartX);
      const dy = Math.abs(touch.clientY - touchStartY);
      if (dx > 15 || dy > 15) return; // finger moved too much (drag/scroll)

      // This is a genuine tap on the marker
      e.preventDefault(); // prevent subsequent click event from firing
      e.stopPropagation(); // prevent map from seeing this touch
      onClickRef.current(dataKeyRef.current);
    };

    const onClickFallback = (e: MouseEvent) => {
      // Fallback for desktop / non-touch devices
      e.stopPropagation();
      onClickRef.current(dataKeyRef.current);
    };

    // Touch events for mobile — these fire BEFORE click on iOS
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    // Click for desktop fallback
    el.addEventListener('click', onClickFallback);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('click', onClickFallback);
    };
  }); // intentionally no deps — re-attach after every render in case icon element changed

  return (
    <Marker
      ref={markerRef}
      position={[data.lat, data.lng]}
      icon={icon}
    />
  );
}

// ─── Main Map Component ─────────────────────────────────
export default function LeafletMap({
  markers,
  center,
  zoom,
  selectedKey,
  onMarkerClick,
  onMapClick,
}: LeafletMapProps) {
  const selectedMarker = selectedKey ? markers.find((m) => m.key === selectedKey) : null;

  // Stable ref for the click handler — avoids stale closures in DOM listeners
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  return (
    <>
      {/* CSS fixes:
          - touch-action:manipulation eliminates 300ms iOS tap delay
          - Tailwind img{max-width:100%} breaks Leaflet tiles
          - leaflet-interactive gets cursor pointer for markers
      */}
      <style jsx global>{`
        .leaflet-container {
          font-family: inherit;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .leaflet-container img,
        .leaflet-container svg { max-width: none !important; max-height: none !important; }
        .leaflet-tile-pane { pointer-events: none; }
        .leaflet-marker-icon {
          outline: none !important;
          touch-action: manipulation;
        }
        @keyframes lm-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.7; }
        }
      `}</style>

      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        <ZoomControl position="bottomright" />
        <AttributionControl position="bottomleft" />

        {/* Clicking the map background dismisses the venue card.
            Zoom guard prevents spurious iOS clicks during pinch-zoom. */}
        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {/* Render markers with direct DOM tap handlers */}
        {markers.map((m) => (
          <VenueMarker
            key={m.key}
            data={m}
            isSelected={selectedKey === m.key}
            onClickRef={onMarkerClickRef}
          />
        ))}

        {/* Auto-fit bounds (skip when a venue is selected) */}
        <FitBounds markers={markers} skip={!!selectedKey} />

        {/* Fly to selected marker */}
        {selectedMarker && (
          <FlyTo lat={selectedMarker.lat} lng={selectedMarker.lng} />
        )}
      </MapContainer>
    </>
  );
}
