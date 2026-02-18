import { StickAndPuckSession, SessionType } from '@/types';

const API_BASE = 'https://apps.daysmartrecreation.com/dash/jsonapi/api/v1';
const DASH_BASE = 'https://apps.daysmartrecreation.com/dash/x/#/online';

const orgIdCache = new Map<string, string | null>();
const scheduleCache = new Map<string, { data: StickAndPuckSession[]; timestamp: number; confirmed: boolean }>();

const CACHE_TTL = 15 * 60 * 1000;
const ERROR_CACHE_TTL = 2 * 60 * 1000;

const SLUG_TO_RINK_ID: Record<string, string> = {
  warmemorial: 'iceplex',
  iceden: 'iceden',
};

interface FacilityMeta {
  rinkId: string;
  rinkName: string;
  location: StickAndPuckSession['location'];
}

const FACILITY_META: Record<string, FacilityMeta> = {
  warmemorial: {
    rinkId: 'iceplex',
    rinkName: 'Baptist Health IcePlex',
    location: { venue: 'Baptist Health IcePlex', address: '3299 Sportsplex Dr', city: 'Sunrise', state: 'FL', lat: 26.1275, lng: -80.1727 },
  },
  iceden: {
    rinkId: 'iceden',
    rinkName: 'Florida Panthers IceDen',
    location: { venue: 'Florida Panthers IceDen', address: '3299 Sportsplex Dr', city: 'Coral Springs', state: 'FL', lat: 26.271, lng: -80.2534 },
  },
};

function classifySessionType(eventName: string, eventTypeName: string): SessionType | null {
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
  if (combined.includes('pickup hockey') || combined.includes('pick-up hockey')) return 'open-hockey';
  if (combined.includes('adult hockey') && !combined.includes('league')) return 'open-hockey';

  const skip = ['freestyle', 'figure', 'practice', 'game', 'lesson', 'clinic', 'camp', 'class', 'rental', 'party', 'private', 'maintenance', 'locker', 'meeting', 'training', 'show', 'competition', 'test', 'tryout', 'broomball'];
  for (const s of skip) if (combined.includes(s)) return null;

  return null;
}

function toNaiveDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toNaiveISOStr(d: Date): string {
  return `${toNaiveDateStr(d)}T00:00:00`;
}

function extractTime24(iso: string): string {
  if (iso.length >= 16 && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return iso.slice(11, 16);
  }
  const d = new Date(iso);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

function extractDateISO(iso: string): string {
  if (iso.length >= 10 && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return iso.slice(0, 10);
  }
  return new Date(iso).toISOString().split('T')[0];
}

interface JsonApiResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

function normalizeType(raw: string): string {
  return raw.toLowerCase().replace(/[-_]/g, '').replace(/s$/, '');
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3, timeoutMs = 15000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('All retries failed');
}

function buildHeaders(facilitySlug: string): Record<string, string> {
  return {
    Accept: 'application/vnd.api+json, application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: `${DASH_BASE}/${facilitySlug}/`,
    Origin: 'https://apps.daysmartrecreation.com',
  };
}

async function discoverOrgId(facilitySlug: string, headers: Record<string, string>): Promise<string | null> {
  if (orgIdCache.has(facilitySlug)) return orgIdCache.get(facilitySlug) ?? null;

  const strategies = [
    `${API_BASE}/organizations?filter[slug]=${encodeURIComponent(facilitySlug)}&page[size]=5`,
    `${API_BASE}/organizations?filter[company]=${encodeURIComponent(facilitySlug)}&page[size]=5`,
    `${API_BASE}/organizations?company=${encodeURIComponent(facilitySlug)}&page[size]=5`,
    `${API_BASE}/organizations?page[size]=20`,
  ];

  for (const url of strategies) {
    try {
      const res = await fetchWithRetry(url, headers, 2, 8000);
      if (!res.ok) continue;
      const json = await res.json();
      const orgs: JsonApiResource[] = Array.isArray(json?.data) ? json.data : [];
      if (orgs.length === 0) continue;

      const match = orgs.find(o => 
        (o.attributes?.slug as string) === facilitySlug ||
        (o.attributes?.company as string) === facilitySlug
      ) ?? (orgs.length === 1 ? orgs[0] : null);

      if (match?.id) {
        orgIdCache.set(facilitySlug, match.id);
        return match.id;
      }
    } catch {}
  }

  orgIdCache.set(facilitySlug, null);
  return null;
}

async function fetchEventsPage(
  facilitySlug: string,
  orgId: string | null,
  startDateStr: string,
  endDateStr: string,
  page: number,
  headers: Record<string, string>
): Promise<{ data: JsonApiResource[]; included: JsonApiResource[]; lastPage: number } | null> {

  const buildUrl = (excludeLeague: boolean): string => {
    const url = new URL(`${API_BASE}/events`);
    url.searchParams.set('company', facilitySlug);
    url.searchParams.set('filter[end__gte]', startDateStr);
    url.searchParams.set('filter[start__lt]', endDateStr);
    if (orgId) url.searchParams.set('filter[organization]', orgId);
    if (excludeLeague) url.searchParams.set('filter[eventType.code__not]', 'L');
    url.searchParams.set('include', 'resource,resourceArea,eventType');
    url.searchParams.set('sort', 'start');
    url.searchParams.set('page[size]', '100');
    url.searchParams.set('page[number]', String(page));
    return url.toString();
  };

  for (let excludeLeague = false; ; excludeLeague = true) {
    const urlStr = buildUrl(excludeLeague);
    let res: Response;
    try {
      res = await fetchWithRetry(urlStr, headers, 2, 15000);
    } catch {
      return null;
    }

    if (!res.ok) {
      if (excludeLeague) return null;
      continue;
    }

    const json = await res.json();
    const data: JsonApiResource[] = Array.isArray(json?.data) ? json.data : [];
    const included: JsonApiResource[] = Array.isArray(json?.included) ? json.included : [];

    const pageMeta = json?.meta as any;
    const lastPage = Number(pageMeta?.page?.['last-page'] ?? pageMeta?.page?.last_page ?? 1);

    return { data, included, lastPage };
  }
}

export async function fetchDaySmartSchedule(facilitySlug: string, daysAhead = 28) {
  const meta = FACILITY_META[facilitySlug];
  if (!meta) return { sessions: [], fromCache: false, confirmed: false };

  const cached = scheduleCache.get(facilitySlug);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < (cached.confirmed ? CACHE_TTL : ERROR_CACHE_TTL)) {
      return { sessions: cached.data, fromCache: true, confirmed: cached.confirmed };
    }
  }

  const staleData = cached?.data ?? [];

  try {
    const headers = buildHeaders(facilitySlug);
    const orgId = await discoverOrgId(facilitySlug, headers);

    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const endDate = new Date(startDate.getTime() + (daysAhead + 1) * 24 * 60 * 60 * 1000);

    const startDateStr = toNaiveISOStr(startDate);
    const endDateStr = toNaiveISOStr(endDate);

    let allEvents: JsonApiResource[] = [];
    const allIncluded: JsonApiResource[] = [];
    let page = 1;
    let hasMore = true;
    let gotAnyResponse = false;

    while (hasMore && page <= 10) {
      const result = await fetchEventsPage(facilitySlug, orgId, startDateStr, endDateStr, page, headers);
      if (!result) {
        if (!gotAnyResponse) {
          scheduleCache.set(facilitySlug, { data: staleData, timestamp: Date.now(), confirmed: false });
          return { sessions: staleData, fromCache: staleData.length > 0, confirmed: false };
        }
        break;
      }
      gotAnyResponse = true;
      allEvents = allEvents.concat(result.data);
      allIncluded.push(...result.included);
      hasMore = page < result.lastPage && result.data.length > 0;
      page++;
    }

    if (allEvents.length === 0) {
      scheduleCache.set(facilitySlug, { data: [], timestamp: Date.now(), confirmed: true });
      return { sessions: [], fromCache: false, confirmed: true };
    }

    const resourceMap = new Map<string, string>();
    const eventTypeMap = new Map<string, { name: string; code: string }>();

    for (const item of allIncluded) {
      const nt = normalizeType(item.type ?? '');
      if (nt === 'resource') {
        resourceMap.set(item.id, (item.attributes?.name as string) ?? '');
      } else if (nt === 'eventtype') {
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
      const eventType = eventTypeMap.get(event.relationships?.eventType?.data?.id as string);
      const resourceName = resourceMap.get(event.relationships?.resource?.data?.id as string);
      const date = extractDateISO(attrs.start as string);
      const startTime = extractTime24(attrs.start as string);
      const endTime = extractTime24(attrs.end as string);

      const sessionType = classifySessionType(eventName, eventType?.name ?? '');

      if (!sessionType) continue;

      sessions.push({
        id: `ds-${facilitySlug}-${event.id}`,
        rinkId: meta.rinkId,
        rinkName: meta.rinkName,
        sessionType,
        name: eventName,
        location: meta.location,
        date,
        dayOfWeek: new Date(date).getUTCDay(),
        startTime,
        endTime,
        price: typeof attrs.price === 'number' ? attrs.price : 0,
        currency: 'USD',
        source: 'daysmart',
        lastVerified: date,
      });
    }

    scheduleCache.set(facilitySlug, { data: sessions, timestamp: Date.now(), confirmed: true });
    return { sessions, fromCache: false, confirmed: true };

  } catch (error) {
    console.error(`[DaySmart] Fatal error for ${facilitySlug}:`, error);
    scheduleCache.set(facilitySlug, { data: staleData, timestamp: Date.now(), confirmed: false });
    return { sessions: staleData, fromCache: staleData.length > 0, confirmed: false };
  }
}

export async function fetchAllDaySmartSchedules() {
  const slugs = Object.keys(FACILITY_META);
  const results = await Promise.allSettled(slugs.map(slug => fetchDaySmartSchedule(slug)));

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
  return Object.values(FACILITY_META).some(m => m.rinkId === rinkId);
}
