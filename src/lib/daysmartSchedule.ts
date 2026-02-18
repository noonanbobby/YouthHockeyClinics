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
      const res = await
