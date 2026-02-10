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
      // Find next occurrence of this day of week
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
        recurring: {
          pattern: 'weekly',
          days: opts.days,
        },
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
  lat: 26.12,
  lng: -80.17,
};

const ICEDEN_LOCATION = {
  venue: 'Florida Panthers IceDen',
  address: '3299 NW 2nd Ave',
  city: 'Coral Springs',
  state: 'FL',
  lat: 26.27,
  lng: -80.27,
};

const PINESICE_LOCATION = {
  venue: 'Pines Ice Arena',
  address: '12425 Taft St',
  city: 'Pembroke Pines',
  state: 'FL',
  lat: 26.01,
  lng: -80.34,
};

const INCREDIBLE_LOCATION = {
  venue: 'Incredible Ice',
  address: '4601 N Federal Hwy',
  city: 'Coral Springs',
  state: 'FL',
  lat: 26.29,
  lng: -80.10,
};

const SAVEOLOGY_LOCATION = {
  venue: 'Saveology Arena',
  address: '14390 Powerline Rd',
  city: 'Fort Lauderdale',
  state: 'FL',
  lat: 26.10,
  lng: -80.16,
};

// ── Baptist Health IcePlex ──────────────────────────────────────────
const iceplexSessions = [
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [2, 4, 6], // Tue, Thu, Sat
    startTime: '06:00',
    endTime: '07:30',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: ['Full hockey equipment required'],
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
    equipmentRequired: ['Full hockey equipment required'],
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate Session',
    days: [0, 6], // Sun, Sat
    startTime: '13:00',
    endTime: '15:00',
    price: 12,
    notes: 'Skate rental available ($5). All ages.',
  }),
  ...weeklySession('iceplex', 'Baptist Health IcePlex', ICEPLEX_LOCATION, {
    sessionType: 'freestyle',
    name: 'Freestyle / Figure Skating',
    days: [1, 3], // Mon, Wed
    startTime: '06:00',
    endTime: '07:30',
    price: 18,
    notes: 'Figure skaters only. Music allowed.',
  }),
];

// ── Florida Panthers IceDen ─────────────────────────────────────────
const icedenSessions = [
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [1, 3, 5], // Mon, Wed, Fri
    startTime: '06:15',
    endTime: '07:45',
    price: 15,
    maxSkaters: 25,
    goaliesFree: true,
    equipmentRequired: ['Full hockey equipment required'],
    notes: 'All ages. Full equipment mandatory.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Youth Stick & Puck (14U)',
    days: [6], // Sat
    startTime: '07:00',
    endTime: '08:30',
    price: 12,
    maxSkaters: 20,
    goaliesFree: true,
    ageRestriction: '14 & under',
    equipmentRequired: ['Full hockey equipment required'],
    notes: 'Youth only — 14 and under. Great for young players to work on skills.',
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Drop-In Hockey',
    days: [2, 4], // Tue, Thu
    startTime: '12:00',
    endTime: '13:30',
    price: 20,
    maxSkaters: 30,
    ageRestriction: '18+',
    equipmentRequired: ['Full hockey equipment required'],
  }),
  ...weeklySession('iceden', 'Florida Panthers IceDen', ICEDEN_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skate',
    days: [0, 6], // Sun, Sat
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
    days: [0, 3, 5], // Sun, Wed, Fri
    startTime: '06:00',
    endTime: '07:30',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: ['Full hockey equipment required'],
    notes: 'All ages. Goalies free.',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Public Skating',
    days: [6, 0], // Sat, Sun
    startTime: '12:00',
    endTime: '14:00',
    price: 10,
    notes: 'Skate rental included.',
  }),
  ...weeklySession('pines-ice', 'Pines Ice Arena', PINESICE_LOCATION, {
    sessionType: 'drop-in',
    name: 'Adult Drop-In',
    days: [2, 4], // Tue, Thu
    startTime: '11:30',
    endTime: '13:00',
    price: 18,
    ageRestriction: '18+',
    equipmentRequired: ['Full hockey equipment required'],
  }),
];

// ── Incredible Ice ──────────────────────────────────────────────────
const incredibleSessions = [
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Stick & Puck',
    days: [2, 4, 6], // Tue, Thu, Sat
    startTime: '06:30',
    endTime: '08:00',
    price: 13,
    maxSkaters: 22,
    goaliesFree: true,
    equipmentRequired: ['Full hockey equipment required'],
  }),
  ...weeklySession('incredible-ice', 'Incredible Ice', INCREDIBLE_LOCATION, {
    sessionType: 'public-skate',
    name: 'Open Skating',
    days: [5, 6, 0], // Fri, Sat, Sun
    startTime: '19:00',
    endTime: '21:00',
    price: 11,
    notes: 'DJ nights on Fridays! Skate rental $4.',
  }),
];

// ── Saveology Arena ─────────────────────────────────────────────────
const saveologySessions = [
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'stick-and-puck',
    name: 'Early Bird Stick & Puck',
    days: [1, 3, 5], // Mon, Wed, Fri
    startTime: '05:45',
    endTime: '07:15',
    price: 14,
    maxSkaters: 20,
    goaliesFree: true,
    equipmentRequired: ['Full hockey equipment required'],
    notes: 'Early bird special. All ages.',
  }),
  ...weeklySession('saveology', 'Saveology Arena', SAVEOLOGY_LOCATION, {
    sessionType: 'open-hockey',
    name: 'Open Hockey',
    days: [0], // Sun
    startTime: '18:00',
    endTime: '19:30',
    price: 18,
    ageRestriction: '16+',
    equipmentRequired: ['Full hockey equipment required'],
  }),
];

// ══ ASSEMBLE RINKS ═══════════════════════════════════════════════════

export const SEED_RINKS: Rink[] = [
  {
    id: 'iceplex',
    name: 'Baptist Health IcePlex',
    slug: 'baptisticeplex',
    platform: 'daysmart',
    location: { address: '3299 Sportsplex Dr', city: 'Fort Lauderdale', state: 'FL', lat: 26.12, lng: -80.17 },
    phone: '(954) 555-0100',
    website: 'https://www.baptisthealthiceplex.com',
    scheduleUrl: 'https://www.baptisthealthiceplex.com/schedule',
    sessions: iceplexSessions,
  },
  {
    id: 'iceden',
    name: 'Florida Panthers IceDen',
    slug: 'iceden',
    platform: 'daysmart',
    location: { address: '3299 NW 2nd Ave', city: 'Coral Springs', state: 'FL', lat: 26.27, lng: -80.27 },
    phone: '(954) 555-0200',
    website: 'https://www.floridapanthersiceden.com',
    scheduleUrl: 'https://www.floridapanthersiceden.com/schedule',
    sessions: icedenSessions,
  },
  {
    id: 'pines-ice',
    name: 'Pines Ice Arena',
    platform: 'independent',
    location: { address: '12425 Taft St', city: 'Pembroke Pines', state: 'FL', lat: 26.01, lng: -80.34 },
    phone: '(954) 555-0300',
    website: 'https://www.pinesicearena.com',
    sessions: pinesSessions,
  },
  {
    id: 'incredible-ice',
    name: 'Incredible Ice',
    platform: 'independent',
    location: { address: '4601 N Federal Hwy', city: 'Coral Springs', state: 'FL', lat: 26.29, lng: -80.10 },
    phone: '(954) 555-0400',
    website: 'https://www.incredibleice.com',
    sessions: incredibleSessions,
  },
  {
    id: 'saveology',
    name: 'Saveology Arena',
    platform: 'independent',
    location: { address: '14390 Powerline Rd', city: 'Fort Lauderdale', state: 'FL', lat: 26.10, lng: -80.16 },
    phone: '(954) 555-0500',
    sessions: saveologySessions,
  },
];

// Flat list of all sessions across all rinks
export const ALL_SEED_SESSIONS: StickAndPuckSession[] = SEED_RINKS.flatMap(r => r.sessions);
