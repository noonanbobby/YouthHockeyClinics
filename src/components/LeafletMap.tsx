'use client';

import { useCallback, useMemo } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

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

// ─── Marker visual component ────────────────────────────
function MarkerIcon({ count, isLive, isSelected }: { count: number; isLive: boolean; isSelected: boolean }) {
  const size = isSelected ? 40 : 34;
  const emoji = isLive ? '📹' : '🏒';
  const fontSize = isSelected ? 17 : 14;

  return (
    <div style={{ position: 'relative', width: 48, height: 48, cursor: 'pointer' }}>
      {/* Visual circle */}
      <div
        style={{
          position: 'absolute',
          top: (48 - size) / 2,
          left: (48 - size) / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          background: isLive
            ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
            : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
          border: isSelected
            ? '3px solid #fff'
            : isLive
            ? '3px solid #fca5a5'
            : '2px solid rgba(255,255,255,0.35)',
          boxShadow: isLive
            ? '0 0 20px rgba(239,68,68,0.5)'
            : isSelected
            ? '0 0 16px rgba(56,189,248,0.4)'
            : '0 2px 8px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
      >
        <span style={{ fontSize, lineHeight: 1 }}>{emoji}</span>
      </div>

      {/* Count badge */}
      {count > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            background: 'var(--theme-primary, #0ea5e9)',
            border: '2px solid #0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>{count}</span>
        </div>
      )}

      {/* LIVE badge */}
      {isLive && (
        <div
          className="lm-pulse"
          style={{
            position: 'absolute',
            top: count > 1 ? 0 : 2,
            left: 0,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid #0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 8px rgba(239,68,68,0.6)',
          }}
        >
          <span style={{ fontSize: 5, color: '#fff', fontWeight: 900 }}>LIVE</span>
        </div>
      )}
    </div>
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
  // Handle map background click (dismisses venue card)
  const handleMapClick = useCallback(() => {
    if (onMapClick) onMapClick();
  }, [onMapClick]);

  // Compute bounds for initial view
  const bounds = useMemo(() => {
    if (markers.length === 0) return null;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const m of markers) {
      if (m.lat < minLat) minLat = m.lat;
      if (m.lat > maxLat) maxLat = m.lat;
      if (m.lng < minLng) minLng = m.lng;
      if (m.lng > maxLng) maxLng = m.lng;
    }
    return [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]];
  }, [markers]);

  return (
    <>
      <style jsx global>{`
        .maplibregl-map { font-family: inherit; }
        .maplibregl-canvas { outline: none; }
        .maplibregl-marker { cursor: pointer; }
        @keyframes lm-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.7; }
        }
        .lm-pulse { animation: lm-pulse 1.5s infinite; }
      `}</style>

      <Map
        initialViewState={
          selectedKey || !bounds
            ? { longitude: center[1], latitude: center[0], zoom }
            : {
                bounds,
                fitBoundsOptions: { padding: 50, maxZoom: 12 },
              }
        }
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        onClick={handleMapClick}
        clickTolerance={5}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {markers.map((m) => (
          <Marker
            key={m.key}
            longitude={m.lng}
            latitude={m.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onMarkerClick(m.key);
            }}
          >
            <MarkerIcon
              count={m.count}
              isLive={m.isLive}
              isSelected={selectedKey === m.key}
            />
          </Marker>
        ))}
      </Map>
    </>
  );
}
