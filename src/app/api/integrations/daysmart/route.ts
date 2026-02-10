import { NextRequest, NextResponse } from 'next/server';
import { fetchDaySmartSchedule } from '@/lib/daysmartSchedule';

/**
 * DaySmart / Dash integration API — UNIVERSAL
 *
 * Works with ANY DaySmart-powered facility worldwide.
 * The client provides the facility slug (e.g. "warmemorial", "iceden").
 *
 * Authentication strategy (tried in order):
 *   1. OAuth2 password grant at /company/auth/token  → JWT bearer token
 *   2. PHP Auth/login with JSON body                 → session cookie + token extraction
 *   3. PHP Auth/login with form-encoded body          → session cookie
 *
 * All subsequent API calls use Authorization: Bearer {token} when available,
 * falling back to Cookie header for legacy sessions.
 *
 * Flow:
 *   POST ?action=validate      → Check facility slug exists
 *   POST ?action=login         → Authenticate + discover family members
 *   POST ?action=sync          → Fetch registered events
 *   POST ?action=programs      → Fetch available programs
 *   POST ?action=schedule      → Fetch public schedule (no auth)
 *   POST ?action=debug-login   → Try all auth strategies, return raw diagnostics
 */

const DAYSMART_BASE = 'https://apps.daysmartrecreation.com/dash';
const API_BASE = `${DAYSMART_BASE}/jsonapi/api/v1`;

// Alternate API domain used by the official Dash PHP client library
const DASH_API_BASE = 'https://api.dashplatform.com/api/v1';

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

/** Result from any authentication strategy */
interface AuthResult {
  strategy: string;
  token: string;         // JWT or cookie string — used for subsequent API calls
  tokenType: 'bearer' | 'cookie';
  responseData: Record<string, unknown>;
  cookies: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build auth headers for DaySmart API calls */
function buildAuthHeaders(auth: string, facilityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.api+json',
    'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
  };

  if (!auth) return headers;

  // JWT tokens start with 'eyJ' (base64-encoded JSON header)
  if (auth.startsWith('eyJ') || auth.startsWith('Bearer ')) {
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Legacy cookie-based auth
    headers['Cookie'] = auth;
  }

  return headers;
}

/** Extract cookies from a fetch Response */
function extractCookies(res: Response): string {
  let cookies = '';

  // Method 1: getSetCookie() (standard, returns array)
  try {
    const setCookieHeaders = res.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      cookies = setCookieHeaders.map((c) => c.split(';')[0]).join('; ');
    }
  } catch {
    // Not available in this runtime
  }

  // Method 2: get('set-cookie')
  if (!cookies) {
    const raw = res.headers.get('set-cookie') || '';
    if (raw) {
      cookies = raw
        .split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/)
        .map((c) => c.split(';')[0].trim())
        .filter(Boolean)
        .join('; ');
    }
  }

  return cookies;
}

/** Safe JSON parse from response */
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Extract any token-like value from a response body */
function extractToken(data: Record<string, unknown>): string {
  // Try known token field names (DaySmart has used various names)
  for (const key of [
    'access_token', 'token', 'session_token', 'jwt',
    'auth_token', 'api_token', 'bearer_token',
    'accessToken', 'sessionToken', 'authToken',
  ]) {
    if (data[key] && typeof data[key] === 'string') {
      return data[key] as string;
    }
  }

  // Check nested data objects
  if (data.data && typeof data.data === 'object') {
    const nested = data.data as Record<string, unknown>;
    for (const key of ['access_token', 'token', 'session_token', 'jwt']) {
      if (nested[key] && typeof nested[key] === 'string') {
        return nested[key] as string;
      }
    }
    // Check nested attributes
    if (nested.attributes && typeof nested.attributes === 'object') {
      const attrs = nested.attributes as Record<string, unknown>;
      for (const key of ['access_token', 'token', 'session_token']) {
        if (attrs[key] && typeof attrs[key] === 'string') {
          return attrs[key] as string;
        }
      }
    }
  }

  return '';
}

// ── Auth Strategies ──────────────────────────────────────────────────────

/**
 * Strategy 1: OAuth2 password grant at /company/auth/token
 * This is the proper DaySmart API auth flow (their official PHP client uses it).
 */
async function tryOAuth2PasswordGrant(
  email: string, password: string, facilityId: string
): Promise<AuthResult | null> {
  // Try both known API domains
  const bases = [API_BASE, DASH_API_BASE];

  for (const base of bases) {
    try {
      const url = `${base}/company/auth/token?company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'password',
          username: email,
          password,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await safeJson(res);
      console.log(`[DaySmart] OAuth2 ${base} → ${res.status}, keys: ${Object.keys(data).join(',')}`);

      if (res.ok && data.access_token) {
        return {
          strategy: `oauth2-password (${base})`,
          token: data.access_token as string,
          tokenType: 'bearer',
          responseData: data,
          cookies: extractCookies(res),
        };
      }

      // Also check if auth=true even without access_token
      if (res.ok && data.auth === true) {
        const token = extractToken(data);
        if (token) {
          return {
            strategy: `oauth2-password-alt (${base})`,
            token,
            tokenType: 'bearer',
            responseData: data,
            cookies: extractCookies(res),
          };
        }
      }
    } catch (err) {
      console.log(`[DaySmart] OAuth2 ${base} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  return null;
}

/**
 * Strategy 2: PHP Auth/login with JSON body
 * The legacy login endpoint used by the Dash SPA.
 */
async function tryPHPLoginJSON(
  email: string, password: string, facilityId: string
): Promise<AuthResult | null> {
  // Try multiple field name combinations
  const payloads = [
    { email, password },
    { username: email, password },
    { email, password, company: facilityId },
    { username: email, password, company: facilityId },
  ];

  for (const payload of payloads) {
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://apps.daysmartrecreation.com',
          'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const cookies = extractCookies(res);
      const data = await safeJson(res);
      const payloadKeys = Object.keys(payload).join('+');
      console.log(`[DaySmart] PHP-JSON(${payloadKeys}) → ${res.status}, keys: ${Object.keys(data).join(',')}, cookies: ${cookies ? cookies.length + ' chars' : 'NONE'}`);

      if (!res.ok) continue;

      // Check for token in response body
      const token = extractToken(data);

      // Success requires a real token or customer_id in the response body.
      // Bare cookies alone are NOT sufficient — DaySmart returns session cookies
      // (e.g. PHPSESSID) even for failed logins, so cookies without a token/customer_id
      // do not indicate authenticated access.
      if (token || data.customer_id) {
        return {
          strategy: `php-json (${payloadKeys})`,
          token: token || cookies,
          tokenType: token ? 'bearer' : 'cookie',
          responseData: data,
          cookies,
        };
      }
    } catch (err) {
      console.log(`[DaySmart] PHP-JSON failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  return null;
}

/**
 * Strategy 3: PHP Auth/login with form-encoded body
 * Some DaySmart PHP endpoints expect application/x-www-form-urlencoded.
 */
async function tryPHPLoginForm(
  email: string, password: string, facilityId: string
): Promise<AuthResult | null> {
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({
      email,
      username: email,
      password,
      company: facilityId,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const cookies = extractCookies(res);
    const data = await safeJson(res);
    console.log(`[DaySmart] PHP-Form → ${res.status}, keys: ${Object.keys(data).join(',')}, cookies: ${cookies ? cookies.length + ' chars' : 'NONE'}`);

    if (!res.ok) return null;

    const token = extractToken(data);

    // Same as php-json: require a real token or customer_id, not just cookies
    if (token || data.customer_id) {
      return {
        strategy: 'php-form',
        token: token || cookies,
        tokenType: token ? 'bearer' : 'cookie',
        responseData: data,
        cookies,
      };
    }
  } catch (err) {
    console.log(`[DaySmart] PHP-Form failed:`, err instanceof Error ? err.message : String(err));
  }

  return null;
}

// ── Route Handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'sync';

  try {
    const body = await request.json();
    const { email, password, facilityId } = body;
    // Accept both 'sessionCookie' (legacy) and 'authToken' (new)
    const auth = body.authToken || body.sessionCookie || '';

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
        return handleSync(facilityId, auth, body.customerIds);
      case 'programs':
        return handlePrograms(facilityId, auth, body.customerIds);
      case 'schedule':
        return handleSchedule(facilityId);
      case 'debug-login':
        return handleDebugLogin(email, password, facilityId);
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

// ── Validate ─────────────────────────────────────────────────────────────

async function handleValidate(facilityId: string) {
  if (!facilityId) {
    return NextResponse.json({ error: 'Facility ID required' }, { status: 400 });
  }

  try {
    const url = new URL(`${API_BASE}/events`);
    url.searchParams.set('company', facilityId);
    url.searchParams.set('page[size]', '1');
    url.searchParams.set('sort', '-start');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // Fall back to the legacy getOptions endpoint
      const optionsUrl = `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`;
      const optRes = await fetch(optionsUrl, {
        headers: {
          'Accept': 'application/json',
          'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
        },
      });

      if (!optRes.ok) {
        return NextResponse.json({
          valid: false,
          error: `Facility "${facilityId}" not found on DaySmart. Check the URL.`,
        });
      }

      const optData = await optRes.json().catch(() => null);
      return NextResponse.json({
        valid: true,
        facilityId,
        facilityName: optData?.company?.name || optData?.name || facilityId,
      });
    }

    // Facility exists — try to get its name
    let facilityName = facilityId;
    try {
      const optionsUrl = `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`;
      const optRes = await fetch(optionsUrl, {
        headers: { 'Accept': 'application/json' },
      });
      if (optRes.ok) {
        const optData = await optRes.json().catch(() => null);
        facilityName = optData?.company?.name || optData?.name || facilityId;
      }
    } catch {
      // Name lookup failed
    }

    return NextResponse.json({ valid: true, facilityId, facilityName });
  } catch {
    return NextResponse.json({
      valid: false,
      error: 'Could not reach DaySmart. Check your internet connection.',
    });
  }
}

// ── Login ────────────────────────────────────────────────────────────────

async function handleLogin(email: string, password: string, facilityId: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  try {
    // Try authentication strategies in order of preference
    console.log(`[DaySmart] Attempting login for ${email} at ${facilityId}`);

    let authResult: AuthResult | null = null;

    // Strategy 1: OAuth2 password grant (modern API)
    authResult = await tryOAuth2PasswordGrant(email, password, facilityId);
    if (authResult) {
      console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
    }

    // Strategy 2: PHP login with JSON body
    if (!authResult) {
      authResult = await tryPHPLoginJSON(email, password, facilityId);
      if (authResult) {
        console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
      }
    }

    // Strategy 3: PHP login with form-encoded body
    if (!authResult) {
      authResult = await tryPHPLoginForm(email, password, facilityId);
      if (authResult) {
        console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
      }
    }

    if (!authResult) {
      console.error('[DaySmart] All auth strategies failed');
      return NextResponse.json({
        success: false,
        error: 'Login failed. Check your email and password, or try logging in at apps.daysmartrecreation.com first to confirm your credentials work.',
        facilityId,
      }, { status: 401 });
    }

    // We have auth — now discover family members
    const { token, tokenType, responseData, cookies } = authResult;
    const authCredential = tokenType === 'bearer' ? token : (cookies || token);

    const familyMembers: Array<{ id: string; name: string }> = [];
    let customerIds: string[] = [];

    // Check login response for customer ID
    if (responseData.customer_id) {
      customerIds = [String(responseData.customer_id)];
    }

    // Fetch linked customers using our auth — this also validates the credential
    let authVerified = false;
    if (authCredential) {
      try {
        const custUrl = `${API_BASE}/customers?cache[save]=false&company=${facilityId}`;
        const custRes = await fetch(custUrl, {
          headers: buildAuthHeaders(authCredential, facilityId),
        });

        console.log(`[DaySmart] Customers API → ${custRes.status}`);

        if (custRes.ok) {
          authVerified = true;
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
        } else {
          console.log(`[DaySmart] Customers API failed: ${custRes.status}`);
          // Try with cookie if we used bearer
          if (tokenType === 'bearer' && cookies) {
            const custRes2 = await fetch(custUrl, {
              headers: {
                ...buildAuthHeaders(cookies, facilityId),
                'Cookie': cookies,
              },
            });
            console.log(`[DaySmart] Customers API (cookie fallback) → ${custRes2.status}`);
            if (custRes2.ok) {
              authVerified = true;
              const custData = await custRes2.json();
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
          }
        }
      } catch (err) {
        console.error('[DaySmart] Failed to fetch customers:', err);
      }
    }

    // If we couldn't verify the auth credential with a real API call,
    // the login was a phantom success (e.g. bare cookies from a failed login).
    // Report this as a login failure so the user knows their credentials didn't work.
    if (!authVerified && customerIds.length === 0) {
      console.error(`[DaySmart] Auth strategy "${authResult.strategy}" returned credentials but they failed verification`);
      return NextResponse.json({
        success: false,
        error: 'Login appeared to succeed but the credentials were rejected by DaySmart. Please check your email and password, then try again.',
        facilityId,
        authStrategy: authResult.strategy,
      }, { status: 401 });
    }

    // Fallback: extract customer info from login response
    if (customerIds.length === 0 && responseData.customer_id) {
      customerIds = [String(responseData.customer_id)];
      const name = (responseData.name as string) ||
                   (responseData.first_name as string) ||
                   (responseData.display_name as string) ||
                   email;
      familyMembers.push({ id: String(responseData.customer_id), name });
    }

    // Get facility name
    let facilityName = facilityId;
    try {
      const optionsUrl = `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (cookies) headers['Cookie'] = cookies;
      const optRes = await fetch(optionsUrl, { headers });
      if (optRes.ok) {
        const optData = await optRes.json().catch(() => null);
        facilityName = optData?.company?.name || optData?.name || facilityId;
      }
    } catch {
      // Use slug as fallback
    }

    console.log(`[DaySmart] Login complete: strategy=${authResult.strategy}, tokenType=${tokenType}, families=${familyMembers.length}, customers=${customerIds.length}`);

    return NextResponse.json({
      success: true,
      sessionCookie: authCredential,  // backward-compatible field name
      authToken: tokenType === 'bearer' ? token : '',
      tokenType,
      authStrategy: authResult.strategy,
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

// ── Sync ─────────────────────────────────────────────────────────────────

async function handleSync(facilityId: string, auth: string, customerIds?: string[]) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const eventsUrl = new URL(`${API_BASE}/customer-events`);
  eventsUrl.searchParams.set('cache[save]', 'false');
  eventsUrl.searchParams.set('include', 'customer,resource.facility,eventType,registrations,rosterRegistration.finances');
  eventsUrl.searchParams.set('page[size]', '100');
  eventsUrl.searchParams.set('sort', '-start');
  eventsUrl.searchParams.set('fields[customer]', 'id,first_name,last_name');
  if (customerIds && customerIds.length > 0) {
    eventsUrl.searchParams.set('filter[customer_id__in]', customerIds.join(','));
  }
  eventsUrl.searchParams.set('company', facilityId);

  try {
    const res = await fetch(eventsUrl.toString(), {
      headers: buildAuthHeaders(auth, facilityId),
    });

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

    // Build lookup maps
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

    const defaultFacilityName = facilityMap.size > 0
      ? [...facilityMap.values()][0]
      : facilityId;

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

      const start = attrs.start ? new Date(attrs.start as string) : new Date();
      const end = attrs.end ? new Date(attrs.end as string) : start;

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

// ── Programs ─────────────────────────────────────────────────────────────

async function handlePrograms(facilityId: string, auth: string, customerIds?: string[]) {
  const childIds = customerIds || [];

  if (childIds.length === 0) {
    return NextResponse.json({
      success: true,
      programs: [],
      totalPrograms: 0,
      error: 'No customer IDs provided. Connect first to discover family members.',
    });
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
        const res = await fetch(progUrl, {
          headers: buildAuthHeaders(auth, facilityId),
        });
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

// ── Schedule (public, no auth) ───────────────────────────────────────────

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

// ── Debug Login ──────────────────────────────────────────────────────────

/**
 * Try all auth strategies and return raw diagnostic info.
 * Used for troubleshooting when login doesn't work as expected.
 */
async function handleDebugLogin(email: string, password: string, facilityId: string) {
  if (!email || !password || !facilityId) {
    return NextResponse.json({ error: 'email, password, and facilityId required' }, { status: 400 });
  }

  const results: Array<{
    strategy: string;
    status: number | string;
    responseKeys: string[];
    hasToken: boolean;
    hasCookies: boolean;
    tokenType: string;
    error?: string;
  }> = [];

  // Strategy 1: OAuth2 password grant
  for (const base of [API_BASE, DASH_API_BASE]) {
    try {
      const url = `${base}/company/auth/token?company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ grant_type: 'password', username: email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await safeJson(res);
      const token = extractToken(data);
      const cookies = extractCookies(res);
      results.push({
        strategy: `oauth2-password (${base})`,
        status: res.status,
        responseKeys: Object.keys(data),
        hasToken: !!token,
        hasCookies: !!cookies,
        tokenType: token ? 'bearer' : cookies ? 'cookie' : 'none',
      });
    } catch (err) {
      results.push({
        strategy: `oauth2-password (${base})`,
        status: 'error',
        responseKeys: [],
        hasToken: false,
        hasCookies: false,
        tokenType: 'none',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy 2: PHP JSON login
  for (const payload of [
    { email, password },
    { username: email, password },
  ]) {
    const keys = Object.keys(payload).join('+');
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://apps.daysmartrecreation.com',
          'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await safeJson(res);
      const token = extractToken(data);
      const cookies = extractCookies(res);
      results.push({
        strategy: `php-json (${keys})`,
        status: res.status,
        responseKeys: Object.keys(data),
        hasToken: !!token,
        hasCookies: !!cookies,
        tokenType: token ? 'bearer' : cookies ? 'cookie' : 'none',
      });
    } catch (err) {
      results.push({
        strategy: `php-json (${keys})`,
        status: 'error',
        responseKeys: [],
        hasToken: false,
        hasCookies: false,
        tokenType: 'none',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy 3: PHP form-encoded login
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({ email, username: email, password, company: facilityId });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await safeJson(res);
    const token = extractToken(data);
    const cookies = extractCookies(res);
    results.push({
      strategy: 'php-form',
      status: res.status,
      responseKeys: Object.keys(data),
      hasToken: !!token,
      hasCookies: !!cookies,
      tokenType: token ? 'bearer' : cookies ? 'cookie' : 'none',
    });
  } catch (err) {
    results.push({
      strategy: 'php-form',
      status: 'error',
      responseKeys: [],
      hasToken: false,
      hasCookies: false,
      tokenType: 'none',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({
    facilityId,
    email,
    strategies: results,
    timestamp: new Date().toISOString(),
  });
}
