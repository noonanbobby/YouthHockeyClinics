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
  type: 'new_clinic' | 'spots_low' | 'price_drop' | 'reminder';
}

export type ViewMode = 'list' | 'map';
