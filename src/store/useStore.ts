import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgeGroup, Clinic, ChildProfile, FilterState, NotificationItem, ViewMode, Registration, DaySmartConfig, IceHockeyProConfig, EmailScanConfig } from '@/types';
import { calculateDistance } from '@/lib/geocoder';

// Scrub demo registrations directly from localStorage at module load time,
// BEFORE the Zustand store reads the data. No middleware, no lifecycle hooks,
// no version gates — just a one-shot edit to the raw JSON in localStorage.
if (typeof window !== 'undefined') {
  try {
    const STORE_KEY = 'hockey-clinics-storage';
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const regs = data?.state?.registrations;
      if (Array.isArray(regs) && regs.length > 0) {
        const before = regs.length;
        data.state.registrations = regs.filter((r: Record<string, unknown>) => {
          const cid = String(r.clinicId || '').toLowerCase();
          const venue = String(r.venue || '').toLowerCase();
          const cn = String(r.clinicName || '').toLowerCase();
          if (cid.startsWith('seed-')) return false;
          if (r.isDemo) return false;
          if (venue.includes('baptist health iceplex') || venue.includes('panthers iceden')) return false;
          if (cn.includes('spring break hockey camp')) return false;
          if (cn.includes('power skating clinic')) return false;
          if (cn.includes('learn to skate')) return false;
          if (cn.includes('elite summer hockey')) return false;
          if (cn.includes('max ivanov spring skills')) return false;
          return true;
        });
        if (data.state.registrations.length < before) {
          localStorage.setItem(STORE_KEY, JSON.stringify(data));
        }
      }
    }
  } catch {
    // localStorage unavailable or corrupt — store will init with defaults
  }
}

/** Compute USA Hockey age group from a child's date of birth */
export function getAgeGroupFromDOB(dob: string): AgeGroup {
  const birthDate = new Date(dob);
  const now = new Date();
  // USA Hockey uses Sept 1 cutoff for the season year
  const cutoffYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const cutoff = new Date(cutoffYear, 8, 1);
  const ageAtCutoff = Math.floor(
    (cutoff.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  if (ageAtCutoff <= 8) return 'mites';
  if (ageAtCutoff <= 10) return 'squirts';
  if (ageAtCutoff <= 12) return 'peewee';
  if (ageAtCutoff <= 14) return 'bantam';
  if (ageAtCutoff <= 18) return 'midget';
  return 'junior';
}

/** Get child's current age in years */
export function getChildAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

interface AppState {
  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Clinics (from API)
  clinics: Clinic[];
  filteredClinics: Clinic[];
  setClinics: (clinics: Clinic[]) => void;
  selectedClinic: Clinic | null;
  setSelectedClinic: (clinic: Clinic | null) => void;

  // Loading / search state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  isRefreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;
  lastUpdated: string | null;
  setLastUpdated: (ts: string) => void;
  searchMeta: {
    totalRaw: number;
    sources: { name: string; count: number; status: string; error?: string }[];
    searchDuration: number;
    hasApiKeys: Record<string, boolean>;
  } | null;
  setSearchMeta: (meta: AppState['searchMeta']) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Filters
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  applyFilters: () => void;
  activeFilterCount: () => number;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // Favorites
  favoriteIds: string[];
  toggleFavorite: (clinicId: string) => void;
  isFavorite: (clinicId: string) => boolean;

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;

  // Child Profiles
  childProfiles: ChildProfile[];
  activeChildIds: string[];
  addChildProfile: (profile: Omit<ChildProfile, 'id' | 'createdAt'>) => void;
  updateChildProfile: (id: string, updates: Partial<Omit<ChildProfile, 'id' | 'createdAt'>>) => void;
  removeChildProfile: (id: string) => void;
  toggleActiveChild: (id: string) => void;
  setActiveChildren: (ids: string[]) => void;
  getActiveChildAgeGroups: () => AgeGroup[];

  // Registrations
  registrations: Registration[];
  addRegistration: (reg: Omit<Registration, 'id' | 'registeredAt'>) => void;
  updateRegistration: (id: string, updates: Partial<Registration>) => void;
  removeRegistration: (id: string) => void;

  // DaySmart / Dash integration
  daySmartConfig: DaySmartConfig;
  setDaySmartConfig: (config: Partial<DaySmartConfig>) => void;
  daySmartSyncing: boolean;
  setDaySmartSyncing: (syncing: boolean) => void;

  // IceHockeyPro integration
  iceHockeyProConfig: IceHockeyProConfig;
  setIceHockeyProConfig: (config: Partial<IceHockeyProConfig>) => void;

  // Email scanning
  emailScanConfig: EmailScanConfig;
  setEmailScanConfig: (config: Partial<EmailScanConfig>) => void;

  // Settings / API keys
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  locationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  homeLocation: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  } | null;
  setHomeLocation: (loc: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  } | null) => void;
  /** Returns the best known location: GPS if available, else home location */
  getEffectiveLocation: () => { lat: number; lng: number } | null;
  preferredCurrency: string;
  setPreferredCurrency: (currency: string) => void;
  apiKeys: {
    googleApiKey: string;
    googleCseId: string;
    braveApiKey: string;
    tavilyApiKey: string;
    eventbriteApiKey: string;
  };
  setApiKey: (key: keyof AppState['apiKeys'], value: string) => void;
  autoRefreshInterval: number; // minutes
  setAutoRefreshInterval: (minutes: number) => void;

  // Color mode
  colorMode: 'light' | 'dark' | 'system';
  setColorMode: (mode: 'light' | 'dark' | 'system') => void;

  // Theme / Branding
  teamThemeId: string; // NHL team id, 'default' for sky blue
  setTeamTheme: (teamId: string) => void;

  // UI
  isFilterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const defaultFilters: FilterState = {
  searchQuery: '',
  dateRange: { start: null, end: null },
  ageGroups: [],
  skillLevels: [],
  clinicTypes: [],
  country: null,
  maxPrice: null,
  goalieOnly: false,
  spotsAvailable: false,
  featured: false,
  sortBy: 'date',
  sortOrder: 'asc',
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // View
      viewMode: 'list',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Clinics
      clinics: [],
      filteredClinics: [],
      setClinics: (clinics) => {
        set({ clinics });
        // Detect new clinics and send notifications
        const state = get();
        const existingIds = new Set(state.clinics.map((c) => c.id));
        const newClinics = clinics.filter((c) => !existingIds.has(c.id));
        if (newClinics.length > 0 && state.clinics.length > 0) {
          // Only notify if we had previous data (not first load)
          for (const nc of newClinics.slice(0, 5)) {
            state.addNotification({
              title: `New: ${nc.name}`,
              body: `${nc.location.city}, ${nc.location.country} — ${nc.dates.start}`,
              clinicId: nc.id,
              type: 'new_clinic',
            });
          }

          // Check if any new clinic matches active children's age groups
          const activeAgs = state.getActiveChildAgeGroups();
          const activeKids = state.childProfiles.filter((c) => state.activeChildIds.includes(c.id));
          if (activeAgs.length > 0 && activeKids.length > 0) {
            const matching = newClinics.filter(
              (c) => activeAgs.some((ag) => c.ageGroups.includes(ag) || c.ageGroups.includes('all'))
            );
            for (const mc of matching.slice(0, 3)) {
              const matchedNames = activeKids
                .filter((child) => {
                  const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
                  return mc.ageGroups.includes(ag) || mc.ageGroups.includes('all');
                })
                .map((c) => c.name);
              if (matchedNames.length > 0) {
                state.addNotification({
                  title: `Match for ${matchedNames.join(' & ')}!`,
                  body: `${mc.name} in ${mc.location.city} fits ${matchedNames.join(' & ')}`,
                  clinicId: mc.id,
                  type: 'child_match',
                });
              }
            }
          }
        }
        // Re-apply filters
        setTimeout(() => get().applyFilters(), 0);
      },
      selectedClinic: null,
      setSelectedClinic: (clinic) => set({ selectedClinic: clinic }),

      // Loading
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
      isRefreshing: false,
      setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
      lastUpdated: null,
      setLastUpdated: (ts) => set({ lastUpdated: ts }),
      searchMeta: null,
      setSearchMeta: (meta) => set({ searchMeta: meta }),
      error: null,
      setError: (error) => set({ error }),

      // Filters
      filters: defaultFilters,
      setFilter: (key, value) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        }));
        get().applyFilters();
      },
      resetFilters: () => {
        set({ filters: defaultFilters });
        get().applyFilters();
      },
      applyFilters: () => {
        const { filters, clinics, activeChildIds, childProfiles, registrations } = get();
        let result = [...clinics];

        // Search (with basic fuzzy tolerance — ignores extra spaces, case)
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase().trim();
          const words = q.split(/\s+/);
          result = result.filter((c) => {
            const haystack = [
              c.name,
              c.description,
              c.location.city,
              c.location.country,
              c.location.state,
              c.location.venue,
              ...c.tags,
              ...c.coaches.map((coach) => coach.name),
            ]
              .join(' ')
              .toLowerCase();
            return words.every((w) => haystack.includes(w));
          });
        }

        // Date range
        if (filters.dateRange.start) {
          result = result.filter((c) => c.dates.end >= filters.dateRange.start!);
        }
        if (filters.dateRange.end) {
          result = result.filter((c) => c.dates.start <= filters.dateRange.end!);
        }

        // Age groups
        if (filters.ageGroups.length > 0) {
          result = result.filter((c) =>
            c.ageGroups.some((ag) => filters.ageGroups.includes(ag) || ag === 'all')
          );
        }

        // Skill levels
        if (filters.skillLevels.length > 0) {
          result = result.filter((c) =>
            c.skillLevels.some((sl) => filters.skillLevels.includes(sl) || sl === 'all')
          );
        }

        // Clinic types
        if (filters.clinicTypes.length > 0) {
          result = result.filter((c) => filters.clinicTypes.includes(c.type));
        }

        // Country
        if (filters.country) {
          result = result.filter((c) => c.location.country === filters.country);
        }

        // Max price
        if (filters.maxPrice !== null && filters.maxPrice > 0) {
          result = result.filter((c) => c.price.amount <= filters.maxPrice! || c.price.amount === 0);
        }

        // Goalie-specific: when goalieOnly is ON, show only goalie clinics
        if (filters.goalieOnly) {
          result = result.filter((c) => {
            const text = `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase();
            return text.includes('goalie') || text.includes('goaltend') || text.includes('goaltending') || text.includes('netminder');
          });
        }

        // Auto-filter: when all active children are players (not goalies), hide goalie-specific clinics
        // This prevents recommending goalie clinics to kids who are players
        if (!filters.goalieOnly && activeChildIds.length > 0) {
          const activeKids = childProfiles.filter((c) => activeChildIds.includes(c.id));
          const allPlayers = activeKids.length > 0 && activeKids.every((c) => c.position === 'player');
          if (allPlayers) {
            result = result.filter((c) => {
              const text = `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase();
              // Only exclude clinics that are specifically goalie-focused
              const isGoalieOnly =
                (text.includes('goalie') || text.includes('goaltend') || text.includes('goaltending') || text.includes('netminder')) &&
                !text.includes('skater') && !text.includes('player') && !text.includes('all positions');
              return !isGoalieOnly;
            });
          }
        }

        // Exclude clinics the kids are already registered for
        // Registered clinics shouldn't show up as recommendations
        if (registrations.length > 0) {
          const activeRegs = registrations.filter((r) => r.status !== 'cancelled');
          if (activeRegs.length > 0) {
            result = result.filter((c) => {
              const clinicName = c.name.toLowerCase();
              return !activeRegs.some((r) => {
                const regName = r.clinicName.toLowerCase();
                // Fuzzy match: check if first 20 chars of either match
                return regName.includes(clinicName.slice(0, 20)) ||
                  clinicName.includes(regName.slice(0, 20));
              });
            });
          }
        }

        // Spots available
        if (filters.spotsAvailable) {
          result = result.filter((c) => c.spotsRemaining > 0);
        }

        // Featured
        if (filters.featured) {
          result = result.filter((c) => c.featured);
        }

        // Sort
        result.sort((a, b) => {
          let comparison = 0;
          switch (filters.sortBy) {
            case 'date':
              comparison = a.dates.start.localeCompare(b.dates.start);
              break;
            case 'price':
              comparison = a.price.amount - b.price.amount;
              break;
            case 'rating':
              comparison = b.rating - a.rating;
              break;
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'distance': {
              const loc = get().getEffectiveLocation();
              if (loc) {
                const distA = calculateDistance(loc.lat, loc.lng, a.location.lat, a.location.lng);
                const distB = calculateDistance(loc.lat, loc.lng, b.location.lat, b.location.lng);
                comparison = distA - distB;
              } else {
                comparison = a.dates.start.localeCompare(b.dates.start);
              }
              break;
            }
          }
          return filters.sortOrder === 'asc' ? comparison : -comparison;
        });

        set({ filteredClinics: result });
      },
      activeFilterCount: () => {
        const { filters } = get();
        let count = 0;
        if (filters.dateRange.start || filters.dateRange.end) count++;
        if (filters.ageGroups.length > 0) count++;
        if (filters.skillLevels.length > 0) count++;
        if (filters.clinicTypes.length > 0) count++;
        if (filters.country) count++;
        if (filters.maxPrice !== null && filters.maxPrice > 0) count++;
        if (filters.goalieOnly) count++;
        if (filters.spotsAvailable) count++;
        if (filters.featured) count++;
        return count;
      },

      // Search
      searchQuery: '',
      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().setFilter('searchQuery', query);
      },
      recentSearches: [],
      addRecentSearch: (query) => {
        if (!query.trim()) return;
        set((state) => ({
          recentSearches: [
            query,
            ...state.recentSearches.filter((s) => s !== query),
          ].slice(0, 10),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),

      // Favorites
      favoriteIds: [],
      toggleFavorite: (clinicId) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(clinicId)
            ? state.favoriteIds.filter((id) => id !== clinicId)
            : [...state.favoriteIds, clinicId],
        })),
      isFavorite: (clinicId) => get().favoriteIds.includes(clinicId),

      // Notifications
      notifications: [],
      unreadCount: 0,
      markAsRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        }),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      addNotification: (notification) =>
        set((state) => {
          const newNotif: NotificationItem = {
            ...notification,
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          return {
            notifications: [newNotif, ...state.notifications].slice(0, 100),
            unreadCount: state.unreadCount + 1,
          };
        }),

      // Child Profiles
      childProfiles: [],
      activeChildIds: [],
      addChildProfile: (profile) => {
        set((state) => {
          const newProfile: ChildProfile = {
            ...profile,
            id: `child-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            createdAt: new Date().toISOString(),
          };
          const profiles = [...state.childProfiles, newProfile];
          return {
            childProfiles: profiles,
            // Auto-set as active if it's the first child
            activeChildIds: state.childProfiles.length === 0 ? [newProfile.id] : state.activeChildIds,
          };
        });
        // Re-apply filters (goalie/player position affects which clinics show)
        setTimeout(() => get().applyFilters(), 0);
      },
      updateChildProfile: (id, updates) => {
        set((state) => ({
          childProfiles: state.childProfiles.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
        // Re-apply filters when position or division changes
        setTimeout(() => get().applyFilters(), 0);
      },
      removeChildProfile: (id) => {
        set((state) => ({
          childProfiles: state.childProfiles.filter((c) => c.id !== id),
          activeChildIds: state.activeChildIds.filter((cid) => cid !== id),
        }));
        setTimeout(() => get().applyFilters(), 0);
      },
      toggleActiveChild: (id) => {
        set((state) => {
          const isActive = state.activeChildIds.includes(id);
          return {
            activeChildIds: isActive
              ? state.activeChildIds.filter((cid) => cid !== id)
              : [...state.activeChildIds, id],
          };
        });
        setTimeout(() => get().applyFilters(), 0);
      },
      setActiveChildren: (ids) => {
        set({ activeChildIds: ids });
        setTimeout(() => get().applyFilters(), 0);
      },
      getActiveChildAgeGroups: () => {
        const state = get();
        if (state.activeChildIds.length === 0) return [];
        const ageGroups: AgeGroup[] = [];
        for (const id of state.activeChildIds) {
          const child = state.childProfiles.find((c) => c.id === id);
          if (child) {
            // Use currentDivision override if set, otherwise compute from DOB
            const ag = child.currentDivision || getAgeGroupFromDOB(child.dateOfBirth);
            if (!ageGroups.includes(ag)) ageGroups.push(ag);
          }
        }
        return ageGroups;
      },

      // Registrations
      registrations: [],
      addRegistration: (reg) => {
        set((state) => ({
          registrations: [
            {
              ...reg,
              id: `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              registeredAt: new Date().toISOString(),
            },
            ...state.registrations,
          ],
        }));
        // Re-filter: registered clinics get excluded from recommendations
        setTimeout(() => get().applyFilters(), 0);
      },
      updateRegistration: (id, updates) => {
        set((state) => ({
          registrations: state.registrations.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
        setTimeout(() => get().applyFilters(), 0);
      },
      removeRegistration: (id) => {
        set((state) => ({
          registrations: state.registrations.filter((r) => r.id !== id),
        }));
        setTimeout(() => get().applyFilters(), 0);
      },

      // DaySmart / Dash
      daySmartConfig: {
        email: '',
        password: '',
        facilityId: '',
        facilityName: '',
        connected: false,
        lastSync: null,
        familyMembers: [],
        customerIds: [],
      },
      setDaySmartConfig: (config) =>
        set((state) => ({
          daySmartConfig: { ...state.daySmartConfig, ...config },
        })),
      daySmartSyncing: false,
      setDaySmartSyncing: (syncing) => set({ daySmartSyncing: syncing }),

      // IceHockeyPro
      iceHockeyProConfig: {
        email: '',
        password: '',
        connected: false,
        lastSync: null,
        playerName: '',
        linkedChildIds: [],
      },
      setIceHockeyProConfig: (config) =>
        set((state) => ({
          iceHockeyProConfig: { ...state.iceHockeyProConfig, ...config },
        })),

      // Email scanning
      emailScanConfig: {
        provider: 'none',
        connected: false,
        lastScan: null,
        scanFrequency: 'daily',
      },
      setEmailScanConfig: (config) =>
        set((state) => ({
          emailScanConfig: { ...state.emailScanConfig, ...config },
        })),

      // Settings
      notificationsEnabled: true,
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      locationEnabled: false,
      setLocationEnabled: (enabled) => set({ locationEnabled: enabled }),
      userLocation: null,
      setUserLocation: (loc) => set({ userLocation: loc }),
      homeLocation: null,
      setHomeLocation: (loc) => set({ homeLocation: loc }),
      getEffectiveLocation: () => {
        const state = get();
        if (state.userLocation) return state.userLocation;
        if (state.homeLocation) return { lat: state.homeLocation.lat, lng: state.homeLocation.lng };
        return null;
      },
      preferredCurrency: 'USD',
      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),
      apiKeys: {
        googleApiKey: '',
        googleCseId: '',
        braveApiKey: '',
        tavilyApiKey: '',
        eventbriteApiKey: '',
      },
      setApiKey: (key, value) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [key]: value },
        })),
      autoRefreshInterval: 30,
      setAutoRefreshInterval: (minutes) => set({ autoRefreshInterval: minutes }),

      // Color mode
      colorMode: 'dark',
      setColorMode: (mode) => set({ colorMode: mode }),

      // Theme / Branding
      teamThemeId: 'default',
      setTeamTheme: (teamId) => set({ teamThemeId: teamId }),

      // UI
      isFilterOpen: false,
      setFilterOpen: (open) => set({ isFilterOpen: open }),
      isSearchOpen: false,
      setSearchOpen: (open) => set({ isSearchOpen: open }),
    }),
    {
      name: 'hockey-clinics-storage',
      version: 8,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          const oldKeys = state.apiKeys as Record<string, string> | undefined;
          state.apiKeys = {
            googleApiKey: oldKeys?.googleApiKey || '',
            googleCseId: oldKeys?.googleCseId || '',
            braveApiKey: oldKeys?.braveApiKey || '',
            tavilyApiKey: oldKeys?.tavilyApiKey || '',
            eventbriteApiKey: oldKeys?.eventbriteApiKey || '',
          };
        }
        if (version < 3) {
          delete state.liveBarnConfig;
          if (!state.colorMode) {
            state.colorMode = 'dark';
          }
        }
        if (version < 4) {
          // Clear fake/demo registrations from simulated integration syncs
          const regs = state.registrations as Array<Record<string, unknown>> | undefined;
          if (regs && regs.length > 0) {
            state.registrations = regs.filter((r) => {
              const src = r.source as string;
              if (src === 'dash' || src === 'icehockeypro') return false;
              return true;
            });
          }
          // Reset integration connection status
          if (state.daySmartConfig) {
            (state.daySmartConfig as Record<string, unknown>).connected = false;
            (state.daySmartConfig as Record<string, unknown>).lastSync = null;
          }
          if (state.iceHockeyProConfig) {
            (state.iceHockeyProConfig as Record<string, unknown>).connected = false;
            (state.iceHockeyProConfig as Record<string, unknown>).lastSync = null;
          }
        }
        if (version < 5) {
          // Add new fields to DaySmartConfig for universal facility support
          if (state.daySmartConfig) {
            const dsc = state.daySmartConfig as Record<string, unknown>;
            if (!dsc.familyMembers) dsc.familyMembers = [];
            if (!dsc.customerIds) dsc.customerIds = [];
            if (!dsc.facilityName) dsc.facilityName = '';
          }
        }
        if (version < 6) {
          // Clear stale stub facilityIds that don't exist on DaySmart
          if (state.daySmartConfig) {
            const dsc = state.daySmartConfig as Record<string, unknown>;
            const fid = dsc.facilityId as string;
            // Old stub IDs like "baptist-iceplex-fl" are not valid DaySmart slugs
            if (fid && fid.includes('-') && fid.length > 20) {
              dsc.facilityId = '';
              dsc.facilityName = '';
              dsc.connected = false;
              dsc.lastSync = null;
              dsc.familyMembers = [];
              dsc.customerIds = [];
            }
          }
        }
        if (version < 7) {
          // Remove ALL old demo/seed registrations — they have clinicId starting with "seed-"
          // or are leftover fake registrations from before real integrations existed
          const regs = state.registrations as Array<Record<string, unknown>> | undefined;
          if (regs && regs.length > 0) {
            state.registrations = regs.filter((r) => {
              const cid = (r.clinicId as string) || '';
              const venue = (r.venue as string) || '';
              // Remove seed clinic registrations
              if (cid.startsWith('seed-')) return false;
              // Remove any with isDemo flag
              if (r.isDemo) return false;
              // Remove leftover hardcoded demo registrations (Baptist Health IcePlex / Panthers IceDen)
              if (venue.includes('Baptist Health IcePlex') || venue.includes('Panthers IceDen')) {
                const src = r.source as string;
                if (src === 'manual') return false;
              }
              return true;
            });
          }
        }
        if (version < 8) {
          // Nuclear cleanup: remove ALL demo registrations unconditionally.
          // Previous v7 migration was too restrictive (only removed source==='manual').
          // This time we match by venue OR clinicName — no source check.
          const regs = state.registrations as Array<Record<string, unknown>> | undefined;
          if (regs && regs.length > 0) {
            state.registrations = regs.filter((r) => {
              const cid = (r.clinicId as string) || '';
              const venue = ((r.venue as string) || '').toLowerCase();
              const clinicName = ((r.clinicName as string) || '').toLowerCase();
              // Remove seed clinic registrations
              if (cid.startsWith('seed-')) return false;
              // Remove any with isDemo flag
              if (r.isDemo) return false;
              // Remove ALL registrations from demo venues — no source check
              if (venue.includes('baptist health iceplex') || venue.includes('panthers iceden')) return false;
              // Remove known demo clinic names
              if (clinicName.includes('spring break hockey camp')) return false;
              if (clinicName.includes('power skating clinic')) return false;
              if (clinicName.includes('learn to skate')) return false;
              if (clinicName.includes('elite summer hockey')) return false;
              if (clinicName.includes('max ivanov spring skills')) return false;
              return true;
            });
          }
        }
        return state;
      },
      partialize: (state) => ({
        favoriteIds: state.favoriteIds,
        recentSearches: state.recentSearches,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        notificationsEnabled: state.notificationsEnabled,
        locationEnabled: state.locationEnabled,
        homeLocation: state.homeLocation,
        preferredCurrency: state.preferredCurrency,
        apiKeys: state.apiKeys,
        autoRefreshInterval: state.autoRefreshInterval,
        filters: state.filters,
        lastUpdated: state.lastUpdated,
        registrations: state.registrations,
        daySmartConfig: state.daySmartConfig,
        colorMode: state.colorMode,
        teamThemeId: state.teamThemeId,
        childProfiles: state.childProfiles,
        activeChildIds: state.activeChildIds,
        iceHockeyProConfig: state.iceHockeyProConfig,
        emailScanConfig: state.emailScanConfig,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.clinics.length > 0) {
          setTimeout(() => state.applyFilters(), 0);
        }
      },
    }
  )
);
