import { NextRequest, NextResponse } from 'next/server';
import { SEED_RINKS, ALL_SEED_SESSIONS } from '@/lib/seedStickAndPuck';
import { calculateDistance } from '@/lib/geocoder';
import { StickAndPuckSession } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const sessionType = searchParams.get('type') || 'all'; // stick-and-puck, open-hockey, public-skate, drop-in, freestyle, all
  const day = searchParams.get('day'); // 0-6 or null for all

  const hasLocation = lat !== 0 && lng !== 0;

  // Start with ALL seed sessions — no radius filtering for seed data.
  // All South Florida rinks should always be visible.
  let sessions: StickAndPuckSession[] = [...ALL_SEED_SESSIONS];

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

  // Add distance to each session
  const sessionsWithDistance = sessions.map(s => ({
    ...s,
    distance: hasLocation
      ? calculateDistance(lat, lng, s.location.lat, s.location.lng)
      : null,
  }));

  // Sort by distance (nearest first) if location provided, otherwise by date/time
  sessionsWithDistance.sort((a, b) => {
    // Primary sort: date
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    // Secondary sort: time
    return a.startTime.localeCompare(b.startTime);
  });

  // Get unique rinks from filtered sessions
  const rinkIds = new Set(sessions.map(s => s.rinkId));
  const rinks = SEED_RINKS.filter(r => rinkIds.has(r.id)).map(r => ({
    ...r,
    sessions: [], // Don't duplicate sessions in rink objects
    distance: hasLocation
      ? calculateDistance(lat, lng, r.location.lat, r.location.lng)
      : null,
  }));

  // Sort rinks by distance if location provided
  if (hasLocation) {
    rinks.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  return NextResponse.json({
    sessions: sessionsWithDistance,
    rinks,
    totalSessions: sessionsWithDistance.length,
    totalRinks: rinks.length,
  });
}
