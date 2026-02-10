/**
 * DaySmart Schedule Fetcher
 *
 * Fetches REAL public schedule data from DaySmart-powered facilities.
 * Uses the JSON:API /events endpoint (same one the Dash SPA uses).
 *
 * Endpoint pattern (from DaySmart's schedule.php example):
 *   GET /dash/jsonapi/api/v1/events
 *     ?company={slug}
 *     &filter[end__gte]={startISO}
 *     &filter[start__lt]={endISO}
 *     &filter[eventType.code__not]=L          (exclude locker room)
 *     &filter[and.or.0.publish]=true           (public events)
 *     &filter[and.or.1.and.publish]=false      (plus private events with display_private)
 *     &filter[and.or.1.and.eventType.display_private]=true
 *     &include=resource,resourceArea,eventType
 *     &sort=start
 *     &page[size]=100
 */

import { StickAndPuckSession, SessionType } from '@/types';

const DAYSMART_BASE = 'https://apps.daysmartrecreation.com/dash';
const API_BASE = `${DAYSMART_BASE}/jsonapi/api/v1`;

// ── Cache ──────────────────────────────────────────────────────────────
const scheduleCache = new Map<string, { data: StickAndPuckSession[]; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ── Facility Metadata ──────────────────────────────────────────────────
// Static info about known DaySmart facilities. We use this to set rinkId,
// rinkName, and location so sessions integrate with the rest of our data.
interface FacilityMeta {
  rinkId: string;
  rinkName: string;
  location: StickAndPuckSession['location'];
}

const FACILITY_META: Record<string, FacilityMeta> = {
  warmemorial: {
    rinkId: 'iceplex',
    rinkName: 'Baptist Health IcePlex',
    location: {
      venue: 'Baptist Health IcePlex',
      address: '3299 Sportsplex Dr',
      city: 'Fort Lauderdale',
      state: 'FL',
      lat: 26.1275,
      lng: -80.1727,
    },
  },
  iceden: {
    rinkId: 'iceden',
    rinkName: 'Florida Panthers IceDen',
    location: {
      venue: 'Florida Panthers IceDen',
      address: '3299 Sportsplex Dr',
      city: 'Coral Springs',
      state: 'FL',
      lat: 26.2710,
      lng: -80.2534,
    },
  },
};

// ── Session Type Classification ────────────────────────────────────────

function classifySessionType(eventName: string, eventTypeName: string): SessionType | null {
  const combined = `${eventName} | ${eventTypeName}`.toLowerCase();

  // Stick & Puck
  if (combined.includes('stick') && combined.includes('puck')) return 'stick-and-puck';
  if (combined.includes('s&p') || combined.includes('s & p')) return 'stick-and-puck';

  // Public Skate
  if (combined.includes('public') && combined.includes('skate')) return 'public-skate';
  if (combined.includes('public') && combined.includes('skating')) return 'public-skate';
  if (/\bopen\s+skat/.test(combined)) return 'public-skate';

  // Drop-in Hockey
  if (combined.includes('drop-in') || combined.includes('drop in')) return 'drop-in';
  if (combined.includes('rat hockey')) return 'drop-in';
  if (combined.includes('shinny')) return 'drop-in';

  // Open Hockey
  if (combined.includes('open hockey')) return 'open-hockey';
  if (combined.includes('pickup hockey') || combined.includes('pick-up hockey') || combined.includes('pick up hockey')) return 'open-hockey';
  if (combined.includes('adult hockey') && !combined.includes('league')) return 'open-hockey';

  // ── Skip patterns (team practices, games, lessons, rentals, etc.) ──
  const skip = [
    'freestyle', 'figure', 'practice', 'game', 'lesson', 'clinic', 'camp',
    'class', 'learn to', 'rental', 'party', 'private', 'maintenance',
    'locker', 'meeting', 'office', 'training', 'rehearsal', 'show',
    'competition', 'test', 'evaluation', 'tryout', 'showcase', 'broomball',
    'curling', 'resurfac', 'zamboni',
  ];
  for (const s of skip) {
    if (combined.includes(s)) return null;
  }

  return null; // Unknown → don't display
}

// ── Time helpers ────────────────────────────────────────────────────────

function extractTime24(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function extractDateISO(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

// ── JSON:API response types ─────────────────────────────────────────────

interface JsonApiResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | Array<{ id: string; type: string }> }>;
}

// ── Main Fetch ──────────────────────────────────────────────────────────

export async function fetchDaySmartSchedule(
  facilitySlug: string,
  daysAhead: number = 28,
): Promise<StickAndPuckSession[]> {
  const meta = FACILITY_META[facilitySlug];
  if (!meta) {
    console.error(`[DaySmart Schedule] Unknown facility slug: ${facilitySlug}`);
    return [];
  }

  // ── Check cache ──
  const cached = scheduleCache.get(facilitySlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const now = new Date();
    // Start from beginning of today
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      .toISOString().slice(0, 19);
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19);

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.api+json',
      'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilitySlug}/`,
    };

    // Paginate through all events in the date range
    let allEvents: JsonApiResource[] = [];
    let allIncluded: JsonApiResource[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) {
      const url = new URL(`${API_BASE}/events`);
      url.searchParams.set('company', facilitySlug);
      url.searchParams.set('filter[end__gte]', startDate);
      url.searchParams.set('filter[start__lt]', endDate);
      url.searchParams.set('filter[eventType.code__not]', 'L');
      // Published events OR private events whose type allows display
      url.searchParams.set('filter[and.or.0.publish]', 'true');
      url.searchParams.set('filter[and.or.1.and.publish]', 'false');
      url.searchParams.set('filter[and.or.1.and.eventType.display_private]', 'true');
      url.searchParams.set('include', 'resource,resourceArea,eventType');
      url.searchParams.set('sort', 'start');
      url.searchParams.set('page[size]', '100');
      url.searchParams.set('page[number]', String(page));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch(url.toString(), {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          console.error(`[DaySmart Schedule] API returned ${res.status} for ${facilitySlug} (page ${page})`);
          break;
        }

        const json = await res.json();
        const events: JsonApiResource[] = json?.data || [];
        const included: JsonApiResource[] = json?.included || [];

        allEvents = allEvents.concat(events);
        allIncluded = allIncluded.concat(included);

        // Check pagination
        const lastPage = json?.meta?.page?.['last-page'] ?? json?.meta?.page?.last_page ?? 1;
        hasMore = page < lastPage && events.length === 100;
        page++;
      } catch (fetchErr) {
        clearTimeout(timeout);
        console.error(`[DaySmart Schedule] Fetch error page ${page}:`, fetchErr);
        break;
      }
    }

    if (allEvents.length === 0) {
      console.warn(`[DaySmart Schedule] No events returned for ${facilitySlug}`);
      return [];
    }

    // ── Build lookup maps from included data ──
    const resourceMap = new Map<string, string>();
    const eventTypeMap = new Map<string, { name: string; code: string }>();

    for (const item of allIncluded) {
      const t = item.type?.toLowerCase().replace(/[_-]/g, '');
      if (t === 'resources' || t === 'resource') {
        resourceMap.set(item.id, (item.attributes?.name as string) || '');
      }
      if (t === 'eventtypes' || t === 'eventtype' || t === 'eventtypes') {
        eventTypeMap.set(item.id, {
          name: (item.attributes?.name as string) || '',
          code: (item.attributes?.code as string) || '',
        });
      }
    }

    // ── Map events → StickAndPuckSession ──
    const sessions: StickAndPuckSession[] = [];

    for (const event of allEvents) {
      const attrs = event.attributes || {};
      const eventName = (attrs.name as string) || '';
      const startStr = attrs.start as string;
      const endStr = attrs.end as string;
      if (!startStr || !endStr) continue;

      // Event type lookup
      const etRel = event.relationships?.eventType?.data;
      const etId = etRel && !Array.isArray(etRel) ? etRel.id : null;
      const eventType = etId ? eventTypeMap.get(etId) : null;
      const eventTypeName = eventType?.name || '';

      // Classify
      const sessionType = classifySessionType(eventName, eventTypeName);
      if (!sessionType) continue;

      // Resource (sub-rink) lookup
      const resRel = event.relationships?.resource?.data;
      const resId = resRel && !Array.isArray(resRel) ? resRel.id : null;
      const resourceName = resId ? resourceMap.get(resId) : null;

      const date = extractDateISO(startStr);
      const dayOfWeek = new Date(startStr).getDay();
      const displayName = eventName || eventTypeName;

      // Build notes with sub-rink info
      const noteParts: string[] = [];
      if (resourceName) noteParts.push(resourceName);
      if (attrs.description && typeof attrs.description === 'string' && attrs.description.length < 200) {
        noteParts.push(attrs.description);
      }

      // Registration capacity
      const maxParticipants = typeof attrs.max_participants === 'number' ? attrs.max_participants : undefined;
      const registered = typeof attrs.registered_count === 'number' ? attrs.registered_count : undefined;
      if (registered !== undefined && maxParticipants !== undefined) {
        noteParts.push(`${registered}/${maxParticipants} registered`);
      }

      sessions.push({
        id: `ds-${facilitySlug}-${event.id}`,
        rinkId: meta.rinkId,
        rinkName: meta.rinkName,
        sessionType,
        name: displayName,
        location: { ...meta.location },
        date,
        dayOfWeek,
        startTime: extractTime24(startStr),
        endTime: extractTime24(endStr),
        price: typeof attrs.price === 'number' ? attrs.price : 0,
        currency: 'USD',
        maxSkaters: maxParticipants,
        notes: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
        source: 'daysmart',
        sourceUrl: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilitySlug}/`,
        registrationUrl: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilitySlug}/`,
        lastVerified: new Date().toISOString().split('T')[0],
      });
    }

    // Cache results
    scheduleCache.set(facilitySlug, { data: sessions, timestamp: Date.now() });

    console.log(
      `[DaySmart Schedule] ${facilitySlug}: ${sessions.length} ice-time sessions from ${allEvents.length} total events (${page - 1} pages)`
    );

    return sessions;
  } catch (error) {
    console.error(`[DaySmart Schedule] Fatal error for ${facilitySlug}:`, error);
    return [];
  }
}

/**
 * Fetch schedules for ALL known DaySmart facilities in parallel.
 * Returns a flat array of sessions.
 */
export async function fetchAllDaySmartSchedules(): Promise<StickAndPuckSession[]> {
  const slugs = Object.keys(FACILITY_META);
  const results = await Promise.allSettled(
    slugs.map((slug) => fetchDaySmartSchedule(slug))
  );

  const sessions: StickAndPuckSession[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      sessions.push(...result.value);
    }
  }
  return sessions;
}

/** Get the list of known DaySmart facility slugs */
export function getDaySmartFacilitySlugs(): string[] {
  return Object.keys(FACILITY_META);
}

/** Check if a rinkId belongs to a DaySmart facility */
export function isDaySmartRink(rinkId: string): boolean {
  return Object.values(FACILITY_META).some((m) => m.rinkId === rinkId);
}
