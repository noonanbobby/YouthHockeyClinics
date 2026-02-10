import { NextRequest, NextResponse } from 'next/server';

/**
 * DaySmart / Dash integration API
 *
 * Calls the DaySmart JSON:API REST API directly.
 * Base: https://apps.daysmartrecreation.com/dash/jsonapi/api/v1/
 * Company: warmemorial (Baptist Health IcePlex / War Memorial)
 *
 * Flow:
 * 1. POST /api/integrations/daysmart?action=login   → Authenticate, get session cookie
 * 2. POST /api/integrations/daysmart?action=sync     → Fetch customer-events + programs
 * 3. POST /api/integrations/daysmart?action=programs  → Fetch available programs/clinics
 */

const DAYSMART_BASE = 'https://apps.daysmartrecreation.com/dash';
const API_BASE = `${DAYSMART_BASE}/jsonapi/api/v1`;
const COMPANY = 'warmemorial';

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

// Known customer IDs for the Noonan family
const KNOWN_CUSTOMERS: Record<string, string> = {
  '20120': 'Bobby Noonan',
  '20121': 'Silas Noonan',
  '20122': 'Sawyer Noonan',
};

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'sync';

  try {
    const body = await request.json();
    const { email, password, sessionCookie } = body;

    switch (action) {
      case 'login':
        return handleLogin(email, password);
      case 'sync':
        return handleSync(sessionCookie || '', body.customerIds);
      case 'programs':
        return handlePrograms(sessionCookie || '', body.customerIds);
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
 * Step 1: Login to DaySmart and get session cookies
 */
async function handleLogin(email: string, password: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  try {
    // DaySmart uses a PHP login endpoint
    const loginUrl = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${COMPANY}`;

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${COMPANY}/login`,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[DaySmart] Login failed:', res.status, text);
      return NextResponse.json(
        { error: 'Login failed', status: res.status, details: text.slice(0, 200) },
        { status: 401 }
      );
    }

    // Extract session cookies from response
    const setCookieHeaders = res.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.map((c) => c.split(';')[0]).join('; ');

    const data = await res.json().catch(() => ({}));

    // Get customer IDs from the login response or fetch them
    let customerIds: string[] = [];
    if (data?.customer_id) {
      customerIds = [String(data.customer_id)];
    }

    // Also try to fetch the account's linked customers
    if (cookies) {
      try {
        const custRes = await fetch(
          `${API_BASE}/customers?cache[save]=false&company=${COMPANY}`,
          {
            headers: {
              'Accept': 'application/vnd.api+json',
              'Cookie': cookies,
              'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${COMPANY}/`,
            },
          }
        );
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData?.data) {
            customerIds = custData.data.map((c: { id: string }) => c.id);
          }
        }
      } catch {
        // Fall back to known customer IDs
        customerIds = Object.keys(KNOWN_CUSTOMERS);
      }
    }

    return NextResponse.json({
      success: true,
      sessionCookie: cookies,
      customerIds: customerIds.length > 0 ? customerIds : Object.keys(KNOWN_CUSTOMERS),
      facility: 'Baptist Health IcePlex',
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
 * Step 2: Sync — fetch registered events for all family members
 */
async function handleSync(sessionCookie: string, customerIds?: string[]) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const filterIds = customerIds || Object.keys(KNOWN_CUSTOMERS);

  // Fetch customer events (registered activities)
  const eventsUrl = new URL(`${API_BASE}/customer-events`);
  eventsUrl.searchParams.set('cache[save]', 'false');
  eventsUrl.searchParams.set('include', 'customer,resource.facility,eventType,registrations,rosterRegistration.finances');
  eventsUrl.searchParams.set('page[size]', '100');
  eventsUrl.searchParams.set('sort', '-start');
  eventsUrl.searchParams.set('fields[customer]', 'id,first_name,last_name');
  // Filter to specific customer IDs if provided
  if (filterIds.length > 0) {
    eventsUrl.searchParams.set('filter[customer_id__in]', filterIds.join(','));
  }
  eventsUrl.searchParams.set('company', COMPANY);

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.api+json',
    'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${COMPANY}/activities`,
  };
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  try {
    const res = await fetch(eventsUrl.toString(), { headers });

    if (!res.ok) {
      // If auth fails, return a descriptive error
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
        facilityMap.set(item.id, item.attributes?.name || 'Baptist Health IcePlex');
      }
      if (item.type === 'event-type' || item.type === 'event_type' || item.type === 'eventType') {
        eventTypeMap.set(item.id, item.attributes?.name || '');
      }
    }

    // Also add known customers
    for (const [id, name] of Object.entries(KNOWN_CUSTOMERS)) {
      if (!customerMap.has(id)) customerMap.set(id, name);
    }

    // Parse events into our format
    const activities: ParsedActivity[] = events.map((event) => {
      const attrs = event.attributes || {};
      const custRel = event.relationships?.customer?.data;
      const custId = custRel?.id || '';
      const custName = customerMap.get(custId) || KNOWN_CUSTOMERS[custId] || 'Unknown';

      const facilityRel = event.relationships?.resource?.data;
      const facilityName = facilityRel ? facilityMap.get(facilityRel.id) || 'Baptist Health IcePlex' : 'Baptist Health IcePlex';

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
        location: facilityName,
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
 * Step 3: Fetch available programs and clinics for registration
 */
async function handlePrograms(sessionCookie: string, customerIds?: string[]) {
  const childIds = customerIds || ['20121', '20122']; // Silas, Sawyer

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.api+json',
    'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${COMPANY}/programs`,
  };
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  try {
    // Fetch programs for each child
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
      const progUrl = `${API_BASE}/programs?cache[save]=false&filter[customer_id]=${childId}&include=activities&company=${COMPANY}`;

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
              location: 'Baptist Health IcePlex',
              spotsAvailable: Number(attrs.spots_available || attrs.max_participants || 0),
              customerId: childId,
              customerName: KNOWN_CUSTOMERS[childId] || `Customer ${childId}`,
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
