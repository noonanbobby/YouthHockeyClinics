import { Rink, StickAndPuckSession } from '@/types';

// ── Date helpers ──────────────────────────────────────────────────────
// Build a YYYY-MM-DD string from a Date object using LOCAL time,
// not UTC. This prevents timezone-shift bugs where a Monday 6 AM ET
// session becomes Sunday in UTC.

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Helper to generate recurring weekly sessions ──────────────────────
function weeklySession(
  rinkId: string,
  rinkName: string,
  location: StickAndPuckSession['location'],
  opts: {
    sessionType: StickAndPuckSession['sessionType'];
    name: string;
    days: number[]; // 0=Sun..6=Sat
    startTime: string;
    endTime: string;
    price: number;
    ageRestriction?: string;
    maxSkaters?: number;
    goaliesFree?: boolean;
    equipmentRequired?: string[];
    notes?: string;
  },
): StickAndPuckSession[] {
  const sessions: StickAndPuckSession[] = [];
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const [startHour, startMin] = opts.startTime.split(':').map(Number);

  // Generate next 4 weeks of sessions
  for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
    for (const day of opts.days) {
      const date = new Date(now);
      const currentDay = now.getDay();
      let daysUntil = day - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      date.setDate(now.getDate() + daysUntil + weekOffset * 7);

      // Use local date string — avoids UTC timezone shift
      const dateStr = toLocalDateStr(date);

      // Skip sessions that have already started today
      if (dateStr === todayStr) {
        const sessionStart = new Date(now);
        sessionStart.setHours(startHour, startMin, 0, 0);
        if (sessionStart <= now) continue;
      }

      // Skip dates in the past
      if (dateStr < todayStr) continue;

      sessions.push({
        id: `${rinkId}-${opts.sessionType}-${dateStr}-${opts.startTime.replace(':', '')}`,
        rinkId,
        rinkName,
        sessionType: opts.sessionType,
        name: opts.name,
        location,
        date: dateStr,
        dayOfWeek: day,
        startTime: opts.startTime,
        endTime: opts.endTime,
        recurring: { pattern: 'weekly', days: opts.days },
        price: opts.price,
        currency: 'USD',
        ageRestriction: opts.ageRestriction,
        maxSkaters: opts.maxSkaters,
        goaliesFree: opts.goaliesFree,
        equipmentRequired: opts.equipmentRequired,
        notes: opts.notes,
        source: 'seed',
        lastVerified: toLocalDateStr(now),
      });
    }
  }
  return sessions;
}

// ══ SOUTH FLORIDA RINKS ══════════════════════════════════════════════

const ICEPLEX_LOCATION = {
  venue: 'Baptist Health IcePlex',
  address: '3299 Sportsplex Dr',
  city: 'Fort Lauderdale',
  state: 'FL',
  lat: 26.1275,
  lng: -80.1727,
};

const ICEDEN_LOCATION = {
  venue: 'Florida Panthers IceDen',
  address: '3299 Sportsplex Dr',
  city: 'Coral Springs',
  state: 'FL',
  lat: 26.2710,
  lng: -80.2534,
};

const PINESICE_LOCATION = {
  venue: 'Pines Ice Arena',
  address: '12425 Taft St',
  city: 'Pembroke Pines',
  state: 'FL',
  lat: 26.0137,
  lng: -80.3399,
};

const INCREDIBLE_LOCATION = {
  venue: 'Incredible Ice',
  address: '3180 Sportsplex Dr',
  city: 'Coral Springs',
  state: 'FL',
  lat: 26.2936,
  lng: -80.1043,
};

const SAVEOLOGY_LOCATION = {
  venue: 'Saveology Arena',
  address: '14390 Powerline Rd',
  city: 'Fort Lauderdale',
  state: 'FL',
  lat: 26.1021,
  lng: -80.1586,
};

const RINKATBEACH_LOCATION = {
  venue: 'The Rink at the Beach',
  address: '505 NE 2nd St',
  city: 'Deerfield Beach',
  state: 'FL',
  lat: 26.3185,
  lng: -80.0942,
};

const FULL_EQUIP = ['Full hockey equipment required'];

// ── Baptist Health IcePlex ──────────────────────────────────────────
const iceplexSessions = [
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck (Early)',
    days: [1, 2, 3, 4, 5],
    startTime: '06:00',
    endTime: '07:30',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages welcome. Goalies skate free.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 3, 5],
    startTime: '10:00',
    endTime: '11:30',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [6, 0],
    startTime: '07:00',
    endTime: '08:30',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Youth Stick & Puck (14U)',
    days: [6, 0],
    startTime: '09:00',
    endTime: '10:30',
    price: 12,
    maxSkaters: 20,
    goaliesFree: true,
    ageRestriction: '14 & under',
    equipmentRequired: FULL_EQUIP,
    notes: 'Youth only. Great intro to open ice.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey',
    days: [1, 3, 5],
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey (Evening)',
    days: [2, 4],
    startTime: '20:00',
    endTime: '21:30',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate (Afternoon)',
    days: [6, 0],
    startTime: '13:00',
    endTime: '15:00',
    price: 12,
    notes: 'Skate rental available ($5). All ages.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'public-skate',
    name: 'Friday Night Skate',
    days: [5],
    startTime: '19:00',
    endTime: '21:00',
    price: 14,
    notes: 'Skate rental available ($5). DJ and lights!',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [3, 4],
    startTime: '12:30',
    endTime: '14:00',
    price: 12,
    notes: 'Skate rental available ($5).',
  }),
];

// ── Florida Panthers IceDen ─────────────────────────────────────────
const icedenSessions = [
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck (Early)',
    days: [1, 2, 3, 4, 5],
    startTime: '06:15',
    endTime: '07:45',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages. Full equipment mandatory.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [2, 4],
    startTime: '10:30',
    endTime: '12:00',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [6, 0],
    startTime: '06:30',
    endTime: '08:00',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Youth Stick & Puck (14U)',
    days: [6, 0],
    startTime: '08:30',
    endTime: '10:00',
    price: 12,
    maxSkaters: 20,
    goaliesFree: true,
    ageRestriction: '14 & under',
    equipmentRequired: FULL_EQUIP,
    notes: 'Youth only — 14 and under.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'drop-in',
    name: 'Drop-In Hockey',
    days: [1, 3, 5],
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'drop-in',
    name: 'Drop-In Hockey (Evening)',
    days: [2, 4, 6],
    startTime: '20:30',
    endTime: '22:00',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [6, 0],
    startTime: '14:00',
    endTime: '16:00',
    price: 10,
    notes: 'Skate rental $4. Helmets recommended for beginners.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [5],
    startTime: '19:00',
    endTime: '21:00',
    price: 12,
    notes: 'Friday night skating. Skate rental $4.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [3],
    startTime: '13:00',
    endTime: '14:30',
    price: 10,
    notes: 'Skate rental $4.',
  }),
];

// ── Pines Ice Arena ─────────────────────────────────────────────────
const pinesSessions = [
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck (Early)',
    days: [1, 2, 3, 4, 5],
    startTime: '06:00',
    endTime: '07:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages. Goalies free.',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 3],
    startTime: '10:00',
    endTime: '11:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [6, 0],
    startTime: '07:00',
    endTime: '08:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'drop-in',
    name: 'Adult Drop-In',
    days: [2, 4],
    startTime: '11:30',
    endTime: '13:00',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'drop-in',
    name: 'Adult Drop-In (Evening)',
    days: [1, 3, 5],
    startTime: '21:00',
    endTime: '22:30',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skating (Afternoon)',
    days: [6, 0],
    startTime: '12:00',
    endTime: '14:00',
    price: 10,
    notes: 'Skate rental included.',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skating (Evening)',
    days: [5, 6],
    startTime: '19:00',
    endTime: '21:00',
    price: 12,
    notes: 'Skate rental included. DJ on Saturdays!',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skating',
    days: [3],
    startTime: '12:30',
    endTime: '14:00',
    price: 10,
    notes: 'Skate rental included.',
  }),
];

// ── Incredible Ice ──────────────────────────────────────────────────
const incredibleSessions = [
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck (Early)',
    days: [1, 2, 3, 4, 5],
    startTime: '06:30',
    endTime: '08:00',
    price: 13,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [2, 4],
    startTime: '10:00',
    endTime: '11:30',
    price: 13,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [6],
    startTime: '07:00',
    endTime: '08:30',
    price: 13,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey',
    days: [1, 3, 5],
    startTime: '12:00',
    endTime: '13:30',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey (Evening)',
    days: [2, 4],
    startTime: '20:00',
    endTime: '21:30',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Open Skating',
    days: [5, 6],
    startTime: '19:00',
    endTime: '21:00',
    price: 11,
    notes: 'DJ nights on Fridays! Skate rental $4.',
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Open Skating',
    days: [0],
    startTime: '13:00',
    endTime: '15:00',
    price: 11,
    notes: 'Skate rental $4.',
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Open Skating',
    days: [3],
    startTime: '12:00',
    endTime: '14:00',
    price: 11,
    notes: 'Skate rental $4.',
  }),
];

// ── Saveology Arena ─────────────────────────────────────────────────
const saveologySessions = [
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Early Bird Stick & Puck',
    days: [1, 2, 3, 4, 5],
    startTime: '05:45',
    endTime: '07:15',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'Early bird special. All ages.',
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 3, 5],
    startTime: '10:00',
    endTime: '11:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [6, 0],
    startTime: '07:00',
    endTime: '08:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Open Hockey',
    days: [6, 0],
    startTime: '18:00',
    endTime: '19:30',
    price: 18,
    ageRestriction: '16+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Open Hockey (Weeknight)',
    days: [2, 4],
    startTime: '21:00',
    endTime: '22:30',
    price: 18,
    ageRestriction: '16+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'public-skate',
    name: 'Weekend Public Skate',
    days: [6, 0],
    startTime: '13:00',
    endTime: '15:00',
    price: 10,
    notes: 'Skate rental $4. All ages.',
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [5],
    startTime: '19:00',
    endTime: '21:00',
    price: 12,
    notes: 'Skate rental $4. Friday night vibes!',
  }),
];

// ── The Rink at the Beach ───────────────────────────────────────────
const rinkAtBeachSessions = [
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck (Early)',
    days: [1, 3, 5],
    startTime: '06:00',
    endTime: '07:30',
    price: 15,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages. Goalies free.',
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [6, 0],
    startTime: '07:00',
    endTime: '08:30',
    price: 15,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Youth Stick & Puck (12U)',
    days: [6, 0],
    startTime: '09:00',
    endTime: '10:30',
    price: 10,
    maxSkaters: 18,
    goaliesFree: true,
    ageRestriction: '12 & under',
    equipmentRequired: FULL_EQUIP,
    notes: 'Youth only. 12 and under.',
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey',
    days: [2, 4],
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 28,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey (Evening)',
    days: [1, 3],
    startTime: '20:30',
    endTime: '22:00',
    price: 20,
    maxSkaters: 28,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate (Weekend)',
    days: [6, 0],
    startTime: '14:00',
    endTime: '16:00',
    price: 12,
    notes: 'Skate rental $5. Beach vibes.',
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate (Evening)',
    days: [5],
    startTime: '19:00',
    endTime: '21:00',
    price: 14,
    notes: 'Skate rental $5. Friday night!',
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [3],
    startTime: '12:00',
    endTime: '14:00',
    price: 12,
    notes: 'Skate rental $5.',
  }),
];

// ══ ASSEMBLE RINKS ═══════════════════════════════════════════════════

export const SEED_RINKS: Rink[] = [
  {
    id: 'iceplex',
    name: 'Baptist Health IcePlex',
    slug: 'warmemorial',
    platform: 'daysmart',
    location: { address: '3299 Sportsplex Dr', city: 'Fort Lauderdale', state: 'FL', lat: 26.1275, lng: -80.1727 },
    phone: '(954) 341-9956',
    website: 'https://www.baptisthealthiceplex.com',
    scheduleUrl: 'https://www.baptisthealthiceplex.com/schedule',
    sessions: iceplexSessions,
  },
  {
    id: 'iceden',
    name: 'Florida Panthers IceDen',
    slug: 'iceden',
    platform: 'daysmart',
    location: { address: '3299 Sportsplex Dr', city: 'Coral Springs', state: 'FL', lat: 26.2710, lng: -80.2534 },
    phone: '(954) 341-9956',
    website: 'https://www.floridapanthersiceden.com',
    scheduleUrl: 'https://www.floridapanthersiceden.com/schedule',
    sessions: icedenSessions,
  },
  {
    id: 'pines-ice',
    name: 'Pines Ice Arena',
    platform: 'independent',
    location: { address: '12425 Taft St', city: 'Pembroke Pines', state: 'FL', lat: 26.0137, lng: -80.3399 },
    phone: '(954) 704-8700',
    website: 'https://www.pinesicearena.com',
    sessions: pinesSessions,
  },
  {
    id: 'incredible-ice',
    name: 'Incredible Ice',
    platform: 'independent',
    location: { address: '3180 Sportsplex Dr', city: 'Coral Springs', state: 'FL', lat: 26.2936, lng: -80.1043 },
    phone: '(954) 345-4423',
    website: 'https://www.incredibleice.com',
    sessions: incredibleSessions,
  },
  {
    id: 'saveology',
    name: 'Saveology Arena',
    platform: 'independent',
    location: { address: '14390 Powerline Rd', city: 'Fort Lauderdale', state: 'FL', lat: 26.1021, lng: -80.1586 },
    phone: '(954) 530-0800',
    sessions: saveologySessions,
  },
  {
    id: 'rink-at-beach',
    name: 'The Rink at the Beach',
    platform: 'independent',
    location: { address: '505 NE 2nd St', city: 'Deerfield Beach', state: 'FL', lat: 26.3185, lng: -80.0942 },
    phone: '(954) 531-1234',
    website: 'https://www.therinkatthebeach.com',
    sessions: rinkAtBeachSessions,
  },
];

// Flat list of all sessions across all rinks
export const ALL_SEED_SESSIONS: StickAndPuckSession[] = SEED_RINKS.flatMap(r => r.sessions);
