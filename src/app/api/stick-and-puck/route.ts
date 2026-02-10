import { NextRequest, NextResponse } from 'next/server';
import { SEED_RINKS, ALL_SEED_SESSIONS } from '@/lib/seedStickAndPuck';
import { calculateDistance } from '@/lib/geocoder';
import { StickAndPuckSession } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const radiusMiles = parseFloat(searchParams.get('radius') || '10');
  const sessionType = searchParams.get('type') || 'all'; // stick-and-puck, open-hockey, public-skate, drop-in, freestyle, all
  const day = searchParams.get('day'); // 0-6 or null for all

  const radiusKm = radiusMiles * 1.60934;

  // Start with all seed sessions
  let sessions: StickAndPuckSession[] = [...ALL_SEED_SESSIONS];

  // Filter by radius if location provided
  if (lat !== 0 && lng !== 0) {
    sessions = sessions.filter((s) => {
      const dist = calculateDistance(lat, lng, s.location.lat, s.location.lng);
      return dist <= radiusKm;
    });
  }

  // Filter by session type
  if (sessionType !== 'all') {
    sessions = sessions.filter(s => s.sessionType === sessionType);
  }

  // Filter by day of week
  if (day !== null && day !== undefined) {
    const dayNum = parseInt(day, 10);
    if (!isNaN(dayNum)) {
      sessions = sessions.filter(s => s.dayOfWeek === dayNum);
    }
  }

  // Filter out past sessions
  const today = new Date().toISOString().split('T')[0];
  sessions = sessions.filter(s => s.date >= today);

  // Sort by date, then time
  sessions.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.startTime.localeCompare(b.startTime);
  });

  // Add distance to each session if location provided
  const sessionsWithDistance = sessions.map(s => ({
    ...s,
    distance: lat !== 0 && lng !== 0
      ? calculateDistance(lat, lng, s.location.lat, s.location.lng)
      : null,
  }));

  // Get unique rinks in range
  const rinkIds = new Set(sessions.map(s => s.rinkId));
  const rinks = SEED_RINKS.filter(r => rinkIds.has(r.id)).map(r => ({
    ...r,
    sessions: [], // Don't duplicate sessions in rink objects
    distance: lat !== 0 && lng !== 0
      ? calculateDistance(lat, lng, r.location.lat, r.location.lng)
      : null,
  }));

  return NextResponse.json({
    sessions: sessionsWithDistance,
    rinks,
    totalSessions: sessionsWithDistance.length,
    totalRinks: rinks.length,
    radiusMiles,
  });
}
