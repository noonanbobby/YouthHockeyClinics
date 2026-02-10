import { Rink, StickAndPuckSession } from '@/types';

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
  const today = new Date();
  // Generate next 4 weeks of sessions
  for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
    for (const day of opts.days) {
      const date = new Date(today);
      const currentDay = today.getDay();
      let daysUntil = day - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      date.setDate(today.getDate() + daysUntil + weekOffset * 7);

      const dateStr = date.toISOString().split('T')[0];
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
        lastVerified: new Date().toISOString().split('T')[0],
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
    name: 'Stick & Puck',
    days: [1, 2, 3, 4, 5, 6], // Mon-Sat
    startTime: '06:00',
    endTime: '07:30',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages welcome. Goalies skate free.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey',
    days: [1, 3, 5], // Mon, Wed, Fri
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [0, 5, 6], // Sun, Fri, Sat
    startTime: '13:00',
    endTime: '15:00',
    price: 12,
    notes: 'Skate rental available ($5). All ages.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'freestyle',
    name: 'Freestyle / Figure Skating',
    days: [2, 4], // Tue, Thu
    startTime: '12:00',
    endTime: '13:30',
    price: 18,
    notes: 'Figure skaters only. Music allowed.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Youth Stick & Puck (14U)',
    days: [0], // Sun
    startTime: '08:00',
    endTime: '09:30',
    price: 12,
    maxSkaters: 20,
    goaliesFree: true,
    ageRestriction: '14 & under',
    equipmentRequired: FULL_EQUIP,
    notes: 'Youth only. Great intro to open ice.',
  }),
];

// ── Florida Panthers IceDen ─────────────────────────────────────────
const icedenSessions = [
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 2, 3, 4, 5], // Mon-Fri
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
    name: 'Youth Stick & Puck (14U)',
    days: [6, 0], // Sat, Sun
    startTime: '07:00',
    endTime: '08:30',
    price: 12,
    maxSkaters: 20,
    goaliesFree: true,
    ageRestriction: '14 & under',
    equipmentRequired: FULL_EQUIP,
    notes: 'Youth only — 14 and under.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Drop-In Hockey',
    days: [2, 4, 6], // Tue, Thu, Sat
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [0, 5, 6], // Sun, Fri, Sat
    startTime: '14:00',
    endTime: '16:00',
    price: 10,
    notes: 'Skate rental $4. Helmets recommended for beginners.',
  }),
];

// ── Pines Ice Arena ─────────────────────────────────────────────────
const pinesSessions = [
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 3, 5, 0], // Mon, Wed, Fri, Sun
    startTime: '06:00',
    endTime: '07:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages. Goalies free.',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skating',
    days: [5, 6, 0], // Fri, Sat, Sun
    startTime: '12:00',
    endTime: '14:00',
    price: 10,
    notes: 'Skate rental included.',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'drop-in',
    name: 'Adult Drop-In',
    days: [2, 4, 6], // Tue, Thu, Sat
    startTime: '11:30',
    endTime: '13:00',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
];

// ── Incredible Ice ──────────────────────────────────────────────────
const incredibleSessions = [
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 2, 4, 6], // Mon, Tue, Thu, Sat
    startTime: '06:30',
    endTime: '08:00',
    price: 13,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Open Skating',
    days: [3, 5, 6, 0], // Wed, Fri, Sat, Sun
    startTime: '19:00',
    endTime: '21:00',
    price: 11,
    notes: 'DJ nights on Fridays! Skate rental $4.',
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey',
    days: [3, 5], // Wed, Fri
    startTime: '12:00',
    endTime: '13:30',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
];

// ── Saveology Arena ─────────────────────────────────────────────────
const saveologySessions = [
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Early Bird Stick & Puck',
    days: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: '05:45',
    endTime: '07:15',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'Early bird special. All ages.',
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Open Hockey',
    days: [0, 6], // Sun, Sat
    startTime: '18:00',
    endTime: '19:30',
    price: 18,
    ageRestriction: '16+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'public-skate',
    name: 'Weekend Public Skate',
    days: [6, 0], // Sat, Sun
    startTime: '13:00',
    endTime: '15:00',
    price: 10,
    notes: 'Skate rental $4. All ages.',
  }),
];

// ── The Rink at the Beach ───────────────────────────────────────────
const rinkAtBeachSessions = [
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    startTime: '06:00',
    endTime: '07:30',
    price: 15,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: FULL_EQUIP,
    notes: 'All ages. Goalies free.',
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Adult Open Hockey',
    days: [2, 4], // Tue, Thu
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 28,
    ageRestriction: '18+',
    equipmentRequired: FULL_EQUIP,
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [0, 5, 6], // Sun, Fri, Sat
    startTime: '14:00',
    endTime: '16:00',
    price: 12,
    notes: 'Skate rental $5. Beach vibes.',
  }),
  ...weeklySession('rink-at-beach', 'The Rink at the Beach', RINKATBEACH_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Youth Stick & Puck (12U)',
    days: [0], // Sun
    startTime: '08:00',
    endTime: '09:30',
    price: 10,
    maxSkaters: 18,
    goaliesFree: true,
    ageRestriction: '12 & under',
    equipmentRequired: FULL_EQUIP,
    notes: 'Youth only. 12 and under.',
  }),
];

// ══ ASSEMBLE RINKS ═══════════════════════════════════════════════════

export const SEED_RINKS: Rink[] = [
  {
    id: 'iceplex',
    name: 'Baptist Health IcePlex',
    slug: 'baptisticeplex',
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
