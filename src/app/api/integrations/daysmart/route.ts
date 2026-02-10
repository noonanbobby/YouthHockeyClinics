import { NextRequest, NextResponse } from 'next/server';
import { fetchDaySmartSchedule } from '@/lib/daysmartSchedule';

/**
 * DaySmart / Dash integration API — UNIVERSAL
 *
 * Works with ANY DaySmart-powered facility worldwide.
 * The client provides the facility slug (e.g. "warmemorial", "iceden", "rinkname").
 *
 * DaySmart JSON:API base: https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/
 *
 * Flow:
 * 1. POST ?action=login    → { email, password, facilityId } → Authenticate, discover family members
 * 2. POST ?action=sync     → { facilityId, sessionCookie, customerIds } → Fetch events
 * 3. POST ?action=programs → { facilityId, sessionCookie, customerIds } → Fetch available programs
 */

const DAYSMART_BASE = 'https://apps.daysmartrecreation.com/dash';
const API_BASE = `${DAYSMART_BASE}/jsonapi/api/v1`;

interface DaySmartEvent {
  id: string;
  type: string;
  attributes: {
    start?: string;
    end?: string;
    name?: string;
    description?: string;
    status?: string;
    [key: string]: unknown;
  };
  relationships?: {
    customer?: { data: { id: string; type: string } };
    resource?: { data: { id: string; type: string } };
    eventType?: { data: { id: string; type: string } };
    registrations?: { data: Array<{ id: string; type: string }> };
    [key: string]: unknown;
  };
}

interface ParsedActivity {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  price: number;
  category: string;
  registered: boolean;
  customerName: string;
  customerId: string;
}

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'sync';

  try {
    const body = await request.json();
    const { email, password, sessionCookie, facilityId } = body;

    if (!facilityId && action !== 'validate') {
      return NextResponse.json(
        { error: 'facilityId is required. This is the slug from your DaySmart rink URL (e.g. "warmemorial").' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'validate':
        return handleValidate(body.facilityId || '');
      case 'login':
        return handleLogin(email, password, facilityId);
      case 'sync':
        return handleSync(facilityId, sessionCookie || '', body.customerIds);
      case 'programs':
        return handlePrograms(facilityId, sessionCookie || '', body.customerIds);
      case 'schedule':
        return handleSchedule(facilityId);
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[DaySmart] Error:', error);
    return NextResponse.json(
      { error: 'DaySmart integration error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Validate a facility slug — check if it exists on DaySmart
 */
async function handleValidate(facilityId: string) {
  if (!facilityId) {
    return NextResponse.json({ error: 'Facility ID required' }, { status: 400 });
  }

  try {
    // Try to fetch facility options — this is a public endpoint
    const optionsUrl = `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`;
    const res = await fetch(optionsUrl, {
      headers: {
        'Accept': 'application/json',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        valid: false,
        error: `Facility "${facilityId}" not found on DaySmart. Check the URL.`,
      });
    }

    const data = await res.json().catch(() => null);
    const facilityName = data?.company?.name || data?.name || facilityId;

    return NextResponse.json({
      valid: true,
      facilityId,
      facilityName,
    });
  } catch {
    return NextResponse.json({
      valid: false,
      error: 'Could not reach DaySmart. Check your internet connection.',
    });
  }
}

/**
 * Login to DaySmart and discover family members automatically
 */
async function handleLogin(email: string, password: string, facilityId: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  try {
    // DaySmart uses a PHP login endpoint — facility-specific
    const loginUrl = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[DaySmart] Login failed:', res.status, text);
      return NextResponse.json(
        { error: 'Login failed. Check your email and password.' },
        { status: 401 }
      );
    }

    // Extract session cookies from response
    const setCookieHeaders = res.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.map((c) => c.split(';')[0]).join('; ');

    const data = await res.json().catch(() => ({}));

    // Discover all linked customers (family members) from the API
    const familyMembers: Array<{ id: string; name: string }> = [];
    let customerIds: string[] = [];

    // The login response may include the primary customer ID
    if (data?.customer_id) {
      customerIds = [String(data.customer_id)];
    }

    // Fetch the account's linked customers
    if (cookies) {
      try {
        const custRes = await fetch(
          `${API_BASE}/customers?cache[save]=false&company=${facilityId}`,
          {
            headers: {
              'Accept': 'application/vnd.api+json',
              'Cookie': cookies,
              'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
            },
          }
        );
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData?.data && Array.isArray(custData.data)) {
            for (const customer of custData.data) {
              const fn = customer.attributes?.first_name || '';
              const ln = customer.attributes?.last_name || '';
              const name = `${fn} ${ln}`.trim();
              familyMembers.push({ id: customer.id, name: name || `Customer #${customer.id}` });
            }
            customerIds = custData.data.map((c: { id: string }) => c.id);
          }
        }
      } catch (err) {
        console.error('[DaySmart] Failed to fetch customers:', err);
      }
    }

    // If we still have no customers, try the primary ID from login response
    if (customerIds.length === 0 && data?.customer_id) {
      customerIds = [String(data.customer_id)];
      familyMembers.push({ id: String(data.customer_id), name: data?.name || email });
    }

    // Get the facility name
    let facilityName = facilityId;
    try {
      const optionsUrl = `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`;
      const optRes = await fetch(optionsUrl, {
        headers: { 'Accept': 'application/json', 'Cookie': cookies },
      });
      if (optRes.ok) {
        const optData = await optRes.json().catch(() => null);
        facilityName = optData?.company?.name || optData?.name || facilityId;
      }
    } catch {
      // Use the slug as fallback
    }

    return NextResponse.json({
      success: true,
      sessionCookie: cookies,
      customerIds,
      familyMembers,
      facilityId,
      facilityName,
    });
  } catch (error) {
    console.error('[DaySmart] Login error:', error);
    return NextResponse.json(
      { error: 'Could not connect to DaySmart. The service may be temporarily unavailable.' },
      { status: 503 }
    );
  }
}

/**
 * Sync — fetch registered events for all family members at any facility
 */
async function handleSync(facilityId: string, sessionCookie: string, customerIds?: string[]) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Fetch customer events (registered activities)
  const eventsUrl = new URL(`${API_BASE}/customer-events`);
  eventsUrl.searchParams.set('cache[save]', 'false');
  eventsUrl.searchParams.set('include', 'customer,resource.facility,eventType,registrations,rosterRegistration.finances');
  eventsUrl.searchParams.set('page[size]', '100');
  eventsUrl.searchParams.set('sort', '-start');
  eventsUrl.searchParams.set('fields[customer]', 'id,first_name,last_name');
  // Filter to specific customer IDs if provided
  if (customerIds && customerIds.length > 0) {
    eventsUrl.searchParams.set('filter[customer_id__in]', customerIds.join(','));
  }
  eventsUrl.searchParams.set('company', facilityId);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.api+json',
    'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/activities`,
  };
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  try {
    const res = await fetch(eventsUrl.toString(), { headers });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'Session expired. Please reconnect.', needsReauth: true },
          { status: 401 }
        );
      }
      throw new Error(`DaySmart API returned ${res.status}`);
    }

    const data = await res.json();
    const events: DaySmartEvent[] = data?.data || [];
    const included = data?.included || [];

    // Build lookup maps from included data
    const customerMap = new Map<string, string>();
    const facilityMap = new Map<string, string>();
    const eventTypeMap = new Map<string, string>();

    for (const item of included) {
      if (item.type === 'customer' || item.type === 'customers') {
        const fn = item.attributes?.first_name || '';
        const ln = item.attributes?.last_name || '';
        customerMap.set(item.id, `${fn} ${ln}`.trim());
      }
      if (item.type === 'facility' || item.type === 'facilities') {
        facilityMap.set(item.id, item.attributes?.name || facilityId);
      }
      if (item.type === 'event-type' || item.type === 'event_type' || item.type === 'eventType') {
        eventTypeMap.set(item.id, item.attributes?.name || '');
      }
    }

    // Default facility name from map or slug
    const defaultFacilityName = facilityMap.size > 0
      ? [...facilityMap.values()][0]
      : facilityId;

    // Parse events into our format
    const activities: ParsedActivity[] = events.map((event) => {
      const attrs = event.attributes || {};
      const custRel = event.relationships?.customer?.data;
      const custId = custRel?.id || '';
      const custName = customerMap.get(custId) || `Customer #${custId}`;

      const facilityRel = event.relationships?.resource?.data;
      const eventFacility = facilityRel
        ? facilityMap.get(facilityRel.id) || defaultFacilityName
        : defaultFacilityName;

      const eventTypeRel = event.relationships?.eventType?.data;
      const eventTypeName = eventTypeRel ? eventTypeMap.get(eventTypeRel.id) || '' : '';

      // Parse dates
      const start = attrs.start ? new Date(attrs.start as string) : new Date();
      const end = attrs.end ? new Date(attrs.end as string) : start;

      // Extract price from finances if available
      let price = 0;
      const rosterReg = event.relationships?.['rosterRegistration'] as { data?: unknown } | undefined;
      const financeData = rosterReg?.data as { id: string } | Array<{ id: string }> | undefined;
      if (financeData && Array.isArray(included)) {
        const finance = included.find(
          (i: { id: string; type: string; attributes?: { amount?: number } }) =>
            i.type === 'finance' && financeData && (Array.isArray(financeData) ? financeData.some((f) => f.id === i.id) : financeData.id === i.id)
        );
        if (finance?.attributes?.amount) {
          price = Number(finance.attributes.amount);
        }
      }

      return {
        id: event.id,
        name: (attrs.name as string) || eventTypeName || 'Activity',
        description: (attrs.description as string) || '',
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        startTime: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        endTime: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        location: eventFacility,
        price,
        category: eventTypeName || 'Hockey',
        registered: true,
        customerName: custName,
        customerId: custId,
      };
    });

    // Separate into upcoming and past
    const upcoming = activities.filter((a) => a.endDate >= now.split(' ')[0]);
    const past = activities.filter((a) => a.endDate < now.split(' ')[0]);

    return NextResponse.json({
      success: true,
      activities,
      upcoming,
      past,
      totalEvents: activities.length,
      customerMap: Object.fromEntries(customerMap),
      facilityName: defaultFacilityName,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DaySmart] Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities from DaySmart', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Fetch available programs and clinics for registration at any facility
 */
async function handlePrograms(facilityId: string, sessionCookie: string, customerIds?: string[]) {
  const childIds = customerIds || [];

  if (childIds.length === 0) {
    return NextResponse.json({
      success: true,
      programs: [],
      totalPrograms: 0,
      error: 'No customer IDs provided. Connect first to discover family members.',
    });
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.api+json',
    'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/programs`,
  };
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  try {
    const allPrograms: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      startDate: string;
      endDate: string;
      price: number;
      location: string;
      spotsAvailable: number;
      customerId: string;
      customerName: string;
      skillLevel: string;
      ageRange: string;
      season: string;
    }> = [];

    for (const childId of childIds) {
      const progUrl = `${API_BASE}/programs?cache[save]=false&filter[customer_id]=${childId}&include=activities&company=${facilityId}`;

      try {
        const res = await fetch(progUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          const programs = data?.data || [];

          for (const prog of programs) {
            const attrs = prog.attributes || {};
            allPrograms.push({
              id: prog.id,
              name: (attrs.name as string) || 'Program',
              description: (attrs.description as string) || '',
              category: (attrs.category as string) || (attrs.activity_type as string) || 'Hockey',
              startDate: (attrs.start_date as string) || '',
              endDate: (attrs.end_date as string) || '',
              price: Number(attrs.price || attrs.price_per_event || 0),
              location: facilityId,
              spotsAvailable: Number(attrs.spots_available || attrs.max_participants || 0),
              customerId: childId,
              customerName: `Customer #${childId}`,
              skillLevel: (attrs.skill_level as string) || 'Recreational',
              ageRange: (attrs.age_range as string) || 'Youth',
              season: (attrs.season as string) || '',
            });
          }
        }
      } catch (err) {
        console.error(`[DaySmart] Failed to fetch programs for customer ${childId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      programs: allPrograms,
      totalPrograms: allPrograms.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DaySmart] Programs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch programs from DaySmart', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Fetch public schedule for a DaySmart facility (no auth required)
 */
async function handleSchedule(facilityId: string) {
  try {
    const sessions = await fetchDaySmartSchedule(facilityId);
    return NextResponse.json({
      success: true,
      sessions,
      totalSessions: sessions.length,
      facilityId,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DaySmart] Schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule from DaySmart', details: String(error) },
      { status: 500 }
    );
  }
}
