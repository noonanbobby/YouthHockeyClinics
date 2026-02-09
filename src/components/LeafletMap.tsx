'use client';

import { useMemo, useEffect, useCallback } from 'react';
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
// 48px outer touch target (exceeds iOS 44pt minimum), 34px visual circle
// ALL inner elements use pointer-events:none so taps always reach Leaflet's handler
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

  // Outer div is the touch target. All children have pointer-events:none
  // so that touch/click events pass through to Leaflet's marker handler.
  return L.divIcon({
    className: '', // No default leaflet-div-icon styles
    iconSize: [touch, touch],
    iconAnchor: [touch / 2, touch / 2],
    html: `<div style="width:${touch}px;height:${touch}px;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;">
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
function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click: onClick,
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
    map.flyTo([lat, lng], 13, { duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

// ─── Single Venue Marker (react-leaflet) ────────────────
function VenueMarker({
  data,
  isSelected,
  onClick,
}: {
  data: VenueMarkerData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const icon = useMemo(
    () => makeIcon(data.count, data.isLive, isSelected),
    [data.count, data.isLive, isSelected]
  );

  // Wrap onClick to stop propagation — prevents map click from also firing
  const handleClick = useCallback((e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    onClick();
  }, [onClick]);

  return (
    <Marker
      position={[data.lat, data.lng]}
      icon={icon}
      eventHandlers={{ click: handleClick }}
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

  return (
    <>
      {/* CSS fixes: Tailwind img{max-width:100%} breaks Leaflet tiles; animation for LIVE pulse */}
      <style jsx global>{`
        .leaflet-container { font-family: inherit; }
        .leaflet-container img,
        .leaflet-container svg { max-width: none !important; max-height: none !important; }
        .leaflet-tile-pane { pointer-events: none; }
        .leaflet-marker-icon { outline: none !important; }
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

        {/* Clicking the map background dismisses the venue card */}
        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        {/* Render markers — react-leaflet handles event binding cleanly */}
        {markers.map((m) => (
          <VenueMarker
            key={m.key}
            data={m}
            isSelected={selectedKey === m.key}
            onClick={() => onMarkerClick(m.key)}
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
