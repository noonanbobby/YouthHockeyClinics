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

function localTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const sessionType = searchParams.get('type') || 'all';
  const day = searchParams.get('day');

  const hasLocation = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);

  let daySmartSessions: StickAndPuckSession[] = [];
  const facilityResults: Record<string, { count: number; fromCache: boolean; confirmed: boolean }> = {};

  try {
    const result = await fetchAllDaySmartSchedules();
    daySmartSessions = result.sessions;
    Object.assign(facilityResults, result.facilityResults);
  } catch (err) {
    console.error('[Ice Time] DaySmart fetch failed, using seed data only:', err);
  }

  const daySmartRinkIds = getDaySmartRinkIds();
  const slugToRinkId = getSlugToRinkId();
  const confirmedDaySmartRinkIds = new Set<string>();

  for (const [slug, info] of Object.entries(facilityResults)) {
    if (!info.confirmed) continue;
    const rinkIdFromSessions = daySmartSessions.find((s) => s.id.startsWith(`ds-${slug}-`))?.rinkId;
    const rinkId = rinkIdFromSessions ?? slugToRinkId[slug];
    if (rinkId) confirmedDaySmartRinkIds.add(rinkId);
  }

  let sessions: StickAndPuckSession[] = [];
  sessions.push(...daySmartSessions);

  for (const seedSession of ALL_SEED_SESSIONS) {
    const isDaySmartManaged = daySmartRinkIds.has(seedSession.rinkId);
    const hasConfirmedLiveData = confirmedDaySmartRinkIds.has(seedSession.rinkId);
    if (isDaySmartManaged && hasConfirmedLiveData) continue;
    sessions.push(seedSession);
  }

  if (sessionType !== 'all') {
    sessions = sessions.filter((s) => s.sessionType === sessionType);
  }

  if (day !== null && day !== undefined) {
    const dayNum = parseInt(day, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      sessions = sessions.filter((s) => s.dayOfWeek === dayNum);
    }
  }

  const today = localTodayStr();
  sessions = sessions.filter((s) => s.date >= today);

  const sessionsWithDistance = sessions.map((s) => ({
    ...s,
    distance: hasLocation ? calculateDistance(lat, lng, s.location.lat, s.location.lng) : null,
  }));

  sessionsWithDistance.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    const timeComp = a.startTime.localeCompare(b.startTime);
    if (timeComp !== 0) return timeComp;
    if (a.distance != null && b.distance != null) return a.distance - b.distance;
    return 0;
  });

  const rinkIds = new Set(sessionsWithDistance.map((s) => s.rinkId));
  const rinks = SEED_RINKS.filter((r) => rinkIds.has(r.id)).map((r) => ({
    ...r,
    sessions: [],
    distance: hasLocation ? calculateDistance(lat, lng, r.location.lat, r.location.lng) : null,
  }));

  if (hasLocation) {
    rinks.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }

  return NextResponse.json({
    sessions: sessionsWithDistance,
    rinks,
    totalSessions: sessionsWithDistance.length,
    totalRinks: rinks.length,
    sources: {
      daysmart: confirmedDaySmartRinkIds.size,
      daysmartSessions: sessionsWithDistance.filter((s) => s.source === 'daysmart').length,
      seed: sessionsWithDistance.filter((s) => s.source === 'seed').length,
      facilityResults,
    },
  });
}
