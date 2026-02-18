/**
 * DaySmart Schedule Fetcher — hardened, retry-capable implementation.
 *
 * Fetches REAL public schedule data from DaySmart-powered facilities.
 * Uses the JSON:API /events endpoint (same one the Dash SPA uses).
 */

import { StickAndPuckSession, SessionType } from '@/types';

const API_BASE = 'https://apps.daysmartrecreation.com/dash/jsonapi/api/v1';

// ── Local date helper ──────────────────────────────────────────────────
// Build YYYY-MM-DD from a Date using LOCAL time, not UTC.
// This prevents the server's UTC timezone from shifting dates.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Build a naive ISO datetime string (no timezone suffix) from local time.
// DaySmart expects local-time filter values without a timezone offset.
function toLocalISOStr(d: Date): string {
  const date = toLocalDateStr(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${date}T${hh}:${mm}:${ss}`;
}

// ── Cache ──────────────────────────────────────────────────────────────
interface CacheEntry {
  data: StickAndPuckSession[];
  timestamp: number;
  confirmed: boolean;
}
const scheduleCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000;
const ERROR_CACHE_TTL = 2 * 60 * 1000;

// ── Slug → rinkId mapping ──────────────────────────────────────────────
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

function classifySessionType(
  eventName: string,
  eventTypeName: string,
): SessionType | null {
  const combined = `${eventName} | ${eventTypeName}`.toLowerCase();

  if (combined.includes('stick') && combined.includes('puck')) return 'stick-and-puck';
  if (combined.includes('s&p') || combined.includes('s & p')) return 'stick-and-puck';
  if (/\bstick\s*n\s*puck\b/.test(combined)) return 'stick-and-puck';

  if (combined.includes('public') && combined.includes('skat')) return 'public-skate';
  if (/\bopen\s+skat/.test(combined)) return 'public-skate';
  if (combined.includes('family skate')) return 'public-skate';

  if (combined.includes('drop-in') || combined.includes('drop in')) return 'drop-in';
  if (combined.includes('rat hockey')) return 'drop-in';
  if (combined.includes('shinny')) return 'drop-in';

  if (combined.includes('open hockey')) return 'open-hockey';
  if (
    combined.includes('pickup hockey') ||
    combined.includes('pick-up hockey') ||
    combined.includes('pick up hockey')
  ) return 'open-hockey';
  if (combined.includes('adult hockey') && !combined.includes('league')) return 'open-hockey';
  if (combined.includes('adult open') && combined.includes('hock')) return 'open-hockey';

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

  return null;
}

// ── Time helpers ────────────────────────────────────────────────────────

/**
 * Extract HH:MM from a DaySmart ISO string.
 * DaySmart returns times in local facility time WITHOUT a timezone suffix,
 * e.g. "2026-01-15T06:00:00". Slice directly to avoid UTC conversion.
 */
function extractTime24(iso: string): string {
  if (iso.length >= 16 && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return iso.slice(11, 16);
  }
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Extract YYYY-MM-DD from a DaySmart ISO string.
 * Slices directly when no timezone suffix to avoid UTC shift.
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
    {
      data?:
        | { id: string; type: string }
        | Array<{ id: string; type: string }>;
    }
  >;
}

// ── Type string normalizer ──────────────────────────────────────────────

function normalizeType(raw: string): string {
  return raw.toLowerCase().replace(/[-_]/g, '').replace(/s$/, '');
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
): Promise<{
  sessions: StickAndPuckSession[];
  fromCache: boolean;
  confirmed: boolean;
}> {
  const meta = FACILITY_META[facilitySlug];
  if (!meta) {
    console.error(`[DaySmart] Unknown facility slug: ${facilitySlug}`);
    return { sessions: [], fromCache: false, confirmed: false };
  }

  const cached = scheduleCache.get(facilitySlug);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const ttl = cached.confirmed ? CACHE_TTL : ERROR_CACHE_TTL;
    if (age < ttl) {
      return { sessions: cached.data, fromCache: true, confirmed: cached.confirmed };
    }
  }

  const staleData = cached?.data ?? [];

  try {
    const now = new Date();

    // Use local midnight as start — avoids UTC date shift on the server
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(startOfToday.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const startDateStr = toLocalISOStr(startOfToday);
    const endDateStr = toLocalISOStr(endDate);

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
    let gotAnyResponse = false;

    while (hasMore && page <= 10) {
      const url = new URL(`${API_BASE}/events`);
      url.searchParams.set('company', facilitySlug);
      url.searchParams.set('filter[end__gte]', startDateStr);
      url.searchParams.set('filter[start__lt]', endDateStr);
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
        if (!gotAnyResponse) {
          scheduleCache.set(facilitySlug, { data: staleData, timestamp: Date.now(), confirmed: false });
          return { sessions: staleData, fromCache: staleData.length > 0, confirmed: false };
        }
        break;
      }

      gotAnyResponse = true;
      const json = await res.json();
      const events: JsonApiResource[] = Array.isArray(json?.data) ? json.data : [];
      const included: JsonApiResource[] = Array.isArray(json?.included) ? json.included : [];

      allEvents = allEvents.concat(events);
      for (const inc of included) {
        if (!allIncluded.some((x) => x.id === inc.id && x.type === inc.type)) {
          allIncluded.push(inc);
        }
      }

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

    const resourceMap = new Map<string, string>();
    const eventTypeMap = new Map<string, { name: string; code: string }>();

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

    const sessions: StickAndPuckSession[] = [];

    for (const event of allEvents) {
      const attrs = event.attributes ?? {};
      const eventName = String(attrs.name ?? '').trim();
      const startStr = attrs.start as string | undefined;
      const endStr = attrs.end as string | undefined;
      if (!startStr || !endStr) continue;

      const etRel = event.relationships?.eventType?.data;
      const etId = etRel && !Array.isArray(etRel) ? etRel.id : null;
      const eventType = etId ? eventTypeMap.get(etId) : null;
      const eventTypeName = eventType?.name ?? '';

      const sessionType = classifySessionType(eventName, eventTypeName);
      if (!sessionType) continue;

      const resRel = event.relationships?.resource?.data;
      const resId = resRel && !Array.isArray(resRel) ? resRel.id : null;
      const resourceName = resId ? resourceMap.get(resId) : null;

      const date = extractDateISO(startStr);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

      const rawPrice = attrs.price ?? attrs.cost ?? 0;
      const price =
        typeof rawPrice === 'number'
          ? rawPrice
          : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

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

      const noteParts: string[] = [];
      if (resourceName) noteParts.push(resourceName);
      const desc = attrs.description ?? attrs.notes;
      if (typeof desc === 'string' && desc.trim().length > 0 && desc.trim().length < 200) {
        noteParts.push(desc.trim());
      }
      if (registeredCount !== undefined && maxParticipants !== undefined) {
        noteParts.push(`${registeredCount}/${maxParticipants} registered`);
      }

      const combinedText =
        `${eventName} ${eventTypeName} ${typeof desc === 'string' ? desc : ''}`.toLowerCase();
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
        lastVerified: toLocalDateStr(new Date()),
      });
    }

    scheduleCache.set(facilitySlug, { data: sessions, timestamp: Date.now(), confirmed: true });
    console.log(
      `[DaySmart] ${facilitySlug}: ${sessions.length} ice-time sessions` +
        ` from ${allEvents.length} total events (${page - 1} pages)`,
    );
    return { sessions, fromCache: false, confirmed: true };
  } catch (error) {
    console.error(`[DaySmart] Fatal error for ${facilitySlug}:`, error);
    scheduleCache.set(facilitySlug, { data: staleData, timestamp: Date.now(), confirmed: false });
    return { sessions: staleData, fromCache: staleData.length > 0, confirmed: false };
  }
}

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

export function getDaySmartFacilitySlugs(): string[] {
  return Object.keys(FACILITY_META);
}

export function isDaySmartRink(rinkId: string): boolean {
  return Object.values(FACILITY_META).some((m) => m.rinkId === rinkId);
}

export function getDaySmartRinkIds(): Set<string> {
  return new Set(Object.values(FACILITY_META).map((m) => m.rinkId));
}

export function getSlugToRinkId(): Record<string, string> {
  return { ...SLUG_TO_RINK_ID };
}
