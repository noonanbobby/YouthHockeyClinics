import { NextRequest, NextResponse } from 'next/server';
import { fetchDaySmartSchedule } from '@/lib/daysmartSchedule';

/**
 * DaySmart / Dash integration API — UNIVERSAL
 *
 * Works with ANY DaySmart-powered facility worldwide.
 * The client provides the facility slug (e.g. "warmemorial", "iceden").
 *
 * Authentication strategies (tried in order):
 *   0. Session init: GET X/getOptions to establish PHPSESSID (like a browser)
 *   1. OAuth2 password grant at /company/auth/token  → JWT bearer token
 *   2. PHP Auth/login with JSON body + session cookie → auth cookie or token
 *   3. PHP Auth/login with form-encoded + session     → auth cookie or token
 *   4. Member portal (member.daysmartrecreation.com)  → auth cookie or token
 *
 * Success detection: tokens, customer_id, auth:true, success:true, user objects.
 * Verification: tries /customers, /customer-events, PHP endpoints.
 * Falls back to Cookie header for session-based auth.
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

/** Check if a login response body indicates successful authentication */
function isPositiveAuthResponse(data: Record<string, unknown>): boolean {
  // Explicit success flags
  if (data.auth === true || data.success === true || data.authenticated === true || data.logged_in === true) return true;
  if (data.status === 'success' || data.status === 'ok' || data.status === 'authenticated') return true;

  // Customer/user data present (indicates we're logged in)
  if (data.customer_id || data.customerId || data.user_id || data.userId) return true;
  if (data.id && (data.first_name || data.email || data.name)) return true;

  // Nested user/customer object with identifying info
  for (const key of ['user', 'customer', 'data', 'account', 'profile', 'member']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const obj = nested as Record<string, unknown>;
      if (obj.id || obj.customer_id || obj.email || obj.first_name) return true;
    }
  }

  return false;
}

/** Extract customer ID from various response formats */
function extractCustomerId(data: Record<string, unknown>): string {
  for (const key of ['customer_id', 'customerId', 'user_id', 'userId', 'id']) {
    if (data[key] && (typeof data[key] === 'string' || typeof data[key] === 'number')) {
      return String(data[key]);
    }
  }
  for (const key of ['user', 'customer', 'data', 'account', 'member']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const obj = nested as Record<string, unknown>;
      for (const idKey of ['id', 'customer_id', 'customerId']) {
        if (obj[idKey] && (typeof obj[idKey] === 'string' || typeof obj[idKey] === 'number')) {
          return String(obj[idKey]);
        }
      }
    }
  }
  return '';
}

/** Extract customer name from various response formats */
function extractCustomerName(data: Record<string, unknown>): string {
  if (data.name && typeof data.name === 'string') return data.name;
  const fn = (data.first_name || data.firstName) as string | undefined;
  const ln = (data.last_name || data.lastName) as string | undefined;
  if (fn || ln) return `${fn || ''} ${ln || ''}`.trim();
  if (data.display_name && typeof data.display_name === 'string') return data.display_name;

  for (const key of ['user', 'customer', 'data', 'account', 'member']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const result = extractCustomerName(nested as Record<string, unknown>);
      if (result) return result;
    }
  }
  return '';
}

// ── Auth Strategies ──────────────────────────────────────────────────────

/**
 * Initialize a DaySmart PHP session by making a GET request.
 * Many PHP apps require an existing session (PHPSESSID) before login POST.
 * Returns the session cookies to include with subsequent login requests.
 */
async function initSession(facilityId: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Hit the online portal to establish a PHPSESSID
    const res = await fetch(
      `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    const cookies = extractCookies(res);
    console.log(`[DaySmart] Session init → ${res.status}, cookies: ${cookies ? cookies.length + ' chars' : 'NONE'}`);
    return cookies;
  } catch (err) {
    console.log(`[DaySmart] Session init failed:`, err instanceof Error ? err.message : String(err));
    return '';
  }
}

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

      // Also check if auth=true with any token
      if (res.ok && isPositiveAuthResponse(data)) {
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
 * The login endpoint used by the Dash SPA (AngularJS).
 * Requires a session cookie (PHPSESSID) from a prior GET request.
 */
async function tryPHPLoginJSON(
  email: string, password: string, facilityId: string, sessionCookies: string
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

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      // Include session cookies from init step (mimics browser behavior)
      if (sessionCookies) {
        headers['Cookie'] = sessionCookies;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseCookies = extractCookies(res);
      // Merge: new cookies override old ones, but keep any that weren't replaced
      const allCookies = mergeCookies(sessionCookies, responseCookies);
      const data = await safeJson(res);
      const payloadKeys = Object.keys(payload).join('+');
      console.log(`[DaySmart] PHP-JSON(${payloadKeys}) → ${res.status}, keys: ${Object.keys(data).join(',')}, cookies: ${allCookies ? allCookies.length + ' chars' : 'NONE'}, body-positive: ${isPositiveAuthResponse(data)}`);

      if (!res.ok) continue;

      const token = extractToken(data);

      // Accept if we got a real token, or if the response positively indicates auth success
      if (token || isPositiveAuthResponse(data)) {
        return {
          strategy: `php-json (${payloadKeys})`,
          token: token || allCookies,
          tokenType: token ? 'bearer' : 'cookie',
          responseData: data,
          cookies: allCookies,
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
  email: string, password: string, facilityId: string, sessionCookies: string
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Origin': 'https://apps.daysmartrecreation.com',
      'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (sessionCookies) {
      headers['Cookie'] = sessionCookies;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseCookies = extractCookies(res);
    const allCookies = mergeCookies(sessionCookies, responseCookies);
    const data = await safeJson(res);
    console.log(`[DaySmart] PHP-Form → ${res.status}, keys: ${Object.keys(data).join(',')}, cookies: ${allCookies ? allCookies.length + ' chars' : 'NONE'}, body-positive: ${isPositiveAuthResponse(data)}`);

    if (!res.ok) return null;

    const token = extractToken(data);

    if (token || isPositiveAuthResponse(data)) {
      return {
        strategy: 'php-form',
        token: token || allCookies,
        tokenType: token ? 'bearer' : 'cookie',
        responseData: data,
        cookies: allCookies,
      };
    }
  } catch (err) {
    console.log(`[DaySmart] PHP-Form failed:`, err instanceof Error ? err.message : String(err));
  }

  return null;
}

/**
 * Strategy 4: Login via the new member portal domain.
 * DaySmart migrated to member.daysmartrecreation.com.
 */
async function tryMemberPortalLogin(
  email: string, password: string, facilityId: string
): Promise<AuthResult | null> {
  const MEMBER_BASE = 'https://member.daysmartrecreation.com';

  // Try getting session first
  let sessionCookies = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const initRes = await fetch(`${MEMBER_BASE}/`, {
      headers: { 'Accept': 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    sessionCookies = extractCookies(initRes);
  } catch {
    // Continue without session cookies
  }

  const payloads = [
    { email, password },
    { username: email, password },
    { email, password, company: facilityId },
  ];

  for (const payload of payloads) {
    try {
      // Try the Auth/login endpoint on the member domain
      const url = `${MEMBER_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': MEMBER_BASE,
        'Referer': `${MEMBER_BASE}/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseCookies = extractCookies(res);
      const allCookies = mergeCookies(sessionCookies, responseCookies);
      const data = await safeJson(res);
      const payloadKeys = Object.keys(payload).join('+');
      console.log(`[DaySmart] Member-Portal(${payloadKeys}) → ${res.status}, keys: ${Object.keys(data).join(',')}, cookies: ${allCookies ? allCookies.length + ' chars' : 'NONE'}, body-positive: ${isPositiveAuthResponse(data)}`);

      if (!res.ok) continue;

      const token = extractToken(data);

      if (token || isPositiveAuthResponse(data)) {
        return {
          strategy: `member-portal (${payloadKeys})`,
          token: token || allCookies,
          tokenType: token ? 'bearer' : 'cookie',
          responseData: data,
          cookies: allCookies,
        };
      }
    } catch (err) {
      console.log(`[DaySmart] Member-Portal failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  return null;
}

/** Merge two cookie strings, with newer cookies taking precedence */
function mergeCookies(existing: string, newer: string): string {
  if (!existing) return newer;
  if (!newer) return existing;

  const cookieMap = new Map<string, string>();
  // Parse existing cookies
  for (const pair of existing.split('; ')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      cookieMap.set(pair.slice(0, eqIdx), pair);
    }
  }
  // Override with newer cookies
  for (const pair of newer.split('; ')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      cookieMap.set(pair.slice(0, eqIdx), pair);
    }
  }
  return [...cookieMap.values()].join('; ');
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

// ── Login Diagnostics (inline, for error responses) ─────────────────────

/** Collect raw diagnostics for every auth strategy — returned inline with login failures */
async function collectLoginDiagnostics(
  email: string, password: string, facilityId: string, sessionCookies: string
): Promise<Array<{
  strategy: string;
  status: number | string;
  responseKeys: string[];
  responseSample: string;
  hasToken: boolean;
  hasCookies: boolean;
  isPositiveAuth: boolean;
  extractedCustomerId: string;
  error?: string;
}>> {
  const results: Array<{
    strategy: string;
    status: number | string;
    responseKeys: string[];
    responseSample: string;
    hasToken: boolean;
    hasCookies: boolean;
    isPositiveAuth: boolean;
    extractedCustomerId: string;
    error?: string;
  }> = [];

  function truncBody(data: Record<string, unknown>, maxLen = 800): string {
    try {
      const s = JSON.stringify(data);
      return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
    } catch { return '{}'; }
  }

  // OAuth2 password grant — both domains
  for (const base of [API_BASE, DASH_API_BASE]) {
    const label = base.includes('apps.') ? 'apps-domain' : 'api-domain';
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
      results.push({
        strategy: `oauth2 (${label})`,
        status: res.status,
        responseKeys: Object.keys(data),
        responseSample: truncBody(data),
        hasToken: !!extractToken(data),
        hasCookies: !!extractCookies(res),
        isPositiveAuth: isPositiveAuthResponse(data),
        extractedCustomerId: extractCustomerId(data),
      });
    } catch (err) {
      results.push({
        strategy: `oauth2 (${label})`,
        status: 'error',
        responseKeys: [],
        responseSample: '',
        hasToken: false,
        hasCookies: false,
        isPositiveAuth: false,
        extractedCustomerId: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // PHP JSON login — multiple payloads
  for (const payload of [
    { email, password },
    { username: email, password },
    { email, password, company: facilityId },
  ]) {
    const keys = Object.keys(payload).join('+');
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;
      const res = await fetch(url, {
        method: 'POST', headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await safeJson(res);
      const responseCookies = extractCookies(res);
      const allCookies = mergeCookies(sessionCookies, responseCookies);
      results.push({
        strategy: `php-json (${keys})`,
        status: res.status,
        responseKeys: Object.keys(data),
        responseSample: truncBody(data),
        hasToken: !!extractToken(data),
        hasCookies: !!allCookies,
        isPositiveAuth: isPositiveAuthResponse(data),
        extractedCustomerId: extractCustomerId(data),
      });
    } catch (err) {
      results.push({
        strategy: `php-json (${keys})`,
        status: 'error',
        responseKeys: [],
        responseSample: '',
        hasToken: false,
        hasCookies: false,
        isPositiveAuth: false,
        extractedCustomerId: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // PHP form-encoded login
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({ email, username: email, password, company: facilityId });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Origin': 'https://apps.daysmartrecreation.com',
      'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (sessionCookies) headers['Cookie'] = sessionCookies;
    const res = await fetch(url, {
      method: 'POST', headers,
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await safeJson(res);
    const responseCookies = extractCookies(res);
    const allCookies = mergeCookies(sessionCookies, responseCookies);
    results.push({
      strategy: 'php-form',
      status: res.status,
      responseKeys: Object.keys(data),
      responseSample: truncBody(data),
      hasToken: !!extractToken(data),
      hasCookies: !!allCookies,
      isPositiveAuth: isPositiveAuthResponse(data),
      extractedCustomerId: extractCustomerId(data),
    });
  } catch (err) {
    results.push({
      strategy: 'php-form',
      status: 'error',
      responseKeys: [],
      responseSample: '',
      hasToken: false,
      hasCookies: false,
      isPositiveAuth: false,
      extractedCustomerId: '',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Member portal
  try {
    const MEMBER_BASE = 'https://member.daysmartrecreation.com';
    const url = `${MEMBER_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': MEMBER_BASE,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await safeJson(res);
    results.push({
      strategy: 'member-portal',
      status: res.status,
      responseKeys: Object.keys(data),
      responseSample: truncBody(data),
      hasToken: !!extractToken(data),
      hasCookies: !!extractCookies(res),
      isPositiveAuth: isPositiveAuthResponse(data),
      extractedCustomerId: extractCustomerId(data),
    });
  } catch (err) {
    results.push({
      strategy: 'member-portal',
      status: 'error',
      responseKeys: [],
      responseSample: '',
      hasToken: false,
      hasCookies: false,
      isPositiveAuth: false,
      extractedCustomerId: '',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}

// ── Login ────────────────────────────────────────────────────────────────

async function handleLogin(email: string, password: string, facilityId: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  // Collect detailed debug info for every step so failures are diagnosable
  const debugLog: string[] = [];
  const debugDetails: Array<{
    step: string;
    status: number | string;
    responseKeys: string[];
    responseSample: string;
    hasToken: boolean;
    hasCookies: boolean;
    isPositiveAuth: boolean;
    error?: string;
  }> = [];

  function truncateJson(data: Record<string, unknown>, maxLen = 500): string {
    try {
      const s = JSON.stringify(data);
      return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
    } catch { return '{}'; }
  }

  try {
    // Try authentication strategies in order of preference
    console.log(`[DaySmart] Attempting login for ${email} at ${facilityId}`);
    debugLog.push(`Login attempt: ${email} @ ${facilityId}`);

    // Step 0: Initialize a session (get PHPSESSID) like a browser would
    const sessionCookies = await initSession(facilityId);
    debugLog.push(`Session init: ${sessionCookies ? sessionCookies.length + ' chars cookies' : 'NO COOKIES'}`);

    let authResult: AuthResult | null = null;

    // Strategy 1: OAuth2 password grant (modern API)
    debugLog.push('--- Strategy 1: OAuth2 password grant ---');
    authResult = await tryOAuth2PasswordGrant(email, password, facilityId);
    if (authResult) {
      debugLog.push(`SUCCESS via ${authResult.strategy}`);
      debugDetails.push({
        step: authResult.strategy,
        status: 200,
        responseKeys: Object.keys(authResult.responseData),
        responseSample: truncateJson(authResult.responseData),
        hasToken: !!authResult.token,
        hasCookies: !!authResult.cookies,
        isPositiveAuth: true,
      });
      console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
    } else {
      debugLog.push('FAILED: No token or positive auth from OAuth2');
    }

    // Strategy 2: PHP login with JSON body (with session cookies)
    if (!authResult) {
      debugLog.push('--- Strategy 2: PHP JSON login ---');
      authResult = await tryPHPLoginJSON(email, password, facilityId, sessionCookies);
      if (authResult) {
        debugLog.push(`SUCCESS via ${authResult.strategy}`);
        debugDetails.push({
          step: authResult.strategy,
          status: 200,
          responseKeys: Object.keys(authResult.responseData),
          responseSample: truncateJson(authResult.responseData),
          hasToken: !!authResult.token,
          hasCookies: !!authResult.cookies,
          isPositiveAuth: true,
        });
        console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
      } else {
        debugLog.push('FAILED: No token or positive auth from PHP JSON');
      }
    }

    // Strategy 3: PHP login with form-encoded body (with session cookies)
    if (!authResult) {
      debugLog.push('--- Strategy 3: PHP form-encoded login ---');
      authResult = await tryPHPLoginForm(email, password, facilityId, sessionCookies);
      if (authResult) {
        debugLog.push(`SUCCESS via ${authResult.strategy}`);
        debugDetails.push({
          step: authResult.strategy,
          status: 200,
          responseKeys: Object.keys(authResult.responseData),
          responseSample: truncateJson(authResult.responseData),
          hasToken: !!authResult.token,
          hasCookies: !!authResult.cookies,
          isPositiveAuth: true,
        });
        console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
      } else {
        debugLog.push('FAILED: No token or positive auth from PHP form');
      }
    }

    // Strategy 4: Try the member portal domain
    if (!authResult) {
      debugLog.push('--- Strategy 4: Member portal ---');
      authResult = await tryMemberPortalLogin(email, password, facilityId);
      if (authResult) {
        debugLog.push(`SUCCESS via ${authResult.strategy}`);
        debugDetails.push({
          step: authResult.strategy,
          status: 200,
          responseKeys: Object.keys(authResult.responseData),
          responseSample: truncateJson(authResult.responseData),
          hasToken: !!authResult.token,
          hasCookies: !!authResult.cookies,
          isPositiveAuth: true,
        });
        console.log(`[DaySmart] Auth succeeded via ${authResult.strategy}`);
      } else {
        debugLog.push('FAILED: No token or positive auth from member portal');
      }
    }

    if (!authResult) {
      console.error('[DaySmart] All auth strategies failed');
      debugLog.push('=== ALL STRATEGIES FAILED ===');

      // Run the full debug-login to get raw details for each strategy
      const debugDiag = await collectLoginDiagnostics(email, password, facilityId, sessionCookies);

      return NextResponse.json({
        success: false,
        error: 'Login failed. Check your email and password, or try logging in at apps.daysmartrecreation.com first to confirm your credentials work.',
        facilityId,
        debugLog,
        debugDiagnostics: debugDiag,
      }, { status: 401 });
    }

    // We have auth — now discover family members
    const { token, tokenType, responseData, cookies } = authResult;
    const authCredential = tokenType === 'bearer' ? token : (cookies || token);

    const familyMembers: Array<{ id: string; name: string }> = [];
    let customerIds: string[] = [];

    // Extract customer info from the login response itself
    const loginCustomerId = extractCustomerId(responseData);
    const loginCustomerName = extractCustomerName(responseData);
    if (loginCustomerId) {
      customerIds = [loginCustomerId];
    }

    // Try multiple endpoints to discover family members and verify auth
    let authVerified = false;
    if (authCredential) {
      // Attempt 1: JSON:API /customers endpoint (may require admin auth)
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
          console.log(`[DaySmart] Customers API failed: ${custRes.status} (may be admin-only)`);
        }
      } catch (err) {
        console.error('[DaySmart] Failed to fetch customers:', err);
      }

      // Attempt 2: Try with cookies if we used bearer for attempt 1
      if (!authVerified && tokenType === 'bearer' && cookies) {
        try {
          const custUrl = `${API_BASE}/customers?cache[save]=false&company=${facilityId}`;
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
        } catch {
          // Cookie fallback failed too
        }
      }

      // Attempt 3: Try /customer-events endpoint (may work with customer session cookies)
      if (!authVerified) {
        try {
          const eventsUrl = `${API_BASE}/customer-events?company=${facilityId}&page[size]=1&cache[save]=false`;
          const eventsRes = await fetch(eventsUrl, {
            headers: buildAuthHeaders(authCredential, facilityId),
          });
          console.log(`[DaySmart] Customer-Events verification → ${eventsRes.status}`);
          if (eventsRes.ok) {
            authVerified = true;
            // Try to extract customer IDs from the events
            const eventsData = await eventsRes.json();
            if (eventsData?.data && Array.isArray(eventsData.data)) {
              const custIdsFromEvents = new Set<string>();
              for (const evt of eventsData.data) {
                const custId = evt.relationships?.customer?.data?.id;
                if (custId) custIdsFromEvents.add(custId);
              }
              if (custIdsFromEvents.size > 0 && customerIds.length === 0) {
                customerIds = [...custIdsFromEvents];
              }
            }
          }
        } catch {
          // Events endpoint failed
        }
      }

      // Attempt 4: Try a PHP endpoint that customer sessions can access
      if (!authVerified) {
        try {
          const phpUrl = `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`;
          const phpHeaders: Record<string, string> = {
            'Accept': 'application/json',
            'Cookie': cookies || authCredential,
            'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
          };
          const phpRes = await fetch(phpUrl, { headers: phpHeaders });
          console.log(`[DaySmart] PHP getOptions (with auth) → ${phpRes.status}`);
          // If the PHP response includes customer-specific data, we're authenticated
          if (phpRes.ok) {
            const phpData = await safeJson(phpRes);
            // Check if the response includes customer-specific data that wouldn't be there without auth
            if (phpData.customer || phpData.user || phpData.customer_id ||
                phpData.logged_in === true || phpData.authenticated === true) {
              authVerified = true;
              const phpCustId = extractCustomerId(phpData);
              if (phpCustId && customerIds.length === 0) {
                customerIds = [phpCustId];
              }
            }
          }
        } catch {
          // PHP fallback failed
        }
      }
    }

    // If we got positive indicators from the login response itself
    // (e.g. auth:true, customer_id, user data), trust it even if verification failed.
    // The verification endpoints may just not support customer-level auth.
    if (!authVerified && isPositiveAuthResponse(responseData)) {
      console.log(`[DaySmart] Auth verification failed but login response was positive — trusting login`);
      authVerified = true;
    }

    // Extract customer info from login response as fallback
    if (customerIds.length === 0 && loginCustomerId) {
      customerIds = [loginCustomerId];
    }
    if (familyMembers.length === 0 && loginCustomerId) {
      const name = loginCustomerName || email;
      familyMembers.push({ id: loginCustomerId, name });
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

  interface DebugResult {
    strategy: string;
    status: number | string;
    responseKeys: string[];
    responseSample: Record<string, unknown>;
    hasToken: boolean;
    hasCookies: boolean;
    cookieNames: string[];
    tokenType: string;
    isPositiveAuth: boolean;
    extractedCustomerId: string;
    error?: string;
  }

  const results: DebugResult[] = [];

  /** Sanitize response: show structure but redact long values */
  function sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.length > 100) {
        result[key] = `[string:${value.length}chars]`;
      } else if (typeof value === 'object' && value !== null) {
        result[key] = Array.isArray(value)
          ? `[array:${value.length}items]`
          : sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /** Extract cookie names from a cookie string */
  function getCookieNames(cookies: string): string[] {
    if (!cookies) return [];
    return cookies.split('; ').map((c) => c.split('=')[0]).filter(Boolean);
  }

  // Step 0: Session init
  const sessionCookies = await initSession(facilityId);
  results.push({
    strategy: 'session-init',
    status: sessionCookies ? 200 : 'no-cookies',
    responseKeys: [],
    responseSample: {},
    hasToken: false,
    hasCookies: !!sessionCookies,
    cookieNames: getCookieNames(sessionCookies),
    tokenType: 'none',
    isPositiveAuth: false,
    extractedCustomerId: '',
  });

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
        strategy: `oauth2-password (${base === API_BASE ? 'apps' : 'api'})`,
        status: res.status,
        responseKeys: Object.keys(data),
        responseSample: sanitize(data),
        hasToken: !!token,
        hasCookies: !!cookies,
        cookieNames: getCookieNames(cookies),
        tokenType: token ? 'bearer' : cookies ? 'cookie' : 'none',
        isPositiveAuth: isPositiveAuthResponse(data),
        extractedCustomerId: extractCustomerId(data),
      });
    } catch (err) {
      results.push({
        strategy: `oauth2-password (${base === API_BASE ? 'apps' : 'api'})`,
        status: 'error',
        responseKeys: [],
        responseSample: {},
        hasToken: false,
        hasCookies: false,
        cookieNames: [],
        tokenType: 'none',
        isPositiveAuth: false,
        extractedCustomerId: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy 2: PHP JSON login (with session cookies)
  for (const payload of [
    { email, password },
    { username: email, password },
  ]) {
    const keys = Object.keys(payload).join('+');
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://apps.daysmartrecreation.com',
        'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await safeJson(res);
      const token = extractToken(data);
      const responseCookies = extractCookies(res);
      const allCookies = mergeCookies(sessionCookies, responseCookies);
      results.push({
        strategy: `php-json+session (${keys})`,
        status: res.status,
        responseKeys: Object.keys(data),
        responseSample: sanitize(data),
        hasToken: !!token,
        hasCookies: !!allCookies,
        cookieNames: getCookieNames(allCookies),
        tokenType: token ? 'bearer' : allCookies ? 'cookie' : 'none',
        isPositiveAuth: isPositiveAuthResponse(data),
        extractedCustomerId: extractCustomerId(data),
      });
    } catch (err) {
      results.push({
        strategy: `php-json+session (${keys})`,
        status: 'error',
        responseKeys: [],
        responseSample: {},
        hasToken: false,
        hasCookies: false,
        cookieNames: [],
        tokenType: 'none',
        isPositiveAuth: false,
        extractedCustomerId: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy 3: PHP form-encoded login (with session cookies)
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({ email, username: email, password, company: facilityId });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Origin': 'https://apps.daysmartrecreation.com',
      'Referer': `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (sessionCookies) headers['Cookie'] = sessionCookies;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await safeJson(res);
    const token = extractToken(data);
    const responseCookies = extractCookies(res);
    const allCookies = mergeCookies(sessionCookies, responseCookies);
    results.push({
      strategy: 'php-form+session',
      status: res.status,
      responseKeys: Object.keys(data),
      responseSample: sanitize(data),
      hasToken: !!token,
      hasCookies: !!allCookies,
      cookieNames: getCookieNames(allCookies),
      tokenType: token ? 'bearer' : allCookies ? 'cookie' : 'none',
      isPositiveAuth: isPositiveAuthResponse(data),
      extractedCustomerId: extractCustomerId(data),
    });
  } catch (err) {
    results.push({
      strategy: 'php-form+session',
      status: 'error',
      responseKeys: [],
      responseSample: {},
      hasToken: false,
      hasCookies: false,
      cookieNames: [],
      tokenType: 'none',
      isPositiveAuth: false,
      extractedCustomerId: '',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Strategy 4: Member portal
  try {
    const memberRes = await tryMemberPortalLogin(email, password, facilityId);
    results.push({
      strategy: 'member-portal',
      status: memberRes ? 200 : 'no-match',
      responseKeys: memberRes ? Object.keys(memberRes.responseData) : [],
      responseSample: memberRes ? sanitize(memberRes.responseData) : {},
      hasToken: !!memberRes?.token && memberRes.tokenType === 'bearer',
      hasCookies: !!memberRes?.cookies,
      cookieNames: memberRes ? getCookieNames(memberRes.cookies) : [],
      tokenType: memberRes?.tokenType || 'none',
      isPositiveAuth: memberRes ? isPositiveAuthResponse(memberRes.responseData) : false,
      extractedCustomerId: memberRes ? extractCustomerId(memberRes.responseData) : '',
    });
  } catch (err) {
    results.push({
      strategy: 'member-portal',
      status: 'error',
      responseKeys: [],
      responseSample: {},
      hasToken: false,
      hasCookies: false,
      cookieNames: [],
      tokenType: 'none',
      isPositiveAuth: false,
      extractedCustomerId: '',
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
