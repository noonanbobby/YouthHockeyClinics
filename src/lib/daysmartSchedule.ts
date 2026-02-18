/**
 * DaySmart Schedule Fetcher — hardened, retry-capable implementation.
 *
 * Fetches REAL public schedule data from DaySmart-powered facilities.
 * Uses the JSON:API /events endpoint (same one the Dash SPA uses).
 *
 * Endpoint pattern:
 *   GET /dash/jsonapi/api/v1/events
 *     ?company={slug}
 *     &filter[end__gte]={startISO}
 *     &filter[start__lt]={endISO}
 *     &filter[eventType.code__not]=L
 *     &filter[and.or.0.publish]=true
 *     &filter[and.or.1.and.publish]=false
 *     &filter[and.or.1.and.eventType.display_private]=true
 *     &include=resource,resourceArea,eventType
 *     &sort=start
 *     &page[size]=100
 */

import { StickAndPuckSession, SessionType } from '@/types';

const DAYSMART_BASE = 'https://apps.daysmartrecreation.com/dash';
const API_BASE = `${DAYSMART_BASE}/jsonapi/api/v1`;

// ── Cache ──────────────────────────────────────────────────────────────
interface CacheEntry {
  data: StickAndPuckSession[];
  timestamp: number;
  /** true = we got a real (possibly empty) response from the API */
  confirmed: boolean;
}
const scheduleCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000;      // 15 min for successful fetches
const ERROR_CACHE_TTL = 2 * 60 * 1000; // 2 min back-off after errors

// ── Slug → rinkId mapping (kept in sync with FACILITY_META) ───────────
const SLUG_TO_RINK_ID: Record<string, string> = {
  warmemorial: 'iceplex',
  iceden: 'iceden',
};

// ── Facility Metadata ──────────────────────────────────────────────────
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

  // Stick & Puck — most specific, check first
  if (combined.includes('stick') && combined.includes('puck')) return 'stick-and-puck';
  if (combined.includes('s&p') || combined.includes('s & p')) return 'stick-and-puck';
  if (/\bstick\s*n\s*puck\b/.test(combined)) return 'stick-and-puck';

  // Public Skate
  if (combined.includes('public') && combined.includes('skat')) return 'public-skate';
  if (/\bopen\s+skat/.test(combined)) return 'public-skate';
  if (combined.includes('family skate')) return 'public-skate';

  // Drop-in Hockey
  if (combined.includes('drop-in') || combined.includes('drop in')) return 'drop-in';
  if (combined.includes('rat hockey')) return 'drop-in';
  if (combined.includes('shinny')) return 'drop-in';

  // Open Hockey
  if (combined.includes('open hockey')) return 'open-hockey';
  if (
    combined.includes('pickup hockey') ||
    combined.includes('pick-up hockey') ||
    combined.includes('pick up hockey')
  )
    return 'open-hockey';
  if (combined.includes('adult hockey') && !combined.includes('league')) return 'open-hockey';
  if (combined.includes('adult open') && combined.includes('hock')) return 'open-hockey';

  // ── Skip patterns ──────────────────────────────────────────────────
  const skip = [
    'freestyle', 'figure', 'practice', 'game', 'lesson', 'clinic', 'camp',
    'class', 'learn to', 'rental', 'party', 'private', 'maintenance',
    'locker', 'meeting', 'office', 'training', 'rehearsal', 'show',
    'competition', 'test', 'evaluation', 'tryout', 'showcase', 'broomball',
    'curling', 'resurfac', 'zamboni', 'hockey school', 'power skating',
    'synchro', 'synchronized',
  ];
  for (const s of skip) {
    if (combined.includes(s)) return null;
  }

  return null; // Unknown → don't display
}

// ── Time helpers ────────────────────────────────────────────────────────

/**
 * Extract HH:MM from a DaySmart ISO string.
 * DaySmart returns times in local facility time WITHOUT a timezone suffix,
 * e.g. "2026-01-15T06:00:00".  We slice the string directly to avoid
 * UTC conversion on the server.
 */
function extractTime24(iso: string): string {
  // No timezone suffix → treat as local, slice directly
  if (iso.length >= 16 && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return iso.slice(11, 16); // "HH:MM"
  }
  // Has timezone info → parse and convert
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Extract YYYY-MM-DD from a DaySmart ISO string.
 * Same reasoning — slice directly when no timezone suffix.
 */
function extractDateISO(iso: string): string {
  if (iso.length >= 10 && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return iso.slice(0, 10);
  }
  return new Date(iso).toISOString().split('T')[0];
}

// ── JSON:API response types ─────────────────────────────────────────────

interface JsonApiResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data?: { id: string; type: string } | Array<{ id: string; type: string }> }
  >;
}

// ── Type string normalizer ──────────────────────────────────────────────
// DaySmart returns inconsistent type strings:
//   "eventTypes", "event-types", "eventtype", "EventType", "resources", "resource"
// Normalize to singular lowercase with no separators.

function normalizeType(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[-_]/g, '')   // strip separators
    .replace(/s$/, '');     // strip trailing 's' (plurals)
}

// ── Retry helper ────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 3,
  timeoutMs = 12000,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      // Back off and retry on rate-limit / service unavailable
      if ((res.status === 429 || res.status === 503) && attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }
  throw lastErr;
}

// ── Main Fetch ──────────────────────────────────────────────────────────

export async function fetchDaySmartSchedule(
  facilitySlug: string,
  daysAhead = 28,
): Promise<{ sessions: StickAndPuckSession[]; fromCache: boolean; confirmed: boolean }> {
  const meta = FACILITY_META[facilitySlug];
  if (!meta) {
    console.error(`[DaySmart] Unknown facility slug: ${facilitySlug}`);
    return { sessions: [], fromCache: false, confirmed: false };
  }

  // ── Cache check ──────────────────────────────────────────────────────
  const cached = scheduleCache.get(facilitySlug);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const ttl = cached.confirmed ? CACHE_TTL : ERROR_CACHE_TTL;
    if (age < ttl) {
      return { sessions: cached.data, fromCache: true, confirmed: cached.confirmed };
    }
  }

  try {
    const now = new Date();
    // Start from beginning of today in local time
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 19);
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.api+json, application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilitySlug}/`,
      Origin: 'https://apps.daysmartrecreation.com',
    };

    let allEvents: JsonApiResource[] = [];
    let allIncluded: JsonApiResource[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const url = new URL(`${API_BASE}/events`);
      url.searchParams.set('company', facilitySlug);
      url.searchParams.set('filter[end__gte]', startDate);
      url.searchParams.set('filter[start__lt]', endDate);
      url.searchParams.set('filter[eventType.code__not]', 'L');
      url.searchParams.set('filter[and.or.0.publish]', 'true');
      url.searchParams.set('filter[and.or.1.and.publish]', 'false');
      url.searchParams.set('filter[and.or.1.and.eventType.display_private]', 'true');
      url.searchParams.set('include', 'resource,resourceArea,eventType');
      url.searchParams.set('sort', 'start');
      url.searchParams.set('page[size]', '100');
      url.searchParams.set('page[number]', String(page));

      const res = await fetchWithRetry(url.toString(), headers);

      if (!res.ok) {
        console.error(`[DaySmart] API ${res.status} for ${facilitySlug} page ${page}`);
        break;
      }

      const json = await res.json();
      const events: JsonApiResource[] = Array.isArray(json?.data) ? json.data : [];
      const included: JsonApiResource[] = Array.isArray(json?.included) ? json.included : [];

      allEvents = allEvents.concat(events);

      // De-duplicate included resources by id+type
      for (const inc of included) {
        if (!allIncluded.some((x) => x.id === inc.id && x.type === inc.type)) {
          allIncluded.push(inc);
        }
      }

      // Pagination
      const pageMeta = json?.meta;
      const lastPage =
        pageMeta?.page?.['last-page'] ??
        pageMeta?.page?.last_page ??
        pageMeta?.['last-page'] ??
        1;
      hasMore = page < Number(lastPage) && events.length > 0;
      page++;
    }

    if (allEvents.length === 0) {
      console.warn(`[DaySmart] No events returned for ${facilitySlug}`);
      scheduleCache.set(facilitySlug, { data: [], timestamp: Date.now(), confirmed: true });
      return { sessions: [], fromCache: false, confirmed: true };
    }

    // ── Build lookup maps from included resources ──────────────────────
    const resourceMap = new Map<string, string>();       // id → name
    const eventTypeMap = new Map<string, { name: string; code: string }>(); // id → {name,code}

    for (const item of allIncluded) {
      const nt = normalizeType(item.type ?? '');
      if (nt === 'resource') {
        resourceMap.set(item.id, (item.attributes?.name as string) ?? '');
      }
      if (nt === 'eventtype') {
        eventTypeMap.set(item.id, {
          name: (item.attributes?.name as string) ?? '',
          code: (item.attributes?.code as string) ?? '',
        });
      }
    }

    // ── Map events → StickAndPuckSession ──────────────────────────────
    const sessions: StickAndPuckSession[] = [];

    for (const event of allEvents) {
      const attrs = event.attributes ?? {};
      const eventName = String(attrs.name ?? '').trim();
      const startStr = attrs.start as string | undefined;
      const endStr = attrs.end as string | undefined;
      if (!startStr || !endStr) continue;

      // Event type lookup
      const etRel = event.relationships?.eventType?.data;
      const etId = etRel && !Array.isArray(etRel) ? etRel.id : null;
      const eventType = etId ? eventTypeMap.get(etId) : null;
      const eventTypeName = eventType?.name ?? '';

      // Classify — skip non-ice-time events
      const sessionType = classifySessionType(eventName, eventTypeName);
      if (!sessionType) continue;

      // Resource (sub-rink) lookup
      const resRel = event.relationships?.resource?.data;
      const resId = resRel && !Array.isArray(resRel) ? resRel.id : null;
      const resourceName = resId ? resourceMap.get(resId) : null;

      const date = extractDateISO(startStr);
      // Use noon on the date string to avoid DST edge cases for getDay()
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

      // Price — API may send string or number
      const rawPrice = attrs.price ?? attrs.cost ?? 0;
      const price =
        typeof rawPrice === 'number'
          ? rawPrice
          : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

      // Capacity
      const maxParticipants =
        typeof attrs.max_participants === 'number'
          ? attrs.max_participants
          : typeof attrs.maxParticipants === 'number'
          ? attrs.maxParticipants
          : undefined;
      const registeredCount =
        typeof attrs.registered_count === 'number'
          ? attrs.registered_count
          : typeof attrs.registeredCount === 'number'
          ? attrs.registeredCount
          : undefined;

      // Notes
      const noteParts: string[] = [];
      if (resourceName) noteParts.push(resourceName);
      const desc = attrs.description ?? attrs.notes;
      if (typeof desc === 'string' && desc.trim().length > 0 && desc.trim().length < 200) {
        noteParts.push(desc.trim());
      }
      if (registeredCount !== undefined && maxParticipants !== undefined) {
        noteParts.push(`${registeredCount}/${maxParticipants} registered`);
      }

      // Goalie free detection
      const combinedText = `${eventName} ${eventTypeName} ${typeof desc === 'string' ? desc : ''}`.toLowerCase();
      const goaliesFree =
        combinedText.includes('goalie free') ||
        combinedText.includes('goalies free') ||
        combinedText.includes('goalie skate free') ||
        combinedText.includes('goalies skate free') ||
        combinedText.includes('goalies no charge') ||
        combinedText.includes('free for goalies')
          ? true
          : undefined;

      sessions.push({
        id: `ds-${facilitySlug}-${event.id}`,
        rinkId: meta.rinkId,
        rinkName: meta.rinkName,
        sessionType,
        name: eventName || eventTypeName,
        location: { ...meta.location },
        date,
        dayOfWeek,
        startTime: extractTime24(startStr),
        endTime: extractTime24(endStr),
        price,
        currency: 'USD',
        maxSkaters: maxParticipants,
        goaliesFree,
        notes: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
        source: 'daysmart',
        sourceUrl: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilitySlug}/`,
        registrationUrl: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilitySlug}/`,
        lastVerified: new Date().toISOString().split('T')[0],
      });
    }

    // Cache successful result
    scheduleCache.set(facilitySlug, { data: sessions, timestamp: Date.now(), confirmed: true });

    console.log(
      `[DaySmart] ${facilitySlug}: ${sessions.length} ice-time sessions from ${allEvents.length} total events (${page - 1} pages)`,
    );

    return { sessions, fromCache: false, confirmed: true };
  } catch (error) {
    console.error(`[DaySmart] Fatal error for ${facilitySlug}:`, error);
    // Cache the failure with a short TTL; return stale data if available
    scheduleCache.set(facilitySlug, {
      data: cached?.data ?? [],
      timestamp: Date.now(),
      confirmed: false,
    });
    return { sessions: cached?.data ?? [], fromCache: !!cached, confirmed: false };
  }
}

/**
 * Fetch schedules for ALL known DaySmart facilities in parallel.
 */
export async function fetchAllDaySmartSchedules(): Promise<{
  sessions: StickAndPuckSession[];
  facilityResults: Record<string, { count: number; fromCache: boolean; confirmed: boolean }>;
}> {
  const slugs = Object.keys(FACILITY_META);
  const results = await Promise.allSettled(slugs.map((slug) => fetchDaySmartSchedule(slug)));

  const sessions: StickAndPuckSession[] = [];
  const facilityResults: Record<string, { count: number; fromCache: boolean; confirmed: boolean }> = {};

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      sessions.push(...result.value.sessions);
      facilityResults[slug] = {
        count: result.value.sessions.length,
        fromCache: result.value.fromCache,
        confirmed: result.value.confirmed,
      };
    } else {
      facilityResults[slug] = { count: 0, fromCache: false, confirmed: false };
    }
  }

  return { sessions, facilityResults };
}

/** Get the list of known DaySmart facility slugs */
export function getDaySmartFacilitySlugs(): string[] {
  return Object.keys(FACILITY_META);
}

/** Check if a rinkId belongs to a DaySmart-managed facility */
export function isDaySmartRink(rinkId: string): boolean {
  return Object.values(FACILITY_META).some((m) => m.rinkId === rinkId);
}

/** Get the Set of all DaySmart-managed rinkIds */
export function getDaySmartRinkIds(): Set<string> {
  return new Set(Object.values(FACILITY_META).map((m) => m.rinkId));
}

/** Map facility slug → rinkId */
export function getSlugToRinkId(): Record<string, string> {
  return { ...SLUG_TO_RINK_ID };
}
