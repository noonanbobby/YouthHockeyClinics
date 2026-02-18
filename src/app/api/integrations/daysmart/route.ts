import { NextRequest, NextResponse } from 'next/server';
import { fetchDaySmartSchedule } from '@/lib/daysmartSchedule';

/**
 * DaySmart / Dash integration API — UNIVERSAL
 *
 * Works with ANY DaySmart-powered facility worldwide.
 * The client provides the facility slug (e.g. "warmemorial", "iceden").
 *
 * Authentication strategies (tried in order):
 *   0. Session init: GET X/getOptions to establish PHPSESSID
 *   1. OAuth2 password grant at /company/auth/token  → JWT bearer token
 *   2. PHP Auth/login with JSON body + session cookie → auth cookie or token
 *   3. PHP Auth/login with form-encoded + session     → auth cookie or token
 *   4. Member portal (member.daysmartrecreation.com)  → auth cookie or token
 *
 * Actions:
 *   POST ?action=validate      → Check facility slug exists
 *   POST ?action=login         → Authenticate + discover family members
 *   POST ?action=sync          → Fetch registered events (with pagination)
 *   POST ?action=programs      → Fetch available programs
 *   POST ?action=schedule      → Fetch public schedule (no auth)
 *   POST ?action=debug-login   → Try all auth strategies, return raw diagnostics
 */

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DAYSMART_BASE = 'https://apps.daysmartrecreation.com/dash';
const API_BASE = `${DAYSMART_BASE}/jsonapi/api/v1`;
const DASH_API_BASE = 'https://api.dashplatform.com/api/v1';

const PAGE_SIZE = 100;
const MAX_SYNC_PAGES = 20;
const REQUEST_TIMEOUT_MS = 12_000;

// ── Event type classification ─────────────────────────────────────────────────

const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  clinic: ['clinic', 'skills', 'development', 'power skating', 'skating lesson', 'instruction', 'training'],
  camp: ['camp', 'summer camp', 'winter camp', 'spring camp', 'hockey school', 'academy', 'school'],
  'stick-and-puck': ['stick and puck', 'stick & puck', 'stick-and-puck', 'puck time', 'stick time'],
  'open-hockey': ['open hockey', 'open ice', 'adult hockey', 'pickup hockey', 'drop-in hockey', 'shinny'],
  'public-skate': ['public skate', 'public skating', 'family skate', 'recreational skate', 'learn to skate'],
  'drop-in': ['drop-in', 'drop in', 'dropin'],
};

function classifyEventType(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  for (const [type, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return type;
  }
  return 'other';
}

// ── Sub-rink detection ────────────────────────────────────────────────────────

function detectSubRink(
  rinkName: string,
  facilityName: string,
): { rink: string; subRink?: string } {
  if (!rinkName || rinkName === facilityName) return { rink: facilityName };

  // "Facility - Rink A" or "Facility — East Rink"
  const dashMatch = rinkName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return { rink: dashMatch[1].trim(), subRink: dashMatch[2].trim() };
  }

  // "Facility (East Rink)"
  const parenMatch = rinkName.match(/^(.+?)\s*\((.+?)\)$/);
  if (parenMatch) {
    return { rink: parenMatch[1].trim(), subRink: parenMatch[2].trim() };
  }

  // Standalone sub-rink names: "Rink A", "Sheet 2", "East Ice", "Main Rink"
  const standalonePattern =
    /^(?:rink|sheet|ice|pad|surface)\s*[a-z0-9]+$|^(?:east|west|north|south|main|upper|lower|olympic|nhl)\s*(?:rink|ice|sheet|pad)?$/i;
  if (standalonePattern.test(rinkName.trim())) {
    return { rink: facilityName, subRink: rinkName.trim() };
  }

  return { rink: rinkName };
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  subRink?: string;
  price: number;
  category: string;
  eventType: string;
  registered: boolean;
  customerName: string;
  customerId: string;
}

interface AuthResult {
  strategy: string;
  token: string;
  tokenType: 'bearer' | 'cookie';
  responseData: Record<string, unknown>;
  cookies: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function buildAuthHeaders(auth: string, facilityId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.api+json',
    Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
  };
  if (!auth) return headers;
  if (auth.startsWith('eyJ') || auth.startsWith('Bearer ')) {
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['Cookie'] = auth;
  }
  return headers;
}

function extractCookies(res: Response): string {
  let cookies = '';
  try {
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
    if (setCookieHeaders.length > 0) {
      cookies = setCookieHeaders.map((c) => c.split(';')[0]).join('; ');
    }
  } catch {
    // getSetCookie not available
  }
  if (!cookies) {
    const raw = res.headers.get('set-cookie') ?? '';
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

function mergeCookies(existing: string, newer: string): string {
  if (!existing) return newer;
  if (!newer) return existing;
  const cookieMap = new Map<string, string>();
  for (const pair of existing.split('; ')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) cookieMap.set(pair.slice(0, eqIdx), pair);
  }
  for (const pair of newer.split('; ')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) cookieMap.set(pair.slice(0, eqIdx), pair);
  }
  return [...cookieMap.values()].join('; ');
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractToken(data: Record<string, unknown>): string {
  const tokenKeys = [
    'access_token', 'token', 'session_token', 'jwt',
    'auth_token', 'api_token', 'bearer_token',
    'accessToken', 'sessionToken', 'authToken',
  ];
  for (const key of tokenKeys) {
    if (data[key] && typeof data[key] === 'string') return data[key] as string;
  }
  for (const key of ['data', 'user', 'customer', 'account', 'member']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const n = nested as Record<string, unknown>;
      for (const tk of ['access_token', 'token', 'session_token', 'jwt']) {
        if (n[tk] && typeof n[tk] === 'string') return n[tk] as string;
      }
      if (n.attributes && typeof n.attributes === 'object') {
        const attrs = n.attributes as Record<string, unknown>;
        for (const tk of ['access_token', 'token', 'session_token']) {
          if (attrs[tk] && typeof attrs[tk] === 'string') return attrs[tk] as string;
        }
      }
    }
  }
  return '';
}

function isPositiveAuthResponse(data: Record<string, unknown>): boolean {
  if (
    data.auth === true ||
    data.success === true ||
    data.authenticated === true ||
    data.logged_in === true
  )
    return true;
  if (
    data.status === 'success' ||
    data.status === 'ok' ||
    data.status === 'authenticated'
  )
    return true;
  if (data.customer_id || data.customerId || data.user_id || data.userId) return true;
  if (data.id && (data.first_name || data.email || data.name)) return true;
  for (const key of ['user', 'customer', 'data', 'account', 'profile', 'member']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const obj = nested as Record<string, unknown>;
      if (obj.id || obj.customer_id || obj.email || obj.first_name) return true;
    }
  }
  return false;
}

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

function extractCustomerName(data: Record<string, unknown>): string {
  if (data.name && typeof data.name === 'string') return data.name;
  const fn = (data.first_name ?? data.firstName) as string | undefined;
  const ln = (data.last_name ?? data.lastName) as string | undefined;
  if (fn || ln) return `${fn ?? ''} ${ln ?? ''}`.trim();
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

// ── Auth strategies ───────────────────────────────────────────────────────────

async function initSession(facilityId: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`,
      {
        headers: {
          Accept: 'application/json',
          Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
        },
      },
      8_000,
    );
    const cookies = extractCookies(res);
    console.log(
      `[DaySmart] Session init → ${res.status}, cookies: ${cookies ? cookies.length + ' chars' : 'NONE'}`,
    );
    return cookies;
  } catch (err) {
    console.log(
      `[DaySmart] Session init failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return '';
  }
}

async function tryOAuth2PasswordGrant(
  email: string,
  password: string,
  facilityId: string,
): Promise<AuthResult | null> {
  for (const base of [API_BASE, DASH_API_BASE]) {
    try {
      const url = `${base}/company/auth/token?company=${facilityId}`;
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ grant_type: 'password', username: email, password }),
        },
        10_000,
      );
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
      console.log(
        `[DaySmart] OAuth2 ${base} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return null;
}

async function tryPHPLoginJSON(
  email: string,
  password: string,
  facilityId: string,
  sessionCookies: string,
): Promise<AuthResult | null> {
  const payloads = [
    { email, password },
    { username: email, password },
    { email, password, company: facilityId },
    { username: email, password, company: facilityId },
  ];

  for (const payload of payloads) {
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://apps.daysmartrecreation.com',
        Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;

      const res = await fetchWithTimeout(
        url,
        { method: 'POST', headers, body: JSON.stringify(payload) },
        10_000,
      );
      const responseCookies = extractCookies(res);
      const allCookies = mergeCookies(sessionCookies, responseCookies);
      const data = await safeJson(res);
      const payloadKeys = Object.keys(payload).join('+');
      console.log(
        `[DaySmart] PHP-JSON(${payloadKeys}) → ${res.status}, positive: ${isPositiveAuthResponse(data)}`,
      );

      if (!res.ok) continue;

      const token = extractToken(data);
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
      console.log(
        `[DaySmart] PHP-JSON failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return null;
}

async function tryPHPLoginForm(
  email: string,
  password: string,
  facilityId: string,
  sessionCookies: string,
): Promise<AuthResult | null> {
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({ email, username: email, password, company: facilityId });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Origin: 'https://apps.daysmartrecreation.com',
      Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (sessionCookies) headers['Cookie'] = sessionCookies;

    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers, body: body.toString() },
      10_000,
    );
    const responseCookies = extractCookies(res);
    const allCookies = mergeCookies(sessionCookies, responseCookies);
    const data = await safeJson(res);
    console.log(
      `[DaySmart] PHP-Form → ${res.status}, positive: ${isPositiveAuthResponse(data)}`,
    );

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
    console.log(
      `[DaySmart] PHP-Form failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }
  return null;
}

async function tryMemberPortalLogin(
  email: string,
  password: string,
  facilityId: string,
): Promise<AuthResult | null> {
  const MEMBER_BASE = 'https://member.daysmartrecreation.com';
  let sessionCookies = '';

  try {
    const initRes = await fetchWithTimeout(
      `${MEMBER_BASE}/`,
      { headers: { Accept: 'text/html' } },
      8_000,
    );
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
      const url = `${MEMBER_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: MEMBER_BASE,
        Referer: `${MEMBER_BASE}/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;

      const res = await fetchWithTimeout(
        url,
        { method: 'POST', headers, body: JSON.stringify(payload) },
        10_000,
      );
      const responseCookies = extractCookies(res);
      const allCookies = mergeCookies(sessionCookies, responseCookies);
      const data = await safeJson(res);
      const payloadKeys = Object.keys(payload).join('+');
      console.log(
        `[DaySmart] Member-Portal(${payloadKeys}) → ${res.status}, positive: ${isPositiveAuthResponse(data)}`,
      );

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
      console.log(
        `[DaySmart] Member-Portal failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return null;
}

// ── Diagnostics helper ────────────────────────────────────────────────────────

async function collectLoginDiagnostics(
  email: string,
  password: string,
  facilityId: string,
  sessionCookies: string,
): Promise<
  Array<{
    strategy: string;
    status: number | string;
    responseKeys: string[];
    responseSample: string;
    hasToken: boolean;
    hasCookies: boolean;
    isPositiveAuth: boolean;
    extractedCustomerId: string;
    error?: string;
  }>
> {
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
    } catch {
      return '{}';
    }
  }

  // OAuth2 — both domains
  for (const base of [API_BASE, DASH_API_BASE]) {
    const label = base.includes('apps.') ? 'apps-domain' : 'api-domain';
    try {
      const res = await fetchWithTimeout(
        `${base}/company/auth/token?company=${facilityId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ grant_type: 'password', username: email, password }),
        },
        8_000,
      );
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

  // PHP JSON — multiple payloads
  for (const payload of [
    { email, password },
    { username: email, password },
    { email, password, company: facilityId },
  ]) {
    const keys = Object.keys(payload).join('+');
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://apps.daysmartrecreation.com',
        Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;
      const res = await fetchWithTimeout(
        url,
        { method: 'POST', headers, body: JSON.stringify(payload) },
        8_000,
      );
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

  // PHP form
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({ email, username: email, password, company: facilityId });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Origin: 'https://apps.daysmartrecreation.com',
      Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (sessionCookies) headers['Cookie'] = sessionCookies;
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers, body: body.toString() },
      8_000,
    );
    const data = await safeJson(res);
    const allCookies = mergeCookies(sessionCookies, extractCookies(res));
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
    const res = await fetchWithTimeout(
      `${MEMBER_BASE}/index.php?Action=Auth/login&company=${facilityId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: MEMBER_BASE,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ email, password }),
      },
      8_000,
    );
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') ?? 'sync';

  try {
    const body = await request.json();
    const { email, password, facilityId } = body;
    const auth = body.authToken ?? body.sessionCookie ?? '';

    if (!facilityId && action !== 'validate') {
      return NextResponse.json(
        {
          error:
            'facilityId is required. This is the slug from your DaySmart rink URL (e.g. "warmemorial").',
        },
        { status: 400 },
      );
    }

    switch (action) {
      case 'validate':
        return handleValidate(body.facilityId ?? '');
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
      { status: 500 },
    );
  }
}

// ── Validate ──────────────────────────────────────────────────────────────────

async function handleValidate(facilityId: string) {
  if (!facilityId) {
    return NextResponse.json({ error: 'Facility ID required' }, { status: 400 });
  }

  try {
    const url = new URL(`${API_BASE}/events`);
    url.searchParams.set('company', facilityId);
    url.searchParams.set('page[size]', '1');
    url.searchParams.set('sort', '-start');

    const res = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          Accept: 'application/vnd.api+json',
          Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
        },
      },
      10_000,
    );

    if (!res.ok) {
      // Fall back to getOptions
      const optRes = await fetchWithTimeout(
        `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`,
        {
          headers: {
            Accept: 'application/json',
            Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
          },
        },
        8_000,
      );
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
        facilityName: optData?.company?.name ?? optData?.name ?? facilityId,
      });
    }

    // Get facility name
    let facilityName = facilityId;
    try {
      const optRes = await fetchWithTimeout(
        `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`,
        { headers: { Accept: 'application/json' } },
        8_000,
      );
      if (optRes.ok) {
        const optData = await optRes.json().catch(() => null);
        facilityName = optData?.company?.name ?? optData?.name ?? facilityId;
      }
    } catch {
      // Name lookup failed — use slug
    }

    return NextResponse.json({ valid: true, facilityId, facilityName });
  } catch {
    return NextResponse.json({
      valid: false,
      error: 'Could not reach DaySmart. Check your internet connection.',
    });
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function handleLogin(email: string, password: string, facilityId: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const debugLog: string[] = [];

  try {
    console.log(`[DaySmart] Login attempt: ${email} @ ${facilityId}`);
    debugLog.push(`Login attempt: ${email} @ ${facilityId}`);

    // Step 0: Init session
    const sessionCookies = await initSession(facilityId);
    debugLog.push(
      `Session init: ${sessionCookies ? sessionCookies.length + ' chars' : 'NO COOKIES'}`,
    );

    let authResult: AuthResult | null = null;

    // Strategy 1: OAuth2
    debugLog.push('--- Strategy 1: OAuth2 password grant ---');
    authResult = await tryOAuth2PasswordGrant(email, password, facilityId);
    if (authResult) {
      debugLog.push(`SUCCESS via ${authResult.strategy}`);
    } else {
      debugLog.push('FAILED: OAuth2');
    }

    // Strategy 2: PHP JSON
    if (!authResult) {
      debugLog.push('--- Strategy 2: PHP JSON login ---');
      authResult = await tryPHPLoginJSON(email, password, facilityId, sessionCookies);
      if (authResult) {
        debugLog.push(`SUCCESS via ${authResult.strategy}`);
      } else {
        debugLog.push('FAILED: PHP JSON');
      }
    }

    // Strategy 3: PHP form
    if (!authResult) {
      debugLog.push('--- Strategy 3: PHP form-encoded login ---');
      authResult = await tryPHPLoginForm(email, password, facilityId, sessionCookies);
      if (authResult) {
        debugLog.push(`SUCCESS via ${authResult.strategy}`);
      } else {
        debugLog.push('FAILED: PHP form');
      }
    }

    // Strategy 4: Member portal
    if (!authResult) {
      debugLog.push('--- Strategy 4: Member portal ---');
      authResult = await tryMemberPortalLogin(email, password, facilityId);
      if (authResult) {
        debugLog.push(`SUCCESS via ${authResult.strategy}`);
      } else {
        debugLog.push('FAILED: Member portal');
      }
    }

    if (!authResult) {
      debugLog.push('=== ALL STRATEGIES FAILED ===');
      const debugDiag = await collectLoginDiagnostics(
        email,
        password,
        facilityId,
        sessionCookies,
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Login failed. Check your email and password, or try logging in at apps.daysmartrecreation.com first to confirm your credentials work.',
          facilityId,
          debugLog,
          debugDiagnostics: debugDiag,
        },
        { status: 401 },
      );
    }

    const { token, tokenType, responseData, cookies } = authResult;
    const authCredential = tokenType === 'bearer' ? token : cookies || token;

    const familyMembers: Array<{ id: string; name: string }> = [];
    let customerIds: string[] = [];

    const loginCustomerId = extractCustomerId(responseData);
    const loginCustomerName = extractCustomerName(responseData);
    if (loginCustomerId) customerIds = [loginCustomerId];

    // Verify auth + discover family members
    let authVerified = false;

    if (authCredential) {
      // Attempt 1: /customers endpoint
      try {
        const custRes = await fetchWithTimeout(
          `${API_BASE}/customers?cache[save]=false&company=${facilityId}`,
          { headers: buildAuthHeaders(authCredential, facilityId) },
          10_000,
        );
        console.log(`[DaySmart] Customers API → ${custRes.status}`);
        if (custRes.ok) {
          authVerified = true;
          const custData = await custRes.json();
          if (custData?.data && Array.isArray(custData.data)) {
            for (const customer of custData.data) {
              const fn = customer.attributes?.first_name ?? '';
              const ln = customer.attributes?.last_name ?? '';
              familyMembers.push({
                id: customer.id,
                name: `${fn} ${ln}`.trim() || `Customer #${customer.id}`,
              });
            }
            customerIds = custData.data.map((c: { id: string }) => c.id);
          }
        }
      } catch (err) {
        console.error('[DaySmart] Customers API error:', err);
      }

      // Attempt 2: Cookie fallback for /customers
      if (!authVerified && tokenType === 'bearer' && cookies) {
        try {
          const custRes2 = await fetchWithTimeout(
            `${API_BASE}/customers?cache[save]=false&company=${facilityId}`,
            {
              headers: {
                ...buildAuthHeaders(cookies, facilityId),
                Cookie: cookies,
              },
            },
            10_000,
          );
          if (custRes2.ok) {
            authVerified = true;
            const custData = await custRes2.json();
            if (custData?.data && Array.isArray(custData.data)) {
              for (const customer of custData.data) {
                const fn = customer.attributes?.first_name ?? '';
                const ln = customer.attributes?.last_name ?? '';
                familyMembers.push({
                  id: customer.id,
                  name: `${fn} ${ln}`.trim() || `Customer #${customer.id}`,
                });
              }
              customerIds = custData.data.map((c: { id: string }) => c.id);
            }
          }
        } catch {
          // Cookie fallback failed
        }
      }

      // Attempt 3: /customer-events
      if (!authVerified) {
        try {
          const eventsRes = await fetchWithTimeout(
            `${API_BASE}/customer-events?company=${facilityId}&page[size]=1&cache[save]=false`,
            { headers: buildAuthHeaders(authCredential, facilityId) },
            10_000,
          );
          console.log(`[DaySmart] Customer-Events verification → ${eventsRes.status}`);
          if (eventsRes.ok) {
            authVerified = true;
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

      // Attempt 4: PHP getOptions with auth cookies
      if (!authVerified) {
        try {
          const phpRes = await fetchWithTimeout(
            `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`,
            {
              headers: {
                Accept: 'application/json',
                Cookie: cookies || authCredential,
                Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/`,
              },
            },
            8_000,
          );
          if (phpRes.ok) {
            const phpData = await safeJson(phpRes);
            if (
              phpData.customer ||
              phpData.user ||
              phpData.customer_id ||
              phpData.logged_in === true ||
              phpData.authenticated === true
            ) {
              authVerified = true;
              const phpCustId = extractCustomerId(phpData);
              if (phpCustId && customerIds.length === 0) customerIds = [phpCustId];
            }
          }
        } catch {
          // PHP fallback failed
        }
      }
    }

    // Trust positive login response even if verification endpoints failed
    if (!authVerified && isPositiveAuthResponse(responseData)) {
      console.log('[DaySmart] Trusting positive login response despite verification failure');
      authVerified = true;
    }

    // Fallback: use login response data
    if (customerIds.length === 0 && loginCustomerId) customerIds = [loginCustomerId];
    if (familyMembers.length === 0 && loginCustomerId) {
      familyMembers.push({ id: loginCustomerId, name: loginCustomerName || email });
    }

    // Get facility name
    let facilityName = facilityId;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (cookies) headers['Cookie'] = cookies;
      const optRes = await fetchWithTimeout(
        `${DAYSMART_BASE}/index.php?Action=X/getOptions&cid=${facilityId}&company=${facilityId}`,
        { headers },
        8_000,
      );
      if (optRes.ok) {
        const optData = await optRes.json().catch(() => null);
        facilityName = optData?.company?.name ?? optData?.name ?? facilityId;
      }
    } catch {
      // Use slug as fallback
    }

    console.log(
      `[DaySmart] Login complete: strategy=${authResult.strategy}, tokenType=${tokenType}, families=${familyMembers.length}, customers=${customerIds.length}`,
    );

    return NextResponse.json({
      success: true,
      sessionCookie: authCredential,
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
      { status: 503 },
    );
  }
}

// ── Sync (with full pagination) ───────────────────────────────────────────────

async function handleSync(
  facilityId: string,
  auth: string,
  customerIds?: string[],
) {
  const todayStr = new Date().toISOString().split('T')[0];
  const allActivities: ParsedActivity[] = [];
  const errors: string[] = [];

  // Paginate through all pages
  let page = 1;
  let hasMore = true;
  let defaultFacilityName = facilityId;

  while (hasMore && page <= MAX_SYNC_PAGES) {
    const eventsUrl = new URL(`${API_BASE}/customer-events`);
    eventsUrl.searchParams.set('cache[save]', 'false');
    eventsUrl.searchParams.set(
      'include',
      'customer,resource.facility,eventType,registrations,rosterRegistration.finances',
    );
    eventsUrl.searchParams.set('page[size]', String(PAGE_SIZE));
    eventsUrl.searchParams.set('page[number]', String(page));
    eventsUrl.searchParams.set('sort', '-start');
    eventsUrl.searchParams.set('fields[customer]', 'id,first_name,last_name');
    if (customerIds && customerIds.length > 0) {
      eventsUrl.searchParams.set('filter[customer_id__in]', customerIds.join(','));
    }
    eventsUrl.searchParams.set('company', facilityId);

    try {
      const res = await fetchWithTimeout(
        eventsUrl.toString(),
        { headers: buildAuthHeaders(auth, facilityId) },
        REQUEST_TIMEOUT_MS,
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json(
            { error: 'Session expired. Please reconnect.', needsReauth: true },
            { status: 401 },
          );
        }
        errors.push(`Page ${page}: HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const events: DaySmartEvent[] = data?.data ?? [];
      const included = data?.included ?? [];

      // Pagination metadata
      const totalPages: number =
        data?.meta?.last_page ??
        data?.meta?.total_pages ??
        Math.ceil((data?.meta?.total ?? events.length) / PAGE_SIZE) ??
        1;

      hasMore = page < totalPages && events.length === PAGE_SIZE;

      // Build lookup maps from included resources
      const customerMap = new Map<string, string>();
      const facilityMap = new Map<string, string>();
      const eventTypeMap = new Map<string, string>();

      for (const item of included) {
        if (item.type === 'customer' || item.type === 'customers') {
          const fn = item.attributes?.first_name ?? '';
          const ln = item.attributes?.last_name ?? '';
          customerMap.set(item.id, `${fn} ${ln}`.trim());
        }
        if (item.type === 'facility' || item.type === 'facilities') {
          facilityMap.set(item.id, item.attributes?.name ?? facilityId);
        }
        if (
          item.type === 'event-type' ||
          item.type === 'event_type' ||
          item.type === 'eventType'
        ) {
          eventTypeMap.set(item.id, item.attributes?.name ?? '');
        }
      }

      if (facilityMap.size > 0) {
        defaultFacilityName = [...facilityMap.values()][0];
      }

      // Parse events
      for (const event of events) {
        const attrs = event.attributes ?? {};
        const custRel = event.relationships?.customer?.data;
        const custId = custRel?.id ?? '';
        const custName = customerMap.get(custId) ?? `Customer #${custId}`;

        const facilityRel = event.relationships?.resource?.data;
        const rawRinkName = facilityRel
          ? facilityMap.get(facilityRel.id) ?? defaultFacilityName
          : defaultFacilityName;

        const { rink, subRink } = detectSubRink(rawRinkName, defaultFacilityName);

        const eventTypeRel = event.relationships?.eventType?.data;
        const eventTypeName = eventTypeRel
          ? eventTypeMap.get(eventTypeRel.id) ?? ''
          : '';

        const start = attrs.start ? new Date(attrs.start as string) : new Date();
        const end = attrs.end ? new Date(attrs.end as string) : start;

        // Extract price from included finances
        let price = 0;
        const rosterReg = event.relationships?.['rosterRegistration'] as
          | { data?: unknown }
          | undefined;
        const financeData = rosterReg?.data as
          | { id: string }
          | Array<{ id: string }>
          | undefined;
        if (financeData && Array.isArray(included)) {
          const finance = included.find(
            (i: { id: string; type: string; attributes?: { amount?: number } }) =>
              i.type === 'finance' &&
              financeData &&
              (Array.isArray(financeData)
                ? financeData.some((f) => f.id === i.id)
                : financeData.id === i.id),
          );
          if (finance?.attributes?.amount) {
            price = Number(finance.attributes.amount);
          }
        }

        const name = (attrs.name as string) ?? eventTypeName ?? 'Activity';
        const description = (attrs.description as string) ?? '';

        allActivities.push({
          id: event.id,
          name,
          description,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          startTime: start.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
          endTime: end.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
          location: rink,
          subRink,
          price,
          category: eventTypeName || 'Hockey',
          eventType: classifyEventType(name, description),
          registered: true,
          customerName: custName,
          customerId: custId,
        });
      }

      page++;

      // Small delay between pages to be polite
      if (hasMore) await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Page ${page}: ${msg}`);
      console.error(`[DaySmart] Sync page ${page} error:`, err);
      break;
    }
  }

  const upcoming = allActivities.filter((a) => a.endDate >= todayStr);
  const past = allActivities.filter((a) => a.endDate < todayStr);

  return NextResponse.json({
    success: allActivities.length > 0 || errors.length === 0,
    activities: allActivities,
    upcoming,
    past,
    totalEvents: allActivities.length,
    pagesScraped: page - 1,
    facilityName: defaultFacilityName,
    errors: errors.length > 0 ? errors : undefined,
    syncedAt: new Date().toISOString(),
  });
}

// ── Programs ──────────────────────────────────────────────────────────────────

async function handlePrograms(
  facilityId: string,
  auth: string,
  customerIds?: string[],
) {
  const childIds = customerIds ?? [];

  if (childIds.length === 0) {
    return NextResponse.json({
      success: true,
      programs: [],
      totalPrograms: 0,
      error: 'No customer IDs provided. Connect first to discover family members.',
    });
  }

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
    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/programs?cache[save]=false&filter[customer_id]=${childId}&include=activities&company=${facilityId}`,
        { headers: buildAuthHeaders(auth, facilityId) },
        REQUEST_TIMEOUT_MS,
      );
      if (res.ok) {
        const data = await res.json();
        for (const prog of data?.data ?? []) {
          const attrs = prog.attributes ?? {};
          allPrograms.push({
            id: prog.id,
            name: (attrs.name as string) ?? 'Program',
            description: (attrs.description as string) ?? '',
            category: (attrs.category as string) ?? (attrs.activity_type as string) ?? 'Hockey',
            startDate: (attrs.start_date as string) ?? '',
            endDate: (attrs.end_date as string) ?? '',
            price: Number(attrs.price ?? attrs.price_per_event ?? 0),
            location: facilityId,
            spotsAvailable: Number(attrs.spots_available ?? attrs.max_participants ?? 0),
            customerId: childId,
            customerName: `Customer #${childId}`,
            skillLevel: (attrs.skill_level as string) ?? 'Recreational',
            ageRange: (attrs.age_range as string) ?? 'Youth',
            season: (attrs.season as string) ?? '',
          });
        }
      }
    } catch (err) {
      console.error(`[DaySmart] Programs error for customer ${childId}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    programs: allPrograms,
    totalPrograms: allPrograms.length,
    fetchedAt: new Date().toISOString(),
  });
}

// ── Schedule (public, no auth) ────────────────────────────────────────────────

async function handleSchedule(facilityId: string) {
  try {
    const result = await fetchDaySmartSchedule(facilityId);
    return NextResponse.json({
      success: true,
      sessions: result.sessions,
      totalSessions: result.sessions.length,
      fromCache: result.fromCache,
      confirmed: result.confirmed,
      facilityId,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DaySmart] Schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule from DaySmart', details: String(error) },
      { status: 500 },
    );
  }
}

// ── Debug Login ───────────────────────────────────────────────────────────────

async function handleDebugLogin(email: string, password: string, facilityId: string) {
  if (!email || !password || !facilityId) {
    return NextResponse.json(
      { error: 'email, password, and facilityId required' },
      { status: 400 },
    );
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

  function getCookieNames(cookies: string): string[] {
    if (!cookies) return [];
    return cookies
      .split('; ')
      .map((c) => c.split('=')[0])
      .filter(Boolean);
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

  // OAuth2
  for (const base of [API_BASE, DASH_API_BASE]) {
    try {
      const res = await fetchWithTimeout(
        `${base}/company/auth/token?company=${facilityId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ grant_type: 'password', username: email, password }),
        },
        8_000,
      );
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

  // PHP JSON
  for (const payload of [{ email, password }, { username: email, password }]) {
    const keys = Object.keys(payload).join('+');
    try {
      const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://apps.daysmartrecreation.com',
        Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;
      const res = await fetchWithTimeout(
        url,
        { method: 'POST', headers, body: JSON.stringify(payload) },
        8_000,
      );
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

  // PHP form
  try {
    const url = `${DAYSMART_BASE}/index.php?Action=Auth/login&company=${facilityId}`;
    const body = new URLSearchParams({ email, username: email, password, company: facilityId });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Origin: 'https://apps.daysmartrecreation.com',
      Referer: `https://apps.daysmartrecreation.com/dash/x/#/online/${facilityId}/login`,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (sessionCookies) headers['Cookie'] = sessionCookies;
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers, body: body.toString() },
      8_000,
    );
    const data = await safeJson(res);
    const token = extractToken(data);
    const allCookies = mergeCookies(sessionCookies, extractCookies(res));
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

  // Member portal
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
      tokenType: memberRes?.tokenType ?? 'none',
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
