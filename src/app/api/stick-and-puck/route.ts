import { NextRequest, NextResponse } from 'next/server';
import { SEED_RINKS, ALL_SEED_SESSIONS } from '@/lib/seedStickAndPuck';
import {
  fetchAllDaySmartSchedules,
  getDaySmartRinkIds,
  getSlugToRinkId,
} from '@/lib/daysmartSchedule';
import { calculateDistance } from '@/lib/geocoder';
import { StickAndPuckSession } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const sessionType = searchParams.get('type') || 'all';
  const day = searchParams.get('day'); // 0-6 or null for all

  const hasLocation = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);

  // ── Fetch live DaySmart data ───────────────────────────────────────
  let daySmartSessions: StickAndPuckSession[] = [];
  const facilityResults: Record<
    string,
    { count: number; fromCache: boolean; confirmed: boolean }
  > = {};

  try {
    const result = await fetchAllDaySmartSchedules();
    daySmartSessions = result.sessions;
    Object.assign(facilityResults, result.facilityResults);
  } catch (err) {
    console.error('[Ice Time] DaySmart fetch failed, using seed data only:', err);
  }

  // ── Determine which rinks have CONFIRMED live data ─────────────────
  // Only suppress seed data for a rink when DaySmart confirmed a response
  // (even if 0 sessions — that means the rink is genuinely empty today).
  // If DaySmart errored (confirmed=false), keep seed data as fallback.
  const daySmartRinkIds = getDaySmartRinkIds();
  const slugToRinkId = getSlugToRinkId();
  const confirmedDaySmartRinkIds = new Set<string>();

  for (const [slug, info] of Object.entries(facilityResults)) {
    if (!info.confirmed) continue;

    // Find rinkId from live sessions first (most reliable)
    const rinkIdFromSessions = daySmartSessions.find(
      (s) => s.id.startsWith(`ds-${slug}-`),
    )?.rinkId;

    const rinkId = rinkIdFromSessions ?? slugToRinkId[slug];
    if (rinkId) {
      confirmedDaySmartRinkIds.add(rinkId);
    }
  }

  // ── Build session list ─────────────────────────────────────────────
  let sessions: StickAndPuckSession[] = [];

  // 1. All DaySmart live sessions
  sessions.push(...daySmartSessions);

  // 2. Seed sessions only for rinks without confirmed live data
  for (const seedSession of ALL_SEED_SESSIONS) {
    const isDaySmartManaged = daySmartRinkIds.has(seedSession.rinkId);
    const hasConfirmedLiveData = confirmedDaySmartRinkIds.has(seedSession.rinkId);

    if (isDaySmartManaged && hasConfirmedLiveData) {
      // Live data confirmed for this rink — skip seed
      continue;
    }
    sessions.push(seedSession);
  }

  // ── Filter by session type ─────────────────────────────────────────
  if (sessionType !== 'all') {
    sessions = sessions.filter((s) => s.sessionType === sessionType);
  }

  // ── Filter by day of week ──────────────────────────────────────────
  if (day !== null && day !== undefined) {
    const dayNum = parseInt(day, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      sessions = sessions.filter((s) => s.dayOfWeek === dayNum);
    }
  }

  // ── Filter out past sessions ───────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  sessions = sessions.filter((s) => s.date >= today);

  // ── Add distance ───────────────────────────────────────────────────
  const sessionsWithDistance = sessions.map((s) => ({
    ...s,
    distance: hasLocation
      ? calculateDistance(lat, lng, s.location.lat, s.location.lng)
      : null,
  }));

  // ── Sort: date → time → distance ──────────────────────────────────
  sessionsWithDistance.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    const timeComp = a.startTime.localeCompare(b.startTime);
    if (timeComp !== 0) return timeComp;
    if (a.distance != null && b.distance != null) return a.distance - b.distance;
    return 0;
  });

  // ── Build rink list ────────────────────────────────────────────────
  const rinkIds = new Set(sessionsWithDistance.map((s) => s.rinkId));
  const rinks = SEED_RINKS.filter((r) => rinkIds.has(r.id)).map((r) => ({
    ...r,
    sessions: [],
    distance: hasLocation
      ? calculateDistance(lat, lng, r.location.lat, r.location.lng)
      : null,
  }));

  if (hasLocation) {
    rinks.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }

  // ── Source summary ─────────────────────────────────────────────────
  const daySmartSessionCount = sessionsWithDistance.filter(
    (s) => s.source === 'daysmart',
  ).length;
  const seedSessionCount = sessionsWithDistance.filter(
    (s) => s.source === 'seed',
  ).length;

  return NextResponse.json({
    sessions: sessionsWithDistance,
    rinks,
    totalSessions: sessionsWithDistance.length,
    totalRinks: rinks.length,
    sources: {
      daysmart: confirmedDaySmartRinkIds.size,
      daysmartSessions: daySmartSessionCount,
      seed: seedSessionCount,
      facilityResults,
    },
  });
}
