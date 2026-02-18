import { StickAndPuckSession, SessionType } from '@/types';

const API_BASE = 'https://apps.daysmartrecreation.com/dash/jsonapi/api/v1';
const DASH_BASE = 'https://apps.daysmartrecreation.com/dash/x/#/online';

function toNaiveDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toNaiveISOStr(d: Date): string {
  return `${toNaiveDateStr(d)}T00:00:00`;
}

const orgIdCache = new Map<string, string | null>();

interface CacheEntry {
  data: StickAndPuckSession[];
  timestamp: number;
  confirmed: boolean;
}
const scheduleCache = new Map<string, CacheEntry>();
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
      lat: 26.271,
      lng: -80.2534,
    },
  },
};

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
  relationships?: Record<
    string,
    {
      data?:
        | { id: string; type: string }
        | Array<{ id: string; type: string }>;
    }
  >;
}

function normalizeType(raw: string): string {
  return raw.toLowerCase().replace(/[-_]/g, '').replace(/s$/, '');
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = 3,
  timeoutMs = 15000,
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

function buildHeaders(facilitySlug: string): Record<string, string> {
  return {
    Accept: 'application/vnd.api+json, application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Referer: `${DASH_BASE}/${facilitySlug}/`,
    Origin: 'https://apps.daysmartrecreation.com',
  };
}

async function discoverOrgId(
  facilitySlug: string,
  headers: Record<string, string>,
): Promise<string | null> {
  if (orgIdCache.has(facilitySlug)) {
    return orgIdCache.get(facilitySlug) ?? null;
  }

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

      const match =
        orgs.find(
          (o) =>
            (o.attributes?.slug as string | undefined) === facilitySlug ||
            (o.attributes?.company as string | undefined) === facilitySlug ||
            (o.attributes?.name as string | undefined)
              ?.toLowerCase()
              .replace(/\s+/g, '') ===
              facilitySlug.toLowerCase().replace(/\s+/g, ''),
        ) ?? (orgs.length === 1 ? orgs[0] : null);

      if (match?.id) {
        orgIdCache.set(facilitySlug, match.id);
        console.log(`[DaySmart] Discovered org ID for ${facilitySlug}: ${match.id} (via ${url})`);
        return match.id;
      }
    } catch (err) {
      console.warn(`[DaySmart] Org-ID strategy failed (${url}):`, err);
    }
  }

  console.warn(`[DaySmart] Could not discover org ID for ${facilitySlug} — proceeding without it`);
  orgIdCache.set(facilitySlug, null);
  return null;
}

async function fetchEventsPage(
  facilitySlug: string,
  orgId: string | null,
  startDateStr: string,
  endDateStr: string,
  page: number,
  headers: Record<string, string>,
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

  for (const excludeLeague of [true, false]) {
    const urlStr = buildUrl(excludeLeague);
    let res: Response;
    try {
      res = await fetchWithRetry(urlStr, headers, 2, 15000);
    } catch (err) {
      console.error(`[DaySmart] Network error for ${facilitySlug} page ${page}:`, err);
      return null;
    }

    if (!res.ok) {
      console.warn(
        `[DaySmart] HTTP ${res.status} for ${facilitySlug} page ${page}` +
          (excludeLeague ? ' (with league filter) — retrying without' : ' (without league filter)'),
      );
      if (excludeLeague) continue;
      return null;
    }

    let json: Record<string, unknown>;
    try {
      json = await res.json();
    } catch {
      console.error(`[DaySmart] JSON parse error for ${facilitySlug} page ${page}`);
      return null;
    }

    const data: JsonApiResource[] = Array.isArray(json?.data) ? (json.data as JsonApiResource[]) : [];
    const included: JsonApiResource[] = Array.isArray(json?.included) ? (json.included as JsonApiResource[]) : [];

    const pageMeta = json?.meta as Record<string, unknown> | undefined;
    const pageInfo = pageMeta?.page as Record<string, unknown> | undefined;
    const lastPage = Number(
      pageInfo?.['last-page'] ?? pageInfo?.last_page ?? pageMeta?.['last-page'] ?? 1,
    );

    return { data, included, lastPage };
  }

  return null;
}

export async function fetchDaySmartSchedule(
  facilitySlug: string,
  daysAhead = 28,
): Promise<{ sessions: StickAndPuckSession[]; fromCache: boolean; confirmed: boolean }> {
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
    const headers = buildHeaders(facilitySlug);
    const orgId = await discoverOrgId(facilitySlug, headers);

    const now = new Date();
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
    );
    const endDate = new Date(startDate.getTime() + (daysAhead + 1) * 24 * 60 * 60 * 1000);

    const startDateStr = toNaiveISOStr(startDate);
    const endDateStr = toNaiveISOStr(endDate);

    let allEvents: JsonApiResource[] = [];
    let allIncluded: JsonApiResource[] = [];
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

      for (const inc of result.included) {
        if (!allIncluded.some((x) => x.id === inc.id && x.type === inc.type)) {
          allIncluded.push(inc);
        }
      }

      hasMore = page < result.lastPage && result.data.length > 0;
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
      const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();

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
        sourceUrl: `${DASH_BASE}/${facilitySlug}/`,
        registrationUrl: `${DASH_BASE}/${facilitySlug}/`,
        lastVerified: toNaiveDateStr(new Date()),
      });
    }

    scheduleCache.set(facilitySlug, { data: sessions, timestamp: Date.now(), confirmed: true });
    console.log(
      `[DaySmart] ${facilitySlug}: ${sessions.length} ice-time sessions from ${allEvents.length} total events (${page - 1} page(s))`,
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
      console.error(`[DaySmart] fetchAllDaySmartSchedules: ${slug} rejected:`, result.reason);
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
