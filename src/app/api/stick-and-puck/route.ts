import { NextRequest, NextResponse } from 'next/server';
import { SEED_RINKS, ALL_SEED_SESSIONS } from '@/lib/seedStickAndPuck';
import { fetchAllDaySmartSchedules, isDaySmartRink } from '@/lib/daysmartSchedule';
import { calculateDistance } from '@/lib/geocoder';
import { StickAndPuckSession } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const sessionType = searchParams.get('type') || 'all';
  const day = searchParams.get('day'); // 0-6 or null for all

  const hasLocation = lat !== 0 && lng !== 0;

  // ── Fetch REAL schedule data from DaySmart facilities ──
  let daySmartSessions: StickAndPuckSession[] = [];
  try {
    daySmartSessions = await fetchAllDaySmartSchedules();
  } catch (err) {
    console.error('[Ice Time] DaySmart fetch failed, using seed data:', err);
  }

  // Track which rinks got real data from DaySmart
  const daySmartRinkIds = new Set(daySmartSessions.map((s) => s.rinkId));

  // ── Build session list ──
  // For DaySmart rinks: use real data if available, otherwise fall back to seed data
  // For non-DaySmart rinks: always use seed data
  let sessions: StickAndPuckSession[] = [];

  // Add DaySmart live sessions
  sessions.push(...daySmartSessions);

  // Add seed sessions for rinks that DON'T have live DaySmart data
  for (const seedSession of ALL_SEED_SESSIONS) {
    if (isDaySmartRink(seedSession.rinkId) && daySmartRinkIds.has(seedSession.rinkId)) {
      // This rink has real DaySmart data — skip seed data
      continue;
    }
    sessions.push(seedSession);
  }

  // ── Filter by session type ──
  if (sessionType !== 'all') {
    sessions = sessions.filter((s) => s.sessionType === sessionType);
  }

  // ── Filter by day of week ──
  if (day !== null && day !== undefined) {
    const dayNum = parseInt(day, 10);
    if (!isNaN(dayNum)) {
      sessions = sessions.filter((s) => s.dayOfWeek === dayNum);
    }
  }

  // ── Filter out past sessions ──
  const today = new Date().toISOString().split('T')[0];
  sessions = sessions.filter((s) => s.date >= today);

  // ── Add distance ──
  const sessionsWithDistance = sessions.map((s) => ({
    ...s,
    distance: hasLocation
      ? calculateDistance(lat, lng, s.location.lat, s.location.lng)
      : null,
  }));

  // ── Sort by date then time ──
  sessionsWithDistance.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.startTime.localeCompare(b.startTime);
  });

  // ── Build rink list ──
  const rinkIds = new Set(sessions.map((s) => s.rinkId));
  const rinks = SEED_RINKS.filter((r) => rinkIds.has(r.id)).map((r) => ({
    ...r,
    sessions: [],
    distance: hasLocation
      ? calculateDistance(lat, lng, r.location.lat, r.location.lng)
      : null,
  }));

  if (hasLocation) {
    rinks.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  return NextResponse.json({
    sessions: sessionsWithDistance,
    rinks,
    totalSessions: sessionsWithDistance.length,
    totalRinks: rinks.length,
    sources: {
      daysmart: daySmartRinkIds.size,
      daysmartSessions: daySmartSessions.length,
      seed: sessions.filter((s) => s.source === 'seed').length,
    },
  });
}
