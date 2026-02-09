export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite' | 'all';
export type ClinicType = 'camp' | 'clinic' | 'tournament' | 'showcase' | 'development';
export type AgeGroup = 'mites' | 'squirts' | 'peewee' | 'bantam' | 'midget' | 'junior' | 'all';

export interface Coach {
  id: string;
  name: string;
  title: string;
  bio: string;
  photoUrl: string;
  credentials: string[];
}

export interface Clinic {
  id: string;
  name: string;
  type: ClinicType;
  description: string;
  longDescription: string;
  imageUrl: string;
  galleryUrls: string[];
  location: {
    venue: string;
    address: string;
    city: string;
    state: string;
    country: string;
    countryCode: string;
    lat: number;
    lng: number;
  };
  dates: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
    activity: string;
  }[];
  duration: string;
  price: {
    amount: number;
    currency: string;
    earlyBird?: {
      amount: number;
      deadline: string;
    };
  };
  ageGroups: AgeGroup[];
  skillLevels: SkillLevel[];
  coaches: Coach[];
  maxParticipants: number;
  spotsRemaining: number;
  registrationUrl: string;
  websiteUrl: string;
  contactEmail: string;
  contactPhone: string;
  amenities: string[];
  includes: string[];
  tags: string[];
  featured: boolean;
  isNew: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  // Source tracking
  source?: string;
}

export interface FilterState {
  searchQuery: string;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  ageGroups: AgeGroup[];
  skillLevels: SkillLevel[];
  clinicTypes: ClinicType[];
  country: string | null;
  maxPrice: number | null;
  goalieOnly: boolean;
  spotsAvailable: boolean;
  featured: boolean;
  sortBy: 'date' | 'price' | 'rating' | 'distance' | 'name';
  sortOrder: 'asc' | 'desc';
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  clinicId: string;
  timestamp: string;
  read: boolean;
  type: 'new_clinic' | 'spots_low' | 'price_drop' | 'reminder' | 'registration_reminder' | 'child_match';
}

export type PlayerPosition = 'player' | 'goalie';

// Child profile for age-group defaults and per-child tracking
export interface ChildProfile {
  id: string;
  name: string;
  dateOfBirth: string; // ISO date (YYYY-MM-DD)
  position: PlayerPosition;
  currentDivision?: AgeGroup; // Override: e.g. 9yo playing up in Squirts (10U)
  createdAt: string;
}

// Registration tracking
export interface Registration {
  id: string;
  clinicId: string;
  clinicName: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  price: number;
  currency: string;
  registeredAt: string;
  status: 'confirmed' | 'pending' | 'waitlisted' | 'cancelled';
  source: 'manual' | 'dash' | 'icehockeypro';
  notes: string;
  // Player info
  playerName?: string;
  childId?: string;
  isDemo?: boolean;
}

// DaySmart/Dash integration
export interface DaySmartConfig {
  email: string;
  password: string;
  facilityId: string; // Baptist Ice Plex
  facilityName: string;
  connected: boolean;
  lastSync: string | null;
}

export interface DaySmartActivity {
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
  spotsAvailable: number;
}

// IceHockeyPro integration
export interface IceHockeyProConfig {
  email: string;
  password: string;
  connected: boolean;
  lastSync: string | null;
  playerName: string;
  linkedChildIds: string[];
}

// Spending tracking
export interface MonthlySpend {
  month: string; // "2026-01"
  total: number;
  currency: string;
  registrations: {
    clinicName: string;
    amount: number;
    date: string;
  }[];
}

// Email scanning configuration
export interface EmailScanConfig {
  provider: 'gmail' | 'outlook' | 'none';
  connected: boolean;
  lastScan: string | null;
  scanFrequency: 'hourly' | 'daily' | 'manual';
}

export type ViewMode = 'list' | 'map';

export type ColorMode = 'light' | 'dark' | 'system';
